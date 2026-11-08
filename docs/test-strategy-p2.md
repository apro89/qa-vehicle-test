# Part 2 – Test Strategy

**Goal.** Fast, reliable 2-week releases with the same 3 QA. Known business rules are checked
automatically at the API layer within minutes of a change; people spend their time on what
automation cannot do; every release decision is backed by the risk register from Part 1.

**Inputs from Part 1.** Risk register (Q1: R1 ordering 25, R2 invoicing 25, R3 integrations 20,
R4 regression safety net 20; R5–R7 < 10; R8 unscored), the manual / automate split (Q2, Q3),
the 3-month roadmap (Q4) and the ownership model (Q6). This document says *how* those
decisions are executed.

## 1. Manual testing approach

Manual testing is for judgement, not repetition (Part 1 Q2).

- **Exploratory sessions on every story in a risk area ≥ 20** (ordering, invoicing,
  integrations): 60–90 min, written charter, short findings note. Lower-risk areas (R5–R7) get a
  session only when they change.
- **Risk-based regression pack, ≤ 1 day per release:** desktop UI smoke checklist (~1 h), one
  end-to-end walkthrough vehicle → order → OEM confirmation → purchase → invoice on the release
  candidate, and a spot-check of any integration that changed against the real partner sandbox.
- **Acceptance (UAT)** with the product owner and dealership users per feature: "does it solve
  the problem", not "does it work".
- **Production smoke** after each deploy: 15-minute checklist, owned by the release QA (QA 3).
- **Test management in Xray (Jira).** Manual tests are managed in Xray so that manual and
  automated coverage are visible in one place:
  - the regression pack, UI smoke checklist, E2E walkthrough and production smoke are Xray
    **Test** issues grouped in **Test Sets** per risk area (R1–R7) and tagged with the risk score;
  - each release gets a **Test Plan** with one **Test Execution** per activity, so go/no-go
    (section 4) is a status in Jira, not a message in chat;
  - exploratory sessions are recorded as Xray **Generic / Exploratory** tests with the charter
    as description and findings linked as defects, so exploratory effort is traceable;
  - every Test is linked to its story (requirement coverage), which gives a per-feature and
    per-risk-area coverage view that feeds the metrics in section 6;
  - automated runs are imported too: the CI publishes the JUnit report
    (`reports/junit/results.xml`) to Xray via the REST API, so a Test Plan shows manual and
    automated results side by side and a test that moved from manual to automated keeps its history.
- **Lightweight artefacts stay in the repository** (charters, checklist text, walkthrough
  script) next to the automated tests and are referenced from Xray by link, so they are reviewed
  like code and do not silently shrink.

## 2. API testing approach

