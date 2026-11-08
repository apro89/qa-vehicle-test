# Part 1 – Quality Assessment

## 1. What are the three highest quality risks and why?

**Approach: risk-based testing.** Each area is scored on Impact (1–5, business damage if it
fails) and Likelihood (1–5, chance it fails or regresses). Priority = Impact × Likelihood.
Scores come from the evidence in the brief and are validated with the team in the first weeks.

### Risk register

| ID  | Risk item                                                               | Impact | Likelihood | Score  | Evidence                                                                              |
| --- | ----------------------------------------------------------------------- | :----: | :--------: | :----: | ------------------------------------------------------------------------------------- |
| R1  | Vehicle ordering – wrong states, prices, permissions, lost orders       |   5    |     5      | **25** | Most critical workflow, used daily; #1 escaped-defect source; limited API coverage    |
| R2  | Purchase and invoice processing – wrong amounts, invoice ≠ order        |   5    |     5      | **25** | #2 escaped-defect source; financial/compliance impact; downstream of R1               |
| R3  | Supplier and OEM integrations – contract changes, silent failures       |   4    |     5      | **20** | #3 escaped-defect source; limited contract testing; partners change outside our cycle |
| R4  | Regression safety net – 5-day manual regression, flaky UI, no ownership |   4    |     5      | **20** | Half of each sprint on manual regression; flaky UI tests; ~60 tests, unowned          |
| R5  | Vehicle creation                                                        |   3    |     3      |   9    | Core capability, no escaped defects reported                                          |
| R6  | Vehicle search                                                          |   2    |     3      |   6    | Visible and recoverable, no escaped defects reported                                  |
| R7  | Desktop UI (PowerBuilder) regressions                                   |   2    |     3      |   6    | Not a reported defect source; expensive to automate                                   |
| R8  | Performance, security                                                   |   4    |     ?      |   –    | No evidence in the brief; needs data before scoring                                   |

### Top three risks

**1. Order-to-invoice chain (R1 + R2, score 25 / 20).**
This is where the business earns money: a wrong order, price or invoice means lost revenue
and compliance issues. Two of the three escaped-defect categories are here, and the logic is
rule-heavy (state transitions, permissions, price recalculation), which manual regression
covers poorly. Order → purchase → invoice is one data flow, so an early defect is amplified
downstream and is found by finance, not by us.
_Response:_ full API automation of transitions, permissions and validation; chain scenario test.

**2. Supplier and OEM integrations (R3, score 20).**
We do not control these systems: partners change fields and error codes on their own schedule,
and with limited contract testing we find out in production. Failures are often silent
(rejected message, bad mapping), and they corrupt order status, feeding straight into Risk 1.
_Response:_ consumer-driven contract tests, stubbed partners in CI, production monitoring.

**3. Regression safety net (R4, score 20).**
A process risk that multiplies the other two: whatever is not automated depends on a manual
process that is already overloaded. 5 of 10 sprint days (≈15 of 30 QA person-days) go to
manual regression, so it starts late and gets cut under deadline pressure. Flaky UI tests
teach the team to ignore red builds, and the unowned suite does not grow.
_Response:_ API regression in CI on every PR, quarantine flaky UI tests, explicit ownership.

### How scores drive effort

| Score    | Items | Test depth                                                               |
| -------- | ----- | ------------------------------------------------------------------------ |
| ≥ 20     | R1–R4 | Automate first, full API coverage in every CI run, exploratory on change |
| < 10     | R5–R7 | Smoke automation, manual checks when the area changes                    |
| Unscored | R8    | Gather data (incidents, SLAs, auth model) before deciding                |

Scores are reviewed each release against escaped-defect data, so effort follows risk.

## 2. Which testing activities would you keep primarily manual?

**Principle.** Automation checks what we already know; people find what we did not expect.
An activity stays manual when it needs human judgement, when it is cheaper to do by hand
than to automate and maintain (PowerBuilder UI, flaky TestComplete), or when it runs rarely.
Everything repeatable, deterministic and run every release moves to automation (Q3).

