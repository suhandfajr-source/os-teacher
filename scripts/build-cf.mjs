import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

console.log("==> Running OpenNext Cloudflare Build...");
execSync("npx @opennextjs/cloudflare build", { stdio: "inherit" });

const workerSrc = path.join(".open-next", "worker.js");
const workerDest = path.join(".open-next", "assets", "_worker.js");

if (fs.existsSync(workerSrc)) {
  console.log(`==> Copying ${workerSrc} to ${workerDest} for Cloudflare Pages...`);
  fs.copyFileSync(workerSrc, workerDest);
  console.log("==> Cloudflare Pages _worker.js is ready!");
}

const routesSrc = path.join(".open-next", "_routes.json");
const routesDest = path.join(".open-next", "assets", "_routes.json");
if (fs.existsSync(routesSrc)) {
  fs.copyFileSync(routesSrc, routesDest);
} else {
  const defaultRoutes = {
    version: 1,
    include: ["/*"],
    exclude: ["/_next/static/*", "/favicon.ico"]
  };
  fs.writeFileSync(routesDest, JSON.stringify(defaultRoutes, null, 2));
}
console.log("==> Build for Cloudflare Pages successfully prepared!");
