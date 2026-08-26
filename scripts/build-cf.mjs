import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import esbuild from "esbuild";

console.log("==> Running OpenNext Cloudflare Build...");
execSync("npx @opennextjs/cloudflare build", { stdio: "inherit" });

const workerSrc = path.join(".open-next", "worker.js");
const workerDest = path.join(".open-next", "_worker.js");

if (fs.existsSync(workerSrc)) {
  fs.copyFileSync(workerSrc, workerDest);
}

console.log("==> Bundling & minifying _worker.js with esbuild...");
try {
  await esbuild.build({
    entryPoints: [workerDest],
    outfile: workerDest,
    allowOverwrite: true,
    bundle: true,
    minify: true,
    treeShaking: true,
    format: "esm",
    platform: "node",
    target: "es2022",
    loader: {
      ".wasm": "binary"
    },
    external: [
      "cloudflare:*",
      "node:*",
      "pg-cloudflare",
      "@prisma/client",
      ".prisma/client"
    ],
  });

  const stat = fs.statSync(workerDest);
  console.log(`==> Final _worker.js size: ${(stat.size / 1024 / 1024).toFixed(2)} MB (${(stat.size / 1024).toFixed(0)} KB)`);
} catch (e) {
  console.warn("Bundle warning:", e.message);
}

console.log("==> Build and minification complete!");
