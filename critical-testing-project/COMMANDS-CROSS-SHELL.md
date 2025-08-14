# Cross-Shell Command Guide (PowerShell vs. Linux Bash)

This guide is NO‑MOCKS ONLY. No vitest. No unit runners. Live tests hit a running worker (local via Wrangler or deployed) and a real remote content origin.

Use alongside `NO-MOCKS-TESTING-PROTOCOL.md`.

## 1) Environment Variables

PowerShell:
```powershell
$env:SDK_KEY = "FVxxxxxxxxxxxxxxxxxxxxxP"
$env:EDGE_AGENT_URL = "http://localhost:8787"    # or your deployed URL
$env:REMOTE_BASE = "https://<your-remote-content-domain>"  # e.g., GitHub Pages
```

Bash:
```bash
export SDK_KEY="FVxxxxxxxxxxxxxxxxxxxxxP"
export EDGE_AGENT_URL="http://localhost:8787"    # or your deployed URL
export REMOTE_BASE="https://<your-remote-content-domain>"
```

## 2) Install & Build

PowerShell:
```powershell
npm ci
npm run build:cloudflare
```

Bash:
```bash
npm ci
npm run build:cloudflare
```

## 3) Start Local Dev (Wrangler)

PowerShell:
```powershell
wrangler dev --local
```

Bash:
```bash
wrangler dev --local
```

Keep this terminal open (logs stream here). All curl commands below target `$env:EDGE_AGENT_URL` / `$EDGE_AGENT_URL`.

## 4) Agent Mode — Decide (SDK key in Header, v2)

PowerShell:
```powershell
curl -i -X POST "$env:EDGE_AGENT_URL/api/decide" `
  -H 'Content-Type: application/json' `
  -H 'X-Optimizely-Enable-FEX: true' `
  -H "X-Optimizely-SDK-Key: $env:SDK_KEY" `
  --data '{"flagKey":"<FLAG_KEY>","userId":"user-1"}'
```

Bash:
```bash
curl -i -X POST "$EDGE_AGENT_URL/api/decide" \
  -H 'Content-Type: application/json' \
  -H 'X-Optimizely-Enable-FEX: true' \
  -H "X-Optimizely-SDK-Key: $SDK_KEY" \
  --data '{"flagKey":"<FLAG_KEY>","userId":"user-1"}'
```

## 5) Agent Mode — Decide (SDK key in Query, v2)

PowerShell:
```powershell
curl -i -X POST "$env:EDGE_AGENT_URL/api/decide?sdkKey=$($env:SDK_KEY)" `
  -H 'Content-Type: application/json' `
  -H 'X-Optimizely-Enable-FEX: true' `
  --data '{"flagKey":"<FLAG_KEY>","userId":"user-2"}'
```

Bash:
```bash
curl -i -X POST "$EDGE_AGENT_URL/api/decide?sdkKey=$SDK_KEY" \
  -H 'Content-Type: application/json' \
  -H 'X-Optimizely-Enable-FEX: true' \
  --data '{"flagKey":"<FLAG_KEY>","userId":"user-2"}'
```

## 6) Agent Mode — Track Event (v2 pixel endpoint)

PowerShell:
```powershell
curl -i -X POST "$env:EDGE_AGENT_URL/track.gif" `
  -H 'Content-Type: application/json' `
  -H 'X-Optimizely-Enable-FEX: true' `
  -H "X-Optimizely-SDK-Key: $env:SDK_KEY" `
  --data '{"eventKey":"purchase","eventTags":{"value":9.99},"userId":"user-3"}'
```

Bash:
```bash
curl -i -X POST "$EDGE_AGENT_URL/track.gif" \
  -H 'Content-Type: application/json' \
  -H 'X-Optimizely-Enable-FEX: true' \
  -H "X-Optimizely-SDK-Key: $SDK_KEY" \
  --data '{"eventKey":"purchase","eventTags":{"value":9.99},"userId":"user-3"}'
```

## 7) Edge Mode — Forced Decision (ON)

PowerShell:
```powershell
$forced = '{"<FLAG_KEY>":{"variationKey":"on"}}'
curl -i "$env:EDGE_AGENT_URL/?force-edge-mode=true" `
  -H 'X-Optimizely-Enable-FEX: true' `
  -H "X-Optimizely-SDK-Key: $env:SDK_KEY" `
  -H 'X-Optimizely-Visitor-ID: user-4' `
  -H "X-Optimizely-Forced-Decisions: $forced"
```

Bash:
```bash
forced='{"<FLAG_KEY>":{"variationKey":"on"}}'
curl -i "$EDGE_AGENT_URL/?force-edge-mode=true" \
  -H 'X-Optimizely-Enable-FEX: true' \
  -H "X-Optimizely-SDK-Key: $SDK_KEY" \
  -H 'X-Optimizely-Visitor-ID: user-4' \
  -H "X-Optimizely-Forced-Decisions: $forced"
```

## 8) Edge Mode — Forced Decision (OFF)

PowerShell:
```powershell
$forced = '{"<FLAG_KEY>":{"variationKey":"off"}}'
curl -i "$env:EDGE_AGENT_URL/?force-edge-mode=true" `
  -H 'X-Optimizely-Enable-FEX: true' `
  -H "X-Optimizely-SDK-Key: $env:SDK_KEY" `
  -H 'X-Optimizely-Visitor-ID: user-4' `
  -H "X-Optimizely-Forced-Decisions: $forced"
```

Bash:
```bash
forced='{"<FLAG_KEY>":{"variationKey":"off"}}'
curl -i "$EDGE_AGENT_URL/?force-edge-mode=true" \
  -H 'X-Optimizely-Enable-FEX: true' \
  -H "X-Optimizely-SDK-Key: $SDK_KEY" \
  -H 'X-Optimizely-Visitor-ID: user-4' \
  -H "X-Optimizely-Forced-Decisions: $forced"
```

## 9) Evidence Capture (Recommended)

PowerShell:
```powershell
# Save response
curl -i "$env:EDGE_AGENT_URL/api/test" > "critical-testing-project/results/reports/$(Get-Date -Format yyyyMMdd-HHmmss)-health.txt"
```

Bash:
```bash
curl -i "$EDGE_AGENT_URL/api/test" > "critical-testing-project/results/reports/$(date +%Y%m%d-%H%M%S)-health.txt"
```

## 10) Deployed Smoke (Optional)

If deployed, set `EDGE_AGENT_URL` to your live URL and reuse the same commands.

— End —
