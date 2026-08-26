import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

console.log("==> Running OpenNext Cloudflare Build...");
execSync("npx @opennextjs/cloudflare build", { stdio: "inherit" });

const workerSrc = path.join(".open-next", "worker.js");
const workerDest = path.join(".open-next", "_worker.js");

if (fs.existsSync(workerSrc)) {
  fs.copyFileSync(workerSrc, workerDest);
  console.log("==> Cloudflare Pages .open-next/_worker.js is ready!");
}
