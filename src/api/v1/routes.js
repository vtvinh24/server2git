const express = require("express");
const router = express.Router();

const authRoutes = require("./auth.js");
const eventsRoutes = require("./events.js");
const genericRoutes = require("./generic.js");
const judgeRoutes = require("./judge.js");
const problemsRoutes = require("./problems.js");
const submissionsRoutes = require("./submissions.js");
const teamsRoutes = require("./teams.js");
const testRoutes = require("./testRoutes.js");
const tracksRoutes = require("./tracks.js");

router.use("/auth", authRoutes);
router.use("/events", eventsRoutes);
router.use("/generic", genericRoutes);
router.use("/judge", judgeRoutes);
router.use("/problems", problemsRoutes);
router.use("/submissions", submissionsRoutes);
router.use("/teams", teamsRoutes);
router.use("/test", testRoutes);
router.use("/tracks", tracksRoutes);

module.exports = router;
