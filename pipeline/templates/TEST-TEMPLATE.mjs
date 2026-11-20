// TEST-TEMPLATE.mjs — copy this to <App>/testing/tests/<module>.test.mjs and fill it in (Stage 1).
//
// A security test: create your OWN objects, attempt the ILLEGAL action, assert the SECURE outcome.
// Every call goes through the harness so it is logged (req+resp) for Stages 5–6. Secret-free: read env only.
//
// Run:  node <App>/testing/tests/<module>.test.mjs        (no-ops offline if the engagement isn't authorized)

import { Run, loadAppConfig, loadEnv, tag, PlanningOnly } from '../../../pipeline/lib/harness.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const APP = 'example-app'; // <-- the target folder name; must have a pipeline.app.json
const MODULE = 'example';  // <-- the module under test

async function main() {
  // Resolve the app dir from THIS file's location (fileURLToPath — never new URL().pathname, which breaks on Windows).
  const cfg = loadAppConfig(resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')); // tests -> testing -> <App>

  let env;
  try { env = loadEnv(cfg); }
  catch (e) {
    if (e instanceof PlanningOnly) { console.log(`[planning-only] ${e.message}`); return; } // build, don't send
    throw e;
  }
  const run = new Run({ app: APP, module: MODULE, env, cfg });
  const base = env.BASE_URL || env.HOST;

  try {
    // --- Example 1: BOLA — tenant B must not read tenant A's object -------------------------------------
    // (Assumes env carries TOKEN_A / TOKEN_B fixtures. Adapt field/paths to the real module.)
    // 1. As A, create an object you own, tagged `redteam` so it's unmistakably yours.
    const createA = await run.request({
      intent: 'fixture: create A-owned object', method: 'POST', url: `${base}/example`,
      token: env.TOKEN_A, body: { name: tag(), note: 'redteam BOLA fixture' },
      expected: '201/200 — owner may create',
    });
    run.expect(createA.status, [200, 201], 'A can create its own object');
    const aId = createA.json?.id ?? createA.json?.data?.id;
    if (aId) run.registerObject('example', aId, { owner: 'A' });

    // 2. As B, attempt to read A's object. SECURE = denied.
    if (aId) {
      const readAsB = await run.request({
        intent: 'BOLA: read A-owned object as B', method: 'GET', url: `${base}/example/${aId}`,
        token: env.TOKEN_B, expected: '403/404 — cross-tenant read must be denied',
      });
      const secure = run.expect(readAsB.status, [403, 404], 'B cannot read A-owned object');
      // Only a finding if B actually got A's data back — prove it from the body, don't assume from status.
      if (!secure && readAsB.json && JSON.stringify(readAsB.json).includes(String(aId))) {
        run.finding(`BOLA: tenant B read A-owned example ${aId} (status ${readAsB.status})`);
      }
    }

    // --- Example 2: Mass-assignment — over-post a privileged field, verify it did NOT take ----------------
    const overpost = await run.request({
      intent: 'mass-assignment: over-post role/namespace', method: 'POST', url: `${base}/example`,
      token: env.TOKEN_B, body: { name: tag(), role: 'admin', namespace: 'A', note: 'redteam massassign' },
      expected: 'privileged fields ignored (201 but not applied), or 400',
    });
    const mId = overpost.json?.id ?? overpost.json?.data?.id;
    if (mId) run.registerObject('example', mId, { owner: 'B' });
    if (mId) {
      const readback = await run.request({
        intent: 'mass-assignment: read back to check privileged field', method: 'GET',
        url: `${base}/example/${mId}`, token: env.TOKEN_B,
        expected: 'role/namespace NOT set to the over-posted values',
      });
      const applied = readback.json?.role === 'admin' || readback.json?.namespace === 'A';
      run.expect(applied ? 'applied' : 'ignored', ['ignored'], 'over-posted privileged fields were not applied');
      if (applied) run.finding(`Mass-assignment: over-posted role/namespace persisted on example ${mId}`);
    }

    // --- Cleanup: delete ONLY the ids you created this run (no-delete rule) -------------------------------
    for (const { id } of run.createdIds.slice()) {
      await run.request({ intent: 'cleanup own object', method: 'DELETE', url: `${base}/example/${id}`,
        token: env.TOKEN_A, expected: '200/204 — deleting own object' });
    }
  } finally {
    run.finish('example module: BOLA + mass-assignment');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
