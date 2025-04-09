# CDN Variation Settings Test Results

Test Date: Invalid Date

## Summary

- Edge Agent URL: `https://edge-agent-test.expedge.workers.dev`
- SDK Key: `8mR1pGh8u2ztUP8GqjmQq`
- Test User ID: `test-user-757231`
- Results: 0/6 tests passed (0%)

## Test Results

### URL Pattern Matching - ❌ FAIL

Verify URL pattern matching for path: /edge-test/forward

**Path:** `/edge-test/forward`

**Details:**

```
{
  "response": {
    "url": "https://edge-agent-test.expedge.workers.dev/edge-test/forward",
    "status": 500,
    "statusText": "Internal Server Error",
    "headers": {
      "alt-svc": "h3=\":443\"; ma=86400",
      "cf-ray": "92dc0e93d8cba548-MIA",
      "connection": "keep-alive",
      "content-length": "111",
      "content-type": "application/json",
      "date": "Wed, 09 Apr 2025 18:27:10 GMT",
      "nel": "{\"success_fraction\":0,\"report_to\":\"cf-nel\",\"max_age\":604800}",
      "report-to": "{\"endpoints\":[{\"url\":\"https:\\/\\/a.nel.cloudflare.com\\/report\\/v4?s=%2Bepbk4i0ruGsirRtZq43zrPlccyCzgk30IzSx%2FQNUc%2FeGJ9lsaPv72OVHAwk%2BEO8F4SCBL7c2PM484GYvIL3dqVqr87MuiLVScyWC2OtpKZPqaU5TOVWDOYtX73AucEkKotpo1795lHW0oyk5S7UHsRBLECDrw%3D%3D\"}],\"group\":\"cf-nel\",\"max_age\":604800}",
      "server": "cloudflare",
      "server-timing": "cfL4;desc=\"?proto=TCP&rtt=26189&min_rtt=25482&rtt_var=8515&sent=5&recv=5&lost=0&retrans=0&sent_bytes=2849&recv_bytes=819&delivery_rate=140213&cwnd=33&unsent_bytes=0&cid=15e58d276f903d57&ts=95&x=0\"",
      "vary": "Accept-Encoding",
      "x-implementation-version": "v2",
      "x-request-id": "e454261e-440e-4587-9f5e-c8e96b3dc285, e454261e-440e-4587-9f5e-c8e96b3dc285"
    },
    "body": {
      "error": "Error processing Edge Mode request",
      "message": "Cannot read properties of null (reading 'targetUrl')"
    },
    "ok": false
  },
  "isVariationApplied": false,
  "isEdgeResponse": false
}
```

### URL Pattern Matching - ❌ FAIL

Verify URL pattern matching for path: /edge-test/no-forward

**Path:** `/edge-test/no-forward`

**Details:**

```
{
  "response": {
    "url": "https://edge-agent-test.expedge.workers.dev/edge-test/no-forward",
    "status": 500,
    "statusText": "Internal Server Error",
    "headers": {
      "alt-svc": "h3=\":443\"; ma=86400",
      "cf-ray": "92dc0e9479b5a548-MIA",
      "connection": "keep-alive",
      "content-length": "111",
      "content-type": "application/json",
      "date": "Wed, 09 Apr 2025 18:27:10 GMT",
      "nel": "{\"success_fraction\":0,\"report_to\":\"cf-nel\",\"max_age\":604800}",
      "report-to": "{\"endpoints\":[{\"url\":\"https:\\/\\/a.nel.cloudflare.com\\/report\\/v4?s=TGekEW1DeVqlfAC%2FQyu9wfoxUO0DdXlIgD%2Fd86QQwcNE3%2BQ%2FqAsLSqRMcVJ%2FRT3HdU1N3YrCgbQUDmYozowdWeYVdiLBhVxVBSfIExSq%2B0RCFtdwT0wJ5aR2xnM20KQ2FJe29Whn14XiKMN9PTcq5o6OTrip8w%3D%3D\"}],\"group\":\"cf-nel\",\"max_age\":604800}",
      "server": "cloudflare",
      "server-timing": "cfL4;desc=\"?proto=TCP&rtt=26199&min_rtt=25482&rtt_var=6407&sent=8&recv=7&lost=0&retrans=0&sent_bytes=4391&recv_bytes=1168&delivery_rate=140213&cwnd=35&unsent_bytes=0&cid=15e58d276f903d57&ts=148&x=0\"",
      "vary": "Accept-Encoding",
      "x-implementation-version": "v2",
      "x-request-id": "9e0c4b9b-7601-4929-8bf2-702555f171c5, 9e0c4b9b-7601-4929-8bf2-702555f171c5"
    },
    "body": {
      "error": "Error processing Edge Mode request",
      "message": "Cannot read properties of null (reading 'targetUrl')"
    },
    "ok": false
  },
  "isVariationApplied": false,
  "isEdgeResponse": false
}
```

