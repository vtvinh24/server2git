const fs = require("fs");
const path = require("path");
const cron = require("node-cron");
const logger = require("#utils/logger.js");

const pluginsDir = path.join(process.cwd(), "plugins");
const pluginsConfigPath = path.join(process.cwd(), "config", "plugins.json");

let loadedPlugins = [];

function loadPlugins() {
  loadedPlugins = [];
  let config = { plugins: [] };
  if (fs.existsSync(pluginsConfigPath)) {
    try {
      config = JSON.parse(fs.readFileSync(pluginsConfigPath, "utf-8"));
    } catch (e) {
      logger.warn(`Could not parse plugins config: ${e.message}`);
    }
  }

  const files = fs.readdirSync(pluginsDir).filter((f) => f.endsWith(".js") && fs.statSync(path.join(pluginsDir, f)).isFile());
  let updated = false;
  let totalPlugins = files.length;
  let enabledCount = 0;
  let disabledCount = 0;
  let failedCount = 0;
  const failedPlugins = [];
  const enabledPlugins = [];
  const disabledPlugins = [];

  files.forEach((file) => {
    let entry = config.plugins.find((p) => p.file === file);
    if (!entry) {
      entry = { file, enabled: true };
      config.plugins.push(entry);
      updated = true;
      logger.debug(`Auto-enabled plugin added: file=${file}`);
    }
    if (entry.enabled) {
      try {
        const mod = require(path.join(pluginsDir, file));
        loadedPlugins.push({ mod, file });
        enabledCount++;
        enabledPlugins.push(file);
      } catch (e) {
        failedCount++;
        failedPlugins.push({ file, reason: String(e).split("\n")[0] });
        logger.warn(`FAIL ${file} (${String(e).split("\n")[0]})`);
      }
    } else {
      disabledCount++;
      disabledPlugins.push(file);
    }
  });

  if (updated) {
    try {
      fs.writeFileSync(pluginsConfigPath, JSON.stringify(config, null, 2));
    } catch (e) {
      logger.warn(`Could not update plugins config: ${e.message}`);
    }
  }

  return {
    total: totalPlugins,
    enabled: enabledCount,
    disabled: disabledCount,
    failed: failedCount,
    failedPlugins,
    enabledPlugins,
    disabledPlugins,
    loadedPlugins,
  };
}

async function runStartupTasks() {
  const stats = loadPlugins();
  logger.info(`Detected ${stats.total} plugins:`);
  logger.info(`- ${stats.enabled} enabled`);
  if (stats.enabledPlugins && stats.enabledPlugins.length) {
    stats.enabledPlugins.forEach((f) => logger.info(`  - ${f}`));
  }
  logger.info(`- ${stats.disabled} disabled`);
  if (stats.disabledPlugins && stats.disabledPlugins.length) {
    stats.disabledPlugins.forEach((f) => logger.info(`  - ${f}`));
  }
  if (stats.failed && stats.failed > 0) {
    logger.info(`- ${stats.failed} failed`);
    stats.failedPlugins.forEach((p) => logger.warn(`  - ${p.file}: ${p.reason}`));
  } else {
    logger.info(`- 0 failed`);
  }

  for (const { mod, file } of stats.loadedPlugins) {
    if (typeof mod.onStart === "function") {
      try {
        const result = mod.onStart();
        if (result && typeof result.then === "function") {
          await result;
        }
        logger.debug(`plugin.onStart executed: file=${file}`);
      } catch (e) {
        logger.warn(`Plugin onStart failed: file=${file} error=${String(e).split("\n")[0]}`);
      }
    } else {
      logger.debug(`Loaded plugin module: file=${file}`);
    }
  }
  // update module-level loadedPlugins reference
  loadedPlugins = stats.loadedPlugins;
  return stats;
}

async function runCleanupTasks() {
  const controller = new AbortController();
  const { signal } = controller;

  // expose controller so callers can abort if needed
  runCleanupTasks.abortController = controller;

  for (const { mod, file } of loadedPlugins) {
    if (typeof mod.onStop === "function") {
      try {
        const result = mod.onStop(signal);
        if (result && typeof result.then === "function") {
          await result;
        }
        logger.info(`Plugin stopped: file=${file}`);
      } catch (e) {
        logger.warn(`Plugin onStop failed: file=${file} error=${String(e).split("\n")[0]}`);
      }
    }
  }
}

function startSchedulers() {
  loadedPlugins.forEach(({ mod, file }) => {
    if (typeof mod.onSchedule === "function" && mod.cron) {
      try {
        cron.schedule(mod.cron, () => {
          try {
            mod.onSchedule();
            logger.debug(`Plugin scheduled run succeeded: file=${file}`);
          } catch (e) {
            logger.warn(`Plugin scheduled run failed: file=${file} error=${e.message.split("\n")[0]}`);
          }
        });
        logger.debug(`Registered plugin scheduler: file=${file} cron=${mod.cron}`);
      } catch (e) {
        logger.warn(`Scheduler FAIL ${file} (${e.message.split("\n")[0]})`);
      }
    }
  });
}

module.exports = {
  loadPlugins,
  runStartupTasks,
  runCleanupTasks,
  startSchedulers,
  // expose loadedPlugins for consumers that need it
  get loadedPlugins() {
    return loadedPlugins;
  },
};
