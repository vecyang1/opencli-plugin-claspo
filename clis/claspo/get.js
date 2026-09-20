import { cli, Strategy } from '@jackwener/opencli/registry';
import { normalizeWidgetId } from './_schema.js';
import { getWidgetDetails } from './_ui.js';

export const getCommand = cli({
  site: 'claspo',
  name: 'get',
  access: 'read',
  description: 'Get full configuration, targeting rules, and variants of a specific Claspo widget.',
  example: 'opencli claspo get 87240 -f json',
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
  columns: ['WidgetId', 'Name', 'Status', 'LayoutType', 'TargetingRules', 'CreatedDate', 'UpdatedDate'],
  func: async (page, kwargs) => {
    const widgetId = normalizeWidgetId(kwargs['widget-id']);
    const w = await getWidgetDetails(page, widgetId);
    return [
      {
        WidgetId: w.id,
        Name: w.name,
        Status: w.publishStatus,
        LayoutType: w.config?.type || 'UNKNOWN',
        TargetingRules: Object.keys(w.config?.config?.rules || {}).filter(
          (k) => w.config?.config?.rules[k]?.enabled
        ).join(', ') || 'Default',
        CreatedDate: w.createdDate ? w.createdDate.split('T')[0] : 'N/A',
        UpdatedDate: w.updatedDate ? w.updatedDate.split('T')[0] : 'N/A',
      },
    ];
  },
});
