import { CommandExecutionError } from '@jackwener/opencli/errors';
import {
  CLASPO_ORIGIN,
  formatWidgetRow,
  extractTextAndActionComponents,
  formatRulesSummary,
  formatAnalyticsRow,
} from './_schema.js';

/**
 * Ensures the page is running on Claspo and SDKs are loaded.
 */
export async function ensureClaspoContext(page, targetPath = null) {
  if (!page || typeof page.evaluate !== 'function') {
    throw new CommandExecutionError('Claspo command requires an active OpenCLI Browser Bridge session.');
  }

  if (typeof page.setViewportSize === 'function') {
    await page.setViewportSize({ width: 1440, height: 900 }).catch(() => {});
  }

  const destination = targetPath
    ? `${CLASPO_ORIGIN}/dashboard-ui/#${targetPath}`
    : `${CLASPO_ORIGIN}/dashboard-ui/#/widgets-list`;

  const currentUrl = String(await page.evaluate(() => window.location.href).catch(() => ''));

  if (!currentUrl.includes('claspo.io')) {
    await page.goto(destination);
  } else if (targetPath && !currentUrl.includes(targetPath)) {
    // In SPAs with HashRouter, changing hash via window.location is instant and reliable
    await page.evaluate((dest) => {
      window.location.href = dest;
    }, destination);
  }

  // If targeting the editor, poll until ClaspoEditorSDK is initialized
  if (targetPath && targetPath.includes('appearance')) {
    const start = Date.now();
    let isReady = false;
    while (Date.now() - start < 35000) {
      isReady = await page.evaluate(() => Boolean(window.ClaspoEditorSDK?.getDocument)).catch(() => false);
      if (isReady) break;
      await new Promise((r) => setTimeout(r, 600));
    }
    if (!isReady) {
      throw new CommandExecutionError('ClaspoEditorSDK timed out during initialization. Please verify that the widget variant appearance page loaded successfully.');
    }
  } else {
    // For dashboard, wait for ClaspoDashboardSDK
    const start = Date.now();
    let isReady = false;
    while (Date.now() - start < 15000) {
      isReady = await page.evaluate(() => Boolean(window.ClaspoDashboardSDK?.listWidgets)).catch(() => false);
      if (isReady) break;
      await new Promise((r) => setTimeout(r, 400));
    }
    if (!isReady) {
      throw new CommandExecutionError('ClaspoDashboardSDK timed out. Please verify you are logged in to my.claspo.io.');
    }
  }
}

/**
 * Fetch list of all widgets and format with analytics.
 */
export async function listAllWidgets(page) {
  await ensureClaspoContext(page);

  const raw = await page.evaluate(async () => {
    if (!window.ClaspoDashboardSDK?.listWidgets) {
      throw new Error('ClaspoDashboardSDK is not available on this page.');
    }
    const res = await window.ClaspoDashboardSDK.listWidgets();
    return res;
  });

  if (!raw || !Array.isArray(raw.items)) {
    throw new CommandExecutionError('Failed to retrieve widgets list from Claspo.');
  }

  const analyticsMap = {};
  if (Array.isArray(raw.analytics)) {
    for (const a of raw.analytics) {
      if (a.widgetId) analyticsMap[a.widgetId] = a;
    }
  }

  return raw.items.map((item) => formatWidgetRow(item, analyticsMap));
}

/**
 * Get detailed widget configuration.
 */
export async function getWidgetDetails(page, widgetId) {
  await ensureClaspoContext(page);

  const detail = await page.evaluate(async (id) => {
    if (!window.ClaspoDashboardSDK?.getWidget) {
      throw new Error('ClaspoDashboardSDK is not available.');
    }
    return await window.ClaspoDashboardSDK.getWidget(id);
  }, widgetId);

  if (!detail || !detail.id) {
    throw new CommandExecutionError(`Widget #${widgetId} was not found.`);
  }

  return detail;
}

/**
 * Fetch appearance document and extract components.
 */
export async function getAppearanceInfo(page, widgetId) {
  // Ensure we are in the appearance editor for this widget
  const targetHash = `/widget/${widgetId}/variant/${widgetId}/appearance`;
  await ensureClaspoContext(page, targetHash);

  const appearanceData = await page.evaluate(async () => {
    if (!window.ClaspoEditorSDK?.getDocument) {
      throw new Error('ClaspoEditorSDK is not available. Please ensure the appearance editor is open.');
    }
    const doc = await window.ClaspoEditorSDK.getDocument();
    const views = await window.ClaspoEditorSDK.getViews();
    return { doc, views };
  });

  const { doc, views } = appearanceData;
  const components = [];

  if (Array.isArray(doc.views)) {
    for (let i = 0; i < doc.views.length; i++) {
      const viewNode = doc.views[i];
      const viewMeta = views.find((v) => v.id === viewNode.id) || { label: viewNode.label || `View ${i}` };
      const viewComponents = extractTextAndActionComponents(viewNode, viewMeta.label);
      components.push(...viewComponents);
    }
  }

  return {
    doc,
    views,
    components,
  };
}

/**
 * Patch appearance text or properties and save.
 */
