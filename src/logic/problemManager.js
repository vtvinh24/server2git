const fs = require("fs");
const path = require("path");
const problemsDir = path.join(process.cwd(), "data/problems");
const metadataFile = path.join(problemsDir, "problems.json");

function ensureProblemsDir() {
  if (!fs.existsSync(problemsDir)) fs.mkdirSync(problemsDir, { recursive: true });
  if (!fs.existsSync(metadataFile)) fs.writeFileSync(metadataFile, "[]");
}

function getAllProblems() {
  ensureProblemsDir();
  return JSON.parse(fs.readFileSync(metadataFile));
}

function getProblemById(id) {
  const problems = getAllProblems();
  return problems.find((p) => p.id === id);
}

function addProblem(problem) {
  ensureProblemsDir();
  const problems = getAllProblems();
  problems.push(problem);
  fs.writeFileSync(metadataFile, JSON.stringify(problems, null, 2));
}

module.exports = {
  getAllProblems,
  getProblemById,
  addProblem,
  problemsDir,
};
