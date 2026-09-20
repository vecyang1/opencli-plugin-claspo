import { cli, Strategy } from '@jackwener/opencli/registry';
import { CommandExecutionError } from '@jackwener/opencli/errors';
import { normalizeWidgetId } from './_schema.js';
import { renameWidget } from './_ui.js';

export const renameCommand = cli({
  site: 'claspo',
  name: 'rename',
  access: 'write',
  description: 'Rename a Claspo widget.',
  example: 'opencli claspo rename 87240 "Summer Promo Pop-up"',
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
      name: 'name',
      type: 'string',
      required: true,
      positional: true,
      help: 'New name for the widget.',
    },
  ],
  columns: ['WidgetId', 'Name', 'Status'],
  func: async (page, kwargs) => {
    const widgetId = normalizeWidgetId(kwargs['widget-id']);
    const newName = String(kwargs.name || '').trim();
    if (!newName) {
      throw new CommandExecutionError('Widget name cannot be empty.');
    }
    const res = await renameWidget(page, widgetId, newName);
    return [
      {
        WidgetId: res.id,
        Name: res.name,
        Status: res.status,
      },
    ];
  },
});