### Activities kept manual

| Activity                                                                                           | Why manual                                                                                                                                                           | Scope / cadence                                                                   |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **Exploratory testing of new or changed features**                                                 | Needs domain thinking: combinations, edge cases, "what would a dealer actually do". Automation only encodes what was already thought of.                             | Every story, time-boxed sessions with a charter; focus on R1–R3 areas             |
| **End-to-end business flow walkthrough** (vehicle → order → OEM confirmation → purchase → invoice) | Cross-system flow with real data and real partner sandboxes; automating it end-to-end is brittle and slow. API tests cover the steps, a person validates the whole.  | Once per release, on release candidate, 1 scripted scenario per key path          |
| **Desktop UI (PowerBuilder) checks** – layout, navigation, usability, visual regressions           | TestComplete suite is flaky and costly to extend; UI is not a reported source of escaped defects (R7, score 6). Human eyes find visual issues faster.                | Smoke checklist per release (~1 hour), deeper checks only on screens that changed |
| **Acceptance / UAT with dealership users**                                                         | Validates that the feature solves the business problem, not just that it works. Cannot be automated by definition.                                                   | Per feature, before release, with product owner                                   |
| **Integration validation against real partner environments**                                       | Partner sandboxes are unstable, rate-limited and have no test data control. Contract tests cover the format; a manual check confirms the real partner still behaves. | Per release, for integrations that changed, plus after partner announcements      |
| **Release verification in production (smoke)**                                                     | Confirms deployment, configuration and connectivity. Few steps, high value, run against live data where automation is risky.                                         | After each deploy, 15-minute checklist                                            |
| **Usability, accessibility, negative "human" scenarios**                                           | Subjective quality and unusual user behaviour (wrong order of actions, abandoned flows) that scripts do not model.                                                   | Ad hoc, bundled into exploratory sessions                                         |

### What stops being manual

- **The 5-day regression pack.** Repeatable checks of ordering, invoicing and integration rules
  move to API tests in CI. Manual regression shrinks to a risk-based pack of ~0.5–1 day:
  the UI smoke checklist and the end-to-end walkthrough above.
- **Data setup and precondition creation.** Done by the test framework (factories, API
  steps), not by hand in the UI.
- **Contract and schema checks.** Replaced by automated contract tests at every boundary.

### Why this balance

- Manual effort goes where risk is highest **and** automation is weakest: new features in R1–R3
  and cross-system flows.
- It frees roughly 4 of the 5 regression days per release for exploratory testing and for
  building automation, which is how the automation backlog gets done with the same 3 QA.
- Manual activities are scripted lightly (charters, checklists), so they are consistent
  between the 3 QA and leave a record, without becoming a second regression suite.

## 3. Which testing activities would you automate first?

**Principle.** Automate by risk score ÷ cost, not by what is easiest. First targets are
the areas scoring ≥ 20 in the risk register where tests are deterministic, fast and
cheap to maintain. That is the API layer, not the PowerBuilder UI. Every new automated
test must retire a manual regression step, so the 5-day pack shrinks from the first sprint.

### Automation priority

