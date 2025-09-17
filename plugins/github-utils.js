const fs = require("fs");
const path = require("path");
const https = require("https");
const logger = require("#utils/logger.js");
const repoManager = require("#logic/repoManager.js");
const GITIGNORE_PATH = process.env.GITIGNORE_PATH || path.join(process.cwd(), "data/templates/gitignore.json");
const GITHUB_API_URL = process.env.GITHUB_GITIGNORE_API_URL || "https://api.github.com/gitignore/templates";

/**
 * This plugin checks GitHub App authentication and permissions on startup.
 * And also fetch .gitignore templates if not present.
 *
 * Exports a plugin object with `file` and `enabled` so the plugin loader in
 * `src/index.js` can discover and manage it like the others.
 */

let activeRequest = null; // reference to an ongoing https request so we can abort it

async function checkPermissions() {
  const org = process.env.GITHUB_ORG;
  const appId = process.env.GITHUB_APP_ID;
  const privateKeyPath = process.env.GITHUB_APP_PRIVATE_KEY_PATH;

  if (!org || !appId || !privateKeyPath) {
    logger.warn("GitHub App permission check skipped: missing GITHUB_ORG, GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY_PATH");
    return;
  }

  let privateKey;
  try {
    privateKey = fs.readFileSync(privateKeyPath, "utf8");
  } catch (err) {
    logger.warn(`GitHub App permission check skipped: could not read private key: ${err.message}`);
    return;
  }

  try {
    const appOctokit = repoManager.getAppOctokit(appId, privateKey);
    const installation = await repoManager.getInstallationForOrg(appOctokit, org);
    if (!installation) {
      logger.warn(`GitHub App is not installed on org '${org}'. Please install the app with correct permissions.`);
      return;
    }

    const perms = installation.permissions || {};
    const contents = perms.contents; // may be 'read', 'write', or undefined
    if (!contents || (contents !== "write" && contents !== "read")) {
      logger.error(`GitHub App installation for org '${org}' does not have 'contents' permission (found: ${JSON.stringify(perms)})`);
      logger.error("Repository contents permission is required to populate repositories.");
      logger.error(`Please grant 'Repository contents' Read & Write.`);
    } else if (contents === "read") {
      logger.error(`GitHub App installation for org '${org}' has only READ access to 'contents'. Write access is required to populate repositories.`);
    } else {
      logger.info(`Sufficient GitHub App permissions detected for org '${org}'.`);
    }
  } catch (err) {
    logger.warn(`Error while checking GitHub App permissions for org '${org}': ${err.message}`);
  }
}

function fetchGitignoreTemplates(signal) {
  // Return a Promise that resolves with the parsed JSON or rejects on error.
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        // GitHub requires a User-Agent header for some endpoints
        "User-Agent": "server2git",
      },
    };

    const req = https.get(GITHUB_API_URL, options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            const dir = path.dirname(GITIGNORE_PATH);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(GITIGNORE_PATH, JSON.stringify(json, null, 2));
            activeRequest = null;
            resolve(json);
          } catch (e) {
            activeRequest = null;
            reject(e);
          }
        } else {
          activeRequest = null;
          reject(new Error(`Failed to fetch templates: HTTP ${res.statusCode}`));
        }
      });
    });

    req.on("error", (err) => {
      activeRequest = null;
      reject(err);
    });

    // allow the caller to abort the request via signal
    if (signal) {
      if (signal.aborted) {
        try {
          req.destroy(new Error("aborted"));
        } catch (e) {
          // ignore
        }
        return reject(new Error("aborted"));
      }
      const onAbort = () => {
        try {
          req.destroy(new Error("aborted"));
        } catch (e) {
          // ignore
        }
        signal.removeEventListener && signal.removeEventListener("abort", onAbort);
      };
      signal.addEventListener && signal.addEventListener("abort", onAbort, { once: true });
    }

    activeRequest = req;
  });
}

async function fetchGitignore(signal) {
  try {
    if (!fs.existsSync(GITIGNORE_PATH) || fs.statSync(GITIGNORE_PATH).size === 0) {
      try {
        await fetchGitignoreTemplates(signal);
        logger.info("Fetched .gitignore templates from GitHub.");
        return true;
      } catch (err) {
        if (String(err).toLowerCase().includes("aborted")) {
          logger.info("Fetch .gitignore templates aborted by signal.");
          return false;
        }
        logger.warn(`Could not fetch .gitignore templates: ${err.message}`);
        return false;
      }
    } else {
      logger.info(".gitignore templates already present, skipping fetch.");
      return true;
    }
  } catch (e) {
    logger.warn(`Could not fetch .gitignore templates: ${e.message}`);
    return false;
  }
}

module.exports = {
  onStart: async function () {
    await checkPermissions();
    await fetchGitignore();
  },
  // If shutdown is forced, abort any active fetch.
  onStop: async function (signal) {
    if (signal && signal.aborted) {
      return;
    }
    try {
      if (activeRequest && signal) {
        // Abort the active request if the host signalled abort
        signal.addEventListener &&
          signal.addEventListener(
            "abort",
            () => {
              try {
                activeRequest.destroy(new Error("aborted"));
              } catch (e) {
                // ignore
              }
            },
            { once: true }
          );
      }
    } catch (e) {
      logger.warn(`github-utils: error while wiring abort: ${e.message}`);
    }
  },
};
