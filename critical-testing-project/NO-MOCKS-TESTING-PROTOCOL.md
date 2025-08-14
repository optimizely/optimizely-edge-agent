# NO‑MOCKS LIVE TESTING PROTOCOL (Agent + Edge)

This protocol replaces mock/unit patterns with end‑to‑end, live tests only. Run real code, hit real endpoints, fetch real content. No mocks.

## 0) Principles (MUST)
- No mocks. All tests call a running worker (local via Wrangler Dev or deployed) and validate real responses.
- Agent Mode: exercise REST API endpoints over HTTP.
- Edge Mode: exercise full pipeline with a remote content origin on a different domain.
- Every test records evidence (HTTP status, headers, body, logs).

## 1) Environment Setup (MUST)
- Node 20+, npm 10+, Wrangler 3+.
- From repo root:
  - `npm ci`
  - `npm run build:cloudflare`
- `wrangler.toml` MUST include:
  - `ROUTING_TARGET = "v2"`
  - `DEV_CONTENT_BASE_URL = "https://<REMOTE_CONTENT_BASE_DOMAIN>"` (see §3)
  - KV namespaces as checked in file
- Have a valid Optimizely Feature Experimentation SDK Key (`SDK_KEY`).

## 2) Datafile Access (MUST)
Use ONE of:
- Automatic (recommended): Provide `SDK_KEY` header on requests; the agent fetches the datafile from Optimizely CDN.
- Administrative preload (optional): Call `POST /api/datafile` with `ADMIN_TOKEN` to seed KV.

## 3) Remote Content Origin for Edge Mode (MUST)
Pick exactly one and ensure it is on a different domain than the worker:
- GitHub Pages: `https://<user>.github.io/edge-mode-content-test/`
- Cloudflare Pages with custom domain on a separate zone, e.g., `https://content.example.org`
- Vercel/Netlify static site at a distinct domain

Content structure (minimum):
```
/
  index.html
  variation-a.html
  variation-b.html
  category/backpack.html
```

Set in `wrangler.toml`: `DEV_CONTENT_BASE_URL = "https://<your-remote-domain>"`

## 4) Start Live Server (MUST)
Local live run (preferred for iteration):
```
npm run build:cloudflare
wrangler dev --local
```
Server URL: `http://localhost:8787`

Deployed live run (optional):
```
npx wrangler deploy
```
Server URL: `https://<your-worker>.workers.dev` (or custom domain)

## 5) Agent Mode — Live Test Matrix (NO MOCKS)
Use curl; replace placeholders. All MUST pass.

A. Decide: SDK key in Header (v2)
```
curl -i -X POST http://localhost:8787/api/decide \
  -H 'Content-Type: application/json' \
  -H 'X-Optimizely-Enable-FEX: true' \
  -H "X-Optimizely-SDK-Key: <SDK_KEY>" \
  --data '{"flagKey":"<FLAG_KEY>","userId":"user-1"}'
```
Verify:
- HTTP 200
- Body contains decision for `<FLAG_KEY>` with non-null variation
- Response headers: content-type, request id, trimmed decisions header (if enabled)
- No "Invalid header value" errors

B. Decide: SDK key in Query (v2)
```
curl -i -X POST "http://localhost:8787/api/decide?sdkKey=<SDK_KEY>" \
  -H 'Content-Type: application/json' \
  -H 'X-Optimizely-Enable-FEX: true' \
  --data '{"flagKey":"<FLAG_KEY>","userId":"user-2"}'
```
Verify: same as A; precedence rules honored (Header > Query > Body when combined tests are run).

C. Decide: Attributes & Decide Options (v2)
```
curl -i -X POST http://localhost:8787/api/decide \
  -H 'Content-Type: application/json' \
  -H 'X-Optimizely-Enable-FEX: true' \
  -H "X-Optimizely-SDK-Key: <SDK_KEY>" \
  -H 'X-Optimizely-Decide-Options: ["INCLUDE_REASONS","INCLUDE_VARIABLES"]' \
  --data '{"flagKey":"<FLAG_KEY>","userId":"user-3","attributes":{"tier":"gold","region":"us"}}'
```
Verify: options applied; reasons/variables present if configured.

D. Track Event (v2 pixel endpoint)
```
curl -i -X POST http://localhost:8787/track.gif \
  -H 'Content-Type: application/json' \
  -H 'X-Optimizely-Enable-FEX: true' \
  -H "X-Optimizely-SDK-Key: <SDK_KEY>" \
  --data '{"eventKey":"purchase","eventTags":{"value":9.99},"userId":"user-4"}'
```
Verify: HTTP 200; event accepted; no header errors.

