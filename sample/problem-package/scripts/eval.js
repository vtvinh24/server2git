// System evaluation script for sample-problem
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const TEST_CASES_DIR = path.join(__dirname, "../data/test-cases.json");
const RAW_SERVER = process.env.DEMO_SERVER_URL || "http://localhost:3000";
const SERVER_URL = RAW_SERVER.endsWith("/evaluation") ? RAW_SERVER : RAW_SERVER.replace(/\/$/, "") + "/evaluation";
const SUBMISSION_PATH = path.join(__dirname, "../source/main.js");
const TEAM_ID = process.env.TEAM_ID || "unknown-team";
const PROBLEM_ID = process.env.PROBLEM_ID || process.env.PROBLEM || "unknown-problem";
const COMMIT_HASH = process.env.COMMIT_HASH || null;

// Load pluggable evaluation scripts
const perfScriptPath = path.join(__dirname, "perf.js");
let perfEval = null;
if (fs.existsSync(perfScriptPath)) {
  perfEval = require(perfScriptPath);
}

function runSubmission(submissionPath, testCase) {
  // Load submission fresh for each test case to avoid module state carry-over
  try {
    delete require.cache[require.resolve(submissionPath)];
  } catch (e) {
    // ignore if not in cache
  }
  const submission = require(submissionPath);
  if (perfEval) {
    // perfEval should accept (runFn, testCase)
    return perfEval((tc) => submission(tc.a, tc.b), testCase);
  } else {
    return { result: submission(testCase.a, testCase.b) };
  }
}

function aggregatePerf(results) {
  // Aggregate runtime and memory if available
  let totalRuntime = 0,
    totalMemory = 0,
    count = 0;
  results.forEach((r) => {
    if (typeof r.durationMs === "number") {
      totalRuntime += r.durationMs;
      count++;
    }
    if (typeof r.memory === "number") {
      totalMemory += r.memory;
    }
  });
  return {
    runtime: count ? totalRuntime / count : null,
    memory: count ? totalMemory / count : null,
  };
}

function evaluate() {
  const testCases = JSON.parse(fs.readFileSync(path.join(TEST_CASES_DIR, "test1.json")));
  let passed = 0;
  let total = testCases.length;
  let results = [];
  testCases.forEach((tc) => {
    let output, status;
    try {
      const evalResult = runSubmission(SUBMISSION_PATH, tc.input);
      // evalResult is expected to contain { result, durationMs, memory }
      output = evalResult.result;
      if (output === tc.output) {
        passed++;
        status = "pass";
      } else {
        status = "fail";
      }
      results.push({ input: tc.input, expected: tc.output, actual: output, status, durationMs: evalResult.durationMs, memory: evalResult.memory });
    } catch (e) {
      results.push({ input: tc.input, expected: tc.output, actual: String(e), status: "error" });
    }
  });
  const { runtime, memory } = aggregatePerf(results);
  const payload = {
    teamId: TEAM_ID,
    problem: PROBLEM_ID,
    commitHash: COMMIT_HASH,
    score: passed,
    runtime: runtime || 0,
    memory: memory || 0,
  };
  console.log("Evaluation payload:", payload);
  // Use a short timeout so evaluator doesn't hang if server is unreachable
  axios
    .post(SERVER_URL, payload, { timeout: 5000 })
    .then((res) => {
      if (res && res.status >= 200 && res.status < 300) {
        console.log("Reported stats to server");
        process.exit(0);
      } else {
        console.error("Server returned non-2xx status:", res && res.status);
        process.exit(2);
      }
    })
    .catch((err) => {
      const detail = err && (err.response ? `status=${err.response.status}` : err.code || err.message);
      console.error("Failed to report stats:", detail);
      // Exit with non-zero so orchestration can detect failure; user may retry
      process.exit(3);
    });
  console.log(`Passed ${passed}/${total} test cases.`);
}

evaluate();
