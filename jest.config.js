module.exports = {
  testEnvironment: "node", // or "jsdom" for browser-like environment
  testMatch: ["**/tests/**/*.js", "**/?(*.)+(spec|test).js"],
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov"],
  verbose: true,
  clearMocks: true,
  moduleFileExtensions: ["js", "json"],
  // Uncomment if using Babel or need transforms:
  // transform: { "^.+\\.js$": "babel-jest" },
  // setupFilesAfterEnv: ["<rootDir>/jest.setup.js"], // If global
  // testPathIgnorePatterns: ["/node_modules/", "/dist/"],
};
