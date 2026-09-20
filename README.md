# opencli-plugin-claspo

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.5.0-brightgreen.svg)](package.json)
[![OpenCLI Plugin](https://img.shields.io/badge/OpenCLI-Plugin-orange.svg)](https://github.com/jackwener/OpenCLI)
[![Tests Pass](https://img.shields.io/badge/Tests-6%2F6%20Pass-success.svg)](clis/claspo/commands.test.mjs)

Production-grade [Claspo](https://claspo.io) widget and popup automation suite for [OpenCLI](https://github.com/jackwener/OpenCLI). Enables autonomous agents and developers to inspect targeting rules, extract multi-step appearance component trees, surgically update button/copy text, and publish widgets.

---

## Highlights

- **Multi-Step Funnel Extraction**: Recursively parses Claspo's `ClDocumentI` AST across all step views (`Signup`, `Email`, `Promocode`, `Existing`, `Error`) into structured JSON.
- **Surgical Component Patching**: Safely mutate text copy, button labels, and countdown timer parameters by component UUID using Claspo's native `ClaspoEditorSDK`.
- **Targeting & Schedule Inspection**: Retrieve live display rules, frequency caps, scheduling, and URL triggers.
- **Real-Time Analytics**: View impressions, submissions, and conversion rates across all account widgets.
- **Zero Session Drift (SSOT)**: Drives Claspo's Angular dashboard singletons (`window.ClaspoDashboardSDK` and `window.ClaspoEditorSDK`) directly via OpenCLI Browser Bridge, reusing the active authenticated Chrome session.
- **Production Hardened**: Built with TDD, strict ID validation, desktop viewport enforcement (>= 1280px), and instant SPA hash routing.

---

## Installation

### Via OpenCLI Plugin Manager

```bash
opencli plugin install github:vecyang1/opencli-plugin-claspo
```

### Manual / Local Development

```bash
git clone https://github.com/vecyang1/opencli-plugin-claspo.git
cd opencli-plugin-claspo
npm run install-adapters
```

---

## Command Reference

All commands support `-f json` or `--format json` for machine-readable output in agent workflows.

| Command | Usage | Description |
|---|---|---|
| `list` | `opencli claspo list [-f json]` | List all widgets with ID, Name, Status, Views, Submissions, and Conversion Rate |
| `get` | `opencli claspo get <widget-id> [-f json]` | Retrieve layout configuration, targeting rules, frequency, and schedules |
| `appearance` | `opencli claspo appearance <widget-id> [-f json]` | Extract all multi-step views and interactive component trees with UUIDs |
| `patch` | `opencli claspo patch <widget-id> --component <uuid> --text <text> [--publish]` | Surgically update text copy on a component and invoke native SDK save |
| `publish` | `opencli claspo publish <widget-id> [--unpublish]` | Toggle widget live publishing status |

---

## Usage Examples

### 1. Extract Multi-Step Views & Component UUIDs

```bash
opencli claspo appearance 87240 -f json
```

Output:
```json
{
  "widgetId": 87240,
  "viewsCount": 5,
  "views": [
    {
      "name": "Signup",
      "componentsCount": 4,
      "components": [
        {
          "uuid": "75474abf-9f79-4eb0-a541-e945532029c7",
          "type": "SysButtonComponent",
          "text": "CLAIM YOUR 10% OFF"
        }
      ]
    },
    {
      "name": "Email",
      "componentsCount": 2,
      "components": [...]
    },
    {
      "name": "Promocode",
      "componentsCount": 2,
      "components": [...]
    }
  ]
}
```

### 2. Surgically Patch Component Text & Publish

```bash
opencli claspo patch 87240 \
  --component "75474abf-9f79-4eb0-a541-e945532029c7" \
  --text "CLAIM YOUR EXCLUSIVE 15% OFF" \
  --publish
```

### 3. Retrieve Targeting Rules & Schedule

```bash
opencli claspo get 87240 -f json
```

---

## Architecture & Invariants

```
┌────────────────────────────────────────────────────────┐
│               OpenCLI Agent / Terminal                 │
└───────────────────────────┬────────────────────────────┘
                            │
              opencli claspo <subcommand>
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│           OpenCLI Browser Bridge (port 19825)          │
│               Paired with Chrome Profile               │
└───────────────────────────┬────────────────────────────┘
                            │
               CDP / Native Page Execution
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│         Claspo Dashboard (my.claspo.io)                │
│  - window.ClaspoDashboardSDK (CRUD, Rules, Leads)      │
│  - window.ClaspoEditorSDK (ClDocumentI AST, Mutate)    │
└────────────────────────────────────────────────────────┘
```

1. **Native Client Singletons**: Rather than attempting reverse REST API calls requiring transient session cookies and CSRF tokens, the adapter executes against Claspo's client-side Angular singletons (`ClaspoDashboardSDK` and `ClaspoEditorSDK`).
2. **Desktop Viewport Enforcement**: Claspo's appearance editor requires a viewport width of at least 1280px. The adapter enforces this to prevent mobile fallback banners.
3. **Instant SPA Hash Navigation**: Uses direct location hash assignment and SDK readiness polling to avoid CDP hangs during client-side route transitions.
4. **Unidirectional State Mutation**: Read authoritative document AST -> inject modification -> invoke `editorSDK.save()` -> re-verify.

---

## Project Structure

```text
.
├── CHANGELOG.md
├── LICENSE
├── README.md
├── clis
│   └── claspo
│       ├── README.md
│       ├── _schema.js
│       ├── _ui.js
│       ├── appearance.js
│       ├── commands.test.mjs
│       ├── get.js
│       ├── list.js
│       ├── patch.js
│       └── publish.js
├── opencli-plugin.json
├── package.json
└── scripts
    └── install-adapters.sh
```

---

## Verification & Testing

Run the hermetic test suite:

```bash
npm test
```

Run OpenCLI command validation:

```bash
opencli validate claspo
```

---

## License

This project is licensed under the [GNU General Public License v3.0 or later (GPL-3.0-or-later)](LICENSE).
