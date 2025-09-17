const { Octokit } = require("@octokit/rest");
const { createAppAuth } = require("@octokit/auth-app");
const fs = require("fs").promises;
const path = require("path");
const logger = require("#utils/logger.js");

/**
 * Get Octokit authenticated as GitHub App
 */
function getAppOctokit(appId, privateKey) {
  return new Octokit({
    authStrategy: createAppAuth,
    auth: { appId, privateKey },
  });
}

/**
 * Get installation for org or user
 */
async function getInstallationForAccount(appOctokit, account) {
  logger.info(`[repoManager] fetching app installations for account lookup: ${account}`);
  const installations = await appOctokit.request("GET /app/installations");
  logger.info(`[repoManager] fetched ${installations.data.length} installations`);
  const found = installations.data.find((inst) => inst.account && inst.account.login === account);
  logger.info(`[repoManager] installation for ${account}: ${found ? found.id : "not found"}`);
  return found;
}

/**
 * Get Octokit authenticated as installation
 */
async function getInstallationOctokit(appId, privateKey, installationId) {
  logger.info(`[repoManager] creating installation auth for installationId=${installationId}`);
  const auth = createAppAuth({ appId, privateKey });
  const installationAuth = await auth({
    type: "installation",
    installationId,
  });
  logger.info(`[repoManager] obtained installation token (masked) for installationId=${installationId}`);
  const oct = new Octokit({ auth: installationAuth.token });
  // attach token for flows that need to push via HTTPS (simple-git)
  oct.token = installationAuth.token;
  return oct;
}

/**
 * Recursively walk a directory and return all file paths
 */
async function walkDir(dir, baseDir = dir) {
  let results = [];
  logger.debug(`[repoManager] reading directory: ${dir}`);
  const list = await fs.readdir(dir, { withFileTypes: true });
  logger.debug(`[repoManager] read ${list.length} entries from ${dir}`);
  for (const file of list) {
    const filePath = path.join(dir, file.name);
    if (file.isDirectory()) {
      logger.debug(`[repoManager] descending into directory: ${filePath}`);
      results = results.concat(await walkDir(filePath, baseDir));
    } else {
      results.push(path.relative(baseDir, filePath));
    }
  }
  logger.debug(`[repoManager] discovered ${results.length} files under ${dir}`);
  return results;
}

/**
 * Create a new repo and populate it with files from a directory as the very first commit (no auto_init).
 * Handles org and user repos, and works even if repo is completely empty.
 * @param {Object} params
 * @param {string} params.appId - GitHub App ID
 * @param {string} params.privateKey - GitHub App private key (PEM string)
 * @param {string} params.owner - Repo owner (org or user login)
 * @param {string} params.repo - New repo name
 * @param {string} params.filesDir - Path to directory containing files to upload
 * @param {string} [params.description] - Repo description
 * @param {boolean} [params.privateRepo] - Should the repo be private?
 * @param {string} [params.defaultBranch] - The default branch to create, default "main"
 * @param {boolean} [params.isOrg] - If true, use createInOrg. If false, use createForAuthenticatedUser.
 */
