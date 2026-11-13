#!/usr/bin/env node
/**
 * Dist gate: the shipped build must actually LOAD.
 *
 * TypeScript typechecks can pass while the emitted output is unusable —
 * this script guards that class of bug by loading dist/index.js twice:
 *
 *   1. require()        — the CJS path (the package's real runtime entry,
 *                         "type": "commonjs"), asserting KyroClient is a
 *                         callable constructor and every expected export
 *                         is present — and nothing unexpected is added.
 *   2. dynamic import() — the ESM path (bundlers and node ESM resolve
 *                         dist through "exports"), asserting the named
 *                         exports surface there too (cjs-module-lexer
 *                         detection, exactly what `import { KyroClient }
 *                         from "@kyroinfra/kyro"` hits in an .mjs).
 *
 * Exit 0 = the published artifact would load in every mode consumers use.
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distPath = path.join(root, 'dist', 'index.js');

/**
 * The complete expected export surface of the package. A new export must be
 * added here deliberately, in the same commit that adds it — an accidental
 * removal or rename fails this gate instead of shipping.
 */
const EXPECTED = [
  // the client
  'KyroClient',
  // the error taxonomy (alphabetical)
  'KyroApiError',
  'KyroAuthError',
  'KyroConflictError',
  'KyroFileTooLargeError',
  'KyroForbiddenError',
  'KyroNotFoundError',
  'KyroRateLimitError',
  'KyroServiceUnavailableError',
  'KyroStorageLimitError',
  'KyroUnprocessableError',
  'KyroUnsupportedMediaTypeError',
  'KyroValidationError',
];

function fail(message) {
  console.error(`check-dist: FAIL — ${message}`);
  process.exit(1);
}

// 1. CJS — the "type": "commonjs" require() path.
const require = createRequire(import.meta.url);
let cjs;
try {
  cjs = require(distPath);
} catch (err) {
  fail(`require("dist/index.js") threw: ${err.message}`);
}

if (typeof cjs.KyroClient !== 'function') {
  fail('CJS: KyroClient is not a constructor function');
}

const cjsMissing = EXPECTED.filter((name) => cjs[name] === undefined);
if (cjsMissing.length > 0) {
  fail(`CJS: missing exports: ${cjsMissing.join(', ')}`);
}

const cjsExtra = Object.keys(cjs).filter(
  (name) => !EXPECTED.includes(name) && name !== '__esModule',
);
if (cjsExtra.length > 0) {
  fail(`CJS: unexpected exports: ${cjsExtra.join(', ')}`);
}

// 2. ESM — the dynamic import() path consumers hit from .mjs / bundlers.
let esm;
try {
  esm = await import(pathToFileURL(distPath).href);
} catch (err) {
  fail(`import("dist/index.js") threw: ${err.message}`);
}

const esmMissing = EXPECTED.filter((name) => esm[name] === undefined);
if (esmMissing.length > 0) {
  fail(`ESM: named exports not detected: ${esmMissing.join(', ')}`);
}

if (typeof esm.KyroClient !== 'function') {
  fail('ESM: KyroClient is not a constructor function');
}

console.log(
  `check-dist: OK — require() and import() both resolve all ${EXPECTED.length} exports; KyroClient is a constructor in both`,
);