| #   | What to automate                                                                                                                                          |  Risk  | Why first                                                                                                                                               | Type / tool                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 1   | **Vehicle Ordering API** – happy path, every status transition, role permissions (dealer vs OEM admin), validation errors, delete/cancel rules            |   R1   | Highest score (25); logic is rule-heavy and stable; API tests run in seconds and do not flake; directly replaces the largest block of manual regression | Playwright API, Zod contract per endpoint                    |
| 2   | **Contract tests for supplier and OEM integrations** – request/response schemas, error codes, mandatory fields at each boundary                           |   R3   | Catches partner changes before production, which is where they currently surface; cheap to write once the schemas are known                             | Consumer-driven contracts (Zod/Pact), stubbed partners in CI |
| 3   | **Purchase and invoice API** – amount = order price, tax and rounding, invoice state follows order state, no invoice for cancelled orders                 |   R2   | Financial impact; rules are deterministic and testable at API level without UI; currently manual only                                                   | Playwright API, data-driven cases                            |
| 4   | **Order-to-invoice chain scenario** – one API-level end-to-end: create vehicle → order → confirm → purchase → invoice                                     | R1–R3  | Proves the data flow between the three risk areas; replaces most of the manual walkthrough on release candidates                                        | Playwright API, tagged `@smoke`                              |
| 5   | **Stabilise, then minimise the UI suite** – fix or quarantine the 10 flaky TestComplete tests; keep 3–5 UI smoke tests (login, open vehicle, place order) | R4, R7 | Flaky tests destroy trust in CI; a small reliable UI smoke is worth more than a large flaky one. UI stays mostly manual (Q2)                            | TestComplete, run nightly, not on every PR                   |
| 6   | **CI quality gate** – API suite on every PR, contract tests on every PR, UI smoke nightly, failing build blocks merge                                     |   R4   | Automation only reduces risk when it runs automatically and is trusted; makes ownership visible per PR                                                  | GitHub Actions                                               |

### What is deliberately not automated first

- **Broad UI regression** in TestComplete: low risk score (R7 = 6), high cost, known flakiness.
- **Performance and security** (R8): no data yet; a decision after the first month's findings.
- **Vehicle creation and search** (R5, R6): smoke-level API checks only, after items 1–4.

### Why this order

- Items 1–3 attack the three escaped-defect categories directly, in order of risk score.
- API-first gives the fastest payback: ~50 existing tests show the Playwright framework is
  already in place, so the team adds coverage instead of building tooling.
- Item 6 is scheduled early, not last: without a gate the suite is a report, not a safety net.
- Each item replaces a named manual regression step, so the 5-day pack shrinks sprint by
  sprint and the freed time funds the next item.

## 4. How would you prioritise your testing efforts during the first three months?

**Principle.** Three months = 6 releases. Each month has one goal and a measurable exit
criterion, so the team can see whether the approach works and adjust. Order follows the
risk register (Q1) and the automation priority (Q3): first stop the defects in ordering,
then widen to integrations and invoicing, then make the new baseline the normal way of working.
Manual regression is not stopped overnight; it shrinks as each automated block replaces it.

### Roadmap

