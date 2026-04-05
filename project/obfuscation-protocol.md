# HAA Traffic Obfuscation Protocol — v1

## Purpose

Make JSON-RPC traffic between the HAA wallet and proxy servers indistinguishable from ordinary REST API calls when inspected via deep packet inspection (DPI).

## Overview

The protocol wraps Hive JSON-RPC requests inside normal-looking HTTP POST requests to REST-like endpoints. The actual payload is compressed and base64-encoded, making it opaque to content inspection.

## Request Format

**Method:** `POST`

**Path:** One of several REST-like paths, chosen randomly per request:
- `/api/comments`
- `/api/search`
- `/api/posts`
- `/api/feed`
- `/api/notifications`
- `/api/analytics`
- `/api/content`
- `/api/media`

**Headers:**
```
Content-Type: application/json
X-Api-Version: 1
```

The `X-Api-Version: 1` header signals to the proxy that the request is obfuscated and should be decoded before processing. Requests without this header are treated as normal traffic.

**Body:**
```json
{
  "q": "<base64(gzip(json_rpc_request))>",
  "sid": "<random_hex_string>"
}
```

| Field | Type   | Description |
|-------|--------|-------------|
| `q`   | string | The encoded payload: JSON-RPC request → gzip compressed → base64 encoded |
| `sid` | string | Random 16-character hex string. Adds plausibility as a session identifier. Not used by the proxy. |

## Response Format

**Status:** `200 OK`

**Body:**
```json
{
  "ok": true,
  "data": {
    "r": "<base64(gzip(json_rpc_response))>"
  }
}
```

| Field    | Type    | Description |
|----------|---------|-------------|
| `ok`     | boolean | `true` if the relay succeeded |
| `data.r` | string  | The encoded response: JSON-RPC response → gzip compressed → base64 encoded |

**Error response:**
```json
{
  "ok": false,
  "error": "description of error"
}
```

## Encoding Steps

### Client (encode request)

1. Construct a standard JSON-RPC 2.0 request object
2. Serialize to JSON string
3. Compress with gzip (using `CompressionStream` in browsers)
4. Encode the compressed bytes as base64
5. Wrap in the request body format with a random `sid`
6. POST to a randomly chosen `/api/:path` endpoint

### Proxy (decode request → encode response)

1. Detect the `X-Api-Version: 1` header
2. Read `q` field from the request body
3. Decode base64 → decompress gzip → parse JSON
4. Process the JSON-RPC request through the normal relay (method allowlist, upstream forwarding)
5. Take the JSON-RPC response, serialize to JSON, gzip compress, base64 encode
6. Wrap in the response body format and return

### Client (decode response)

1. Parse the response JSON
2. Read `data.r` field
3. Decode base64 → decompress gzip (using `DecompressionStream`) → parse JSON
4. Use the resulting JSON-RPC response normally

## Detection Resistance

What DPI sees on the wire:

- **URL:** `POST /api/comments` — a normal REST API endpoint
- **Headers:** Standard `Content-Type: application/json` with an innocuous `X-Api-Version`
- **Request body:** `{"q":"H4sIAAAA...","sid":"a1b2c3d4"}` — a generic JSON object with a base64 blob
- **Response body:** `{"ok":true,"data":{"r":"H4sIAAAA..."}}` — a generic API response

What DPI does **not** see:

- No `jsonrpc` field
- No Hive method names (`condenser_api.get_accounts`, `broadcast_transaction`, etc.)
- No Hive-specific data structures (account names, operations, signatures)
- No recognizable JSON-RPC error codes

## Limitations

- **Not encryption.** The payload is compressed and encoded, not encrypted. A determined adversary who knows the protocol can decode it. This is obfuscation, not cryptography.
- **TLS required.** The base64 payload is visible in plaintext over HTTP. HTTPS is mandatory for any meaningful protection.
- **Header fingerprinting.** The `X-Api-Version` header is a weak signal. Future versions may eliminate it in favor of path-based or body-structure-based detection.
- **Traffic analysis.** Request/response sizes and timing patterns may still fingerprint Hive RPC traffic. Future versions may add padding and timing jitter.

## Compatibility

Any implementation that follows this spec can interoperate:
- **Wallet implementations** can use any compatible proxy
- **Proxy implementations** can serve any compatible wallet
- The protocol version (`X-Api-Version: 1`) ensures forward compatibility

## Version History

| Version | Changes |
|---------|---------|
| 1       | Initial protocol: gzip + base64, random REST paths, `X-Api-Version` detection |
