# CLAUDE.md

Guidance for Claude Code (and humans) working in this repository.

## What this is

Playwright **API** test automation for the Vehicle Ordering API (Nextlane-style dealer/OEM
ordering domain). It uses `APIRequestContext` only, with no browser. The real API does not
exist yet, so a **stateful local mock** in `mock-server/` stands in for it and is booted
automatically by Playwright's `webServer`.

Endpoints under test: `POST /orders`, `GET /orders/{id}`, `PATCH /orders/{id}`, `DELETE /orders/{id}`.

## Commands

| Command | Purpose |
| --- | --- |
| `npm test` | Run the full suite (boots the mock when `START_MOCK_SERVER=true`) |
| `npm run test:smoke` / `test:contract` / `test:security` | Run by tag |
| `npm run check` | `tsc --noEmit` + ESLint. **Must pass before you finish any change.** |
| `npm run mock` | Start the mock on its own (port from `.env`) |
| `npm run report` | Open the HTML report (`reports/html`) |
| `npm run trace -- <path/to/trace.zip>` | Open a trace from `test-results/` |

First-time setup: `npm ci && cp .env.example .env`.

## Architecture (layers, top → bottom)

```
tests/**/*.spec.ts          What is verified. Arrange / Act / Assert, no plumbing.
src/fixtures/index.ts       DI container: ordersApi, orderSteps, orderCleanup, ordersApiFactory.
src/api/api-context.ts      The only place that builds an APIRequestContext (baseURL + bearer token).
src/fixtures/matchers.ts    Custom expect: toHaveStatus, toMatchSchema.
src/api/order.steps.ts      Typed, self-asserting business steps (Arrange & verify), each a @boxedStep.
src/api/orders.client.ts    Raw transport: one method per endpoint, returns APIResponse.
src/helpers/                parseBody(), expectApiError(): reusable response assertions;
                            boxed-step.decorator.ts: @boxedStep.
src/schemas/                Zod consumer contracts + inferred TS types (single source of truth).
src/data/                   Test-data factories (faker), the order state-machine table
                            (order-lifecycle.ts: allowed/forbidden transitions, pathTo) and
                            data-driven negative/401 cases.
src/constants/              HttpStatus, ApiRoutes.
src/config/env.ts           The ONLY place that reads process.env (validated with Zod).
mock-server/                Independent provider stub (Express, in-memory, business rules,
                            single bearer-token auth).
```

## Hard rules

1. **No time-based waiting.** Never use `waitForTimeout`, `setTimeout`, or sleep helpers.
   API calls are awaited, so nothing needs polling. If eventual consistency ever appears,
   use `expect.poll()` / `expect(...).toPass()` with a condition. ESLint enforces
   `playwright/no-wait-for-timeout`.
2. **No hard-coded configuration.** Environment facts (URLs, tokens, ports, mock on/off)
   live in `.env` (documented in `.env.example`) and are read only via `env` from
   `src/config/env.ts`. Adding a variable means updating **both** the Zod schema in
   `env.ts` and `.env.example`. Runner behaviour (timeouts, retries, workers, trace,
   reporters) is **not** in `.env`: it is defined once per run profile (`local` / `ci`,
   selected by the `CI` flag) in `playwright.config.ts`.
3. **No magic values in tests.** Use `HttpStatus.*`, `OrderStatus.*`, `ErrorCode.*` and
   `ApiRoutes.*`, never raw `201` or `'PENDING'`.
4. **Contracts are Zod schemas in `src/schemas/`.** Derive TS types with `z.infer`; never
   hand-write a duplicate interface. Response schemas use `z.strictObject` on purpose
   (an unexpected field is a contract break).
5. **The mock and the tests must never share code.** `mock-server/` must not import from
   `src/`, and the reverse is also forbidden. Sharing schemas would make the contract tests
   tautological.
6. **Use fixtures, not `beforeEach` plumbing.** One identity, authenticated with a single bearer
   token (`API_TOKEN`). Use `ordersApi` / `orderSteps` for everything authenticated, and
   `ordersApiFactory(token?)` only for authentication tests (omitted or forged token). Never
   use the built-in `request` fixture and never set `Authorization` globally in
   `playwright.config.ts`: `src/api/api-context.ts` is the single place that builds a context.
   Import `test`/`expect` **only** from `@/fixtures`.
7. **Every created resource is cleaned up.** `orderSteps.createOrder()` registers cleanup
   automatically. If a test calls `ordersApi.create()` directly, call `orderCleanup.track(id)`.
8. **Tests are independent and parallel-safe.** Each test creates its own data
   (`fullyParallel: true`). Never depend on execution order or on data from another test.
9. **The client never asserts. Steps always assert.** Call the endpoint *under test*
   through `ordersApi` so the test shows the request explicitly. Use `orderSteps` for
   Arrange and follow-up verification.
10. **Step classes use `@boxedStep`, never a hand-written `test.step(..., { box: true })`.**
    Write the method body only:
    ```ts
    @boxedStep((id: string) => `fetch order ${id}`)
    async getOrder(id: string): Promise<Order> { … }
    ```
    A failure is reported at the test line that called the step. If you ever wrap
    `test.step` yourself, `return await` it: returning the bare promise breaks the async
    stack, and a boxed failure then has no location at all.

## Conventions

- **Test names** describe behaviour: `'<verb>s … when/and …'`, grouped by
  `test.describe('<METHOD> <path>')`. One spec file per endpoint/behaviour area in `tests/<resource>/`.
- **Tags**: `@smoke` (critical path), `@regression`, `@negative`, `@contract`, `@security`. Pass them
  via the `{ tag: [...] }` option, not inside the title.
- **Structure**: Arrange → Act (a single call to the endpoint under test) → Assert. Wrap
  follow-up checks in `test.step('Assert: …')`.
- **Data-driven negatives**: add a case to `src/data/invalid-order.cases.ts` instead of
  writing a new test. Each case states the `invalidField` the API must report.
- **Test data**: `buildCreateOrderPayload(overrides)`. Override only what the test cares about.
- Path alias `@/*` → `src/*`. TypeScript is strict (`noUncheckedIndexedAccess` included).

## Recipe: adding tests for a new resource (e.g. `/dealers`)

1. `src/schemas/dealer.schema.ts`: Zod request/response schemas and inferred types.
2. `src/constants/routes.ts`: add the routes.
3. `src/api/dealers.client.ts`: thin client, inject `APIRequestContext`, return `APIResponse`.
4. `src/api/dealer.steps.ts`: a class whose methods are `@boxedStep`s for Arrange and verify.
5. `src/data/dealer.factory.ts`: faker-based builder with overrides.
6. `src/fixtures/index.ts`: add `dealersApi`, `dealerSteps` and cleanup fixtures.
7. If the mock must support it: `mock-server/dealers/{model,repository,service,router}.ts`
   and wire it in `mock-server/app.ts`.
8. `tests/dealers/*.spec.ts`, then `npm run check && npm test`.

## Pointing at a real environment

Set `API_BASE_URL` and `API_TOKEN` to the real values and set `START_MOCK_SERVER=false`.
The tests do not change.

## Debugging failures

- Failure messages from `toHaveStatus` include the URL and response body. Messages from
  `toMatchSchema` include a pretty-printed Zod diff.
- Traces capture every API request and response (local profile: always; CI: retained on failure):
  run `npm run trace -- test-results/<test>/trace.zip`.
- Reports: HTML (`reports/html`), JUnit (`reports/junit/results.xml`, for CI) and JSON.