The backbone of the strategy and where regression moves to (Part 1 Q3 #1–#4). The framework in
this repository (Part 3) is the template for the whole team.

- **Tooling:** Playwright `APIRequestContext` + TypeScript, no browser. Layers:
  `tests/` spec → fixtures (`ordersApi`, `orderSteps`, `orderCleanup`) → typed `@boxedStep`
  steps → thin client (one method per endpoint, never asserts) → Zod schemas as the single
  source of truth for types and contracts.
- **Coverage per endpoint, risk ≥ 20 first.** For `/orders`: happy path; **every** status
  transition, allowed and forbidden, generated from one state-machine table
  (`order-lifecycle.ts`), so a rule change is a one-line edit; validation errors as data-driven
  cases; authentication (missing / forged token); not-found and locked-order handling; response
  contract on every call. Role-based permissions are added as soon as the team confirms which
  roles exist (Part 1 Q5).
- **Contract tests:** every response is validated with `toMatchSchema` against a *strict* Zod
  schema, so an unexpected field or type is a failure, not a warning. For supplier and OEM
  integrations: consumer-driven contracts run against stubbed partners in CI; the real sandbox
  is checked manually per release (section 1).
- **Chain scenario:** one `@smoke` API test across order → purchase → invoice, proving the data
  flow between the three risk areas (Part 1 Q3 #4).
- **Design rules** (enforced by lint and review): no time-based waits; no magic values
  (`HttpStatus.*`, `OrderStatus.*`, `ErrorCode.*`); no hard-coded configuration (`.env` via a
  validated `env`); every created resource cleaned up; tests independent and fully parallel;
  the mock and the tests never share code, so contract tests cannot become tautological.
- **Tags select scope:** `@smoke`, `@contract`, `@regression`, `@negative`, `@security`.
- **Target:** ordering fully covered in month 1, invoicing and integrations by month 3,
  ≥ 150 API tests running in < 5 minutes.

## 3. UI automation approach

Minimal by design (Part 1 Q3 #5). PowerBuilder + TestComplete is slow, flaky and expensive,
and UI is not a reported source of escaped defects (R7 = 6). Business rules are tested at the
API layer; the UI is checked for "the screen works".

- **Month 1:** triage the 10 flaky tests; fix root causes (waits, locators, data) or quarantine.
  A quarantined test not fixed within 2 sprints is deleted.
- **Keep a 3–5 test UI smoke:** login, open a vehicle, search, place an order, open an invoice.
  Test data is created through the API before the UI step, never through the UI: a UI test
  does Arrange via `POST /orders`, then checks only that the screen shows what was created.
  TestComplete recognises PowerBuilder windows and DataWindow controls natively (Name Mapping,
  cell-level access), so the UI step stays short: one order, one screen, one check.
- **Seed data options** (chosen in month 1 after the Q5 answers on environments and agents):

  | Option | How | Pros | Cons | Use when |
  |--------|-----|------|------|----------|
  | **A. `aqHttp` inside TestComplete** | The test script calls the REST API with TestComplete's built-in HTTP client; base URL and token come from project variables | No extra tooling on the agent; data created right before the UI step | Duplicates request payloads and rules that already live in the Playwright repo | Quick start; agent cannot run Node |
  | **B. Playwright framework as a seed CLI** | A small `scripts/seed.ts` reuses `orderSteps` (incl. `pathTo(status)`) to create an order in any lifecycle state and prints its id as JSON; TestComplete runs it with `WshShell.Exec` and parses the output | One source of truth for payloads, schemas and the state machine; no duplicated business rules | Node must be installed on the TestComplete agent | Default once the API suite is in place (month 1) |
  | **C. CI-level seeding** | A GitHub Actions step runs a Playwright `@seed` project that writes created ids to `seed-output.json`; the TestComplete step reads the file | UI tests know nothing about the API; cleanest separation; same data for the whole nightly run | Only works in the pipeline, not for a local run from the TestComplete IDE | Nightly and release-candidate runs |

  Whatever the option, seeded resources are cleaned up by the same mechanism as in the API
  suite, and no UI test depends on data left by another test.
- **Run nightly and on release candidates, not on every PR**, so UI flakiness can never block a
  merge. Results are reviewed by the UI owner (QA 3) each morning.
- **Grow only on evidence:** a new UI test is added only when a UI-level defect escapes.

## 4. CI/CD quality gates (GitHub Actions)

The repository workflow (`api-tests.yml`) already runs `npm run check` (type check + lint) and
the API suite on every push and PR with the `ci` run profile (GitHub + JUnit + JSON reporters,
traces on failure, one retry to separate infrastructure noise from real failures, `forbidOnly`).
The full set of gates:

| Stage | Trigger | What runs | Gate |
|-------|---------|-----------|------|
| **Pull request** | every push | type check + lint, API `@smoke` + `@contract` (< 5 min) | Must pass to merge; CODEOWNERS routes review to the area owner |
| **Merge to main** | every merge | full API suite (`@regression`, `@negative`, `@security`), parallel | Must pass; a red main is fixed or reverted the same day |
| **Nightly** | schedule | full API suite against the integration environment, contract tests vs partner stubs, UI smoke | Failures triaged by the owner next morning; flaky rate reported |
| **Release candidate** | tag | full API suite + UI smoke + manual risk-based pack (≤ 1 day) | Go/no-go by release QA with product owner; checklist attached to the release |
| **Post-deploy** | production deploy | API smoke against production (read-only plus safe create/delete), manual production smoke | Rollback if smoke fails |

Rules: no re-running to make a build green (flaky = fix or quarantine, the owner decides the
same day); HTML, JUnit and JSON reports plus traces are published as artefacts on every run;
the quarantine list is visible and every entry has an expiry date.

## 5. Regression strategy

- **Automated at the API layer, risk-based everywhere else.** The 5-day manual pack is retired
  step by step: each automated block replaces its manual steps in the same sprint
  (5 → 4 → 2 → ≤ 1 day over three months, Part 1 Q4).
- **Selection by risk and change.** The full API suite always runs (it is cheap). The manual
  pack is scoped by what changed, plus the fixed UI smoke and E2E walkthrough. Integration
  checks run for partners that changed or announced a change.
- **Tags set depth per stage:** `@smoke` on every PR, full suite on main and nightly, so
  regression depth scales with the pipeline stage, not with the calendar.
- **Living pack.** Reviewed each release against the risk register. An escaped defect always
  produces an automated test first and a manual check only if automation is impossible.
- **Ownership.** Each risk area has an owner and a backup (Part 1 Q6) who keep its regression
  tests green and relevant; developers own the tests their PR changes.

## 6. Success metrics

Reviewed every release on a dashboard built from CI data (JSON / JUnit reporters). Targets are
for month 3 and are adjusted after month-1 data (Part 1 Q4, Q5).

| Metric | Baseline (today) | Target (month 3) | What it tells us |
|--------|------------------|------------------|------------------|
| Escaped defects per release in R1–R3 (ordering, invoicing, integrations) | "occasional", unmeasured | 0 critical, trending down overall | Does the strategy stop defects where it matters |
| Manual regression effort per release | 5 days | ≤ 1 day | Capacity freed for exploratory and automation |
| API tests in CI and coverage of R1–R3 rules | ~50, unmapped | ≥ 150; 100 % of R1–R3 rules mapped to tests | Depth of the safety net |
| Flaky rate (retried or quarantined ÷ total) | unmeasured, UI known flaky | < 2 % | Trust in the pipeline |
| PR feedback time (push → green/red) | no gate | < 10 min | Fast developer feedback |
| Release go/no-go lead time (RC → decision) | ~5 days | ≤ 1 day | Delivery speed |
| Defects found before release (÷ all defects) | unmeasured | ≥ 90 % | Shift-left is working |
| Test ownership | inconsistent | 100 % of risk areas with owner + backup; 0 failing tests orphaned > 1 day | The problem from the brief is solved |

**How to read the metrics.** They fall into two groups:

- **Leading metrics** (PR feedback time, flaky rate, coverage) show the health of the pipeline.
  They react within one or two sprints and we control them directly: add a gate, fix a flaky
  test, write tests for a rule.
- **Lagging metrics** (escaped defects, manual regression effort) show the business outcome.
  They react with a delay of several releases and cannot be changed directly, only through the
  leading ones.

The expected pattern is: leading metrics improve first, lagging metrics follow. If the pipeline
is fast, stable and coverage grows, but defects still escape, we have automated the wrong things:
the Impact and Likelihood scores in the Part 1 risk register do not match reality. In that case
the register is re-scored with the real defect data and the automation order is corrected.