### URL Pattern Matching - ❌ FAIL

Verify URL pattern matching for path: /edge-test/transform

**Path:** `/edge-test/transform`

**Details:**

```
{
  "response": {
    "url": "https://edge-agent-test.expedge.workers.dev/edge-test/transform",
    "status": 500,
    "statusText": "Internal Server Error",
    "headers": {
      "alt-svc": "h3=\":443\"; ma=86400",
      "cf-ray": "92dc0e94ba1ca548-MIA",
      "connection": "keep-alive",
      "content-length": "111",
      "content-type": "application/json",
      "date": "Wed, 09 Apr 2025 18:27:10 GMT",
      "nel": "{\"success_fraction\":0,\"report_to\":\"cf-nel\",\"max_age\":604800}",
      "report-to": "{\"endpoints\":[{\"url\":\"https:\\/\\/a.nel.cloudflare.com\\/report\\/v4?s=%2FMdpB1QNSG%2FJLxJmZwJH4hLPH71EfUVBTainyS0bAsUofE%2FD%2BfUR7dAFpUu47ZVhFXNY5VkRj%2BD9O%2Fv2cr9Z8EkCXml55gpY7MBAEWK9RMKc%2BokzKJkwWTDnl8GnH2qPoxr7pDjmjegfW3MW%2Ba25k1vJtFfUxQ%3D%3D\"}],\"group\":\"cf-nel\",\"max_age\":604800}",
      "server": "cloudflare",
      "server-timing": "cfL4;desc=\"?proto=TCP&rtt=26410&min_rtt=25482&rtt_var=5226&sent=9&recv=8&lost=0&retrans=0&sent_bytes=5489&recv_bytes=1516&delivery_rate=140213&cwnd=36&unsent_bytes=0&cid=15e58d276f903d57&ts=191&x=0\"",
      "vary": "Accept-Encoding",
      "x-implementation-version": "v2",
      "x-request-id": "b8154823-a9d0-44f5-ac0e-18c2fd6339c7, b8154823-a9d0-44f5-ac0e-18c2fd6339c7"
    },
    "body": {
      "error": "Error processing Edge Mode request",
      "message": "Cannot read properties of null (reading 'targetUrl')"
    },
    "ok": false
  },
  "isVariationApplied": false,
  "isEdgeResponse": false
}
```

### URL Pattern Matching - ❌ FAIL

Verify URL pattern matching for path: /edge-test/control

**Path:** `/edge-test/control`

**Details:**

```
{
  "response": {
    "url": "https://edge-agent-test.expedge.workers.dev/edge-test/control",
    "status": 500,
    "statusText": "Internal Server Error",
    "headers": {
      "alt-svc": "h3=\":443\"; ma=86400",
      "cf-ray": "92dc0e950a8ea548-MIA",
      "connection": "keep-alive",
      "content-length": "111",
      "content-type": "application/json",
      "date": "Wed, 09 Apr 2025 18:27:10 GMT",
      "nel": "{\"success_fraction\":0,\"report_to\":\"cf-nel\",\"max_age\":604800}",
      "report-to": "{\"endpoints\":[{\"url\":\"https:\\/\\/a.nel.cloudflare.com\\/report\\/v4?s=ouQEt%2FXMTkXoPj86KhLSUMwCpBUVBpyvnJCcQmsIcdOPYebFetECCVAhvlG58SzTCatRT8DHArT2wAlCiKylOKilZH%2FYiHfQ5x5%2Bvg2J%2FTMygQZ8X81%2FiXurnItoz8AZ6AFgzm5obOecKF3ekblilEmBV1aUkQ%3D%3D\"}],\"group\":\"cf-nel\",\"max_age\":604800}",
      "server": "cloudflare",
      "server-timing": "cfL4;desc=\"?proto=TCP&rtt=26881&min_rtt=25482&rtt_var=4862&sent=10&recv=9&lost=0&retrans=0&sent_bytes=6591&recv_bytes=1862&delivery_rate=140213&cwnd=37&unsent_bytes=0&cid=15e58d276f903d57&ts=235&x=0\"",
      "vary": "Accept-Encoding",
      "x-implementation-version": "v2",
      "x-request-id": "e2632b4b-3a77-4a03-b3a4-f817a8ca4490, e2632b4b-3a77-4a03-b3a4-f817a8ca4490"
    },
    "body": {
      "error": "Error processing Edge Mode request",
      "message": "Cannot read properties of null (reading 'targetUrl')"
    },
    "ok": false
  },
  "isVariationApplied": false,
  "isEdgeResponse": false
}
```

