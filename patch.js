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
      required: true,
      help: 'Target component UUID (from `opencli claspo appearance <id>`).',
    },
    {
      name: 'text',
      type: 'string',
      required: true,
      help: 'New text or copy to apply to the component.',
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
    const componentId = String(kwargs.component || '').trim();
    const text = String(kwargs.text || '').trim();
    const shouldPublish = Boolean(kwargs.publish);

    if (!componentId) {
      throw new CommandExecutionError('--component UUID is required.');
    }
    if (!text) {
      throw new CommandExecutionError('--text content is required.');
    }

    const res = await patchAppearance(page, widgetId, {
      updates: [{ componentId, text }],
      publish: shouldPublish,
    });

    return [
      {
        WidgetId: widgetId,
        ComponentId: componentId,
        NewText: text,
        Saved: res.saved ? 'YES' : 'NO',
        Published: res.published ? 'YES' : 'NO',
      },
    ];
  },
});
