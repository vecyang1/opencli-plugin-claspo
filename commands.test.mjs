import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeWidgetId,
  formatWidgetRow,
  extractTextAndActionComponents,
  formatRulesSummary,
  formatAnalyticsRow,
} from './_schema.js';
import { deleteCommand } from './delete.js';
import { renameCommand } from './rename.js';
import { duplicateCommand } from './duplicate.js';
import { rulesCommand } from './rules.js';
import { analyticsCommand } from './analytics.js';
import { diagnoseCommand, diagnoseUrlClaspo } from './diagnose.js';


describe('claspo _schema unit tests', () => {
  describe('normalizeWidgetId', () => {
    it('normalizes valid numeric strings and integers', () => {
      assert.equal(normalizeWidgetId(87240), 87240);
      assert.equal(normalizeWidgetId('87240'), 87240);
      assert.equal(normalizeWidgetId('  87240  '), 87240);
    });

    it('rejects non-numeric inputs', () => {
      assert.throws(() => normalizeWidgetId('abc'), /numeric integer/);
      assert.throws(() => normalizeWidgetId('87240a'), /numeric integer/);
      assert.throws(() => normalizeWidgetId('-10'), /numeric integer/);
    });

    it('handles empty and optional values correctly', () => {
      assert.throws(() => normalizeWidgetId(''), /required/);
      assert.throws(() => normalizeWidgetId(null), /required/);
      assert.equal(normalizeWidgetId('', { required: false }), undefined);
      assert.equal(normalizeWidgetId(undefined, { required: false }), undefined);
    });
  });

  describe('formatWidgetRow', () => {
    it('formats a raw widget item into clean table columns', () => {
      const mockItem = {
        id: 87240,
        name: 'Welcome Offer',
        publishStatus: 'FOR_ALL',
        config: { type: 'DETACHED' },
        updatedDate: '2026-09-20T03:23:33.684Z',
      };
      const mockAnalytics = {
        87240: {
          views: 120,
          submits: 15,
          conversion: 12.5,
        },
      };

      const formatted = formatWidgetRow(mockItem, mockAnalytics);
      assert.deepEqual(formatted, {
        WidgetId: 87240,
        Name: 'Welcome Offer',
        Status: 'FOR_ALL',
        Type: 'DETACHED',
        Views: 120,
        Submissions: 15,
        Conversion: '12.5%',
        LastUpdate: '2026-09-20',
      });
    });

    it('falls back safely when analytics or dates are missing', () => {
      const mockItem = { id: 999 };
      const formatted = formatWidgetRow(mockItem, {});
      assert.equal(formatted.WidgetId, 999);
      assert.equal(formatted.Name, 'Untitled');
      assert.equal(formatted.Status, 'DEBUG');
      assert.equal(formatted.Views, 0);
      assert.equal(formatted.Conversion, '0.0%');
      assert.equal(formatted.LastUpdate, 'N/A');
    });
  });

  describe('extractTextAndActionComponents', () => {
    it('recursively extracts texts, buttons, timers, and inputs from document tree', () => {
      const mockNode = {
        id: 'view-1',
        type: 'VIEW',
        children: [
          {
            id: 'text-1',
            type: 'TEXT',
            props: { content: { text: '10% OFF' } },
          },
          {
            id: 'col-1',
            type: 'COLUMN',
            children: [
              {
                id: 'btn-1',
                type: 'BUTTON',
                props: { content: { text: 'Claim' } },
              },
              {
                id: 'input-1',
                type: 'INPUT',
                props: { content: { placeholder: 'Your email' }, control: { name: 'email' } },
              },
            ],
          },
        ],
      };

      const extracted = extractTextAndActionComponents(mockNode, 'Signup');
      assert.equal(extracted.length, 3);
      assert.equal(extracted[0].ComponentId, 'text-1');
      assert.equal(extracted[0].Content, '10% OFF');
      assert.equal(extracted[1].ComponentId, 'btn-1');
      assert.equal(extracted[1].Content, 'Claim');
      assert.equal(extracted[2].ComponentId, 'input-1');
      assert.equal(extracted[2].Field, 'email');
    });
  });

  describe('formatRulesSummary', () => {
    it('summarizes frequency, schedule, and targeting rules correctly', () => {
      const mockRules = {
        FREQUENCY: { predicates: [{ name: 'EVERY_TIME' }] },
        SCHEDULE: { predicates: [{ params: { lengthFromTheStart: '15m', showAgainMode: 'AFTER_CLOSE' } }] },
        TARGETING: {
          schema: {
            include: {
              groups: [
                {
                  conditions: [
                    { operand: { name: 'CURRENT_URL' }, operator: 'CONTAINS', value: '/checkout' },
                  ],
                },
              ],
            },
          },
        },
      };
      const mockTracking = {
        trackers: [{ name: 'GA4' }, { name: 'MetaPixel' }],
      };

      const summary = formatRulesSummary(mockRules, mockTracking);
      assert.equal(summary.Frequency, 'EVERY_TIME');
      assert.equal(summary.TimerDuration, '15m');
      assert.equal(summary.ShowAgainMode, 'AFTER_CLOSE');
      assert.equal(summary.TargetingConditions.length, 1);
      assert.equal(summary.TargetingConditions[0].target, 'CURRENT_URL');
      assert.equal(summary.Trackers, 'GA4, MetaPixel');
    });

    it('falls back gracefully when rules are empty', () => {
      const summary = formatRulesSummary({}, {});
      assert.equal(summary.Frequency, 'DISABLED');
      assert.equal(summary.TimerDuration, 'NONE');
      assert.equal(summary.ShowAgainMode, 'N/A');
      assert.equal(summary.TargetingConditions.length, 0);
      assert.equal(summary.Trackers, 'None');
    });
  });

  describe('formatAnalyticsRow', () => {
    it('formats analytics numbers and conversion rate', () => {
      const row = formatAnalyticsRow({
        widgetId: 87240,
        views: 250,
        clicks: 50,
        submits: 25,
        targetActions: 30,
        conversion: 10.0,
      });
      assert.equal(row.WidgetId, 87240);
      assert.equal(row.Views, 250);
      assert.equal(row.Clicks, 50);
      assert.equal(row.Submissions, 25);
      assert.equal(row.TargetActions, 30);
      assert.equal(row.Conversion, '10.00%');
    });
  });

  describe('OpenCLI Command Definitions & Safety Guards', () => {
    it('verifies deleteCommand aborts without --yes flag', async () => {
      assert.equal(deleteCommand.name, 'delete');
      await assert.rejects(
        async () => {
          await deleteCommand.func(null, { 'widget-id': '87240', yes: false });
        },
        /--yes flag is required to delete/
      );
    });

    it('verifies renameCommand requires widget-id and name', async () => {
      assert.equal(renameCommand.name, 'rename');
      await assert.rejects(
        async () => {
          await renameCommand.func(null, { 'widget-id': '87240', name: '  ' });
        },
        /Widget name cannot be empty/
      );
    });

    it('verifies duplicateCommand, rulesCommand, and analyticsCommand metadata', () => {
      assert.equal(duplicateCommand.name, 'duplicate');
      assert.equal(duplicateCommand.site, 'claspo');
      assert.equal(rulesCommand.name, 'rules');
      assert.equal(rulesCommand.site, 'claspo');
      assert.equal(analyticsCommand.name, 'analytics');
      assert.equal(analyticsCommand.site, 'claspo');
    });

    it('verifies diagnoseCommand metadata and argument validation', async () => {
      assert.equal(diagnoseCommand.name, 'diagnose');
      assert.equal(diagnoseCommand.site, 'claspo');
      assert.equal(diagnoseCommand.strategy, 'local');
      assert.equal(diagnoseCommand.browser, false);
      assert.deepEqual(diagnoseCommand.columns, [
        'Scope',
        'Url',
        'ClaspoScript',
        'ClaspoWidgetDom',
        'ActiveModals',
        'FloatingTeasers',
        'Countdowns',
        'GuardActive',
        'Status',
      ]);

      await assert.rejects(
        async () => {
          await diagnoseUrlClaspo('ftp://invalid-url');
        },
        /valid http:\/\/ or https:\/\/ target URL is required/
      );

      await assert.rejects(
        async () => {
          await diagnoseUrlClaspo('');
        },
        /valid http:\/\/ or https:\/\/ target URL is required/
      );
    });
  });
});


