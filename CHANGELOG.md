# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.1] - 2026-10-04

### Features
- Integrate headless Playwright diagnostic runner into opencli claspo diagnose (`230e94b`)

### Fixes
- Use waitUntil none to avoid page load hang on tracker-heavy sites (`53179dc`)

## [1.3.0] - 2026-09-21

### Added
- Real-page multi-frame diagnostic command `opencli claspo diagnose <url> [--wait <sec>]`:
  - Inspects target URL and embedded child iframes for injected Claspo scripts, active modals (`.cl-dialog`), floating teaser boxes (`.cl-floating-box`), and countdown badges.
  - Automatically verifies whether the Zero-Trust iframe guard (`window.claspo.__inited = true`, `window._clConfig = null`) is active.
  - Detects duplicate popups and duplicate countdown timer badges across main document and embedded frames (`ALERT: MULTIPLE_COUNTDOWNS`).
  - Formatted tabular, JSON, YAML, and CSV output for seamless CI/CD and agentic verification.
- Unit tests for `diagnoseCommand` metadata, argument validation, duplicate countdown detection, and clean guarded iframe states (15/15 passing).

## [1.2.0] - 2026-09-20

### Added
- Batch patching capability to `opencli claspo patch`: accepts `--updates <json_string_or_filepath>` to update multiple AST components atomically across multiple views in a single operation.
- Multi-step view tab switching: dynamically detects and activates the corresponding view tab (`Signup`, `Email`, `Promocode`, `Existing`, `Error`) before mutating component copy, ensuring full multi-step popup support.
- Native Claspo save & apply workflow: triggers the dropdown save menu (`Save and apply`) and polls the toolbar button's `es-btn-loading` state to ensure server-side persistence and live deployment.

### Fixed
- Eliminated premature navigation reloads during Angular SPA initialization, preventing transient `about:blank` context drops.

## [1.1.0] - 2026-09-20

### Added
- Five new core subcommands expanding Claspo automation to full lifecycle and analytics:
  - `opencli claspo rename <widgetId> <name>`: Rename an existing widget.
  - `opencli claspo duplicate <widgetId> [--name <name>]`: Clone an existing widget and optionally assign a new name.
  - `opencli claspo delete <widgetId> --yes`: Delete a widget, guarded by mandatory `--yes` flag to prevent accidental destruction of production assets.
  - `opencli claspo rules <widgetId>`: Deep inspection of display frequency, countdown timers, show-again modes, and URL/targeting predicates.
  - `opencli claspo analytics <widgetId>`: Live breakdown of impressions, clicks, submissions, target actions, and conversion rate.
- Unit tests for targeting rules formatting, analytics formatting, and command safety assertions (12/12 passing).

## [1.0.1] - 2026-09-20

### Changed
- Promoted all command adapters and unit tests to repository root to support standard OpenCLI plugin discovery (`opencli plugin install github:vecyang1/opencli-plugin-claspo`).
- Updated `package.json` test runner and `scripts/install-adapters.sh` to source directly from plugin root.

## [1.0.0] - 2026-09-20

### Added
- Initial public release of `opencli-plugin-claspo`.
- Five standard OpenCLI subcommands for Claspo widget automation:
  - `opencli claspo list`: Retrieve all widgets with ID, Name, Status, Type, Views, Submissions, Conversion Rate, and Last Update timestamp.
  - `opencli claspo get <widgetId>`: Fetch widget layout type and active targeting/frequency/schedule rules.
  - `opencli claspo appearance <widgetId>`: Recursively extract the AST component tree across all multi-step views (`Signup`, `Email`, `Promocode`, `Existing`, `Error`) with component UUIDs, classes, and current text copy.
  - `opencli claspo patch <widgetId> --component <uuid> --text <text> [--publish]`: Surgical mutation of component text with native `save()` and optional publishing.
  - `opencli claspo publish <widgetId> [--unpublish]`: Toggle live publishing status.
- Single Source of Truth architecture interfacing directly with Claspo's client-side Angular singletons (`window.ClaspoDashboardSDK` and `window.ClaspoEditorSDK`).
- Hermetic unit test suite (`clis/claspo/commands.test.mjs`) covering widget ID normalization, adversarial validation, format fallbacks, and AST component extraction.
- Desktop breakpoint invariant enforcing >= 1280px viewport to prevent mobile layout fallbacks.
- Instant SPA hash navigation engine with zero CDP blocking.
