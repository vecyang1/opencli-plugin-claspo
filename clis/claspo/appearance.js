import { cli, Strategy } from '@jackwener/opencli/registry';
import { normalizeWidgetId } from './_schema.js';
import { getAppearanceInfo } from './_ui.js';

export const appearanceCommand = cli({
  site: 'claspo',
  name: 'appearance',
  access: 'read',
  description: 'Inspect the live appearance document, multi-step views, and text/action components of a widget.',
  example: 'opencli claspo appearance 87240 -f json',
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
  columns: ['View', 'ComponentId', 'Type', 'Content', 'Field'],
  func: async (page, kwargs) => {
    const widgetId = normalizeWidgetId(kwargs['widget-id']);
    const info = await getAppearanceInfo(page, widgetId);
    return info.components;
  },
});
