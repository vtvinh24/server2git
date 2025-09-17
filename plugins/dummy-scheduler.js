const logger = require("#utils/logger.js");

module.exports = {
  cron: "*/5 * * * * *",

  onSchedule() {
    try {
      const now = new Date().toISOString();
      void now;
    } catch (e) {
      logger.error(`example-scheduler: scheduled job error: ${String(e).split("\n")[0]}`);
    }
  },
};
