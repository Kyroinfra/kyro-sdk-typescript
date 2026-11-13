#!/usr/bin/env node
/**
 * Pack-payload gate: `npm pack --dry-run` must contain ONLY the shipping
 * surface — dist/** plus the two files npm always includes (README.md,
 * package.json). The allowlist is the guarantee: any other file fails the
 * gate, so source, tests, the playground, secrets, and stray artifacts can
 * never leak into a published tarball. The explicit denylist entries exist
 * to name the culprit clearly if one of the known risk paths ever shows up.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fail(message) {
  console.error(`check-pack: FAIL — ${message}`);
  process.exit(1);
}

const res = spawnSync(
  'npm',
  ['pack', '--dry-run', '--json'],
  { cwd: root, encoding: 'utf8' },
);

if (res.error) fail(`npm pack could not run: ${res.error.message}`);
if (res.status !== 0) {
  fail(`npm pack exited ${res.status}\n${res.stderr}`);
}

let json;
try {
  json = JSON.parse(res.stdout);
} catch {
  fail(`npm pack --json output was not JSON:\n${res.stdout.slice(0, 400)}`);
}

const pack = Array.isArray(json) ? json[0] : json;
const files = pack?.files;
if (!Array.isArray(files) || files.length === 0) {
  fail('npm pack reported no files');
}

// Allowed payload: the built dist tree, plus the two files npm includes
// automatically. Everything else is a leak.
const ALLOWED = [/^dist\//, /^README\.md$/, /^package\.json$/];
// Known risk paths — never publishable, called out by name in the failure.
const FORBIDDEN = [
  [/^src\//, 'source files'],
  [/^tests?\//, 'test files'],
  [/^playground\//, 'playground files'],
  [/^\.env/, 'dotfiles and secrets'],
  [/node_modules/, 'dependencies'],
];

const leaks = [];
for (const file of files) {
  if (!ALLOWED.some((re) => re.test(file.path))) {
    const reason = FORBIDDEN.find(([re]) => re.test(file.path))?.[1];
    leaks.push(reason ? `${file.path} (${reason})` : file.path);
  }
}

if (leaks.length > 0) {
  fail(`payload contains ${leaks.length} file(s) outside dist/:\n  ${leaks.join('\n  ')}`);
}

const totalBytes = files.reduce((sum, f) => sum + (f.size ?? 0), 0);
console.log(
  `check-pack: OK — ${files.length} files, all inside dist/ (+ README.md, package.json); ${(totalBytes / 1024).toFixed(1)} kB unpacked`,
);
