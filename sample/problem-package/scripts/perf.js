// Example perf.js: measures execution time and simple heap diff for memory for each test case
module.exports = function (runFn, testCase) {
  const startMem = process.memoryUsage().heapUsed;
  const start = process.hrtime.bigint();
  const result = runFn(testCase);
  const end = process.hrtime.bigint();
  const endMem = process.memoryUsage().heapUsed;
  const durationMs = Number(end - start) / 1e6;
  const memoryBytes = Math.max(0, endMem - startMem);
  const memoryKb = Math.round(memoryBytes / 1024);
  return { result, durationMs, memory: memoryKb };
};
