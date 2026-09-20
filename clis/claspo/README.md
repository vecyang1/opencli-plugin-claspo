# OpenCLI Claspo Adapter

`claspo` turns the Claspo popup/widget dashboard (`my.claspo.io`) into a typed, agent-operable CLI surface.

## Commands

- `opencli claspo list`: List all widgets with ID, Name, Status, Views, Submissions, Conversion rate.
- `opencli claspo get <widget-id>`: Inspect detailed widget configuration, layout type, and targeting rules.
- `opencli claspo appearance <widget-id>`: Extract the full component tree, multi-step views (Signup, Email, Promocode, etc.), text copy, timers, and input fields.
- `opencli claspo patch <widget-id> --component <uuid> --text <text> [--publish]`: Programmatically mutate component text/styling and save/publish via `ClaspoEditorSDK`.
- `opencli claspo publish <widget-id> [--unpublish]`: Publish or unpublish a widget.

## Architecture

- **Strategy**: `Strategy.UI` backed by OpenCLI Browser Bridge.
- **SSOT**: Leverages Claspo's internal client-side SDK singletons (`window.ClaspoDashboardSDK` and `window.ClaspoEditorSDK`), ensuring zero session drift, full type safety, and automatic token management.
- **Verification**: Built with TDD and real-page E2E validation against live production dashboards.
