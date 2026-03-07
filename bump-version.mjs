import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import { createInterface } from "readline";

const arg = process.argv[2];

// Read current version from tauri.conf.json (source of truth)
const conf = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
const current = conf.version;
const [major, minor, patch] = current.split(".").map(Number);

let version;

if (arg === "major") {
  version = `${major + 1}.0.0`;
} else if (arg === "minor") {
  version = `${major}.${minor + 1}.0`;
} else if (arg === "patch") {
  version = `${major}.${minor}.${patch + 1}`;
} else if (arg && /^\d+\.\d+\.\d+$/.test(arg)) {
  version = arg;
} else {
  console.log(`Current version: ${current}`);
  console.log(`Usage: npm run bump [major|minor|patch|x.y.z]`);
  console.log(`  major -> ${major + 1}.0.0`);
  console.log(`  minor -> ${major}.${minor + 1}.0`);
  console.log(`  patch -> ${major}.${minor}.${patch + 1}`);
  process.exit(1);
}

// Confirm
const rl = createInterface({ input: process.stdin, output: process.stdout });
const answer = await new Promise((resolve) =>
  rl.question(`Bump ${current} -> ${version}? (y/N) `, resolve),
);
rl.close();
if (answer.toLowerCase() !== "y") {
  console.log("Cancelled.");
  process.exit(0);
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
conf.version = version;
writeFileSync(
  "src-tauri/tauri.conf.json",
  JSON.stringify(conf, null, 2) + "\n",
);
console.log(`tauri.conf.json -> ${version}`);

// Update lock files
execSync("npm install --package-lock-only", { stdio: "inherit" });
console.log(`package-lock.json updated`);
execSync("cargo update --workspace", { cwd: "src-tauri", stdio: "inherit" });
console.log(`Cargo.lock updated`);

console.log(`\nVersion bumped to ${version}`);
console.log(`Next steps:`);
console.log(`  git add -A`);
console.log(`  git commit -m "bump version to ${version}"`);
console.log(`  git tag v${version}`);
console.log(`  git push origin main --tags`);
