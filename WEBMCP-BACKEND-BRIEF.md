# WebMCP Backend Brief — GovToolsPro (workflowsApi)

> **🅿️ STATUS: PARKED (2026-06-12).** Do **not** start this yet. It's a dependency of the WebMCP
> browser adapter, which is itself parked until a **logged-in GovToolsPro web app** exists (see
> `WEBMCP-PHASE3-HANDOFF.md`). This brief stays valid as the spec for *when* that web app ships;
> there's nothing to change in the backend for WebMCP before then.

**Audience (when unparked):** the session working in the **GovToolsPro backend** repo
(Firebase `workflowsApi`, served at `https://mcp.govtoolspro.com/api/v1/workflows`).
**Why this exists:** the WebMCP browser adapter needs the **browser** to call the workflow
endpoints directly, using the **logged-in user's session**. Today those endpoints authenticate
via `X-API-Key` only. This brief specs the backend change (Firebase ID-token auth + CORS) that
unblocks it. **This is the gating dependency** — the adapter can't work until this lands.

---

## 1. The ask, in one line

Let the workflow endpoints accept a **Firebase ID token** (the dashboard user's session) in
addition to `X-API-Key`, and enable **CORS for the dashboard origin**, so the same account +
shared credit pool is used either way.

---

## 2. Current state (confirm before changing)

- `workflowsApi` HTTP function, base `…/api/v1/workflows`, auth = `X-API-Key` header → resolves
  to a GovToolsPro account + shared credit pool. (Same pool the extension and MCP server use.)
- Endpoints (pilot needs the first three; full list for later):
  `/balance` (GET), `/score-go-no-go` (POST), `/analyze-market` (POST),
  `/get-solicitation`, `/find-incumbents`, `/find-partners-near`, `/predict-recompete`,
  `/lookup-neco-data`, `/lookup-labor-rates`, `/analyze-award-patterns` (all POST).
- Response envelope is `{ data, disclaimer? }`. **Do not change this** — both the MCP server and
  the dashboard depend on it. (Verified live: `/balance` returns
  `{balance, subscriptionCredits, topupCredits, totalUsed, totalPurchased, subscription}`.)

---

## 3. Required changes

### 3a. Accept Firebase ID-token auth (recommended over cookies)

Add a second auth path alongside `X-API-Key`:

- If `Authorization: Bearer <token>` is present, verify it with the Firebase Admin SDK
  (`admin.auth().verifyIdToken(token)`), get the `uid`, and **resolve it to the SAME account +
  shared credit pool** the API-key path uses. Credits must debit identically regardless of auth path.
- If `X-API-Key` is present, keep the existing behavior unchanged.
- If neither, return the existing 401 shape.

> **Why Bearer ID token, not a session cookie:** the dashboard is a Firebase web app that already
> holds the user's ID token client-side. A Bearer header means **no CSRF surface** and **simpler
> CORS** (no `Allow-Credentials`/cookie handling). This supersedes the `credentials:'include'`
> sketch in the Phase 3 handoff — the dashboard's `BrowserTransport` should attach
> `Authorization: Bearer <await user.getIdToken()>` instead.

### 3a-bis. Tag usage with the `webmcp` source key (for surface analytics)

The WebMCP adapter sends an **`X-Source: webmcp`** header on every call. The backend should read
it and **stamp the usage/revenue record with `source: 'webmcp'`** (same mechanism that already
distinguishes `mcp` vs `api` traffic). The seller-analytics dashboard already declares the
`webmcp` surface (inert, $0/0) and will light up automatically the moment these records appear —
no further dashboard work. Treat an unknown/missing `X-Source` as the existing default; only
allow-list known source keys (don't reflect arbitrary header values into analytics).

### 3b. CORS for the dashboard origin

The workflow endpoints must answer cross-origin browser requests from the dashboard:

- `Access-Control-Allow-Origin: https://<DASHBOARD_ORIGIN>` — **confirm the exact origin**
  (e.g. `https://app.govtoolspro.com`). Echo a specific origin, not `*`.
- `Access-Control-Allow-Methods: GET, POST, OPTIONS`
- `Access-Control-Allow-Headers: Authorization, Content-Type, X-Source`
- Handle the **`OPTIONS` preflight** → respond `204` with the above headers.
- `Allow-Credentials` is **not** needed if using the Bearer-token approach (no cookies).

---

## 4. Scope

- **Pilot (do first):** `/balance`, `/score-go-no-go`, `/analyze-market`.
- **Then:** the remaining 7 endpoints (same auth + CORS treatment — ideally middleware so it's
  applied uniformly rather than per-endpoint).
- All 10 tools are read-only; no write/destructive endpoints are involved.

---

## 5. Security checklist

- [ ] ID-token path resolves to the **same** account/credit record as the API-key path (no
      bypass of credit accounting, set-asides, or entitlements).
- [ ] Token verification rejects expired/invalid/revoked tokens (use `verifyIdToken(token, true)`
      to check revocation if you revoke sessions).
- [ ] CORS origin is an **allow-list**, not `*` reflected blindly. Reject unknown origins.
- [ ] Rate limits / credit checks apply equally to the session path.
- [ ] No secrets (API keys, service-account material) are exposed to the browser — the browser
      only ever sends the user's own ID token.

---

## 6. Acceptance test

From the dashboard origin, logged in, in the browser console:

```js
const t = await firebase.auth().currentUser.getIdToken();
const r = await fetch('https://mcp.govtoolspro.com/api/v1/workflows/balance', {
  headers: { Authorization: `Bearer ${t}` },
});
console.log(r.status, await r.json());   // expect 200 + { data: { balance, … }, disclaimer? }
```

Plus a preflight check: an `OPTIONS` to the same URL returns `204` with the CORS headers.

**Done when:** that fetch returns the same `{ data, disclaimer }` shape as the `X-API-Key` path,
debits the user's shared credit pool correctly, and the preflight passes — for `/balance`,
`/score-go-no-go`, and `/analyze-market`.

---

## 7. First steps for the backend session

1. Locate the `workflowsApi` auth middleware (where `X-API-Key` is checked) and the CORS setup.
2. Add the Bearer/ID-token branch that resolves `uid → same account + credit pool`.
3. Add the CORS allow-list + `OPTIONS` handling (middleware, applied to all workflow routes).
4. Verify with the §6 acceptance test for the 3 pilot endpoints; then extend to all 10.
