# FINAL CORRECTIONS AUDIT — Optimizely Edge Agent v2

Purpose: Establish a single, prescriptive, ambiguity‑free process to validate and correct the v2 implementation across Agent Mode (POST) and Edge Mode (GET), with a repeatable cross‑domain Edge Mode testing recipe, hard pass/fail gates, and corrective action steps.

This document is executable: follow steps in order. Do not skip or re‑order.

## 0. Preconditions (MUST)
1. OS: Windows 10/11 with PowerShell.
2. Tools installed and on PATH: Node 20+, npm 10+, git, Wrangler 3+ (`wrangler --version`), curl.
3. From repo root: `npm ci` completes without errors.
4. Ensure these files exist:
   - `wrangler.toml` with `ROUTING_TARGET = "v2"`.
   - `src-v2/` and its `composition/*.ts` present.
5. Environment network access to:
   - Optimizely CDN for datafiles.
   - Your chosen remote content origin (see §3).

If any precondition fails → STOP and fix before proceeding.

## 1. Test Suite Inventory (Authoritative)
We will validate ALL v2 tests discovered in the repo. Categories and entry points:

1. Node-mode unit/integration (services focus):
   - Config file: `src-v2/tests/vitest.config.ts` (environment: node)
   - Include: `src-v2/tests/**/*.test.ts` (services, adapters unit, some integration)

2. Workers-mode integration (Cloudflare simulation):
   - Config file: `vitest.config.ts` (uses @cloudflare/vitest‑pool‑workers)
   - Requires build output present

3. Targeted runners:
   - URL matching/components: `npm run test:url-matching` (delegates to `src-v2/tests/run-url-matching-tests.ts`)
   - Integration harness: `src-v2/tests/run-integration-tests.ts`

Explicit coverage (non‑exhaustive, MUST run):
 - Services: DecisionService, ConfigurationService, CookieService, CacheService, ContentFetcher, ContentTransformer, RequestForwarder, URLMatcher, FlagStorageService
 - Adapters: Cloudflare/Vercel/Fastly Request/Response/Environment/Storage
 - Edge Mode: EdgeModeHandler, EdgeModeIntegration, pipeline integration
 - API: ApiRouter endpoints, Response headers/cookies
 - Metrics: CloudflareMetricsAdapter

## 2. Test Execution Sequence (MUST)
Execute in this order. Capture exit code and summary after each step.

1) Build Cloudflare bundle (required for Workers-mode tests)
```powershell
npm run build:cloudflare
```

2) Run Node-mode suite (services + unit/integration)
```powershell
npx vitest run -c src-v2/tests/vitest.config.ts
```
Pass criteria: 100% of tests in this run must pass.

3) Run Workers-mode suite (Cloudflare simulated env)
```powershell
npx vitest run -c vitest.config.ts
```
Pass criteria: 100% of tests in this run must pass.

4) Run component battery (URL matching + pipeline)
```powershell
npm run test:url-matching
```
Pass criteria: 100% pass.

5) Optional live integration (if EDGE_AGENT_URL and SDK_KEY are set)
```powershell
npm run test:integration
```
Pass criteria: All cases pass or are marked expected‑skip in this audit; otherwise file a defect in §7.

If any step fails → proceed to §7 Corrective Actions, then re‑run from the failed step.

## 3. Edge Mode Cross‑Domain Testing Recipe (MUST)
Problem: Same‑zone/same‑origin restrictions can block fetching Pages content when the worker and content share a zone. Solution: use a distinct remote content origin under a different domain.

Approved recipes (choose ONE):

A) GitHub Pages (recommended, fast)
1. Create a public repo `edge-mode-content-test` with structure:
```
/
  index.html         # control
  variation-a.html   # A
  variation-b.html   # B
  category/backpack.html
```
2. Enable GitHub Pages (e.g., `https://<user>.github.io/edge-mode-content-test`).
3. Note the absolute base URL, e.g., `https://<user>.github.io/edge-mode-content-test`.

B) Cloudflare Pages + Custom Domain (mirrors production)
1. Deploy a Pages project with the same structure above.
2. Attach a custom domain NOT in the same zone as your API worker, e.g., `content.example.org`.

C) Vercel/Netlify static site (separate domain)
1. Deploy static site with the same structure.
2. Ensure the domain is different from your API worker domain.

