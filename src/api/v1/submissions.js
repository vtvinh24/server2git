const express = require("express");
const router = express.Router();

// TODO
// GET /submissions: get a list of submissions (id, team, problem, timestamp, status)
// GET /submissions/:id: get details of a specific submission (id, team, problem, timestamp, status, code file URL, result details)
// POST /submissions: create a new submission (team, problem, code file upload, store metadata, trigger judging process)
// GET /submissions/:id/file: download/view the submission code file
// DELETE /submissions/:id: delete a specific submission (delete metadata and file)

module.exports = router;
