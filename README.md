# Brownfield testing with GitHub Copilot

[Read the presentation](https://ashikaiapps.github.io/copilot-brownfield-testing/) | [Complete Markdown handout](playbook.md) | [CI and deployment runs](https://github.com/ashikaiapps/copilot-brownfield-testing/actions/workflows/site.yml)

A customer-facing, evidence-first playbook for adding trusted tests to established applications. Ten implementation stages include reusable prompts, intent, outputs, and review gates, followed by coverage guidance, reusable skills, a twelve-minute walkthrough, and working CI evidence.

The application under test **in this repository is just the presentation page**. It demonstrates deterministic testing and test-gated delivery, not a real legacy backend, purchase-request implementation, or complete application coverage. No third-party skill or reverse-engineering tool is installed.

Community references: [morluto/rea](https://github.com/morluto/rea) for authorized evidence-backed investigation, and [petrkindlmann/qa-skills](https://github.com/petrkindlmann/qa-skills) for reviewed QA skills and prompts. These are third-party resources, not built-in Copilot features. Inspect instructions/scripts, authorize execution, and pin reviewed versions; installing skills does not install the separate QA runner.

## Run locally

Use Node.js 22 or newer:

```powershell
npm ci
npx playwright install chromium
npm test
npm start
```

Open <http://127.0.0.1:4173>. Stop the server with Ctrl+C. Playwright starts and stops its own local server when testing. There is no frontend framework or runtime build. `index.html` can also be opened directly, but clipboard access depends on browser permissions and a secure context; failed copies show explicit manual-copy guidance.

To edit content, update `playbook.md`, run `npm run render`, and commit both the handout and generated `index.html`. `render.mjs` uses the pinned development-only Markdown renderer; it adds the small inline theme/copy controls. CI checks that the committed HTML matches its source. The published page needs no Node.js or third-party scripts, styles, fonts, or network services.

## Files

| File | Purpose |
|---|---|
| `index.html` | Complete self-contained presentation; semantic headings, anchor navigation, light/dark preference, copy feedback, mobile and print styles |
| `playbook.md` | Full editable handout and prompt library |
| `render.mjs` | Small development-only Markdown-to-HTML renderer and page template |
| `server.mjs` | Local static server with an explicit public-file allowlist |
| `tests/`, `playwright.config.mjs` | Independent browser checks and hosted revision smoke |
| `playwright.demo.config.mjs`, `tests/demo-failure.spec.mjs` | Isolated, deliberately failing demonstration with its own reports |
| `package.json`, `package-lock.json` | Pinned development tooling and reproducible dependency installation |
| `.github/workflows/site.yml` | Test, gated Pages publication, and hosted smoke |
| `.github/workflows/failure-demo.yml` | Manual failure demonstration; read-only permissions and no deployment |

## Executable scenarios

Eighteen scenarios run in both desktop Chromium and Chromium mobile emulation: **36 checks per local/CI run**. PAGE-09 through PAGE-18 are ten additional scenarios. A separate post-deployment check brings the main-branch delivery workflow total to **37**. Actual passed, failed, flaky, and skipped counts appear in the Actions job summary and downloadable report.

| ID | Approved observable outcome |
|---|---|
| PAGE-01 | Correct title; exactly ten numbered stages with intent, output, prompt, review gate; complete accessible handout |
| PAGE-02 | Exact community reference URLs and visible third-party/coverage limitations |
| PAGE-03 | All ten navigation links reach their stage; all internal anchors resolve |
| PAGE-04 | Copy writes the complete prompt to the actual browser clipboard, allowing only OS newline normalization |
| PAGE-05 | A deliberately denied clipboard write displays explicit recovery without hiding the prompt |
| PAGE-06 | Keyboard skip link focuses main content; semantic landmarks and language exist; keyboard activation reaches copy failure feedback |
| PAGE-07 | System and explicit themes work; no page-level overflow at 320, 390, and 1280 pixels; print hides controls but retains content |
| PAGE-08 | No browser errors or failed page requests; local linked resources respond successfully |
| PAGE-09 | A bookmarked tutorial stage stays in view after reload |
| PAGE-10 | Primary chapter navigation and back-to-top reach the correct content and focus target |
| PAGE-11 | Tutorial content and anchor navigation remain usable with JavaScript disabled |
| PAGE-12 | Heading levels, unique IDs, and accessible stage labels preserve document structure |
| PAGE-13 | Every code sample has its own uniquely named copy control and live feedback |
| PAGE-14 | A copy action recovers from a transient clipboard failure without reloading |
| PAGE-15 | Every displayed code sample exactly preserves the Markdown handout's sample text |
| PAGE-16 | Customer-facing copy replaces conversational replies and internal presenter notes |
| PAGE-17 | Delivery evidence and the intentional-failure demonstration link to separate workflows with explicit expectations |
| PAGE-18 | Narrow-screen reference tables expose column headers and support keyboard horizontal scrolling without overflowing the page |
| HOST-01 | Hosted page responds, has the correct title/ten stages, and `version.json` identifies the exact deployed commit |

PAGE-05 and the keyboard activation part of PAGE-06 simulate clipboard denial. PAGE-14 uses a controlled clipboard adapter that rejects once and resolves once to test feedback recovery; it does not claim to exercise the OS clipboard. PAGE-04 uses real clipboard read/write, not a success stub. Real clipboard tests use the same immutable prompt; no tests share server-side mutable data. Browser storage is isolated per test.

These checks do **not** demonstrate exhaustive accessibility, Firefox/WebKit or real-device support, legacy business-rule coverage, performance, security auditing, or absence of flaky behavior. Semantic/keyboard checks are basics, not a WCAG certification. External documentation links are asserted as references rather than depend on third-party uptime. Public CI has no accounts, secrets, auth state, or customer data. Do not reuse its public-artifact policy unchanged for a real business application.

## CI/CD behavior

- Every pushed branch commit and pull-request update runs the 36 browser checks and source/HTML consistency check. A local commit alone does not trigger GitHub Actions.
- Only `main` pushes (or a manual run on `main`) can deploy, and only after the test job passes. Pull requests use read-only permissions and never deploy; there is no privileged `pull_request_target` execution.
- The deployment job alone receives `pages: write` and `id-token: write`. Official Pages actions publish **only** `index.html`, `playbook.md`, and a generated `version.json`. Dependencies, reports, and traces are never placed in the public site.
- The hosted-smoke job waits for successful deployment, uses its actual URL, and compares the hosted revision to `github.sha`; it cannot silently fall back to localhost. Runs for the same branch are serialized across testing, deployment, and smoke to avoid overlapping deployments.
- HTML reports and failure screenshots/traces are uploaded even on failures, retained for seven days as separate Actions artifacts. This is a public demo: artifacts contain only presentation content. First-attempt failures/retry recoveries appear in reports; **flaky tests fail CI** rather than silently approving deployment. Jobs have bounded timeouts.

The test job blocks deployment. A hosted smoke failure fails the workflow **after** publication; it is not an automatic rollback. Merge blocking also requires an owner to enable a branch ruleset requiring the `test` check; workflow configuration alone does not protect `main`. No nightly suite, business-app environment, or production promotion gate is configured in this intentionally small example.

For an explicit hosted check in PowerShell:

```powershell
$env:BASE_URL = "https://ashikaiapps.github.io/copilot-brownfield-testing/"
$env:EXPECTED_SHA = (git rev-parse HEAD)
npm run test:hosted
```

Pages must be configured to build from **GitHub Actions**, with an environment permitting the default branch. No custom domain or deployment secret is needed. Keep maps, contracts, journeys, prompts, and their checks in sync as expectations evolve.

## Demonstrate a real failing test

[Open the intentional failure workflow](https://github.com/ashikaiapps/copilot-brownfield-testing/actions/workflows/failure-demo.yml) and choose **Run workflow**, or reproduce it locally:

```powershell
npm run test:demo-failure
```

**Expected result: exit code 1 and exactly one failed test, DEMO-01.** It loads the actual presentation and verifies the correct heading, then replaces that heading with `Release confidence unavailable` inside its own browser only. The original expectation, `From legacy code to release confidence`, fails. This is an actual failed assertion, not `test.fail()`, a skip, or `continue-on-error`.

The manual workflow remains red, shows the expected/actual difference, and always uploads `intentional-failure-evidence` with the HTML report, screenshot, JSON results, and trace (seven-day retention). It has read-only repository permissions, no deployment job, and cannot publish the injected regression. It is excluded from normal regression and hosted-smoke projects; neither the public page nor the deployment gate is weakened.

Inspect local evidence with `npx playwright show-report playwright-report-demo` or open the recorded `trace.zip` with `npx playwright show-trace`. Demo output stays in ignored `playwright-report-demo` and `test-results-demo` directories, separate from the passing suite's evidence.
