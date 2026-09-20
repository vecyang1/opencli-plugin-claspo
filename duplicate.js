import { cli, Strategy } from '@jackwener/opencli/registry';
import { normalizeWidgetId } from './_schema.js';
import { duplicateWidget } from './_ui.js';

export const duplicateCommand = cli({
  site: 'claspo',
  name: 'duplicate',
  access: 'write',
  description: 'Duplicate (clone) an existing Claspo widget.',
  example: 'opencli claspo duplicate 87240 --name "Black Friday Variant B"',
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
      help: 'Numeric source Claspo widget ID to clone.',
    },
    {
      name: 'name',
      type: 'string',
      required: false,
      help: 'Optional new name for the cloned widget.',
    },
  ],
  columns: ['WidgetId', 'Name', 'Status', 'CopiedFrom'],
  func: async (page, kwargs) => {
    const widgetId = normalizeWidgetId(kwargs['widget-id']);
    const customName = kwargs.name ? String(kwargs.name).trim() : null;
    const res = await duplicateWidget(page, widgetId, customName);
    return [
      {
        WidgetId: res.id,
        Name: res.name,
        Status: res.status,
        CopiedFrom: res.copiedFrom,
      },
    ];
  },
});
