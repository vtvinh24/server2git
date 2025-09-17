const { createLogger, format, transports } = require("winston");
const { combine, timestamp, colorize, printf, errors, splat } = format;
const path = require("path");
const fs = require("fs");
const rfs = require("rotating-file-stream");

const LOGS_DIR = process.env.LOGS_DIR ? path.resolve(process.cwd(), process.env.LOGS_DIR) : path.join(process.cwd(), "logs");
const LOG_FILE_SIZE_LIMIT = process.env.LOG_FILE_SIZE_LIMIT || "10M";
const LOG_ROTATE_INTERVAL = process.env.LOG_ROTATE_INTERVAL || "0";
fs.mkdirSync(LOGS_DIR, { recursive: true });

// File log format: [Timestamp - Level] Content, stacktrace if error
const fileLogFormat = printf(({ timestamp, level, message, stack }) => {
  let log = `[${timestamp} - ${level.toUpperCase()}] ${message}`;
  if (stack) log += `\nStacktrace: ${stack}`;
  return log;
});

// Create rotating file stream: new file every size limit, with timestamped filenames
function generator(time, index) {
  if (!time) return "app.log";
  const pad = (num) => (num > 9 ? "" : "0") + num;
  const year = time.getFullYear();
  const month = pad(time.getMonth() + 1);
  const day = pad(time.getDate());
  const hour = pad(time.getHours());
  const min = pad(time.getMinutes());
  const sec = pad(time.getSeconds());
  return `app-${year}${month}${day}-${hour}${min}${sec}-${index}.log`;
}

const logStreamOptions = {
  size: LOG_FILE_SIZE_LIMIT, // rotate every X MegaBytes written
  path: LOGS_DIR,
  compress: false,
};
if (LOG_ROTATE_INTERVAL && LOG_ROTATE_INTERVAL !== "0") {
  logStreamOptions.interval = LOG_ROTATE_INTERVAL;
}
const logStream = rfs.createStream(generator, logStreamOptions);

const chalk = require("chalk");
const levelBg = {
  info: chalk.bgBlue.bold.white,
  warn: chalk.bgYellow.bold.black,
  error: chalk.bgRed.bold.white,
  debug: chalk.bgGreen.bold.black,
  silly: chalk.bgMagenta.bold.white,
  verbose: chalk.bgCyan.bold.black,
};
function padLevel(lvl) {
  // Right align level to 7 characters
  const maxLen = 7;
  if (lvl.length >= maxLen) return lvl;
  return " ".repeat(maxLen - lvl.length) + lvl;
}
const timeBg = chalk.bgWhite.bold.black;
const consoleLogFormat = printf(({ level, message, timestamp }) => {
  const lvl = padLevel(level.toUpperCase());
  const lvlColor = levelBg[level] ? levelBg[level](lvl) : chalk.bgGray.black(lvl);
  const timeColor = timeBg(timestamp);
  return `${lvlColor} ${timeColor} ${message}`;
});

const logger = createLogger({
  level: "info",
  format: combine(errors({ stack: true }), splat(), timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" })),
  transports: [
    new transports.Console({
      format: combine(timestamp({ format: "HH:mm:ss" }), consoleLogFormat),
    }),
    new transports.Stream({
      stream: logStream,
      format: combine(timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }), fileLogFormat),
      level: "silly",
    }),
  ],
});

logger.stream = {
  write: (msg) => logger.info(msg.trim()),
};

module.exports = logger;
