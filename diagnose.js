import { cli, Strategy } from '@jackwener/opencli/registry';
import { ArgumentError, CommandExecutionError } from '@jackwener/opencli/errors';

/**
 * Diagnostic helper to inspect Claspo widgets, modals, teasers, and countdowns.
 */
export async function diagnoseUrlClaspo(page, targetUrl, waitSec = 5) {
  if (!targetUrl || typeof targetUrl !== 'string' || !/^https?:\/\//i.test(targetUrl.trim())) {
    throw new ArgumentError('A valid http:// or https:// target URL is required.');
  }

  const cleanUrl = targetUrl.trim();

  // 1. Navigate to target URL
  try {
    await page.goto(cleanUrl, { waitUntil: 'none' });
  } catch (err) {
    throw new CommandExecutionError(`Failed to load target URL ${cleanUrl}: ${err.message}`);
  }

  // 2. Settle period for asynchronous GTM and Claspo widgets to mount
  if (waitSec > 0) {
    await page.wait(waitSec);
  }

  // In-page inspection snippet
  const inspectScript = `(() => {
    const claspoScripts = Array.from(document.querySelectorAll('script[src]'))
      .map(s => s.src)
      .filter(src => src.includes('claspo.io') || src.includes('claspo'));

    const gtmScripts = Array.from(document.querySelectorAll('script[src]'))
      .map(s => s.src)
      .filter(src => src.includes('googletagmanager.com') || src.includes('gtm.js'));

    const claspoWidget = document.querySelector('#claspo-widget');
    
    // Dialog / Modal popups
    const modals = Array.from(document.querySelectorAll('.cl-dialog, .cl-modal, [class*="cl-dialog"], [class*="cl-modal"]'))
      .filter(el => {
        const s = window.getComputedStyle(el);
        return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
      });

    // Floating teaser boxes
    const teasers = Array.from(document.querySelectorAll('.cl-floating-box, [class*="cl-floating-box"]'))
      .filter(el => {
        const s = window.getComputedStyle(el);
        return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
      });

    // Countdown timer badges
    const countdowns = Array.from(document.querySelectorAll('[class*="countdown"], [class*="timer"], [data-claspo-countdown]'))
      .filter(el => {
        const s = window.getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
        const text = el.innerText || '';
        return /\\d{1,2}:\\d{2}/.test(text) || (el.className && String(el.className).includes('cl-countdown'));
      });

    const hasClaspoObj = typeof window.claspo !== 'undefined';
    const isClaspoInited = Boolean(window.claspo?.__inited);
    const hasClConfig = Boolean(window._clConfig);
    const isGuardActive = isClaspoInited && !hasClConfig;

    const iframes = Array.from(document.querySelectorAll('iframe'))
      .map(f => f.src || f.getAttribute('src') || '')
      .filter(src => src && /^https?:\\/\\//i.test(src));

    return {
      url: window.location.href,
      claspoScriptsCount: claspoScripts.length,
      claspoScripts,
      gtmScriptsCount: gtmScripts.length,
      hasWidgetDom: Boolean(claspoWidget),
      activeModalsCount: modals.length,
      floatingTeasersCount: teasers.length,
      countdownsCount: countdowns.length,
      hasClaspoObj,
      isClaspoInited,
      hasClConfig,
      isGuardActive,
      iframes,
    };
  })()`;

  let mainReport;
  try {
    mainReport = await page.evaluate(inspectScript);
    if (typeof mainReport === 'string') {
      mainReport = JSON.parse(mainReport);
    }
  } catch (err) {
    throw new CommandExecutionError(`Failed to evaluate DOM in ${cleanUrl}: ${err.message}`);
  }

  const reports = [];
  reports.push({
    scope: 'Main Window',
    url: mainReport.url || cleanUrl,
    claspoScript: mainReport.claspoScriptsCount > 0 ? `Yes (${mainReport.claspoScriptsCount})` : 'No',
    claspoWidgetDom: mainReport.hasWidgetDom ? 'Yes' : 'No',
    activeModals: mainReport.activeModalsCount,
    floatingTeasers: mainReport.floatingTeasersCount,
    countdowns: mainReport.countdownsCount,
    guardActive: mainReport.isGuardActive ? 'Active' : 'N/A',
    status: mainReport.countdownsCount > 1 ? 'DUPLICATE_COUNTDOWN' : 'OK',
  });

  // Evaluate embedded child iframes matching same organization or root domain
  let parsedHost;
  try {
    parsedHost = new URL(cleanUrl).hostname;
  } catch {
    parsedHost = '';
  }
  const rootDomain = parsedHost.split('.').slice(-2).join('.');

  const candidateIframes = (mainReport.iframes || []).filter(src => {
    try {
      const u = new URL(src);
      return rootDomain && u.hostname.endsWith(rootDomain);
    } catch {
      return false;
    }
  });

  for (let i = 0; i < candidateIframes.length; i++) {
    const iframeUrl = candidateIframes[i];
    try {
      await page.goto(iframeUrl, { waitUntil: 'none' });
      await page.wait(Math.min(3, waitSec));
      let frameReport = await page.evaluate(inspectScript);
      if (typeof frameReport === 'string') {
        frameReport = JSON.parse(frameReport);
      }
      const isClean = frameReport.activeModalsCount === 0 &&
                      frameReport.floatingTeasersCount === 0 &&
                      frameReport.countdownsCount === 0;

      reports.push({
        scope: `Iframe [${i + 1}]`,
        url: iframeUrl,
        claspoScript: frameReport.claspoScriptsCount > 0 ? `Injected (${frameReport.claspoScriptsCount})` : 'Blocked',
        claspoWidgetDom: frameReport.hasWidgetDom ? 'Yes' : 'No',
        activeModals: frameReport.activeModalsCount,
        floatingTeasers: frameReport.floatingTeasersCount,
        countdowns: frameReport.countdownsCount,
        guardActive: frameReport.isGuardActive ? 'Protected' : (frameReport.hasClaspoObj ? 'Unprotected' : 'None'),
        status: isClean ? 'CLEAN_GUARDED' : 'DUPLICATE_LEAK',
      });
    } catch (err) {
      reports.push({
        scope: `Iframe [${i + 1}]`,
        url: iframeUrl,
        claspoScript: 'Error',
        claspoWidgetDom: 'Error',
        activeModals: 0,
        floatingTeasers: 0,
        countdowns: 0,
        guardActive: 'Unknown',
        status: `ERROR: ${err.message}`,
      });
    }
  }

  const totalCountdowns = reports.reduce((acc, r) => acc + (Number(r.countdowns) || 0), 0);

  return reports.map(r => ({
    Scope: r.scope,
    Url: r.url,
    ClaspoScript: r.claspoScript,
    ClaspoWidgetDom: r.claspoWidgetDom,
    ActiveModals: r.activeModals,
    FloatingTeasers: r.floatingTeasers,
    Countdowns: r.countdowns,
    GuardActive: r.guardActive,
    Status: totalCountdowns > 1 ? 'ALERT: MULTIPLE_COUNTDOWNS' : r.status,
  }));
}

export const diagnoseCommand = cli({
  site: 'claspo',
  name: 'diagnose',
  access: 'read',
  description: 'Diagnose any website URL for duplicate Claspo widgets, modals, teasers, and countdown badges across main frame and iframes.',
  example: 'opencli claspo diagnose https://<website-url> -f json',
  domain: 'my.claspo.io',
  strategy: Strategy.UI,
  browser: true,
  siteSession: 'ephemeral',
  navigateBefore: false,
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
  func: async (page, kwargs) => {
    const targetUrl = kwargs.url || kwargs['url'] || kwargs._?.[0];
    const waitSec = Number(kwargs.wait ?? 5);
    return await diagnoseUrlClaspo(page, targetUrl, waitSec);
  },
});
