# HAA RPC Proxy

An Express server that relays JSON-RPC requests to upstream Hive API nodes, with traffic obfuscation to resist deep packet inspection.

## Architecture

```
src/
  server.ts          # Express app setup, routes, CORS, helmet
  relay.ts           # JSON-RPC relay handler + method allowlist
  cover-site.ts      # Cover page (photography blog theme)
  deobfuscate.ts     # Deobfuscation middleware (decodes obfuscated requests)
  middleware/
    rate-limit.ts    # Per-IP rate limiting
```

## Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/` | GET | Cover site — looks like a photography blog to casual inspection |
| `/` | POST | JSON-RPC relay (drop-in Hive API replacement) |
| `/rpc` | POST | JSON-RPC relay with method allowlist |
| `/health` | GET | Health check |

## Security

- **Method allowlist** — only permitted Hive RPC methods are relayed (e.g. `condenser_api.get_accounts`, `bridge.get_discussion`)
- **Helmet** for HTTP security headers
- **CORS** configured for wallet requests
- **Per-IP rate limiting**
- **Cover site** makes the server look like a normal blog to DPI/casual inspection
- The proxy is an **untrusted relay** — it never sees private keys, only signed transactions and public blockchain data

## Traffic Obfuscation Protocol

See `project/obfuscation-protocol.md` for the full spec.

Requests are wrapped to look like REST API calls:
- Random REST-like paths (`/api/comments`, `/api/search`, etc.)
- Payload is compressed + base64-encoded
- `X-Api-Version: 1` header signals obfuscated request
- `deobfuscate.ts` middleware unwraps before relay

## Deployment

- Deployed on Fly.io (London + Singapore instances)
- `min_machines_running: 0` with auto-stop to minimize costs
- Port: 3100 (default, `PORT` env var)
- Instance ID: `PROXY_INSTANCE_ID` env var

## Dev

```bash
npm run dev    # tsx watch src/server.ts
npm start      # node --import tsx src/server.ts
```

## Endpoint Discovery

Proxy URLs are delivered to users via encrypted Hive memo transfers from `haa-service`. Each user/group gets specific endpoints. If endpoints are blocked, the user group is subdivided to isolate leaks. See project/requirements.md section 2.1 for the full per-user endpoint feed design.