E. Cookies (if enabled)
- Repeat Decide with `setResponseCookies=true` in config if applicable.
- Verify `Set-Cookie` contains visitor id and trimmed decisions; multiple cookies delivered as multiple header lines by client.

## 6) Edge Mode — Live Test Matrix (NO MOCKS)
Precondition: Flag variable `cdnVariationSettings` configured to point to your local worker for experiment URL and remote origin for content URL, e.g.:
```
{
  "cdnExperimentURL": "http://localhost:8787/",
  "cdnResponseURL": "<REMOTE_BASE>/category/backpack",
  "cacheKey": "VARIATION_KEY",
  "forwardRequestToOrigin": "false",
  "cacheRequestToOrigin": "true",
  "cacheTTL": "3600"
}
```

A. Forced Decision ON (deterministic content)
```
forced='{"<FLAG_KEY>":{"variationKey":"on"}}'
curl -i "http://localhost:8787/?force-edge-mode=true" \
  -H 'X-Optimizely-Enable-FEX: true' \
  -H "X-Optimizely-SDK-Key: <SDK_KEY>" \
  -H 'X-Optimizely-Visitor-ID: user-10' \
  -H "X-Optimizely-Forced-Decisions: $forced"
```
Verify:
- HTTP 200; body reflects `<REMOTE_BASE>/...` content
- `Set-Cookie` visitor id present (if enabled)
- Decisions header/cookie trimmed and valid (if enabled)
- No loop detected / no proxy fallback errors

B. Cache HIT on repeat
- Repeat A; verify decreased latency or cache status logs (if enabled)

C. Forced Decision OFF (different content)
- Same as A with `off`; verify different body content

D. Forward to Origin (optional)
- Set `forwardRequestToOrigin="true"`; verify origin registers request (use observable endpoint or server logs). Ensure CORS if needed.

---

## 6.1 Agent Mode — Parameter Combination Matrix (NO MOCKS)
Exercise permutations and precedence without mocks.

Dimensions:
- sdkKey source: Header | Query | Body
- userId/visitorId source: Header (`X-Optimizely-Visitor-Id`) | Query (`userId`/`visitorId`) | Body (`userId`) | Cookie (visitor id cookie present)
- attributes source: Header (`X-Optimizely-Attributes` JSON) | Query (`attributes` JSON) | Body (`attributes`)
- decideOptions source: Header (JSON array) | Query (comma CSV) | Body (array)
- flags: single `flagKey` | multiple via `/api/decide-for-keys`
- negative cases: missing required fields, invalid JSON in headers/queries
- cookies toggle: setResponseCookies on/off

Live verification per case:
- Status 200 (or expected 4xx for negatives)
- Decision non-null for positive cases
- Precedence: when the same param exists in multiple sources, Header > Query > Body
- Headers: no invalid values; trimmed decisions; correct Set-Cookie formatting when enabled

Combinatorial runners (examples):

PowerShell:
```
$EDGE="$env:EDGE_AGENT_URL"; $SDK="$env:SDK_KEY"; $FLAG="<FLAG_KEY>"
$sdkSources=@('header','query','body')
$userSources=@('header','query','body','none')
foreach($s in $sdkSources){
  foreach($u in $userSources){
    $headers=@('Content-Type: application/json','X-Optimizely-Enable-FEX: true')
    $url="$EDGE/api/decide"
    $body=@{ flagKey=$FLAG; userId='ps-user' } | ConvertTo-Json -Compress
    if($s -eq 'header'){ $headers+="X-Optimizely-SDK-Key: $SDK" }
    if($s -eq 'query'){ $url+="?sdkKey=$SDK" }
    if($s -eq 'body'){ $body=@{ flagKey=$FLAG; userId='ps-user'; sdkKey=$SDK } | ConvertTo-Json -Compress }
    if($u -eq 'header'){ $headers+="X-Optimizely-Visitor-Id: ps-user" }
    if($u -eq 'query'){ if($url -match '\?'){ $url+="&userId=ps-user" } else { $url+="?userId=ps-user" } }
    if($u -eq 'body'){ $body=@{ flagKey=$FLAG; userId='ps-user' } | ConvertTo-Json -Compress }
    Write-Host "SDK:$s USER:$u -> $url"
    curl -i -X POST $url -H $headers[0] $(if($headers.Count -gt 1){$headers | Select-Object -Skip 1 | ForEach-Object {"-H '$_'"}}) --data $body
  }
}
```

