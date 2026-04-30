import { existsSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const forwardedArgs = process.argv.slice(2);
const defaultExcludedPaths = [
  // Immutable bootstrap migration with an intentional seeded bcrypt hash.
  "migrations/001_initial_schema.sql",
];
const allowedHelperCommands = new Set(
  process.platform === "win32"
    ? ["where.exe", "py", "python"]
    : ["which", "python3", "python"],
);

function runCommand(command, args) {
  if (!allowedHelperCommands.has(command)) {
    throw new Error(`Unsupported helper command: ${command}`);
  }

  // nosemgrep: javascript.lang.security.detect-child-process.detect-child-process
  return spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });
}

function resolveFromPython(pythonCommand) {
  const probe = runCommand(pythonCommand, [
    "-X",
    "utf8",
    "-c",
    'import os, site; print(os.path.dirname(site.getusersitepackages()))',
  ]);

  if (probe.status !== 0) {
    return null;
  }

  const basePath = probe.stdout.trim();
  if (!basePath) {
    return null;
  }

  const candidates = process.platform === "win32"
    ? [join(basePath, "Scripts", "semgrep.exe"), join(basePath, "Scripts", "semgrep")]
    : [join(dirname(basePath), "bin", "semgrep"), join(basePath, "bin", "semgrep")];

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function resolveSemgrepBinary() {
  if (process.env.SEMGREP_BIN && existsSync(process.env.SEMGREP_BIN)) {
    return process.env.SEMGREP_BIN;
  }

  const pathResult = runCommand(process.platform === "win32" ? "where.exe" : "which", ["semgrep"]);
  if (pathResult.status === 0) {
    const candidate = pathResult.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
    if (candidate && existsSync(candidate)) {
      return candidate;
    }
  }

  for (const pythonCommand of process.platform === "win32" ? ["py", "python"] : ["python3", "python"]) {
    const resolved = resolveFromPython(pythonCommand);
    if (resolved) {
      return resolved;
    }
  }

  return null;
}

function buildSemgrepArgs(args) {
  const semgrepArgs = [...args];

  for (const excludedPath of defaultExcludedPaths) {
    const alreadyExcluded = semgrepArgs.some((arg, index) => {
      if (arg === "--exclude") {
        return semgrepArgs[index + 1] === excludedPath;
      }
      return arg === `--exclude=${excludedPath}`;
    });

    if (!alreadyExcluded) {
      semgrepArgs.push("--exclude", excludedPath);
    }
  }

  return semgrepArgs;
}

const semgrepBinary = resolveSemgrepBinary();
const semgrepArgs = buildSemgrepArgs(forwardedArgs);

if (!semgrepBinary) {
  console.error(
    "Unable to locate a Semgrep CLI binary. Install Semgrep or set SEMGREP_BIN to the executable path.",
  );
  process.exit(1);
}

// nosemgrep: javascript.lang.security.detect-child-process.detect-child-process
const result = spawnSync(semgrepBinary, semgrepArgs, {
  stdio: "inherit",
  env: {
    ...process.env,
    PATH: [dirname(semgrepBinary), process.env.PATH].filter(Boolean).join(delimiter),
    PYTHONUTF8: process.env.PYTHONUTF8 || "1",
  },
  shell: false,
});

if (typeof result.status === "number") {
  process.exit(result.status);
}

process.exit(1);
