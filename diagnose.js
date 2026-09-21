import { cli, Strategy } from '@jackwener/opencli/registry';
import { ArgumentError, CommandExecutionError } from '@jackwener/opencli/errors';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Diagnostic helper to inspect Claspo widgets, modals, teasers, and countdowns.
 */
export async function diagnoseUrlClaspo(targetUrl, waitSec = 5) {
  if (!targetUrl || typeof targetUrl !== 'string' || !/^https?:\/\//i.test(targetUrl.trim())) {
    throw new ArgumentError('A valid http:// or https:// target URL is required.');
  }

  const cleanUrl = targetUrl.trim();
  const scriptPath = path.resolve(__dirname, 'scripts', 'diagnose_runner.py');

  try {
    const { stdout, stderr } = await execFileAsync('python3', [scriptPath, cleanUrl, String(waitSec)], {
      timeout: 45000,
    });
    if (!stdout || !stdout.trim()) {
      throw new Error(stderr || 'Empty output from diagnostic runner');
    }
    return JSON.parse(stdout.trim());
  } catch (err) {
    throw new CommandExecutionError(`Diagnostic execution failed on ${cleanUrl}: ${err.message}`);
  }
}

export const diagnoseCommand = cli({
  site: 'claspo',
  name: 'diagnose',
  access: 'read',
  description: 'Diagnose any website URL for duplicate Claspo widgets, modals, teasers, and countdown badges across main frame and iframes.',
  example: 'opencli claspo diagnose https://<website-url> -f json',
  strategy: Strategy.LOCAL,
  browser: false,
  args: [
    {
      name: 'url',
      type: 'string',
      required: true,
      positional: true,
      help: 'Target website URL to diagnose for Claspo duplicates and popups.',
    },
    {
      name: 'wait',
      type: 'int',
      default: 5,
      help: 'Seconds to wait for asynchronous tags and widgets to mount (default: 5).',
    },
  ],
  columns: [
    'Scope',
    'Url',
    'ClaspoScript',
    'ClaspoWidgetDom',
    'ActiveModals',
    'FloatingTeasers',
    'Countdowns',
    'GuardActive',
    'Status',
  ],
  func: async (kwargs) => {
    const targetUrl = kwargs.url || kwargs['url'] || kwargs._?.[0];
    const waitSec = Number(kwargs.wait ?? 5);
    return await diagnoseUrlClaspo(targetUrl, waitSec);
  },
});