Configuration (all recipes):
1. In `wrangler.toml` set:
   - `ROUTING_TARGET = "v2"`
   - `DEV_CONTENT_BASE_URL = "<REMOTE_CONTENT_BASE_URL>"`
2. In your Optimizely flag `cdnVariationSettings` (for Edge Mode tests):
```json
{
  "cdnExperimentURL": "http://localhost:8787/",          
  "cdnResponseURL": "<REMOTE_CONTENT_BASE_URL>/category/backpack",
  "cacheKey": "VARIATION_KEY",
  "forwardRequestToOrigin": "false",
  "cacheRequestToOrigin": "true",
  "cacheTTL": "3600"
}
```
3. If you test forward‑to‑origin, set `forwardRequestToOrigin = "true"` and ensure CORS on the remote origin allows your local dev origin (`http://localhost:8787`).

Pass criteria for infra: Hitting localhost via Wrangler returns content from the remote origin based on the decided variation, with correct headers and cookies.

## 4. Local Dev Harness (MUST)
1) Start local worker with v2 routing
```powershell
npm run build:cloudflare
wrangler dev --local
```
Expected log: “Listening on http://localhost:8787”. Keep this terminal open.

2) Smoke test health
```powershell
curl -i http://localhost:8787/api/test
```
HTTP 200 and JSON body expected.

## 5. Agent Mode Validation (MUST)
Run all tests. Replace placeholders with your values.

Inputs required:
- SDK key in header, query, and body variants.
- Optional: forced decisions header.

1) Decide with SDK key in header
```powershell
curl -i -X POST http://localhost:8787/api/decide ^
  -H "Content-Type: application/json" ^
  -H "X-Optimizely-Enable-FEX: true" ^
  -H "X-Optimizely-SDK-Key: <SDK_KEY>" ^
  --data '{"flagKey":"<FLAG_KEY>","userId":"user-1"}'
```
Expect: 200; decisions present; headers/cookies per config; no invalid header values.

2) Decide with SDK key in query
```powershell
curl -i -X POST "http://localhost:8787/api/decide?sdkKey=<SDK_KEY>" ^
  -H "Content-Type: application/json" ^
  -H "X-Optimizely-Enable-FEX: true" ^
  --data '{"flagKey":"<FLAG_KEY>","userId":"user-2"}'
```
Expect: 200, identical decision logic. Precedence honored (Header > Query > Body).

3) Track event (eventKey + eventTags)
```powershell
curl -i -X POST http://localhost:8787/track.gif ^
  -H "Content-Type: application/json" ^
  -H "X-Optimizely-Enable-FEX: true" ^
  -H "X-Optimizely-SDK-Key: <SDK_KEY>" ^
  --data '{"eventKey":"purchase","eventTags":{"value":9.99},"userId":"user-3"}'
```
Expect: 200; validates event dispatch pipeline; no header errors.

Pass criteria (Agent Mode): All three pass; headers validated; Set‑Cookie formatting correct (no TypeErrors); trimmed decision headers length under limits.

## 6. Edge Mode Validation (MUST)

Base request with forced decisions to exercise pipeline deterministically:

1) Force ON variation and verify content
```powershell
curl -i "http://localhost:8787/?force-edge-mode=true" ^
  -H "X-Optimizely-Enable-FEX: true" ^
  -H "X-Optimizely-SDK-Key: <SDK_KEY>" ^
  -H "X-Optimizely-Visitor-ID: user-4" ^
  -H "X-Optimizely-Forced-Decisions: {\"<FLAG_KEY>\":{\"variationKey\":\"on\"}}"
```
Expect: 200; body reflects `<REMOTE_CONTENT_BASE_URL>/...` content; Set‑Cookie present (visitor + decisions when enabled); no loop detected; if `forwardRequestToOrigin=true`, origin receives request.

2) Repeat same request to assert cache HIT
Expect: cache status logs indicate HIT; response time decreased.

3) Force OFF variation and verify different content
Same as (1) but variationKey `off`; expect different body; cookies updated if enabled.

4) Header/Cookie audit
- Verify `Set-Cookie` returned as multiple lines internally and correctly appended on Response.
- Verify decisions header size reasonable; debug header present only when enabled.

