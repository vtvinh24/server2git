// src/middlewares/index.js
// Centralized middleware registration

const requestLogger = require("./requestLogger");

// Add more middlewares here as needed

module.exports = [
  // Register middlewares in order
  requestLogger,
];
