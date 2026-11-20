#!/usr/bin/env node
// verify-coverage.mjs — machine check that a sweep obeyed SWEEP-PROTOCOL.md: every module's CLAIMED status is
// backed by the artifacts the protocol requires. The coverage-auditor runs this (and also reads independently).
//
// Usage: node pipeline/lib/verify-coverage.mjs <targetDir>   (e.g. ./my-engagement)
// Exits non-zero if any module claims a status its artifacts don't support, or if any module is left untested.
//
// Required artifacts by status (see SWEEP-PROTOCOL.md):
//   authored+    -> a test file under testing/tests/<module>*.test.mjs
//   gate_passed+ -> gate_score >= 4.5
//   run+         -> >=1 run_id whose testing/runs/<id>/steps.jsonl exists and has >=1 line
//   analyzed+    -> stage5_ref file exists
//   adjudicated/done -> stage6_ref file exists
//   done         -> all above AND endpoints_covered >= endpoint_count

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const appDir = resolve(process.argv[2] || '.');
const ledgerPath = resolve(appDir, 'testing/pipeline/COVERAGE-LEDGER.json');
if (!existsSync(ledgerPath)) { console.error(`no ledger at ${ledgerPath}`); process.exit(2); }
const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
const testsDir = resolve(appDir, 'testing/tests');
const runsDir = resolve(appDir, 'testing/runs');
const testFiles = existsSync(testsDir) ? readdirSync(testsDir) : [];

const GATE = 4.5;
const ORDER = ['not_started', 'authored', 'gate_passed', 'run', 'analyzed', 'adjudicated', 'done'];
const atLeast = (s, min) => ORDER.indexOf(s) >= ORDER.indexOf(min);
const fileOk = (p) => p && existsSync(resolve(appDir, p));
const logOk = (id) => { const p = resolve(runsDir, id, 'steps.jsonl'); try { return existsSync(p) && readFileSync(p, 'utf8').trim().length > 0; } catch { return false; } };

let incomplete = 0, untested = 0;
const rows = [];
for (const [name, m] of Object.entries(ledger.modules)) {
  const s = m.status || 'not_started';
  const checks = {
    test: (m.test_files || []).some((f) => testFiles.includes(f)) || testFiles.some((f) => f.startsWith(name)),
    gate: typeof m.gate_score === 'number' && m.gate_score >= GATE,
    log: (m.run_ids || []).some(logOk),
    s5: fileOk(m.stage5_ref),
    s6: fileOk(m.stage6_ref),
    cov: (m.endpoints_covered || 0) >= (m.endpoint_count || 0),
  };
  // Which checks are REQUIRED for the claimed status.
  const need = [];
  if (atLeast(s, 'authored')) need.push('test');
  if (atLeast(s, 'gate_passed')) need.push('gate');
  if (atLeast(s, 'run')) need.push('log');
  if (atLeast(s, 'analyzed')) need.push('s5');
  if (atLeast(s, 'adjudicated')) need.push('s6');
  if (s === 'done') need.push('cov');
  const missing = need.filter((k) => !checks[k]);
  const ok = missing.length === 0;
  if (s === 'not_started') untested++;
  if (!ok) incomplete++;
  rows.push({ name, status: s, risk: m.max_risk, ok, missing, eps: `${m.endpoints_covered || 0}/${m.endpoint_count}` });
}

rows.sort((a, b) => Number(a.ok) - Number(b.ok) || a.name.localeCompare(b.name));
console.log(`\nCoverage verification — ${ledger.total_modules} modules / ${ledger.total_endpoints} endpoints  (app: ${appDir.split(/[\\/]/).pop()})`);
console.log('status tally:', JSON.stringify(ledger.status_summary || {}));
console.log('\nmodule                         status        risk      eps      artifacts');
console.log('-'.repeat(84));
for (const r of rows) {
  const flag = r.status === 'not_started' ? 'UNTESTED' : r.ok ? 'ok' : `MISSING:${r.missing.join(',')}`;
  console.log(`${r.name.padEnd(30)} ${r.status.padEnd(13)} ${(r.risk||'').padEnd(9)} ${r.eps.padEnd(8)} ${flag}`);
}
console.log('-'.repeat(84));
console.log(`claimed-status NOT backed by artifacts: ${incomplete}   |   still not_started: ${untested}`);
const sweepComplete = incomplete === 0 && untested === 0 && rows.every((r) => r.status === 'done' || r.status === 'partial');
console.log(sweepComplete ? '\n✅ SWEEP COMPLETE — every module done/partial with artifacts present.' :
  `\n❌ SWEEP INCOMPLETE — ${untested} untested, ${incomplete} status-unsupported. Re-run the flagged modules.`);
process.exit(incomplete === 0 && untested === 0 ? 0 : 1);
