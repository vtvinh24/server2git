const os = require("os");
const nets = os.networkInterfaces();
const urls = new Set();
const logger = require("#utils/logger.js");

/**
 * Show host information (IP addresses) where the server is reachable.
 * @param {number} PORT - The port number where the server is listening.
 */
function showHostInfo(PORT) {
  Object.values(nets).forEach((ifaces) => {
    ifaces.forEach((iface) => {
      const family = typeof iface.family === "string" ? iface.family : String(iface.family);
      if (family.includes("4") || family.toLowerCase().includes("ipv4")) {
        urls.add(`http://${iface.address}:${PORT}/`);
      } else if (family.includes("6") || family.toLowerCase().includes("ipv6")) {
        if (iface.address) urls.add(`http://[${iface.address}]:${PORT}/`);
      }
    });
  });

  // Assume sysadmin does not know default localhost addresses
  urls.add(`http://localhost:${PORT}/`);
  urls.add(`http://127.0.0.1:${PORT}/`);
  urls.add(`http://[::1]:${PORT}/`);

  logger.info("Server started at:");
  const ANSI_UNDERLINE_BLUE = "\u001b[4m\u001b[34m";
  const ANSI_RESET = "\u001b[0m";
  urls.forEach((u) => logger.info(`+ ${ANSI_UNDERLINE_BLUE}${u}${ANSI_RESET}`));
}

module.exports = { showHostInfo };
