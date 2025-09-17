// src/middlewares/requestLogger.js
// Logs all incoming requests if enabled by LOG_REQUESTS env var

const logger = require("#utils/logger.js");
const LOG_REQUESTS = process.env.LOG_REQUESTS === "true";

module.exports = function requestLogger(req, res, next) {
  if (!LOG_REQUESTS) return next();
  const method = req.method;
  const url = req.originalUrl;
  const ip = req.ip || req.connection?.remoteAddress || "unknown";
  const headers = JSON.stringify(req.headers, null, 2);
  const query = Object.keys(req.query).length ? JSON.stringify(req.query, null, 2) : "{}";
  let body = req.body;
  if (typeof body === "object" && body !== null) {
    body = JSON.stringify(body, null, 2);
  } else if (!body) {
    body = "{}";
  }

  logger.info(`${method} ${url}`);
  logger.info(`  IP: ${ip}`);
  logger.debug(`  Headers: ${headers}`);
  logger.debug(`  Query: ${query}`);
  logger.debug(`  Body: ${body}`);
  logger.info("----------------------------------------");
  next();
};
