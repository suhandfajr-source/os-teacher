# iPaymu integration — verified documentation notes

Status: planning only; no gateway calls, credentials configured, database migrations, deployment or live payment tests performed.

## Sources

Accessed through the public iPaymu documentation MCP (`https://docs.ipaymu.com/api/mcp`) on 2026-11-08:

- https://docs.ipaymu.com/id/docs
- https://docs.ipaymu.com/id/docs/signature
- https://docs.ipaymu.com/id/docs/payment/redirect-payment
- https://docs.ipaymu.com/id/docs/callback
- https://docs.ipaymu.com/id/docs/transaction/check-transaction
- https://docs.ipaymu.com/id/docs/ip-domain-validation

This MCP exposes documentation search/read only; it is not merchant account access or a transaction executor.

## Environments and rollout

Sandbox base URL/dashboard: `https://sandbox.ipaymu.com`.
Production base URL/dashboard: `https://my.ipaymu.com`.
VA and API key differ between these environments. Both must come from the Integration menu for the selected environment. Never reuse the key disclosed in chat, copy merchant credentials into this file, or infer environment from credential format.

Plan: mock tests, then sandbox, then separately authorized production deployment/test after credential rotation and readiness checks. Retain DOKU default until explicit configuration switch. Sandbox orders must not activate production subscriptions.

Production requires a static outbound IP registered with iPaymu and approved domains for URLs supplied in requests (including notify/return/cancel and additional subdomains). A single IP lookup does not prove a static allocation. The user-reported egress address still needs ISP confirmation; Cloudflare Tunnel ingress addresses and Tailscale addresses are not substitutes.

## Outgoing request signing

Headers: `va`, `signature`, `timestamp`; timestamp is a 14-digit `YYYYMMDDHHmmss` string (endpoint-specific instructions take precedence).

For POST, serialize body once, SHA256 that exact JSON string as lowercase hex, then compute:

```text
stringToSign = METHOD + ':' + VA + ':' + bodyHash + ':' + API_KEY
signature = HMAC-SHA256(stringToSign, API_KEY), hex
```

Send the identical serialized body that was signed. Use built-in Node crypto; no new crypto dependency is required.

## Redirect checkout

Required request fields: arrays `product`, `qty`, `price`, `description`; `returnUrl`, `notifyUrl`, `cancelUrl`.
Optional fields include `referenceId`, `buyerName`, `buyerEmail`, `buyerPhone`, `expired` (hours), `feeDirection` (`BUYER`/`MERCHANT`), and `paymentMethod`.

Use the local invoice as `referenceId`. Success response example: `Status: 200`, `Data.SessionID`, `Data.Url`. Persist session identity and validate the URL before returning it to the browser. Prices come exclusively from server-side plans.

The MCP's rendered payment/transaction pages omit HTTP route metadata and leave `<ApiRequestHeaders />` unexpanded. Confirm exact method/path from the official linked Node sample or rendered API reference before implementing requests; do not infer paths from documentation slugs. Official sample linked by the introduction: https://github.com/putuedi/ipaymu-payment-v2-sample-nodejs.

## Callback verification

Notify URL belongs to the merchant backend and is configured per environment. Supported formats are default `application/x-www-form-urlencoded` and alternative `application/json`.

Docs require `X-Signature` HMAC-SHA256 and identify merchant VA as its key, not the API key. Therefore **VA must also be treated carefully**, and a callback signature alone must not substitute for a credential-authenticated transaction inquiry: VA was disclosed in chat and may be known outside the server.

Documented form normalization: convert `trx_id`, `status_code`, `transaction_status_code`, `paid_off` to integers; `is_escrow` to boolean; `additional_info` to an array (insert `[]` if absent). Other values stay strings. Remove an embedded `signature`, sort keys case-sensitively, JSON-serialize and apply PHP-style slash escaping, then compare HMAC in constant time.

Docs are not fully consistent: JSON examples contain numeric strings, whereas JSON verifier examples assume correctly typed fields; JS `localeCompare` sorting may differ from PHP case-sensitive sorting. Do not accept arbitrary signature alternatives or blindly copy debug logging. Validate actual sandbox fixtures for the configured format, use deterministic normalization, reject malformed/duplicate fields, and keep raw payload/signature/key out of logs.

Core fields: `trx_id`, `sid`, `reference_id`/`referenceId`, `merchant`, `status_code`, `amount`, `is_sandbox`. Cross-check identifiers/merchant/mode and server price against stored order and signed inquiry results. `paid_off` is net of fees, not automatically the order price. Do not confuse method VA (`va`/`payment_no`) with merchant identity.

Callbacks retry on non-200 responses. Acknowledge only handled/duplicate events; temporary verification/DB failures must remain retryable. Never mutate on invalid signatures. PAID is terminal for this integration; refund processing remains separate.

## Authoritative status inquiry

Request body: `transactionId` string; optional `account`.
Response fields include `TransactionId`, `SessionId`, `ReferenceId`, `Amount`, `Fee`, `Status`, `PaidStatus`, `Type`, and dates.
Status codes documented: 0 pending; 1 success; 2 cancelled; 3 refund; 4 error; 5 failed; 6 success-unsettled; 7 escrow; -2 expired.

Check the transaction using the API key for the stored environment; bind results to stored session/invoice and amount before fulfillment. Code 6 is a successful payment awaiting settlement, not necessarily unpaid. Code 7/refund must not automatically activate subscriptions. Unknown or contradictory status/amount/identity data must fail closed. Final mapping and fixtures require sandbox verification.

## Existing deployment constraints

Backend is Docker container `klassa` on the user's AlmaLinux server behind Cloudflare Tunnel (`doc/panduan-deploy.md`), not Workers. Landing page calls the existing backend checkout endpoint. Local environment may point to the production database: do not execute migrations or integration DB tests against it.

Implementation/deployment/rollback instructions will be added after plan approval and code verification. These notes do not claim an implemented or verified production integration.
