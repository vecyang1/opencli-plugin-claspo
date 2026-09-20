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
    await page.goto(destination, { waitUntil: 'load' }).catch(() => {});
  } else if (targetPath && !currentUrl.includes(targetPath)) {
    await page.goto(destination, { waitUntil: 'load' }).catch(() => {});
  }

  // If targeting the editor, poll until ClaspoEditorSDK is initialized
  if (targetPath && targetPath.includes('appearance')) {
    const start = Date.now();
    let isReady = false;
    while (Date.now() - start < 45000) {
      isReady = await page.evaluate(() => {
        return Boolean(window.ClaspoEditorSDK?.getDocument && window.ClaspoEditorSDK?.setText);
      }).catch(() => false);
      if (isReady) break;
      await new Promise((r) => setTimeout(r, 1000));
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

  // Apply in-memory SDK updates across views and trigger save/publish
  const interceptResult = await page.evaluate(async ({ updatesList, publish }) => {
    if (!window.ClaspoEditorSDK?.setText || !window.ClaspoEditorSDK?.getDocument) {
      throw new Error('ClaspoEditorSDK is not available.');
    }

    const doc = await window.ClaspoEditorSDK.getDocument();
    const views = await window.ClaspoEditorSDK.getViews();

    function getComponentIds(node) {
      const ids = [];
      if (!node) return ids;
      if (node.id) ids.push(node.id);
      if (Array.isArray(node.children)) {
        for (const child of node.children) {
          ids.push(...getComponentIds(child));
        }
      }
      return ids;
    }

    const viewMap = [];
    if (Array.isArray(doc.views)) {
      for (let i = 0; i < doc.views.length; i++) {
        const vNode = doc.views[i];
        const vMeta = views.find((v) => v.id === vNode.id) || { label: vNode.label || `View ${i}` };
        viewMap.push({
          id: vNode.id,
          label: vMeta.label,
          componentIds: new Set(getComponentIds(vNode)),
        });
      }
    }

    const applied = [];

    // Apply updates per view by switching tabs first
    for (const v of viewMap) {
      const viewUpdates = updatesList.filter((u) => v.componentIds.has(u.componentId));
      if (viewUpdates.length > 0) {
        const tab = Array.from(
          document.querySelectorAll('.widgetsEditor-viewHighlighterOption.e2e-active-view-selector')
        ).find((el) => el.innerText?.trim() === v.label);
        if (tab) {
          tab.click();
          await new Promise((r) => setTimeout(r, 500));
        }

        for (const u of viewUpdates) {
          await window.ClaspoEditorSDK.setText(u.componentId, u.text);
          applied.push(u);
        }
      }
    }

    // Any remaining updates not bound to a view
    const appliedIds = new Set(applied.map((a) => a.componentId));
    for (const u of updatesList) {
      if (!appliedIds.has(u.componentId)) {
        await window.ClaspoEditorSDK.setText(u.componentId, u.text).catch(() => {});
        applied.push(u);
      }
    }

    // Trigger Save dropdown and click specific option
    const saveTrigger = Array.from(document.querySelectorAll('button')).find(
      (b) => b.innerText?.trim() === 'Save' && b.classList.contains('es-btn-primary')
    );
    let optionClicked = false;
    if (saveTrigger) {
      saveTrigger.click();
      await new Promise((r) => setTimeout(r, 500));
      const targetOption = Array.from(document.querySelectorAll('button.saveOptions--button')).find((b) => {
        const t = b.innerText || '';
        return publish ? t.includes('Save and apply') : (t.includes('Save') && !t.includes('apply'));
      });
      if (targetOption) {
        targetOption.click();
        optionClicked = true;
      }
    } else if (window.ClaspoEditor?.save) {
      window.ClaspoEditor.save({ publishChanges: publish });
      optionClicked = true;
    }

    // Wait for save operation to finish (watch for es-btn-loading)
    const waitStart = Date.now();
    let sawLoading = false;
    while (Date.now() - waitStart < 25000) {
      const isLoading = Boolean(document.querySelector('button.es-btn-loading'));
      if (isLoading) sawLoading = true;
      if (sawLoading && !isLoading) {
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    // Grace period for backend consistency
    await new Promise((r) => setTimeout(r, 2500));

    return {
      applied,
      sawLoading,
      optionClicked,
    };
  }, { updatesList: updates, publish });

  console.error('INTERCEPT RESULT:', JSON.stringify(interceptResult, null, 2));

  // Re-read authoritative state to verify
  const newDoc = await page.evaluate(async () => {
    return window.ClaspoEditorSDK?.getDocument ? await window.ClaspoEditorSDK.getDocument() : null;
  });

  return {
    applied: interceptResult.applied,
    saved: true,
    published: publish,
    viewsCount: newDoc?.views?.length || 0,
  };
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
    const rules = widget.config?.config?.rules || widget.config?.rules || widget.rules || {};
    const tracking = widget.config?.config?.tracking || widget.config?.tracking || widget.tracking || {};
    return {
      rules,
      tracking,
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
