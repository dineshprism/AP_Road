import fs from "node:fs";
import path from "node:path";

const lockfiles = ["frontend/package-lock.json", "backend/package-lock.json"];

for (const lockfile of lockfiles) {
  const lockPath = path.resolve(lockfile);
  const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
  const deprecatedPackages = Object.entries(lock.packages ?? {}).filter(([, metadata]) =>
    Boolean(metadata.deprecated),
  );

  console.log(`\n${lockfile}`);

  if (deprecatedPackages.length === 0) {
    console.log("  No deprecated package entries found.");
    continue;
  }

  for (const [packagePath, metadata] of deprecatedPackages) {
    console.log(`  ${packagePath}: ${metadata.deprecated}`);
  }

  console.log(`  Deprecated package entries: ${deprecatedPackages.length}`);
}
