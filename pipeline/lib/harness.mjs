// pipeline/lib/harness.mjs — a shared, target-agnostic request/response logger for the
// secure-testing pipeline (see ../OPERATING-CONTRACT.md; PIPELINE.md Stage 4).
//
// REFERENCE IMPLEMENTATION. This is one concrete harness so EVERY target logs tests the same way;
// treat it as an executable spec of the behaviour each stage needs, and port it to your own stack.
//
// What it gives you:
//   - loadAppConfig(appDir) : read pipeline.app.json (where is the env file, the runs dir, the scope)
//   - loadEnv(cfg)          : read the target env file, fail-closed if not authorized (planning-only stays offline)
//   - new Run({app, module}): a run that logs EVERY step (full req+response) to <runs>/<id>/steps.jsonl
//   - run.request(...)      : make a call; capture + log inputs and outputs
//   - run.expect(...)       : assert expected-vs-actual ("what secure looks like")
//   - run.finding(...)      : flag a confirmed hit — STOP and notify a human (see ../OPERATING-CONTRACT.md)
//   - run.finish(...)       : write the manifest with counters
//
// AUTHORIZATION, not tokens, gates live traffic. Whether to mask secrets in logs is an engagement
// choice: set { maskSecrets: true } per-run (or MASK_SECRETS=1 in the target env) for a shared/exported
// run. Traffic is NEVER sent unless the target env is authorized (loadEnv is fail-closed). Keep raw
// full-fidelity logs out of any shared location unless the engagement explicitly permits it.

