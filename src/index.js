const { printSplash } = require("./utils/splash");
const express = require("express");
const logger = require("#utils/logger.js");

// --- Plugin Loader ---
const { loadPlugins, runStartupTasks, runCleanupTasks, startSchedulers, loadedPlugins } = require("./utils/pluginLoader");

// --- Lifecycle logic ---
printSplash();
(async () => {
  await runStartupTasks();
  startSchedulers();
})();

// --- Main server logic ---
const app = express();
app.use(express.json());

const middlewares = require("./middlewares");
middlewares.forEach((mw) => app.use(mw));

const apiV1Routes = require("#routes/v1/routes.js");
const { showHostInfo } = require("#utils/showHostInfo.js");
app.use("/api/v1", apiV1Routes);

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  try {
    showHostInfo(PORT);
  } catch (e) {
    logger.error(`Could not show host info: ${String(e).split("\n")[0]}`);
    logger.info(`Server listening on port ${PORT}`);
  }
});

// --- Cleanup logic ---
let shuttingDown = false;

async function gracefulShutdown(signal) {
  if (shuttingDown) {
    logger.warn(`Received ${signal} while already shutting down. Forcing immediate exit.`);
    process.exit(1);
    return;
  }

  shuttingDown = true;
  const FORCE_TIMEOUT_MS = Number(process.env.SHUTDOWN_TIMEOUT_MS) || 30000;
  logger.info(`Received ${signal}. Initiating graceful shutdown...`);

  const forceTimer = setTimeout(() => {
    logger.warn("Cleanup did not finish in time. Forcing shutdown.");
    process.exit(1);
  }, FORCE_TIMEOUT_MS);

  try {
    await runCleanupTasks();
  } catch (e) {
    logger.warn(`Error during cleanup: ${String(e).split("\n")[0]}`);
  }

  if (server && typeof server.close === "function") {
    await new Promise((resolve) => {
      server.close((err) => {
        if (err) {
          const msg = String(err).split("\n")[0] || "";
          if (!msg.includes("ERR_SERVER_NOT_RUNNING")) {
            logger.warn(`Error closing server: ${msg}`);
          }
        } else logger.info("HTTP server closed.");
        resolve();
      });
    });
  }

  clearTimeout(forceTimer);
  logger.info("Shutdown complete. Exiting.");
  process.exit(0);
}

process.on("SIGINT", () => {
  if (!shuttingDown) {
    gracefulShutdown("SIGINT");
  } else {
    logger.warn("SIGINT received again: aborting plugin cleanup and forcing immediate exit.");
    try {
      if (runCleanupTasks.abortController) runCleanupTasks.abortController.abort();
    } catch (e) {
      logger.warn(`Failed to abort cleanup controller: ${e.message}`);
    }
    process.exit(1);
  }
});

process.on("SIGTERM", () => {
  if (!shuttingDown) {
    gracefulShutdown("SIGTERM");
  } else {
    logger.warn("SIGTERM received again: aborting plugin cleanup and forcing immediate exit.");
    try {
      if (runCleanupTasks.abortController) runCleanupTasks.abortController.abort();
    } catch (e) {
      logger.warn(`Failed to abort cleanup controller: ${e.message}`);
    }
    process.exit(1);
  }
});
