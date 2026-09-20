import { cli, Strategy } from '@jackwener/opencli/registry';
import { listAllWidgets } from './_ui.js';

export const listCommand = cli({
  site: 'claspo',
  name: 'list',
  access: 'read',
  description: 'List all Claspo widgets with their status, views, submissions, and conversion rates.',
  example: 'opencli claspo list -f json',
  domain: 'my.claspo.io',
  strategy: Strategy.UI,
  browser: true,
  siteSession: 'ephemeral',
  navigateBefore: false,
  args: [],
  columns: ['WidgetId', 'Name', 'Status', 'Type', 'Views', 'Submissions', 'Conversion', 'LastUpdate'],
  func: async (page) => {
    return await listAllWidgets(page);
  },
});
