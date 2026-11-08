# Vehicle Ordering API – Playwright API tests

A small but production-shaped API test suite for the Vehicle Ordering API
(`POST/GET/PATCH/DELETE /orders`). It is built with Playwright's `APIRequestContext`,
Zod contract validation and a local stateful mock.

```bash
npm ci
cp .env.example .env
npm test              # boots the mock, runs the suite, opens the HTML report
npm run report        # re-open the last HTML report
```

Two run profiles are selected by the `CI` flag (set by GitHub Actions) and defined in
`playwright.config.ts`; `.env` holds only environment facts (API URL, token, mock settings).

| | local | CI |
| --- | --- | --- |
| Reporters | `list`, HTML opened after every run | `github`, HTML (written only), `junit`, `json` |
| Trace | always | retain on failure |
| Retries | 0 | 1 |
| Workers | 4 | 2 |
| Mock server | reuse a running one | always start clean |
| `test.only` | allowed | fails the build |

## 1. No API yet: which mock approach?

| Option | Verdict |
| --- | --- |
| MSW / `page.route()` | ❌ Cannot intercept `APIRequestContext`, which calls the network directly from Node. |
| json-server | ❌ Generic CRUD: no validation, no state machine, no 409s. Only happy paths are testable. |
| Prism (OpenAPI mock) | ⚠️ Good for contract-first work, but **stateless**: create → patch → get → delete flows are impossible. |
| WireMock | ⚠️ Works, but needs Java or Docker, and stateful scenarios take a lot of configuration. |
| **In-repo stateful mock (Express + TS)** | ✅ **Chosen.** Zero infrastructure. It implements the real business rules (validation, lifecycle, 404/409). Playwright starts it via `webServer`. |

The mock lives in `mock-server/` and **deliberately shares no code with the tests**.
Its validation is written separately from the consumer Zod contracts in `src/schemas/`,
so a mismatch between the two shows up as a failing contract test, as it would against
a real provider.

When the real API exists, set `START_MOCK_SERVER=false` and change `API_BASE_URL`.
No test code changes. The natural next step is to publish an OpenAPI spec and either
generate the mock from it (Prism, for stateless checks) or add Pact consumer-driven
contracts.

### Mock domain rules

- `POST` validates the payload strictly (VIN format, positive price, ISO currency, known
  fields only), sets `status=PENDING`, and returns `201` with a `Location` header.
- Order lifecycle: `PENDING → CONFIRMED | CANCELLED`, `CONFIRMED → IN_PRODUCTION | CANCELLED`,
  `IN_PRODUCTION → DELIVERED`. An illegal transition returns `409 INVALID_STATUS_TRANSITION`.
- `DELETE` returns `204`, then `GET` returns `404`. A delivered order cannot be deleted (`409`).
- Single bearer-token auth (`API_TOKEN`). A missing or unknown token returns `401`, checked
  before the body is parsed. Checks run in the order 401 → 400 → 404 → 409.
- A uniform error envelope `{ error: { code, message, details[] } }`.

## 2. Test scenarios implemented

