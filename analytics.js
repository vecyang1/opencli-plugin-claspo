import { cli, Strategy } from '@jackwener/opencli/registry';
import { normalizeWidgetId } from './_schema.js';
import { getWidgetAnalytics } from './_ui.js';

export const analyticsCommand = cli({
  site: 'claspo',
  name: 'analytics',
  access: 'read',
  description: 'Retrieve detailed analytics performance metrics for a specific widget.',
  example: 'opencli claspo analytics 87240 -f json',
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
  ],
  columns: ['WidgetId', 'Name', 'Views', 'Clicks', 'Submissions', 'TargetActions', 'Conversion'],
  func: async (page, kwargs) => {
    const widgetId = normalizeWidgetId(kwargs['widget-id']);
    const res = await getWidgetAnalytics(page, widgetId);
    return [res];
  },
});
