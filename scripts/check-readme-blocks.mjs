#!/usr/bin/env node
/**
 * README gate: every ```ts code block in README.md must typecheck against
 * src/ (the source of truth) under strict mode. Documentation that stops
 * compiling is documentation that lies — this gate fails the build when a
 * README example drifts from the real API.
 *
 * How it works, per run (everything lands in .readme-extracts/, which is
 * deleted in a finally block — the tree is always clean afterwards):
 *
 *   1. Extract the fenced ```ts blocks from README.md, in document order.
 *   2. Write each block as block-NN.ts with `export {}` appended, making
 *      every block a module. README examples are fragments — most reference
 *      a `kyro` client, ids, or a blob that "exists" in the surrounding
 *      prose. As modules, per-block names like `const kyro` shadow the
 *      ambient declarations instead of colliding with them.
 *   3. Write preamble.d.ts — the global ambient context those fragments
 *      imply (the client instance, ids, an uploadable blob, a retry
 *      callback), typed from the real API via type-only import().
 *   4. Write a strict tsconfig whose paths map "@kyroinfra/kyro" to
 *      ../src/index.ts, so blocks compile against source, not the
 *      installed package.
 *   5. Run the repo's own tsc over the extracts. Non-zero exit fails the
 *      gate with the compiler's diagnostics.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readmePath = path.join(root, 'README.md');
const workDir = path.join(root, '.readme-extracts');
const tscBin = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');

function fail(message) {
  console.error(`check-readme: FAIL — ${message}`);
  process.exit(1);
}

// ── 1. Extract the fenced ```ts blocks ────────────────────────────────────
const lines = readFileSync(readmePath, 'utf8').split('\n');
const blocks = [];
let current = null;
for (const line of lines) {
  if (current === null) {
    if (/^```ts\s*\r?$/.test(line)) current = [];
  } else if (/^```\s*\r?$/.test(line)) {
    blocks.push(current.join('\n'));
    current = null;
  } else {
    current.push(line);
  }
}
if (current !== null) fail('README.md ends inside an unterminated ```ts fence');
if (blocks.length === 0) fail('README.md contains no ```ts code blocks');

// ── 2–4. Build the compile context ────────────────────────────────────────
if (!existsSync(tscBin)) {
  fail(`typescript not installed at ${tscBin} — run npm install first`);
}

// Failures inside the try are collected and only reported AFTER the finally
// below has removed the extracts dir — process.exit would bypass it and
// leave the scratch tree behind.
let failure = null;

try {
  rmSync(workDir, { recursive: true, force: true });
  mkdirSync(workDir, { recursive: true });

  blocks.forEach((code, i) => {
    const name = `block-${String(i + 1).padStart(2, '0')}.ts`;
    writeFileSync(path.join(workDir, name), `${code}\n\nexport {};\n`);
  });

  // Ambient scope implied by the README's fragment style: the examples read
  // as if a client, ids, an uploadable blob, and a retry callback already
  // exist from earlier snippets. Declared globally; module-scoped block
  // declarations shadow these where a block declares its own.
  writeFileSync(
    path.join(workDir, 'preamble.d.ts'),
    `// Ambient declarations for README example fragments — see scripts/check-readme-blocks.mjs
declare const KyroClient: typeof import('@kyroinfra/kyro').KyroClient;
declare const kyro: import('@kyroinfra/kyro').KyroClient;
declare const blob: Blob;
declare const pdfBlob: Blob;
declare const fileId: string;
declare const fileId1: string;
declare const fileId2: string;
declare const collectionId: string;
declare function retry(): void;
`,
  );

  writeFileSync(
    path.join(workDir, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2020',
          module: 'ESNext',
          moduleResolution: 'bundler',
          strict: true,
          esModuleInterop: true,
          noEmit: true,
          skipLibCheck: true,
          // Mirror the SDK's own compile: the root tsconfig sets no lib, so
          // its public File/Blob types resolve to the DOM globals that the
          // default lib for ES2020 provides. The README upload examples pass
          // such a Blob.
          lib: ['ES2020', 'DOM'],
          // Explicit, deterministic node typing for blocks that use Node
          // globals (process, setTimeout) — don't rely on auto-inclusion.
          types: ['node'],
          paths: {
            // Blocks compile against src/ — the source of truth — never the
            // installed package, so the gate tracks the code being changed.
            // Paths entries resolve relative to this tsconfig without baseUrl
            // (baseUrl is deprecated in TypeScript 6).
            '@kyroinfra/kyro': ['../src/index.ts'],
          },
        },
        include: ['block-*.ts', 'preamble.d.ts'],
      },
      null,
      2,
    ),
  );

  // ── 5. Compile ──────────────────────────────────────────────────────────
  const res = spawnSync(
    process.execPath,
    [tscBin, '-p', path.join(workDir, 'tsconfig.json')],
    { encoding: 'utf8' },
  );

  if (res.error) {
    failure = `could not run tsc: ${res.error.message}`;
  } else if (res.status !== 0) {
    const out = `${res.stdout ?? ''}${res.stderr ?? ''}`.trim();
    failure = `${blocks.length} README code blocks do not typecheck against src/ (strict):\n\n${out}`;
  } else {
    console.log(
      `check-readme: OK — ${blocks.length}/${blocks.length} README code blocks compile against src/ (strict)`,
    );
  }
} catch (err) {
  failure = err?.message ?? String(err);
} finally {
  rmSync(workDir, { recursive: true, force: true });
}

if (failure !== null) {
  console.error(`check-readme: FAIL — ${failure}`);
  process.exit(1);
}
