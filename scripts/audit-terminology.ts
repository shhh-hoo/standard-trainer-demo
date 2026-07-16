import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";

const roots = ["src", "scripts", "docs", "tests"];
const extensions = new Set([".ts", ".tsx", ".md", ".json"]);
const forbidden = [new RegExp(`\\b(?:E${"val"}|E${"valuation"})\\b`, "u"), new RegExp(`\\b(?:Foundry|Learner|Trainer|Runtime) E${"valuation"}\\b`, "u")];
const violations: string[] = [];
async function files(path: string): Promise<readonly string[]> { const entries = await readdir(path, { withFileTypes: true }); return (await Promise.all(entries.map((entry) => entry.isDirectory() ? files(join(path, entry.name)) : [join(path, entry.name)]))).flat(); }
for (const file of [...(await Promise.all(roots.map(files))).flat(), "README.md"]) {
  if (!extensions.has(extname(file)) && file !== "README.md") continue;
  const content = await readFile(file, "utf8");
  content.split(/\r?\n/).forEach((line, index) => { const candidate = line.replaceAll("AgentEval", ""); if (forbidden.some((pattern) => pattern.test(candidate))) violations.push(`${file}:${index + 1}: forbidden terminology`); });
}
if (violations.length) { console.error(violations.join("\n")); process.exitCode = 1; } else console.log("Terminology audit passed.");
