const { spawn } = require("child_process");
const path = require("path");

const electronBinary = require("electron");
const env = { ...process.env };
const appDir = __dirname;

// Some environments export this globally, which makes Electron boot as Node.
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronBinary, [path.join(appDir, "main.js")], {
  stdio: "ignore",
  env,
  cwd: appDir,
  windowsHide: false,
  detached: true
});

child.unref();
