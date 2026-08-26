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
  console.log("==> Cloudflare Pages .open-next/_worker.js created.");
}

const filesToMinify = [
  path.join(".open-next", "_worker.js"),
  path.join(".open-next", "server-functions", "default", "handler.mjs"),
  path.join(".open-next", "middleware", "handler.mjs")
];

for (const file of filesToMinify) {
  if (fs.existsSync(file)) {
    try {
      console.log(`==> Minifying ${file}...`);
      await esbuild.build({
        entryPoints: [file],
        outfile: file,
        allowOverwrite: true,
        minify: true,
        treeShaking: true,
        format: "esm",
        platform: "node",
        bundle: false,
      });
      const stat = fs.statSync(file);
      console.log(`==> ${file} minified size: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
    } catch (err) {
      console.warn(`Minification warning for ${file}:`, err.message);
    }
  }
}

console.log("==> Build and minification complete!");