import { readFileSync, existsSync, mkdirSync, appendFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const PIPELINE_ROOT = resolve(HERE, '..');        // lib -> pipeline
export const REPO_ROOT = resolve(PIPELINE_ROOT, '..');   // pipeline -> repo root

// ---- app config -----------------------------------------------------------

/** Each target directory carries a pipeline.app.json describing where its env + runs live and its scope.
 *  Example (example-app/pipeline.app.json):
 *    { "app": "example-app", "envFile": "env/dev.env",
 *      "runsDir": "runs", "requireMarker": "<AUTHORIZED_MARKER>" }
 *  If the file is absent we fall back to sane defaults rooted at the target dir. */
export function loadAppConfig(appDir) {
  const root = resolve(appDir);
  const p = resolve(root, 'pipeline.app.json');
  let cfg = {};
  if (existsSync(p)) { try { cfg = JSON.parse(readFileSync(p, 'utf8')); } catch { cfg = {}; } }
  return {
    app: cfg.app || root.split(/[\\/]/).pop(),
    appRoot: root,
    envFile: resolve(root, cfg.envFile || 'knowledge-base/environments/dev.env'),
    runsDir: resolve(root, cfg.runsDir || 'testing/runs'),
    // An env key that MUST be present+truthy before live traffic is allowed (the authorization gate).
    // null means "the credential below is enough"; a string names an extra marker the operator sets on sign-off.
    requireMarker: cfg.requireMarker ?? null,
    maskSecrets: cfg.maskSecrets ?? false,
    // Auth model. 'bearer' (default) → Authorization: Bearer <TOKEN>. 'cookie' → Cookie: <name>=<identity cookie>.
    authMode: cfg.authMode || 'bearer',
    cookieName: cfg.cookieName || null,          // e.g. '__Secure-better-auth.session_token'
    // Identity → env-var name holding that identity's credential. Lets tests say as:'A'|'B'|'low'|'super'.
    identities: cfg.identities || { A: 'SESSION_COOKIE' },
    defaultIdentity: cfg.defaultIdentity || Object.keys(cfg.identities || { A: 1 })[0] || 'A',
  };
}

/** Thrown when the engagement is not live / not authorized. Scripts catch this to exit without sending traffic. */
export class PlanningOnly extends Error {}
/** Thrown when a request targets a host outside the pinned authorization scope (scope-discipline). */
export class OutOfScope extends Error {}

/** Parse KEY=VALUE lines from the app env. Fail closed if the file (or TOKEN, or the required marker) is missing. */
export function loadEnv(cfg, { requireToken = true } = {}) {
  if (!existsSync(cfg.envFile)) {
    throw new PlanningOnly(
      `No env at ${cfg.envFile}. Posture is PLANNING-ONLY until the app's AUTHORIZATION is signed and the ` +
      `env is filled (the OPERATING-CONTRACT). Build and validate tests; send no live traffic.`
    );
  }
  const env = {};
  for (const line of readFileSync(cfg.envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    env[m[1]] = m[2].replace(/^["']|["']$/g, '').replace(/\s+#.*$/, '').trim();
  }
  if (cfg.requireMarker && !env[cfg.requireMarker]) {
    throw new PlanningOnly(
      `${cfg.envFile} has no '${cfg.requireMarker}' marker — the engagement is NOT signed off. Posture is ` +
      `planning-only; refusing live traffic even if a leftover credential is present. After the owner signs and ` +
      `sets a valid window, add '${cfg.requireMarker}=<signoff-date>' to the env to enable live testing.`
    );
  }
  // Fail-closed on the credential appropriate to the auth model.
  if (requireToken) {
    if (cfg.authMode === 'cookie') {
      const defKey = cfg.identities?.[cfg.defaultIdentity];
      if (!defKey || !env[defKey]) {
        throw new PlanningOnly(
          `${cfg.envFile} has no session cookie for the default identity '${cfg.defaultIdentity}' ` +
          `(env key '${defKey}') — not authorized/configured for live traffic (the OPERATING-CONTRACT). Re-run sign-in first.`
        );
      }
    } else if (!env.TOKEN) {
      throw new PlanningOnly(`${cfg.envFile} has no TOKEN — not authorized/configured for live traffic (the OPERATING-CONTRACT).`);
    }
  }
  env.__app = cfg.app;
  return env;
}

/** Allowed hostnames = those pinned in the env (HOST + BASE_URL). The authorization boundary, machine-checked. */
export function scopeHosts(env) {
  const hosts = new Set();
  for (const key of ['HOST', 'BASE_URL', 'SPA_URL']) {
    if (env[key]) { try { hosts.add(new URL(env[key]).hostname.toLowerCase()); } catch { /* ignore */ } }
  }
  return hosts;
}

/** Iron law (scope-discipline): refuse any URL whose host is not pinned in the env. Exact-match, no suffix tricks. */
export function assertInScope(url, env) {
  let host;
  try { host = new URL(url).hostname.toLowerCase(); } catch { throw new OutOfScope(`Un-parseable URL: ${url}`); }
  const allowed = scopeHosts(env);
  if (!allowed.has(host)) {
    throw new OutOfScope(
      `OUT OF SCOPE: ${host} is not pinned in ${env.__app || 'app'} env (allowed: ${[...allowed].join(', ') || 'none'}). ` +
      `Stop, do not send (the OPERATING-CONTRACT; scope-discipline).`
    );
  }
  return host;
}

// ---- secret masking (OFF by default; opt-in per run) ----------------------

const SECRET_HEADERS = new Set(['authorization', 'cookie', 'set-cookie', 'x-api-key', 'proxy-authorization']);
const SECRET_KEY = /^(otp|mfa|code|password|passwd|pwd|secret|token|refresh_?token|access_?token|api_?key|signature|private_?key)$/i;
const MASK = 'REDACTED';

function maskHeaders(h = {}, on) {
  if (!on) return h;
  const out = {};
  for (const [k, v] of Object.entries(h)) out[k] = SECRET_HEADERS.has(k.toLowerCase()) ? MASK : v;
  return out;
}
function maskBody(v, on) {
  if (!on) return v;
  if (Array.isArray(v)) return v.map((x) => maskBody(x, on));
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, val] of Object.entries(v)) out[k] = SECRET_KEY.test(k) ? MASK : maskBody(val, on);
    return out;
  }
  return v;
}

// ---- helpers --------------------------------------------------------------

/** A recognizable tag for objects you create, so they're never confused with pre-existing data (no-delete rule).
 *  Canonical: every created resource's name starts with the `redteam` prefix. */
export function tag(prefix = 'redteam') { return `${prefix}-${Math.random().toString(36).slice(2, 10)}`; }
function nowIso() { return new Date().toISOString(); }
function safe(s) { return String(s).replace(/[^a-z0-9._-]+/gi, '-'); }
function safeJson(s) { if (typeof s !== 'string') return s; try { return JSON.parse(s); } catch { return s; } }

// ---- Run ------------------------------------------------------------------

export class Run {
  constructor({ app, module, operator = 'agent', cfg, env, maskSecrets } = {}) {
    if (!app) throw new Error('Run needs { app } (e.g. "example-app") to resolve the target config.');
    if (!module) throw new Error('Run needs a { module } name for the run-id and manifest.');
    this.cfg = cfg || loadAppConfig(resolve(REPO_ROOT, app));
    this.env = env || loadEnv(this.cfg);
    this.app = this.cfg.app;
    this.module = module;
    this.operator = operator;
    this.mask = maskSecrets ?? (this.env.MASK_SECRETS === '1') ?? this.cfg.maskSecrets ?? false;
    this.startedAt = nowIso();
    this.runId = `${safe(this.startedAt).replace(/[:.]/g, '-')}-${safe(module)}`;
    this.dir = resolve(this.cfg.runsDir, this.runId);
    mkdirSync(this.dir, { recursive: true });
    this.stepsFile = resolve(this.dir, 'steps.jsonl');
    this.n = 0;
    this.counts = { steps: 0, pass: 0, fail: 0, findings: 0 };
    this.createdIds = []; // [{ resourceType, id }] — reconcile to empty before session end (no-delete rule)
    this._writeManifest('running');
    console.log(`[run ${this.app}/${this.runId}] logging to ${this.stepsFile}`);
  }

  _append(obj) { appendFileSync(this.stepsFile, JSON.stringify(obj) + '\n'); }

  _writeManifest(state, summary) {
    writeFileSync(resolve(this.dir, 'manifest.json'), JSON.stringify({
      run_id: this.runId, app: this.app, module: this.module, operator: this.operator,
      state, started_at: this.startedAt, ended_at: state === 'running' ? null : nowIso(),
      host: this.env.HOST || null, base_url: this.env.BASE_URL || null,
      masked: this.mask, counts: this.counts, created_ids: this.createdIds, summary: summary || null,
    }, null, 2));
  }

  /** Resolve the auth header(s) for an identity. Bearer mode → Authorization; cookie mode → Cookie. */
  _authHeaders(as, token) {
    if (as === 'none') return {};
    if (this.cfg.authMode === 'cookie') {
      const key = this.cfg.identities?.[as ?? this.cfg.defaultIdentity];
      const val = key ? this.env[key] : null;
      if (!val || !this.cfg.cookieName) return {};
      return { Cookie: `${this.cfg.cookieName}=${val}` };
    }
    const bearer = token || this.env.TOKEN;
    return bearer ? { Authorization: `Bearer ${bearer}` } : {};
  }

  /** Make a request; log the full input and output as one step. Returns { status, ok, headers, body, json }.
   *  Pass `path` (prepended with env.BASE_URL) or a full `url`. `as` picks the identity (cookie mode). */
  async request({ intent, endpoint, method = 'GET', url, path, headers = {}, body, token, expected, script, auth = true, as, redirect }) {
    if (!url && path) url = (this.env.BASE_URL || this.env.HOST || '').replace(/\/$/, '') + (path.startsWith('/') ? path : `/${path}`);
    if (!url) throw new Error('request() needs a url or path');
    assertInScope(url, this.env); // scope-discipline: fail-closed before the packet leaves
    const identity = as ?? this.cfg.defaultIdentity;
    const authHeader = auth ? this._authHeaders(identity, token) : {};
    const finalHeaders = { ...(body ? { 'Content-Type': 'application/json' } : {}), ...authHeader, ...headers };
    const init = { method, headers: finalHeaders };
    if (redirect) init.redirect = redirect; // 'manual' to capture 3xx Location (open-redirect tests)
    if (body !== undefined && body !== null) init.body = typeof body === 'string' ? body : JSON.stringify(body);

    this.n += 1; this.counts.steps += 1;
    let status = null, resHeaders = {}, text = '', json = null, error = null;
    const t0 = Date.now();
    try {
      const res = await fetch(url, init);
      status = res.status;
      resHeaders = Object.fromEntries(res.headers.entries());
      text = await res.text();
      try { json = JSON.parse(text); } catch { /* non-JSON kept as text */ }
    } catch (e) { error = String(e); }

    const step = {
      step: this.n, ts: nowIso(), ms: Date.now() - t0, run_id: this.runId, app: this.app, operator: this.operator,
      as: identity, intent: intent || null, endpoint: endpoint || `${method} ${url}`, script: script || null,
      request: { method, url, headers: maskHeaders(finalHeaders, this.mask), body: maskBody(safeJson(init.body), this.mask) },
      response: { status, headers: maskHeaders(resHeaders, this.mask), body: maskBody(json ?? text, this.mask) },
      expected: expected || null, error,
    };
    this._append(step);
    console.log(`[step ${this.n}] ${method} ${url} -> ${status ?? 'ERR'}${intent ? `  (${intent})` : ''}`);
    return { status, ok: status >= 200 && status < 300, headers: resHeaders, body: json ?? text, json };
  }

  /** Encode "what secure looks like": assert the actual status is one of the allowed ones. Logs PASS/FAIL. */
  expect(actualStatus, allowed, description) {
    const ok = (Array.isArray(allowed) ? allowed : [allowed]).includes(actualStatus);
    this.counts[ok ? 'pass' : 'fail'] += 1;
    this._append({ step: this.n, ts: nowIso(), type: 'assert', pass: ok, actualStatus, allowed, description });
    console.log(`   ${ok ? 'PASS' : 'FAIL'} — ${description} (got ${actualStatus}, want ${JSON.stringify(allowed)})`);
    return ok;
  }

  /** Mark a confirmed finding. STOP escalating and notify a human (the OPERATING-CONTRACT). Does not throw. */
  finding(summary) {
    this.counts.findings += 1;
    this._append({ step: this.n, ts: nowIso(), type: 'finding', summary });
    console.log(`   *** FINDING: ${summary} — STOP, log it, notify admin (the OPERATING-CONTRACT) ***`);
  }

  note(message) { this._append({ step: this.n, ts: nowIso(), type: 'note', message }); }

  /** Record an object you created so it's tracked for cleanup and never mistaken for pre-existing data. */
  registerObject(resourceType, id, extra = {}) {
    this.createdIds.push({ resourceType, id });
    this.note(`registered created object ${resourceType}:${id} ${JSON.stringify(extra)}`);
    return id;
  }

  finish(summary) {
    this._writeManifest('done', summary);
    const c = this.counts;
    console.log(`[run ${this.app}/${this.runId}] done — steps:${c.steps} pass:${c.pass} fail:${c.fail} findings:${c.findings}`);
    if (this.createdIds.length) {
      console.log(`   NOTE: ${this.createdIds.length} object(s) still registered — reconcile to zero (no-delete rule).`);
    }
  }
}