async function createRepoWithFiles({ appId, privateKey, owner, repo, filesDir, description = "", privateRepo = false, defaultBranch = "main", isOrg = true }) {
  // Step 1: Authenticate as App and Installation
  const appOctokit = getAppOctokit(appId, privateKey);
  logger.info(`[repoManager] looking up installation for owner=${owner}`);
  const installation = await getInstallationForAccount(appOctokit, owner);
  logger.info(`[repoManager] installation lookup result: ${installation ? installation.id : "none"}`);
  if (!installation) {
    throw new Error(`No installation found for ${owner}`);
  }
  logger.info(`[repoManager] creating octokit for installation id=${installation.id}`);
  const installationOctokit = await getInstallationOctokit(appId, privateKey, installation.id);
  logger.info(`[repoManager] installation octokit created for installation id=${installation.id}`);

  // Step 2: Create the repo (empty, no branches)
  if (isOrg) {
    logger.info(`[repoManager] creating repo ${owner}/${repo} in org (auto_init=true)`);
    const createResp = await installationOctokit.repos.createInOrg({
      org: owner,
      name: repo,
      description,
      private: privateRepo,
      // create an initial commit so repo is not completely empty; avoids the 409 "Git Repo is empty" in subsequent git API calls
      auto_init: true,
      // for orgs, be explicit about visibility when creating public repos
      ...(privateRepo ? {} : { visibility: "public" }),
    });
    logger.info(`[repoManager] created repo ${createResp.data.full_name}`);
  } else {
    logger.info(`[repoManager] creating repo ${repo} for authenticated user (auto_init=true)`);
    const createResp = await installationOctokit.repos.createForAuthenticatedUser({
      name: repo,
      description,
      private: privateRepo,
      auto_init: true,
    });
    logger.info(`[repoManager] created repo ${createResp.data.full_name}`);
  }

  // Wait a short moment to allow GitHub to fully initialize the repo
  logger.debug("[repoManager] sleeping 1200ms to allow GitHub to initialize the repo");
  await new Promise((r) => setTimeout(r, 1200));
  logger.debug("[repoManager] resume after sleep");

  // New flow: use simple-git to clone the repo locally, copy files respecting .gitignore, commit and push
  logger.info(`[repoManager] preparing to push files via git for ${owner}/${repo}`);
  try {
    const fsExtra = require("fs-extra");
    const os = require("os");
    const crypto = require("crypto");
    const simpleGit = require("simple-git");
    const Ignore = require("ignore");

    // create a temporary directory for the clone
    const tmpDir = path.join(os.tmpdir(), `repo-${crypto.randomBytes(6).toString("hex")}`);
    logger.debug(`[repoManager] creating tmp dir ${tmpDir}`);
    await fsExtra.mkdirp(tmpDir);

    // Build an HTTPS URL that includes the token for push access
    // Note: token in the URL is fine for short-lived internal use, but avoid logging it
    const repoUrl = `https://x-access-token:${installationOctokit.token}@github.com/${owner}/${repo}.git`;
    logger.info(`[repoManager] cloning ${owner}/${repo} into ${tmpDir} (using installation token)`);
    const git = simpleGit(tmpDir);
    await git.clone(repoUrl, tmpDir);
    logger.info(`[repoManager] clone complete`);

    // Load .gitignore from source filesDir if present
    const ig = Ignore();
    try {
      const gitignorePath = path.join(filesDir, ".gitignore");
      const gtxt = await fsExtra.readFile(gitignorePath, "utf8");
      ig.add(gtxt);
      logger.info(`[repoManager] loaded .gitignore from ${gitignorePath}`);
    } catch (gerr) {
      logger.debug(`[repoManager] no .gitignore found at ${filesDir}, continuing without ignore`);
    }

    // Copy files while respecting .gitignore
    const files = await walkDir(filesDir);
    for (const rel of files) {
      if (ig.ignores(rel)) {
        logger.debug(`[repoManager] ignoring ${rel} per .gitignore`);
        continue;
      }
      const src = path.join(filesDir, rel);
      const dest = path.join(tmpDir, rel);
      await fsExtra.mkdirp(path.dirname(dest));
      await fsExtra.copyFile(src, dest);
      logger.debug(`[repoManager] copied ${src} -> ${dest}`);
    }

    // Commit & push
    await git.cwd(tmpDir);
    await git.add(".");
    await git.commit("Add repository files from template");
    logger.info(`[repoManager] committing changes and pushing to ${defaultBranch}`);
    await git.push("origin", defaultBranch);
    logger.info(`[repoManager] push complete`);

    // cleanup
    await fsExtra.remove(tmpDir);
    logger.debug(`[repoManager] removed tmp dir ${tmpDir}`);
  } catch (sgErr) {
    logger.warn(`[repoManager] simple-git flow failed: ${sgErr.message}. Falling back to contents API flow.`);
    // fallback to previous contents API flow
    // Helper: get current commit and tree for branch if it exists (fallback)
    async function getCurrentCommitAndTreeFallback(ownerParam, repoParam, branch) {
      try {
        const { data: refData } = await installationOctokit.git.getRef({
          owner: ownerParam,
          repo: repoParam,
          ref: `heads/${branch}`,
        });
        const commitSha = refData.object.sha;
        const { data: commitData } = await installationOctokit.git.getCommit({
          owner: ownerParam,
          repo: repoParam,
          commit_sha: commitSha,
        });
        return { commitSha, treeSha: commitData.tree.sha };
      } catch (e) {
        return { commitSha: null, treeSha: null };
      }
    }

    // contents API fallback (create blobs/tree/commit)
    const filePaths = await walkDir(filesDir);
    const blobs = [];
    for (const filePath of filePaths) {
      const absPath = path.join(filesDir, filePath);
      let content,
        encoding = "utf-8";
      try {
        content = await fs.readFile(absPath, "utf8");
      } catch (e) {
        content = (await fs.readFile(absPath)).toString("base64");
        encoding = "base64";
      }
      const blob = await installationOctokit.git.createBlob({
        owner,
        repo,
        content,
        encoding,
      });
      blobs.push({ sha: blob.data.sha, path: filePath.replace(/\\/g, "/"), mode: "100644", type: "blob" });
    }
    const { commitSha: existingCommitSha, treeSha: existingTreeSha } = await getCurrentCommitAndTreeFallback(owner, repo, defaultBranch);
    const tree = blobs.map((b) => ({ path: b.path, mode: b.mode, type: b.type, sha: b.sha }));
    const createTreeParams = { owner, repo, tree };
    if (existingTreeSha) createTreeParams.base_tree = existingTreeSha;
    const { data: treeData } = await installationOctokit.git.createTree(createTreeParams);
    const commitParams = { owner, repo, message: "Initial commit", tree: treeData.sha, parents: [] };
    if (existingCommitSha) commitParams.parents = [existingCommitSha];
    const { data: commitData } = await installationOctokit.git.createCommit(commitParams);
    try {
      await installationOctokit.git.updateRef({ owner, repo, ref: `heads/${defaultBranch}`, sha: commitData.sha, force: false });
    } catch (e) {
      await installationOctokit.git.createRef({ owner, repo, ref: `refs/heads/${defaultBranch}`, sha: commitData.sha });
    }
  }

  // Step 8: Optionally set default branch (not needed if first ref, but for extra safety)
  logger.info(`[repoManager] setting default branch to ${defaultBranch}`);
  const updateResp = await installationOctokit.repos.update({
    owner,
    repo,
    default_branch: defaultBranch,
  });
  logger.info(`[repoManager] updated repo settings for ${updateResp.data.full_name}`);

  return { repoUrl: `https://github.com/${owner}/${repo}` };
}