export async function patchAppearance(page, widgetId, { updates = [], publish = false } = {}) {
  const targetHash = `/widget/${widgetId}/variant/${widgetId}/appearance`;
  await ensureClaspoContext(page, targetHash);

  const result = await page.evaluate(async ({ updates, publish }) => {
    if (!window.ClaspoEditorSDK?.setText) {
      throw new Error('ClaspoEditorSDK is not available.');
    }

    const applied = [];
    for (const update of updates) {
      const { componentId, text } = update;
      await window.ClaspoEditorSDK.setText(componentId, text);
      applied.push({ componentId, text });
    }

    // Trigger save (and optional publish)
    if (window.ClaspoEditor?.save) {
      await window.ClaspoEditor.save({ publishChanges: publish });
    } else if (window.ClaspoEditorSDK?.save) {
      await window.ClaspoEditorSDK.save();
    }

    // Re-read authoritative state to verify
    const newDoc = await window.ClaspoEditorSDK.getDocument();
    return {
      applied,
      saved: true,
      published: publish,
      viewsCount: newDoc.views?.length || 0,
    };
  }, { updates, publish });

  return result;
}

/**
 * Publish or unpublish a widget.
 */
export async function toggleWidgetPublish(page, widgetId, shouldPublish = true) {
  await ensureClaspoContext(page);

  const res = await page.evaluate(async ({ id, shouldPublish }) => {
    if (!window.ClaspoDashboardSDK) {
      throw new Error('ClaspoDashboardSDK is not available.');
    }
    if (shouldPublish) {
      await window.ClaspoDashboardSDK.publishWidget(id);
    } else {
      await window.ClaspoDashboardSDK.unpublishWidget(id);
    }
    const updated = await window.ClaspoDashboardSDK.getWidget(id);
    return {
      id: updated.id,
      name: updated.name,
      status: updated.publishStatus,
    };
  }, { id: widgetId, shouldPublish });

  return res;
}

/**
 * Rename an existing widget.
 */
export async function renameWidget(page, widgetId, newName) {
  await ensureClaspoContext(page);

  const res = await page.evaluate(async ({ id, name }) => {
    if (!window.ClaspoDashboardSDK?.renameWidget) {
      throw new Error('ClaspoDashboardSDK.renameWidget is not available.');
    }
    await window.ClaspoDashboardSDK.renameWidget(id, name);
    const updated = await window.ClaspoDashboardSDK.getWidget(id);
    return {
      id: updated.id,
      name: updated.name,
      status: updated.publishStatus,
    };
  }, { id: widgetId, name: newName });

  return res;
}

/**
 * Duplicate (clone) an existing widget.
 */
export async function duplicateWidget(page, widgetId, newName = null) {
  await ensureClaspoContext(page);

  const res = await page.evaluate(async ({ id, name }) => {
    if (!window.ClaspoDashboardSDK?.copyWidget) {
      throw new Error('ClaspoDashboardSDK.copyWidget is not available.');
    }
    const cloned = await window.ClaspoDashboardSDK.copyWidget(id);
    const newId = cloned.formId || cloned.id;
    if (!newId) {
      throw new Error('Failed to determine cloned widget ID from response.');
    }
    if (name) {
      await window.ClaspoDashboardSDK.renameWidget(newId, name);
    }
    const item = await window.ClaspoDashboardSDK.getWidget(newId);
    return {
      id: item.id,
      name: item.name,
      status: item.publishStatus,
      copiedFrom: id,
    };
  }, { id: widgetId, name: newName });

  return res;
}

/**
 * Delete a widget.
 */
export async function deleteWidget(page, widgetId) {
  await ensureClaspoContext(page);

  const res = await page.evaluate(async (id) => {
    if (!window.ClaspoDashboardSDK?.deleteWidget) {
      throw new Error('ClaspoDashboardSDK.deleteWidget is not available.');
    }
    const existing = await window.ClaspoDashboardSDK.getWidget(id);
    const widgetName = existing?.name || `Widget #${id}`;
    await window.ClaspoDashboardSDK.deleteWidget(id);
    return {
      id,
      name: widgetName,
      deleted: true,
    };
  }, widgetId);

  return res;
}

/**
 * Retrieve targeting and schedule rules for a widget.
 */
export async function getWidgetRules(page, widgetId) {
  await ensureClaspoContext(page);

  const res = await page.evaluate(async (id) => {
    if (!window.ClaspoDashboardSDK?.getWidget) {
      throw new Error('ClaspoDashboardSDK.getWidget is not available.');
    }
    const widget = await window.ClaspoDashboardSDK.getWidget(id);
    if (!widget || !widget.id) {
      throw new Error(`Widget #${id} was not found.`);
    }
    return {
      rules: widget.rules || {},
      tracking: widget.tracking || {},
      widgetId: widget.id,
      widgetName: widget.name,
    };
  }, widgetId);

  return {
    WidgetId: res.widgetId,
    WidgetName: res.widgetName,
    Summary: formatRulesSummary(res.rules, res.tracking),
    RawRules: res.rules,
    RawTracking: res.tracking,
  };
}

/**
 * Retrieve performance analytics metrics for a widget.
 */
export async function getWidgetAnalytics(page, widgetId) {
  await ensureClaspoContext(page);

  const res = await page.evaluate(async (id) => {
    if (!window.ClaspoDashboardSDK?.listWidgets) {
      throw new Error('ClaspoDashboardSDK.listWidgets is not available.');
    }
    const raw = await window.ClaspoDashboardSDK.listWidgets();
    const stat = raw.analytics?.find((a) => String(a.widgetId) === String(id));
    const widget = raw.items?.find((w) => String(w.id) === String(id));
    return {
      stat: stat || { widgetId: id, views: 0, clicks: 0, submits: 0, conversion: 0 },
      widgetName: widget?.name || `Widget #${id}`,
    };
  }, widgetId);

  return {
    ...formatAnalyticsRow(res.stat),
    Name: res.widgetName,
  };
}
