// Doc link check: every relative link in the given Markdown files must resolve on disk.
// `mstack lint-plugin` covers skills/ and agents/; this covers README.md and docs/wiki/,
// which is why item 9's verification field runs it. Only node: builtins.
//
// Usage, from the repository root:
//   node scripts/check-doc-links.mjs README.md docs/wiki/*.md
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const LINK = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
let checked = 0;
let broken = 0;

for (const file of process.argv.slice(2)) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(LINK)) {
    const target = match[1];
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    checked += 1;
    const path = resolve(dirname(file), target.split("#")[0]);
    if (!existsSync(path)) {
      broken += 1;
      console.error(`BROKEN  ${file}: (${target}) -> ${path}`);
    }
  }
}

console.log(`${checked} relative links checked, ${broken} broken`);
process.exit(broken === 0 ? 0 : 1);