Bash:
```
EDGE="$EDGE_AGENT_URL"; SDK="$SDK_KEY"; FLAG="<FLAG_KEY>"
for s in header query body; do
  for u in header query body none; do
    headers=("-H" "Content-Type: application/json" "-H" "X-Optimizely-Enable-FEX: true")
    url="$EDGE/api/decide"
    body='{"flagKey":"'"$FLAG"'","userId":"sh-user"}'
    if [ "$s" = header ]; then headers+=("-H" "X-Optimizely-SDK-Key: $SDK"); fi
    if [ "$s" = query ]; then url="$url?sdkKey=$SDK"; fi
    if [ "$s" = body ]; then body='{"flagKey":"'"$FLAG"'","userId":"sh-user","sdkKey":"'"$SDK"'"}'; fi
    if [ "$u" = header ]; then headers+=("-H" "X-Optimizely-Visitor-Id: sh-user"); fi
    if [ "$u" = query ]; then url="$url"; url+=$( [[ "$url" == *"?"* ]] && echo "&userId=sh-user" || echo "?userId=sh-user" ); fi
    echo "SDK:$s USER:$u -> $url"
    curl -i -X POST "$url" "${headers[@]}" --data "$body"
  done
done
```

Extend loops similarly for `attributes` and `decideOptions` sources.

## 6.2 Edge Mode — Header/State Combination Matrix

Dimensions:
- FEX enable header: `X-Optimizely-Enable-FEX: true` present/absent
- Visitor id: present (header) vs absent (cookie generated)
- Forced decisions: present (valid JSON), invalid JSON, absent
- Cache override: `overrideCache=true` param present/absent
- Forwarding mode: `forwardRequestToOrigin` true/false in flag
- Cookies present/absent (existing decisions cookie affects reconciliation)

Live verification per case:
- Response body matches expected variation URL when forced decisions used
- Cache HIT on repeat when enabled
- Cookies set correctly when enabled; reconciliation removes stale experiments
- No loop detection on intended flows

Example Bash sweep:
```
EDGE="$EDGE_AGENT_URL"; SDK="$SDK_KEY"; FLAG="<FLAG_KEY>"
for forced in on off none; do
  h=("-H" "X-Optimizely-Enable-FEX: true" "-H" "X-Optimizely-SDK-Key: $SDK")
  if [ "$forced" != none ]; then
    val='{"'"$FLAG"'":{"variationKey":"'"$forced"'"}}'
    h+=("-H" "X-Optimizely-Forced-Decisions: $val")
  fi
  curl -i "$EDGE/?force-edge-mode=true" "${h[@]}"
  curl -i "$EDGE/?force-edge-mode=true" "${h[@]}"   # repeat for cache
done
```

---

## 7) Evidence Capture (MUST)
- Save each curl `-i` output to `critical-testing-project/results/reports/<timestamp>-<scenario>.txt`
- Copy Wrangler terminal logs to `critical-testing-project/results/logs/<timestamp>.txt`
- Record: status, key headers (`Set-Cookie`, decisions, visitor id), sample of body (first 200 chars)

## 8) Failure Triage (NO MOCKS)
Apply the matched corrective action and re‑run the failing test only, then the whole section.

1) Invalid header value / Set‑Cookie issues:
- Ensure compositions split newline‑joined cookies and append per cookie on Response (already implemented in v2). Do not inject array/object as header values.

2) Decisions too large / full objects in cookies:
- Ensure trimmed decisions are used for both headers and cookies; if a path writes full objects, switch to trimmed variant.

3) Edge Mode cannot fetch content:
- Confirm `DEV_CONTENT_BASE_URL` points to a different domain; switch to GitHub Pages if Cloudflare Pages same‑zone restrictions apply.
- If `forwardRequestToOrigin=true`, configure CORS on origin for your dev origin.

4) Cache not hitting:
- Verify `cacheRequestToOrigin`, `cacheTTL`, identical request repetition, and no explicit `overrideCache`.

5) Datafile not found / decisions null:
- Verify `SDK_KEY` and `flagKey` exist in the project’s datafile; if needed, preload via `POST /api/datafile` with `ADMIN_TOKEN`.

## 9) CI Live Smoke (Optional)
- Non‑mock smoke can run via curl in CI against a test deployment:
  - Health: `GET /api/test`
  - Minimal Decide
  - Minimal Edge Mode forced decision
- Save artifacts; fail on non‑200 or missing expected headers.

## 10) Exit Criteria
- All Agent Mode matrix items pass.
- All Edge Mode matrix items pass (including cache repeat).
- Evidence saved; no mock usage anywhere.
