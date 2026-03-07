import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";

const version = process.argv[2];
if (!version) {
  console.error("Usage: npm run bump <version>");
  console.error("Example: npm run bump 0.2.0");
  process.exit(1);
}

// package.json
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
pkg.version = version;
writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
console.log(`package.json -> ${version}`);

// Cargo.toml
let cargo = readFileSync("src-tauri/Cargo.toml", "utf8");
cargo = cargo.replace(/^version = ".*"/m, `version = "${version}"`);
writeFileSync("src-tauri/Cargo.toml", cargo);
console.log(`Cargo.toml -> ${version}`);

// tauri.conf.json
const conf = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
conf.version = version;
writeFileSync(
  "src-tauri/tauri.conf.json",
  JSON.stringify(conf, null, 2) + "\n",
);
console.log(`tauri.conf.json -> ${version}`);

// Update Cargo.lock
execSync("cargo update --workspace", { cwd: "src-tauri", stdio: "inherit" });
console.log(`Cargo.lock updated`);

console.log(`\nVersion bumped to ${version}`);
console.log(`Next steps:`);
console.log(`  git add -A`);
console.log(`  git commit -m "bump version to ${version}"`);
console.log(`  git tag v${version}`);
console.log(`  git push origin main --tags`);
