const express = require("express");
const router = express.Router();
const logger = require("#utils/logger.js");
// ...existing code...
const multer = require("multer");
const path = require("path");
const { addProblem, getProblemById, problemsDir } = require("#logic/problemManager.js");
const repoManager = require("#logic/repoManager.js");
const fs = require("fs");
const AdmZip = require("adm-zip");
const os = require("os");
const { v4: uuidv4 } = require("uuid");

const upload = multer({ dest: path.join(problemsDir, "uploads") });

// Create a new problem
router.post("/", upload.single("source"), async (req, res) => {
  const { title, statement } = req.body;
  if (!title || !statement || !req.file) {
    return res.status(400).json({ error: "title, statement, and source (zip) required" });
  }

  // Create GitHub repo in org

  // Generate id early so it's available for metadata even if repo creation fails
  const id = Date.now().toString();

  let repoUrl;
  let submissionRepoUrl;
  try {
    const org = process.env.GITHUB_ORG;
    const appId = process.env.GITHUB_APP_ID;
    const privateKey = fs.readFileSync(process.env.GITHUB_APP_PRIVATE_KEY_PATH, "utf8");

    // Save uploaded zip to permanent problems dir first
    const filePath = path.join(problemsDir, `${id}.zip`);
    fs.renameSync(req.file.path, filePath);

    // Unzip into a temporary directory
    const tmpBase = path.join(process.cwd(), "data", "problems", "uploads");
    if (!fs.existsSync(tmpBase)) fs.mkdirSync(tmpBase, { recursive: true });
    const tmpDir = path.join(tmpBase, uuidv4());
    fs.mkdirSync(tmpDir);
    const zip = new AdmZip(filePath);
    zip.extractAllTo(tmpDir, true);

    // Create README.md from statement and write into extracted directory
    const readme = `# ${title}\n\n${statement}\n`;
    const readmePath = path.join(tmpDir, "README.md");
    fs.writeFileSync(readmePath, readme, "utf8");

    // Determine tags from env or REPO_PREFIX
    const tags = process.env.REPO_TOPICS ? process.env.REPO_TOPICS.split(",") : undefined;

    // Sanitize repo name: replace spaces and unsafe chars with hyphens
    const prefix = process.env.REPO_PREFIX || "repo";
    const slug = `${prefix}-${title}`
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/(^-|-$)/g, "");

    // Determine if repo should be private
    const privateRepo = (process.env.REPO_PRIVATE || "false").toLowerCase() === "true";

    // Create host (private) and submission (public) repos using repoManager.createProblemRepos
    const hostRepoName = `${slug}-host`;
    const submissionRepoName = `${slug}-submission`;
    logger.info(`Creating host repo '${hostRepoName}' and submission repo '${submissionRepoName}'`);
    const result = await repoManager.createProblemRepos({
      appId,
      privateKey,
      owner: org,
      hostRepoName,
      submissionRepoName,
      filesDir: tmpDir,
      description: statement,
      defaultBranch: "main",
      isOrg: true,
    });
    repoUrl = result && result.hostRepoUrl;
    submissionRepoUrl = result && result.submissionRepoUrl;
  } catch (err) {
    logger.error(`GitHub repo creation failed: ${err.message}`);
    return res.status(500).json({ error: "GitHub repo creation failed", details: err.message });
  }

  // Store metadata, file path and repo URL
  addProblem({ id, title, statement, file: `${id}.zip`, repoUrl, submissionRepoUrl });
  logger.info(`Problem created: ${id} (${title})`);
  res.status(201).json({ id, title, statement });
});

// Read a problem
router.get("/:id", (req, res) => {
  const problem = getProblemById(req.params.id);
  if (!problem) {
    logger.warn(`Problem not found: ${req.params.id}`);
    return res.status(404).json({ error: "Not found" });
  }
  const fileUrl = `/api/v1/problems/${problem.id}/file`;
  res.json({ title: problem.title, statement: problem.statement, file: fileUrl });
});

// Download/view problem file
router.get("/:id/file", (req, res) => {
  const problem = getProblemById(req.params.id);
  if (!problem) return res.status(404).json({ error: "Not found" });
  const filePath = path.join(problemsDir, problem.file);
  if (!fs.existsSync(filePath)) {
    logger.warn(`Problem file not found: ${filePath}`);
    return res.status(404).json({ error: "File not found" });
  }
  res.download(filePath, `${problem.title}.zip`);
});

module.exports = router;
