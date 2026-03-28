const { spawn } = require("child_process");
const path = require("path");

function resolveElectronBinary() {
  const candidates = [
    path.join(__dirname, "node_modules", "electron"),
    path.join(__dirname, "..", "standalone-editor", "node_modules", "electron"),
    "electron"
  ];

  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) {
      continue;
    }
  }

  throw new Error("Electron could not be resolved for standalone-editor-v2.");
}

const electronBinary = resolveElectronBinary();
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronBinary, [path.join(__dirname, "main.js")], {
  stdio: "ignore",
  env,
  cwd: __dirname,
  windowsHide: false,
  detached: true
});

child.unref();