| Month                                       | Goal                                          | Key activities                                                                                                                                                                                                                                                                                                                                                                               | Exit criteria                                                                                                                                                         |
| ------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1 – Stabilise and learn** (releases 1–2)  | Trusted CI and a baseline of facts            | Collect data: escaped defects by area, change frequency, current test inventory, partner contracts. Validate risk scores with the team. Fix or quarantine the 10 flaky UI tests. Set up the API suite and contract checks in GitHub Actions on every PR; failing build blocks merge. Automate Vehicle Ordering API (Q3 #1). Agree test ownership: the team that changes code owns its tests. | CI green and trusted (no re-runs needed). Ordering API covered: transitions, roles, validation. Risk register validated. Manual regression ≈ 4 days                   |
| **2 – Widen the safety net** (releases 3–4) | Cover the other two escaped-defect areas      | Contract tests for supplier and OEM integrations (Q3 #2) with stubbed partners in CI. Purchase and invoice API tests (Q3 #3). Order-to-invoice chain scenario tagged `@smoke` (Q3 #4). Replace manual regression steps one by one as tests land. Start exploratory charters on every story in R1–R3.                                                                                         | All three escaped-defect areas have automated coverage. Manual regression ≈ 2 days. First release with zero escaped defects in ordering                               |
| **3 – Make it the norm** (releases 5–6)     | Risk-based release process with the same 3 QA | Manual regression reduced to the risk-based pack (Q2): UI smoke checklist + E2E walkthrough, ≤ 1 day. 3–5 reliable UI smoke tests nightly. Smoke-level API checks for vehicle creation and search (R5, R6). Decide on performance and security (R8) from month-1 data. Publish metrics dashboard (Part 2). Retrospective: re-score the risk register.                                        | Manual regression ≤ 1 day. ≥ 150 API tests in CI, < 2 % flaky. Freed QA time goes to exploratory testing and automation of new stories. Escaped defects trending down |

### Why this order

- **Data before decisions.** Month 1 confirms the risk scores with real defect data instead of
  guessing; the roadmap is corrected if the evidence disagrees.
- **Trust before coverage.** Flaky tests and no gate are fixed first, otherwise new tests add
  noise, not safety.
- **Risk score decides sequence.** Ordering (25) in month 1, integrations and invoicing (20)
  in month 2, the rest in month 3.
- **Visible wins each month.** Manual regression 5 → 4 → 2 → 1 days is a number the team and
  management can see, which keeps support for the change.
- **No big bang.** Manual regression is retired step by step as automated coverage proves itself,
  so release confidence never drops during the transition.

## 5. What additional information would you request from the team before finalising the approach?

**Principle.** The assessment above is built on the brief alone, so the risk scores,
the automation order and the 3-month plan are hypotheses. Each question below is tied to a
decision it would change. Answers are collected in the first two weeks (month 1 of the roadmap)
and the risk register is re-scored with them.

### Questions by area

| Area                        | What I would ask                                                                                                                                                                                                              | Decision it affects                                                                                                                 |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Defect history**          | Last 6–12 months of escaped defects by area, severity and root cause. How were they found (customer, support, monitoring)? Mean time to detect and fix?                                                                       | Confirms or changes the risk scores (R1–R4); shows whether the problem is missing tests, missing requirements or environment issues |
| **Vehicle Ordering domain** | Full order lifecycle and allowed status transitions. Which roles exist (dealer, OEM admin, others?) and what each may do. Pricing rules and recalculation triggers. Is there an API spec (OpenAPI) and is it kept up to date? | Scope and design of the Ordering API tests (Q3 #1, Part 3); whether contract tests can be generated from the spec                   |
| **Integrations**            | Which suppliers and OEMs, which protocols (REST, files, queues). Do partners provide sandboxes, test data, versioned contracts and change notifications? How are failures detected today?                                     | Feasibility of contract tests vs stubs (Q3 #2); whether monitoring is needed before testing                                         |
| **Existing automation**     | What do the ~50 API tests and ~10 UI tests cover and what do they miss? Why are UI tests flaky (environment, data, locators, timing)? Who maintains them and how often do they run?                                           | Reuse vs rewrite; whether month-1 effort goes to fixing or quarantining; where the coverage gap really is                           |
| **Environments and data**   | How many test environments, who owns them, how stable are they? How is test data created and reset? Can tests run in parallel without interfering?                                                                            | Test independence and parallelism; whether data factories or a seeding API are needed first                                         |
| **Process and CI**          | What is the current release pipeline and what gates exist? What is the branching model? Is there a definition of done that includes tests? Who decides go/no-go for a release and on what basis?                              | Where the quality gates go (Part 2); how a failing build is handled                                                                 |
| **Team and ownership**      | Skills of the 3 QA (coding, TestComplete, domain). Do developers write tests? Who owns tests when a feature is done? Is there QA capacity on each feature team or one central QA?                                             | Capacity split in the roadmap (Q4); whether "team owns its tests" is realistic in month 1                                           |
| **Business priorities**     | Which flows are most used and most revenue-critical from the product owner's view? Any upcoming big changes (new OEM, new pricing model)? Peak periods when releases must not fail?                                           | Validates Impact scores; may reorder months 2–3                                                                                     |
| **Non-functional**          | Any performance or security incidents, SLAs, multi-tenancy model (dealers isolated by token, tenant, database?). Compliance requirements for invoices.                                                                        | Scores R8; decides whether security tests for role separation go into month 1                                                       |

### How the answers are used

- **Week 1–2:** interviews with QA, developers, product owner and support; read defect
  tracker, CI history and existing tests.
- **Week 2:** re-score the risk register with real data; confirm or change the automation
  order and the month-2 / month-3 goals.
- **Open questions become risks:** anything the team cannot answer (e.g. no partner sandbox,
  no API spec) is added to the register as a risk with its own mitigation.

## 6. Test ownership: how to use the three QA engineers

**Problem.** "Inconsistent test ownership" means that today nobody is accountable for a
failing or flaky test, for a coverage gap or for a risk area. Tests are written and then
orphaned. With only 3 QA the fix is not more people but clear ownership: each QA owns a
risk area end to end (manual + automation + CI health), with a named backup, and developers
own the tests they change.

**Assumption.** The brief does not describe the QA profiles, so the model below is based on
three typical profiles. It is confirmed against real skills in week 1 (Q5, "Team and
ownership") and adjusted; the areas stay, the names move.

### Ownership model

| Owner                              | Profile                                                                         | Owns (risk area)                                                                                                                     | Responsibilities                                                                                                                                                                                    | Backup |
| ---------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **QA 1 – Automation lead**         | Strongest coding skills (TypeScript, Playwright, CI)                            | **R1 Vehicle Ordering API** and the **automation framework + CI gate** (R4)                                                          | Builds and reviews all API tests, keeps the framework and CI green, defines test standards (structure, tagging, cleanup), pairs with developers on PR tests, tracks flaky rate                      | QA 3   |
| **QA 2 – Domain / integrations**   | Longest experience with the platform, knows dealers, OEM flows, invoicing rules | **R2 Purchase and invoice** and **R3 Supplier and OEM integrations**                                                                 | Owns contract tests and partner sandboxes, the end-to-end walkthrough on release candidates, exploratory charters for ordering-to-invoice, is the go-to person for business rules and acceptance    | QA 1   |
| **QA 3 – Manual / UI and release** | Strong manual and exploratory tester, TestComplete experience                   | **R7 Desktop UI**, **R5/R6 vehicle creation and search**, and the **release process** (risk-based regression pack, production smoke) | Stabilises then minimises the UI suite, maintains the manual regression pack and checklists, runs UAT with dealership users, drives exploratory sessions on new features, reports release readiness | QA 2   |

Cross-cutting rules:

- **One owner per risk area, one backup.** The backup reviews the owner's tests and can run
  the area alone, so holidays and attrition do not stall a release (bus factor ≥ 2).
- **Developers own PR-level tests.** A pull request that changes ordering, invoicing or an
  integration must include or update the API tests; the QA owner reviews, not writes, those.
- **Owner is accountable for the health of the area:** failing or flaky tests in CI are fixed
  or quarantined by the owner within the same day, never ignored or re-run.
- **Ownership is visible:** a `CODEOWNERS` file in the test repository maps `tests/orders/`,
  `tests/invoices/`, `tests/integrations/` and `ui/` to the owners, so reviews are routed
  automatically and the mapping is not tribal knowledge.
- **Rotation every quarter** (owner ↔ backup) spreads platform knowledge and prevents silos.

### Why this split

- **Matches skills to risk.** The best coder takes the highest-scoring area (R1 = 25) and the
  framework everyone depends on; the domain expert takes the areas where business rules and
  partner behaviour matter more than code (R2, R3); the manual expert keeps the activities
  that stay manual (Q2) and the release process.
- **Covers all three escaped-defect categories** with a named accountable person each.
- **Keeps manual and automated testing together** in one owner per area instead of splitting
  "automation QA" from "manual QA", which is how tests get orphaned.
- **Fits the roadmap (Q4):** month 1 is QA 1 on ordering automation + CI, QA 2 on data
  collection and partner contracts, QA 3 on flaky-test triage and the regression pack.
