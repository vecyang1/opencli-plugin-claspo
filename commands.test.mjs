import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeWidgetId,
  formatWidgetRow,
  extractTextAndActionComponents,
} from './_schema.js';

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
});
