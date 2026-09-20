import { cli, Strategy } from '@jackwener/opencli/registry';
import { normalizeWidgetId } from './_schema.js';
import { getWidgetRules } from './_ui.js';

export const rulesCommand = cli({
  site: 'claspo',
  name: 'rules',
  access: 'read',
  description: 'Inspect display frequency, triggers, schedule, and targeting rules for a Claspo widget.',
  example: 'opencli claspo rules 87240 -f json',
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
  columns: ['WidgetId', 'WidgetName', 'Frequency', 'TimerDuration', 'ShowAgainMode', 'TargetingCount', 'Trackers'],
  func: async (page, kwargs) => {
    const widgetId = normalizeWidgetId(kwargs['widget-id']);
    const res = await getWidgetRules(page, widgetId);
    return [
      {
        WidgetId: res.WidgetId,
        WidgetName: res.WidgetName,
        Frequency: res.Summary.Frequency,
        TimerDuration: res.Summary.TimerDuration,
        ShowAgainMode: res.Summary.ShowAgainMode,
        TargetingCount: res.Summary.TargetingConditions.length,
        Trackers: res.Summary.Trackers,
        _details: {
          Summary: res.Summary,
          RawRules: res.RawRules,
          RawTracking: res.RawTracking,
        },
      },
    ];
  },
});
