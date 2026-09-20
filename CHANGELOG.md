# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
