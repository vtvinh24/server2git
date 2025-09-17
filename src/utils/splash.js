const fs = require("fs");
const path = require("path");

// Fascinating
function gradientText(text) {
  // 129 (purple) to 123 (light blue) in 256-color
  const gradient = [129, 135, 141, 147, 153, 159, 123];
  let out = "";
  let colorIdx = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === "\n") {
      out += char;
      colorIdx = 0;
      continue;
    }
    const color = gradient[colorIdx % gradient.length];
    out += `\x1b[38;5;${color}m${char}\x1b[0m`;
    colorIdx++;
  }
  return out;
}

function printSplash() {
  try {
    const pkgPath = path.join(process.cwd(), "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    const splashPath = path.join(process.cwd(), "./config/SPLASH.TXT");
    let splash = fs.readFileSync(splashPath, "utf8");
    splash = splash.replace("${version}", pkg.version || "").replace("${description}", pkg.description || "");
    const lines = splash.split("\n");
    for (let i = 0; i < lines.length; i++) {
      console.log(gradientText(lines[i]));
    }
  } catch (e) {
    console.error("Error printing splash:", e);
  }
}

module.exports = { printSplash, gradientText };
