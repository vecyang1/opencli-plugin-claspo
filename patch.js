import fs from 'fs';
import { cli, Strategy } from '@jackwener/opencli/registry';
import { CommandExecutionError } from '@jackwener/opencli/errors';
import { normalizeWidgetId } from './_schema.js';
import { patchAppearance } from './_ui.js';

export const patchCommand = cli({
  site: 'claspo',
  name: 'patch',
  access: 'write',
  description: 'Programmatically update text copy or properties of a widget appearance and save it.',
  example: 'opencli claspo patch 87240 --component d4ddfeee-fe74-4828-b1df-ca7400bc0c51 --text "15% OFF TODAY" --publish',
  domain: 'my.claspo.io',
  strategy: Strategy.UI,
  browser: true,
  siteSession: 'ephemeral',
  navigateBefore: false,
  args: [
    {
      name: 'widget-id',
      type: 'string',
      required: true,
      positional: true,
      help: 'Numeric Claspo widget ID (e.g. 87240).',
    },
    {
      name: 'component',
      type: 'string',
      required: false,
      help: 'Target component UUID (from `opencli claspo appearance <id>`).',
    },
    {
      name: 'text',
      type: 'string',
      required: false,
      help: 'New text or copy to apply to the component.',
    },
    {
      name: 'updates',
      type: 'string',
      required: false,
      help: 'JSON string or path to JSON file containing array of { componentId, text } updates for batch patching.',
    },
    {
      name: 'publish',
      type: 'boolean',
      default: false,
      help: 'Publish changes immediately after saving.',
    },
  ],
  columns: ['WidgetId', 'ComponentId', 'NewText', 'Saved', 'Published'],
  func: async (page, kwargs) => {
    const widgetId = normalizeWidgetId(kwargs['widget-id']);
    const shouldPublish = Boolean(kwargs.publish);
    let updates = [];

    if (kwargs.updates) {
      const val = String(kwargs.updates).trim();
      let rawJson = val;
      if (!val.startsWith('[') && !val.startsWith('{') && fs.existsSync(val)) {
        rawJson = fs.readFileSync(val, 'utf8');
      }
      try {
        const parsed = JSON.parse(rawJson);
        updates = Array.isArray(parsed) ? parsed : [parsed];
      } catch (err) {
        throw new CommandExecutionError(`Failed to parse --updates JSON: ${err.message}`);
      }
    } else {
      const componentId = String(kwargs.component || '').trim();
      const text = String(kwargs.text || '').trim();
      if (!componentId) {
        throw new CommandExecutionError('Either --component with --text or --updates (JSON/file) is required.');
      }
      if (!text) {
        throw new CommandExecutionError('--text content is required when --component is specified.');
      }
      updates.push({ componentId, text });
    }

    const res = await patchAppearance(page, widgetId, {
      updates,
      publish: shouldPublish,
    });

    const appliedList = res.applied?.length ? res.applied : updates;
    return appliedList.map((item) => ({
      WidgetId: widgetId,
      ComponentId: item.componentId,
      NewText: item.text,
      Saved: res.saved ? 'YES' : 'NO',
      Published: res.published ? 'YES' : 'NO',
    }));
  },
});