/**
 * Get installation for org
 */
async function getInstallationForOrg(appOctokit, org) {
  const installations = await appOctokit.request("GET /app/installations");
  return installations.data.find((inst) => inst.account && inst.account.login === org);
}

module.exports = {
  createRepoWithFiles,
  // createProblemRepos creates two repos:
  // - host repo (private) populated with the whole problem package at `filesDir`
  // - submission repo (public) populated with the `source/` directory and a workflow at .github/workflows/deploy.yml
  createProblemRepos,
  getAppOctokit,
  getInstallationForAccount,
  getInstallationOctokit,
  getInstallationForOrg,
  walkDir,
};

/**
 * Create host + submission repos for a problem.
 * - host repo is private and contains the whole package at `filesDir`.
 * - submission repo is public and contains only the `source/` folder plus a workflow copied from filesDir/deploy.yml to .github/workflows/deploy.yml
 */
async function createProblemRepos({ appId, privateKey, owner, hostRepoName, submissionRepoName, filesDir, description = "", defaultBranch = "main", isOrg = true }) {
  // Create host repo (private) with full package
  logger.info(`[repoManager] creating host repo ${owner}/${hostRepoName} (private)`);
  await createRepoWithFiles({ appId, privateKey, owner, repo: hostRepoName, filesDir, description, privateRepo: true, defaultBranch, isOrg });

  // Prepare submission package (source/ + deploy workflow)
  const fsExtra = require("fs-extra");
  const os = require("os");
  const crypto = require("crypto");
  const tmpDir = path.join(os.tmpdir(), `submission-${crypto.randomBytes(6).toString("hex")}`);
  logger.debug(`[repoManager] preparing submission tempdir ${tmpDir}`);
  await fsExtra.mkdirp(tmpDir);

  // Copy source/ if present
  const sourceDir = path.join(filesDir, "source");
  try {
    const stat = await fs.stat(sourceDir).catch(() => null);
    if (stat && stat.isDirectory()) {
      await fsExtra.copy(sourceDir, tmpDir);
      logger.info(`[repoManager] copied source/ into submission package`);
    } else {
      logger.warn(`[repoManager] no source/ directory found in ${filesDir}; submission repo will contain only workflow`);
    }
  } catch (e) {
    logger.warn(`[repoManager] error copying source/: ${e.message}`);
  }

  // Copy deploy.yml (if present) into .github/workflows/deploy.yml in submission package
  try {
    const deployPath = path.join(filesDir, "deploy.yml");
    const deployContent = await fsExtra.readFile(deployPath, "utf8");
    const workflowsDir = path.join(tmpDir, ".github", "workflows");
    await fsExtra.mkdirp(workflowsDir);
    await fsExtra.writeFile(path.join(workflowsDir, "deploy.yml"), deployContent, "utf8");
    logger.info(`[repoManager] copied deploy.yml into submission package at .github/workflows/deploy.yml`);
  } catch (e) {
    logger.warn(`[repoManager] no deploy.yml found in ${filesDir}; submission repo will not include a deploy workflow`);
  }

  // Create submission repo (public) with the prepared tmpDir contents
  logger.info(`[repoManager] creating submission repo ${owner}/${submissionRepoName} (public)`);
  try {
    await createRepoWithFiles({ appId, privateKey, owner, repo: submissionRepoName, filesDir: tmpDir, description: `${description} (submission template)`, privateRepo: false, defaultBranch, isOrg });
  } catch (e) {
    logger.error(`[repoManager] failed to create submission repo ${owner}/${submissionRepoName}: ${e.message}`);
    // rethrow so callers can handle
    throw e;
  }

  // Verify submission repo exists via installation octokit
  try {
    const appOct = getAppOctokit(appId, privateKey);
    const installation = await getInstallationForAccount(appOct, owner);
    const instOct = await getInstallationOctokit(appId, privateKey, installation.id);
    const repoInfo = await instOct.repos.get({ owner, repo: submissionRepoName });
    logger.info(`[repoManager] verified submission repo exists: ${repoInfo.data.full_name}`);
  } catch (verifyErr) {
    logger.warn(`[repoManager] verification of submission repo failed: ${verifyErr.message}`);
  }

  // cleanup
  await fsExtra.remove(tmpDir);
  logger.debug(`[repoManager] removed submission tempdir ${tmpDir}`);

  return {
    hostRepoUrl: `https://github.com/${owner}/${hostRepoName}`,
    submissionRepoUrl: `https://github.com/${owner}/${submissionRepoName}`,
  };
}
