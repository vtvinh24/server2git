const fs = require("fs");
const path = require("path");
const os = require("os");

// We'll manipulate process.cwd during tests to isolate filesystem effects
describe("problemManager", () => {
  let originalCwd;
  let tmpDir;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pm-test-"));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    // return to original cwd and remove temp dir
    try {
      process.chdir(originalCwd);
      // recursively remove tmpDir
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {
      // ignore cleanup errors
    }
  });

  test("getAllProblems returns an array (initially empty)", () => {
    const pm = require("#logic/problemManager.js");
    const all = pm.getAllProblems();
    expect(Array.isArray(all)).toBe(true);
    expect(all.length).toBe(0);
  });

  test("addProblem writes problem and getProblemById finds it", () => {
    // re-require to ensure fresh module state inside tmp cwd
    jest.resetModules();
    const pm = require("#logic/problemManager.js");

    const sample = { id: "p1", title: "Sample" };
    pm.addProblem(sample);

    const all = pm.getAllProblems();
    expect(all.length).toBe(1);
    expect(all[0]).toEqual(sample);

    const fetched = pm.getProblemById("p1");
    expect(fetched).toEqual(sample);
  });

  test("problemsDir is under process.cwd/data/problems", () => {
    jest.resetModules();
    const pm = require("#logic/problemManager.js");
    const expected = path.join(process.cwd(), "data/problems");
    expect(pm.problemsDir).toBe(expected);
  });
});
