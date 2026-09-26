// Stellt einen sauberen, minimalen Ordner für die Tauri-Desktop-App
// zusammen: nur die tatsächlich benötigten statischen Dateien, kein
// node_modules/.git/Quellcode. Läuft vor `tauri dev`/`tauri build`.
import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(repoRoot, "app-dist");

const filesToCopy = ["index.html", "app.js", "main.js", "styles.css"];
const dirsToCopy = ["dist-browser"];

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

for (const file of filesToCopy) {
  await cp(path.join(repoRoot, file), path.join(outDir, file));
}
for (const dir of dirsToCopy) {
  await cp(path.join(repoRoot, dir), path.join(outDir, dir), { recursive: true });
}

console.log(`app-dist bereit: ${outDir}`);
