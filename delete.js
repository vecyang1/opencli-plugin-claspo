import { cli, Strategy } from '@jackwener/opencli/registry';
import { CommandExecutionError } from '@jackwener/opencli/errors';
import { normalizeWidgetId } from './_schema.js';
import { deleteWidget } from './_ui.js';

export const deleteCommand = cli({
  site: 'claspo',
  name: 'delete',
  access: 'write',
  description: 'Delete a Claspo widget. Requires --yes confirmation flag.',
  example: 'opencli claspo delete 87247 --yes',
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
      help: 'Numeric Claspo widget ID to delete.',
    },
    {
      name: 'yes',
      type: 'boolean',
      required: false,
      default: false,
      help: 'Confirm deletion of the widget (mandatory safety guard).',
    },
  ],
  columns: ['WidgetId', 'Name', 'Deleted'],
  func: async (page, kwargs) => {
    const widgetId = normalizeWidgetId(kwargs['widget-id']);
    if (!kwargs.yes) {
      throw new CommandExecutionError('Deletion aborted: --yes flag is required to delete a Claspo widget.');
    }
    const res = await deleteWidget(page, widgetId);
    return [
      {
        WidgetId: res.id,
        Name: res.name,
        Deleted: res.deleted ? 'YES' : 'NO',
      },
    ];
  },
});