### URL Pattern Matching - ❌ FAIL

Verify URL pattern matching for path: /edge-test/treatment

**Path:** `/edge-test/treatment`

**Details:**

```
{
  "response": {
    "url": "https://edge-agent-test.expedge.workers.dev/edge-test/treatment",
    "status": 500,
    "statusText": "Internal Server Error",
    "headers": {
      "alt-svc": "h3=\":443\"; ma=86400",
      "cf-ray": "92dc0e954b32a548-MIA",
      "connection": "keep-alive",
      "content-length": "111",
      "content-type": "application/json",
      "date": "Wed, 09 Apr 2025 18:27:10 GMT",
      "nel": "{\"success_fraction\":0,\"report_to\":\"cf-nel\",\"max_age\":604800}",
      "report-to": "{\"endpoints\":[{\"url\":\"https:\\/\\/a.nel.cloudflare.com\\/report\\/v4?s=Nz42KbbbftQJPth%2BCdxJO8Lh1McKsg4hPYfFKvl8IuMTHwwjBbkY4t9YneqdJAqTrXMoEzVLR3C5DPd3bIP1LdSxfwMCb8%2Fxdrl%2Fb4MYYia5EZu7P6d4Co5SGwpNRH4NKxItEusCAyyqVTJc%2FsnRbyNTPSSFzg%3D%3D\"}],\"group\":\"cf-nel\",\"max_age\":604800}",
      "server": "cloudflare",
      "server-timing": "cfL4;desc=\"?proto=TCP&rtt=27401&min_rtt=25482&rtt_var=4687&sent=11&recv=10&lost=0&retrans=0&sent_bytes=7688&recv_bytes=2210&delivery_rate=140213&cwnd=38&unsent_bytes=0&cid=15e58d276f903d57&ts=284&x=0\"",
      "vary": "Accept-Encoding",
      "x-implementation-version": "v2",
      "x-request-id": "adaf8cb3-ee0c-4f2c-b336-5fe4177b5921, adaf8cb3-ee0c-4f2c-b336-5fe4177b5921"
    },
    "body": {
      "error": "Error processing Edge Mode request",
      "message": "Cannot read properties of null (reading 'targetUrl')"
    },
    "ok": false
  },
  "isVariationApplied": false,
  "isEdgeResponse": false
}
```

### URL Pattern Matching - ❌ FAIL

Verify URL pattern matching for path: /non-matching-path

**Path:** `/non-matching-path`

**Details:**

```
{
  "response": {
    "url": "https://edge-agent-test.expedge.workers.dev/non-matching-path",
    "status": 500,
    "statusText": "Internal Server Error",
    "headers": {
      "alt-svc": "h3=\":443\"; ma=86400",
      "cf-ray": "92dc0e959bafa548-MIA",
      "connection": "keep-alive",
      "content-length": "111",
      "content-type": "application/json",
      "date": "Wed, 09 Apr 2025 18:27:10 GMT",
      "nel": "{\"success_fraction\":0,\"report_to\":\"cf-nel\",\"max_age\":604800}",
      "report-to": "{\"endpoints\":[{\"url\":\"https:\\/\\/a.nel.cloudflare.com\\/report\\/v4?s=164eGJ31YSlgA4cy88OC%2B5v5wpsFYIDAuBLzrNJnWqZMue1eWO%2Fr7y6%2FBrNBZdPHVw%2FqZ1dToYOj7ys0yl05%2FUQmyeA0keysXN0B0Qwcr1Di7Z1GSHu4DDi92pc9hn6rTw19V4n3sQMBuPDhaXiLT5WuxIA9Ow%3D%3D\"}],\"group\":\"cf-nel\",\"max_age\":604800}",
      "server": "cloudflare",
      "server-timing": "cfL4;desc=\"?proto=TCP&rtt=27375&min_rtt=25482&rtt_var=3568&sent=12&recv=11&lost=0&retrans=0&sent_bytes=8784&recv_bytes=2556&delivery_rate=140213&cwnd=38&unsent_bytes=0&cid=15e58d276f903d57&ts=326&x=0\"",
      "vary": "Accept-Encoding",
      "x-implementation-version": "v2",
      "x-request-id": "b737a03c-95d7-447d-86fc-629a5bb676ed, b737a03c-95d7-447d-86fc-629a5bb676ed"
    },
    "body": {
      "error": "Error processing Edge Mode request",
      "message": "Cannot read properties of null (reading 'targetUrl')"
    },
    "ok": false
  },
  "isVariationApplied": false,
  "isEdgeResponse": false
}
```

