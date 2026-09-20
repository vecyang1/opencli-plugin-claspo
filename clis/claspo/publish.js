import { cli, Strategy } from '@jackwener/opencli/registry';
import { normalizeWidgetId } from './_schema.js';
import { toggleWidgetPublish } from './_ui.js';

export const publishCommand = cli({
  site: 'claspo',
  name: 'publish',
  access: 'write',
  description: 'Publish or unpublish a Claspo widget on the live website.',
  example: 'opencli claspo publish 87240',
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
      name: 'unpublish',
      type: 'boolean',
      default: false,
      help: 'Unpublish (set to DEBUG) instead of publishing.',
    },
  ],
  columns: ['WidgetId', 'Name', 'Status'],
  func: async (page, kwargs) => {
    const widgetId = normalizeWidgetId(kwargs['widget-id']);
    const shouldPublish = !Boolean(kwargs.unpublish);
    const res = await toggleWidgetPublish(page, widgetId, shouldPublish);
    return [
      {
        WidgetId: res.id,
        Name: res.name,
        Status: res.status,
      },
    ];
  },
});
