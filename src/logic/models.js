/**
 * Pseudo-models for domain entities used across the app.
 * These are plain JS objects with JSDoc typedefs to help document
 * the expected shape of data used by routes and logic.
 */

/**
 * @typedef {Object} Problem
 * @property {string} id - Unique problem id (stringified timestamp in current code)
 * @property {string} title - Human readable title
 * @property {string} statement - Problem statement / description
 * @property {string} repoUrl - GitHub repo URL containing the problem definition and tests
 */

/**
 * @typedef {Object} Contestant
 * @property {string} id - Unique contestant id (could be user id or team id)
 * @property {string} name - Display name for the contestant (team name, user name)
 */

/**
 * @typedef {Object} Team
 * @property {string} id - Unique participant id (could be user id or team id)
 * @property {string} name - Display name for the participant (team name, user name)
 * @property {string[]} [contestants] - List of contestant ids
 */

/**
 * @typedef {Object} Submission
 * @property {string} id - Unique submission id (e.g. timestamp or uuid)
 * @property {string} problem - Problem id this submission targets
 * @property {string} team - Participant id (team or user) that made the submission
 * @property {string} repoUrl - GitHub repo URL containing the submission code
 * @property {number} timestamp - Unix ms timestamp when submission was created
 * @property {string} status - One of: 'queued','running','done','error'
 * @property {Object} [result] - Result details (score, passed tests, logs, etc.)
 * @property {number} [runtimeMs] - Execution runtime in milliseconds (if measured)
 */