The brief asks for 3–5 tests that show design rather than quantity. The suite is **five
scenarios**, each mapped to an item of the first automation priority in
[Part 1, Q3 #1](docs/quality-assesment-p1.md) (Vehicle Ordering API, risk R1 = 25). Data-driven
scenarios expand to several test runs, but each is one design decision and one table entry.

| # | Scenario | Part 1 item | Design point | Tags |
| --- | --- | --- | --- | --- |
| 1 | `POST` creates a PENDING order, honours the strict contract, sets `Location`, and is retrievable by `GET` | Happy path | Response validated with a strict Zod schema; one test also proves `GET /orders/{id}` | `@smoke @contract` |
| 2 | `POST` rejects invalid payloads with `400` and names the offending field (×5: VIN, missing dealerId, zero price, bad email, server-owned field) | Validation errors | Equivalence classes live in `src/data/invalid-order.cases.ts`; a new rule is one table row | `@negative @contract` |
| 3 | `PATCH` moves an order along **every allowed edge** of the state machine (×5, incl. cancel from PENDING and CONFIRMED) and preserves every other field; **every other transition** is refused with `409` and the order is untouched (×9: 7 `INVALID_STATUS_TRANSITION`, 2 `ORDER_LOCKED` for terminal orders) | Every status transition, cancel rules | Both loops are generated from one table, `src/data/order-lifecycle.ts`; the forbidden set is the complement, so it can never drift from the allowed set. `createOrderInStatus()` arranges any starting status via the shortest path | `@regression @negative` |
| 4 | `DELETE` removes a PENDING order (`204`, then `404`); refuses to delete a DELIVERED order (`409 ORDER_LOCKED`, record unchanged); returns `404` for an unknown id | Delete rules | Business rule (a delivered vehicle is an accounting fact) tested without the UI | `@smoke @negative @regression` |
| 5 | `GET` an existing order returns `401` with no token and with a forged token (×2) | Permissions | 401 rather than 404, so the API does not reveal whether the order exists. The published API has a single bearer identity, so dealer vs OEM-admin roles are listed as an open question (Part 1, Q5) | `@security` |

What is deliberately left out: malformed JSON, idempotency, concurrency and roles. They are
listed in section 5 and in Part 1 Q5 as questions for the team, not guessed.

## 3. Structure

```
tests/orders/            create / lifecycle / delete / authentication specs
src/
  config/env.ts          Zod-validated .env, the single config source
  schemas/               Zod contracts (order, error) + inferred types
  api/orders.client.ts   Thin transport: one method per endpoint, no assertions
  api/order.steps.ts     Typed, self-asserting business steps (@boxedStep methods)
  api/api-context.ts     The single place that builds an APIRequestContext (baseURL + token)
  fixtures/              test.extend fixtures (DI + auto-cleanup) and custom matchers
  helpers/               parseBody(), expectApiError(), @boxedStep decorator
  data/                  faker factory, order state-machine table, data-driven negative cases
  constants/             HttpStatus, ApiRoutes
mock-server/             Express provider stub: router → service → repository
```

## 4. Design decisions

**SOLID**
- *Single responsibility*: the client sends requests, steps express business intent,
  matchers assert, factories build data, fixtures wire everything together. The mock follows
  the same pattern (router → service → repository).
- *Open/closed*: a new resource means new client, steps and schema files, with no edits to
  existing ones. A new negative case or a changed lifecycle rule is one data entry.
- *Dependency inversion*: clients receive an injected `APIRequestContext`, so the same client
  works with any base URL or auth context (e.g. an unauthenticated context for 401 tests).
  The mock service receives its repository and clock.

**DRY**
- Each schema is defined once in Zod. TypeScript types are inferred from it, never duplicated.
- `expectApiError()` covers status, envelope contract and error code in one call.
- `toHaveStatus` and `toMatchSchema` failure messages include the URL, body and Zod diff, so
  no test has to log debug output itself.
- Cleanup lives in one fixture. Tests never write teardown code.

**Reliability**
- No time-based waits anywhere (enforced by ESLint `playwright/no-wait-for-timeout`).
- Each test creates its own unique data (faker), which keeps the suite safe with `fullyParallel`.
- Best-effort cleanup through `Promise.allSettled`, so teardown can never hide the real result.
- Configuration is validated at start-up, so a typo in `.env` fails fast with a clear message.

**Observability**
- Traces record every API request and response: always in the local profile, on failure in CI.
- Reporters: `list` (console), `html`, `junit` (CI) and `json`.

## 5. What I would add next

1. Authorisation, if the API adds roles or per-dealer data ownership (`403` tests).
2. `404` for unknown IDs on `GET` and `PATCH`, plus `400` for malformed JSON and empty `PATCH` bodies.
3. `PATCH` of `price` (recalculation rules) once the business rules are known (Part 1, Q5).
4. Concurrency and idempotency: parallel PATCHes (optimistic locking/`ETag`), and an `Idempotency-Key` on POST.
5. Consumer-driven contracts (Pact) or OpenAPI-driven schema checks once the provider publishes a spec.
6. CI matrix per environment (`.env.<env>` files), with JUnit published to the pipeline.
