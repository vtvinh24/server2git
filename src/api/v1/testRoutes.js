const express = require("express");
const router = express.Router();
const repoManager = require("#logic/repoManager.js");
const logger = require("#utils/logger.js");
const fs = require("fs");
const path = require("path");
// GET /github-repos - List all repos in the org with all possible fields
router.get("/github-repos", async (req, res) => {
  if (!APP_ID || !privateKey || !ORG) {
    logger.error("Missing GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY_PATH, or GITHUB_ORG in environment.");
    return res.status(500).json({
      success: false,
      error: "Missing GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY_PATH, or GITHUB_ORG in environment.",
    });
  }
  try {
    const repos = await repoManager.listReposInOrg({ org: ORG, appId: APP_ID, privateKey });
    res.json(repos);
  } catch (err) {
    logger.error("Failed to fetch repos: " + err.message);
    res.status(500).json({ error: err.message });
  }
});
const APP_ID = process.env.GITHUB_APP_ID;
const PRIVATE_KEY_PATH = process.env.GITHUB_APP_PRIVATE_KEY_PATH;
const ORG = process.env.GITHUB_ORG;

let privateKey = null;
try {
  privateKey = fs.readFileSync(path.resolve(PRIVATE_KEY_PATH), "utf8");
} catch (e) {
  logger.error("Failed to read GitHub App private key: " + e.message);
}

router.get("/github-connection", async (req, res) => {
  if (!APP_ID || !privateKey || !ORG) {
    logger.error("Missing GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY_PATH, or GITHUB_ORG in environment.");
    return res.status(500).json({
      success: false,
      error: "Missing GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY_PATH, or GITHUB_ORG in environment.",
    });
  }
  try {
    const orgInfo = await repoManager.getOrgInfo({ org: ORG, appId: APP_ID, privateKey });
    logger.info(`GitHub org info fetched for ${ORG}`);
    res.json({ success: true, org: orgInfo });
  } catch (error) {
    logger.error("GitHub connection test failed: " + error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
