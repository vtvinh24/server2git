const logger = require("#utils/logger.js");

module.exports = {
  onStart() {
    logger.info("dummy-stop plugin started (no-op)");
  },
  // Accept an optional AbortSignal so the host can cancel the wait if shutdown is forced
  async onStop(signal) {
    logger.info("dummy-stop: beginning shutdown wait (15s)");

    if (signal && signal.aborted) {
      logger.info("dummy-stop: abort signal already set, skipping wait");
      return;
    }

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        signal && signal.removeEventListener && signal.removeEventListener("abort", onAbort);
        logger.info("dummy-stop: cleanup complete");
        resolve();
      }, 15000);

      function onAbort() {
        clearTimeout(timeout);
        logger.info("dummy-stop: abort received, ending wait early");
        resolve();
      }

      if (signal && signal.addEventListener) {
        signal.addEventListener("abort", onAbort, { once: true });
      }
    });
  },
};