Pass criteria (Edge Mode): Deterministic variation → deterministic content; cache HIT on repeat; cookies set when configured; no loop‑detection fallback; headers/cookies formatting valid.

## 7. Corrective Actions (IF ANY FAIL)
Apply ONLY the action matching the observed failure. Verify and re‑run the failing step.

1) Invalid header value / Set‑Cookie formatting
- Ensure newline‑joined Set‑Cookie handling is active in compositions (Cloudflare/Vercel). Already implemented in v2 compositions. If regression: re‑enable splitting by `\n` and appending per cookie before Response creation.

2) Decisions cookie too large / includes full objects
- In `RequestHandler`, ensure cookies use trimmed decisions from `createTrimmedDecisions(...)` consistently.
- If `ApiRouter` injects decisions directly into cookies in JSON: replace with trimmed value (same schema as header) or disable cookies via config for test.

3) Edge Mode cannot fetch remote content (cross‑domain)
- Confirm `DEV_CONTENT_BASE_URL` set to remote site domain (§3).
- If using Cloudflare Pages: ensure content is on a custom domain not sharing the worker’s zone; if still blocked, switch to GitHub Pages recipe.
- Add permissive CORS on content origin (Access‑Control‑Allow‑Origin: http://localhost:8787) for forward‑to‑origin scenarios.

4) Cache not hitting
- Verify `cacheRequestToOrigin` and `cacheTTL` in flag; verify `CacheManager` TTL.
- Ensure no `overrideCache=true` on request; repeat identical request.

5) Vercel storage/metrics unavailable
- Storage: proceed with in‑memory; for real KV set `KV_REST_API_URL` and `KV_REST_API_TOKEN`, add `@vercel/kv` dev dep.
- Metrics: set `METRICS_PROVIDER` to `prometheus|datadog|newrelic` or keep undefined to disable.

6) Fastly metrics missing
- Implement minimal `createMetricsAdapter()` in `FastlyAdapterFactory` using `NoOpMetricsAdapter` or standard metrics adapter until a real one is integrated.

7) Any test failure in §2
- Open the failing test file; fix source under test per failure; re‑run only that config (Node or Workers). Do not proceed until passing.

## 8. CI Gate (MUST before merge)
CI must run both suites and the component battery:

Matrix (suggested): node: [18, 20]
- `npm run build:cloudflare`
- `npx vitest run -c src-v2/tests/vitest.config.ts`
- `npx vitest run -c vitest.config.ts`
- `npm run test:url-matching`

Fail on any non‑zero exit code.

## 9. Evidence Logging (MUST)
For each validation sequence (§5, §6):
- Save raw curl `-i` output to `critical-testing-project/results/reports/<timestamp>-<scenario>.txt`.
- Capture the Wrangler dev terminal logs for the same period to `results/logs/<timestamp>.txt` (copy/paste if needed).
- Note decision keys, variation keys, and cache status in a short checklist.

## 10. Configuration Canon (Authoritative)
Minimum variables for Cloudflare local dev (`wrangler.toml`):
- `ROUTING_TARGET = "v2"`
- `DEV_CONTENT_BASE_URL = "<REMOTE_CONTENT_BASE_URL>"`
- Metrics variables may remain enabled as currently configured.
- KV namespaces present (as currently checked in file).

## 11. Exit Criteria (Definition of Done)
All of the following MUST be true:
1. §2 test sequence steps 2, 3, and 4: all pass.
2. §5 Agent Mode: all pass on localhost.
3. §6 Edge Mode: all pass on localhost against remote origin.
4. No header/cookie formatting errors; no loop‑detection aborts in intended scenarios.
5. Evidence artifacts saved under `critical-testing-project/results/` with timestamps.
6. If corrections were applied (§7), all re‑tests pass.

## 12. Optional Platform Parity Steps (Post‑Cloudflare)

Vercel (Edge Functions):
1. Use `src-v2/vercel.ts` entry and `vercel-test-app` for local dev (`vercel dev`).
2. Keep cookies disabled if not required, or plumb `CookieService` if parity is required.
3. Storage: start with in‑memory; enable `@vercel/kv` when credentials are available.

Fastly:
1. Build with `npm run build:fastly`.
2. Use No‑Op metrics adapter until a platform adapter is integrated.

— End of document —


