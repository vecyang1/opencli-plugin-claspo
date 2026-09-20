export class CommandExecutionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CommandExecutionError';
  }
}

export const CLASPO_ORIGIN = 'https://my.claspo.io';

const WIDGET_ID_PATTERN = /^\d+$/;

/**
 * Validate and normalize a Claspo widget ID.
 */
export function normalizeWidgetId(value, { required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new TypeError('widget-id is required.');
    return undefined;
  }
  const idStr = String(value).trim();
  if (!WIDGET_ID_PATTERN.test(idStr)) {
    throw new TypeError(`widget-id must be a numeric integer, got: "${value}"`);
  }
  return Number.parseInt(idStr, 10);
}

/**
 * Format raw widget and analytics object into clean table/json row.
 */
export function formatWidgetRow(item, analyticsMap = {}) {
  if (!item || typeof item !== 'object') {
    throw new CommandExecutionError('Malformed widget item payload from Claspo.');
  }
  const stat = analyticsMap[item.id] || {};
  return {
    WidgetId: item.id,
    Name: item.name || 'Untitled',
    Status: item.publishStatus || 'DEBUG',
    Type: item.config?.type || item.variants?.[0]?.type || 'UNKNOWN',
    Views: stat.views ?? item.analytics?.[0]?.views ?? 0,
    Submissions: stat.submits ?? stat.subscriptions ?? 0,
    Conversion: typeof stat.conversion === 'number' ? `${stat.conversion.toFixed(1)}%` : '0.0%',
    LastUpdate: item.updatedDate ? item.updatedDate.split('T')[0] : 'N/A',
  };
}

/**
 * Recursively extracts user-visible components from a ClDocument view or node.
 */
export function extractTextAndActionComponents(node, viewLabel = '') {
  const list = [];
  if (!node || typeof node !== 'object') return list;

  if (node.id && node.type) {
    const isText = node.type === 'TEXT';
    const isButton = node.type === 'BUTTON';
    const isInput = node.type === 'INPUT';
    const isTimer = node.type === 'COUNTDOWN_TIMER';
    const isImage = node.type === 'IMAGE';

    if (isText || isButton || isInput || isTimer || isImage) {
      list.push({
        View: viewLabel,
        ComponentId: node.id,
        Type: node.type,
        Content:
          node.props?.content?.text ||
          node.props?.content?.placeholder ||
          node.props?.control?.imageSource?.url ||
          (isTimer ? 'Timer (15m)' : ''),
        Field: node.props?.control?.name || '',
      });
    }
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      list.push(...extractTextAndActionComponents(child, viewLabel));
    }
  }

  return list;
}

/**
 * Format targeting and schedule rules into structured summary.
 */
export function formatRulesSummary(rules = {}, tracking = {}) {
  const frequency = rules.FREQUENCY?.predicates?.[0]?.name || (rules.FREQUENCY?.enabled ? 'ENABLED' : 'DISABLED');
  const timer = rules.SCHEDULE?.predicates?.[0]?.params?.lengthFromTheStart || 'NONE';
  const showAgain = rules.SCHEDULE?.predicates?.[0]?.params?.showAgainMode || 'N/A';

  const targetingConditions = [];
  const groups = rules.TARGETING?.schema?.include?.groups || [];
  for (const g of groups) {
    if (Array.isArray(g.conditions)) {
      for (const c of g.conditions) {
        targetingConditions.push({
          target: c.operand?.name || 'TARGET',
          operator: c.operator || 'EQUALS',
          value: typeof c.value === 'object' && c.value !== null ? JSON.stringify(c.value) : String(c.value ?? 'ANY'),
        });
      }
    }
  }

  const trackers = tracking?.trackers?.map((t) => t.name) || [];

  return {
    Frequency: frequency,
    TimerDuration: timer,
    ShowAgainMode: showAgain,
    TargetingConditions: targetingConditions,
    Trackers: trackers.join(', ') || 'None',
  };
}

/**
 * Format analytics object into human-readable metrics.
 */
export function formatAnalyticsRow(item = {}) {
  return {
    WidgetId: item.widgetId ?? 'N/A',
    Views: item.views ?? 0,
    Clicks: item.clicks ?? 0,
    Submissions: item.submits ?? item.subscriptions ?? 0,
    TargetActions: item.targetActions ?? 0,
    Conversion: typeof item.conversion === 'number' ? `${item.conversion.toFixed(2)}%` : '0.00%',
  };
}
