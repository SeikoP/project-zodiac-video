import {readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {applyStyleToken, parseDesignToken} from "./style-token.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rendererDir = path.resolve(scriptDir, "..");
const packageRoot = process.env.ZODIAC_PACKAGE_ROOT ? path.resolve(process.env.ZODIAC_PACKAGE_ROOT) : path.resolve(rendererDir, "..");
const designPath = path.join(packageRoot, "design.md");
const productionPath = path.join(packageRoot, "production.json");
const design = await readFile(designPath, "utf8").catch(() => { throw new Error("design.md is missing at the package root."); });
const production = JSON.parse(await readFile(productionPath, "utf8"));
const token = parseDesignToken(design);
const hash = applyStyleToken(production, token);
await writeFile(productionPath, JSON.stringify(production, null, 2) + "\n", "utf8");
console.log(`Compiled ${token.id} (${hash.slice(0, 12)}) into production.json.`);
