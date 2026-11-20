// pipeline/lib/handoff.mjs — build an ISOLATED input folder for a validator sub-agent (the OPERATING-CONTRACT;
// SUBAGENT-CHARTER.md). The whole point of points 2/5/6/13: each judging agent must see ONLY what we hand it
// — never the finding it is supposed to independently reach, never the repo at large, never the other agents'
// conclusions. We cannot OS-jail a sub-agent's reads, so we enforce by construction + instruction:
//
//   1. Copy EXACTLY the allowed inputs into runs/<id>/handoff/<stage>-<nonce>/inputs/.
//   2. Drop a MANIFEST.json (what's inside, the hash of each file) and a READ-ME-FIRST.md (the hard rule:
//      "everything you need is in this folder; you may not read anything outside it").
//   3. The orchestrator launches the Agent with a prompt that points ONLY at this folder.
//
// Usage:
//   import { buildHandoff } from '../lib/handoff.mjs';
//   const h = buildHandoff({ runDir, stage: '02-test-validation', role: 'test-validator',
//                            charterPath, roleCardPath, inputs: [{ as: 'tests/foo.mjs', from: absPath }],
//                            task: 'Rate the security-focus of these tests per the rubric.' });
//   // -> h.dir (give this to the sub-agent), h.manifestPath

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { createHash } from 'node:crypto';

function sha256(p) { return createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 16); }
function nonce() { return Math.random().toString(36).slice(2, 8); }

/**
 * @param {object} o
 * @param {string} o.runDir   absolute path to the pipeline run dir
 * @param {string} o.stage    e.g. '02-test-validation' | '05-log-analysis' | '06-adjudication'
 * @param {string} o.role     which role card governs this agent, e.g. 'test-validator'
 * @param {string} o.charterPath absolute path to SUBAGENT-CHARTER.md (always included)
 * @param {string} o.roleCardPath absolute path to the role card for this stage (always included)
 * @param {Array<{as:string, from:string}>} o.inputs files to copy in (as = relative name inside inputs/)
 * @param {string} o.task     one-paragraph task statement written into READ-ME-FIRST.md
 * @param {object} [o.context] small JSON facts the agent is allowed to know (NOT conclusions)
 */
export function buildHandoff({ runDir, stage, role, charterPath, roleCardPath, inputs = [], task, context = {} }) {
  const dir = resolve(runDir, 'handoff', `${stage}-${nonce()}`);
  const inputsDir = resolve(dir, 'inputs');
  mkdirSync(inputsDir, { recursive: true });

  const copied = [];
  const place = (as, from) => {
    if (!existsSync(from)) throw new Error(`handoff input missing: ${from}`);
    const dest = resolve(inputsDir, as);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(from, dest);
    copied.push({ as, sha256: sha256(dest) });
  };
  if (charterPath) place('_charter/SUBAGENT-CHARTER.md', charterPath);
  if (roleCardPath) place(`_charter/ROLE-${basename(roleCardPath)}`, roleCardPath);
  for (const { as, from } of inputs) place(as, from);

  const manifest = {
    stage, role, created_at: new Date().toISOString(),
    rule: 'The sub-agent may read ONLY files under this handoff folder. Reading anything outside it voids the result.',
    context, files: copied,
  };
  const manifestPath = resolve(dir, 'MANIFEST.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  writeFileSync(resolve(dir, 'READ-ME-FIRST.md'), [
    `# READ ME FIRST — isolated handoff for the \`${role}\` agent (stage ${stage})`,
    '',
    '## The one hard rule',
    'Everything you need to do your job is inside **this folder**. You **may not** open, read, search, list, or',
    'fetch anything outside it — not the repository, not other apps, not previous findings, not the internet.',
    'If something you think you need is not here, that is deliberate: say so in your output and stop. Do **not**',
    'go looking for it. Reading outside this folder voids your verdict and the whole run is discarded.',
    '',
    '## You have no prior knowledge',
    'You do not know this system. You have not seen earlier stages. You hold no opinion about whether a bug',
    '"should" exist. Judge **only** the evidence in `inputs/`, against the rubric in `_charter/`. No favoritism,',
    'no benefit of the doubt in either direction — for the system or for the finding.',
    '',
    '## What is in here',
    '- `_charter/` — the rules you operate under (the charter + your role card). Read these first.',
    '- `inputs/` — the exact material to judge. Nothing else exists for you.',
    '- `MANIFEST.json` — the list + hashes of every file you were given.',
    '',
    '## Your task',
    task || '(see your role card in _charter/)',
    '',
    '## Your output',
    'Return ONLY the structured result your role card specifies (JSON matching the schema it names). Every claim',
    'must cite a file + location inside `inputs/`. If you cannot prove it from `inputs/`, you may not assert it.',
  ].join('\n'));

  return { dir, inputsDir, manifestPath, manifest };
}
