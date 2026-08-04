/**
 * Extension Order Classification Tests
 * 
 * Tests the classifyOrder logic extracted from session-blocker-main.js.
 * Verifies: exits never blocked, oversized orders caught, correct action mapping.
 */

import { describe, it, expect } from 'vitest';

// Extracted classification logic (same as session-blocker-main.js)
function classifyAction(url: string, body: any): string {
  const lower = (url || '').toLowerCase();

  // URL-based classification
  const CLOSE_URLS = ['/order/close', '/order/flatten', '/closeposition', '/flattenall', '/Order/close'];
  const CANCEL_URLS = ['/Order/cancel', '/order/cancel', '/Order/cancelOrder'];
  const MODIFY_URLS = ['/Order/modify', '/Order/editStopLoss', '/Order/editTakeProfit', '/Order/editStop', '/Order/editTarget'];

  if (CLOSE_URLS.some(p => lower.includes(p.toLowerCase()))) return 'CLOSE_POSITION';
  if (CANCEL_URLS.some(p => lower.includes(p.toLowerCase()))) return 'CANCEL_ORDER';
  if (MODIFY_URLS.some(p => lower.includes(p.toLowerCase()))) return 'MODIFY_PROTECTIVE_ORDER';

  // Body-based classification
  if (body) {
    const action = String(body.action || body.orderAction || body.type || '').toLowerCase();
    if (action === 'close' || action === 'flatten' || action === 'closeposition' || action === 'closeall') return 'CLOSE_POSITION';
    if (action === 'cancel') return 'CANCEL_ORDER';
    if (body.reduceOnly === true || body.isReduceOnly === true) return 'REDUCE_POSITION';
    if (body.isClose === true || body.closePosition === true || body.flatten === true) return 'CLOSE_POSITION';
  }

  return 'OPEN_POSITION';
}

function isOversized(body: any, maxContracts: number): boolean {
  if (!body) return false;
  const qty = Math.abs(body.positionSize || body.qty || body.quantity || body.amount || body.size || 0);
  return qty > maxContracts;
}

function extractSymbol(body: any): string {
  if (!body) return '';
  return String(body.symbolId || body.symbol || body.instrument || '').toUpperCase();
}

describe('Order Classification', () => {
  describe('Exit Safety — Never block exits', () => {
    it('classifies close URL as CLOSE_POSITION', () => {
      expect(classifyAction('https://api.example.com/order/close', null)).toBe('CLOSE_POSITION');
      expect(classifyAction('https://api.example.com/Order/close', null)).toBe('CLOSE_POSITION');
    });

    it('classifies flatten URL as CLOSE_POSITION', () => {
      expect(classifyAction('https://api.example.com/closeposition', null)).toBe('CLOSE_POSITION');
      expect(classifyAction('https://api.example.com/flattenall', null)).toBe('CLOSE_POSITION');
    });

    it('classifies cancel URL as CANCEL_ORDER', () => {
      expect(classifyAction('https://api.example.com/Order/cancel', null)).toBe('CANCEL_ORDER');
    });

    it('classifies modify URL as MODIFY_PROTECTIVE_ORDER', () => {
      expect(classifyAction('https://api.example.com/Order/editStopLoss', null)).toBe('MODIFY_PROTECTIVE_ORDER');
      expect(classifyAction('https://api.example.com/Order/editTakeProfit', null)).toBe('MODIFY_PROTECTIVE_ORDER');
    });

    it('classifies body.action="close" as CLOSE_POSITION', () => {
      expect(classifyAction('/api/Order', { action: 'close' })).toBe('CLOSE_POSITION');
      expect(classifyAction('/api/Order', { action: 'flatten' })).toBe('CLOSE_POSITION');
      expect(classifyAction('/api/Order', { action: 'closeall' })).toBe('CLOSE_POSITION');
    });

    it('classifies body.reduceOnly=true as REDUCE_POSITION', () => {
      expect(classifyAction('/api/Order', { reduceOnly: true, action: 'Buy' })).toBe('REDUCE_POSITION');
    });

    it('classifies body.isClose=true as CLOSE_POSITION', () => {
      expect(classifyAction('/api/Order', { isClose: true })).toBe('CLOSE_POSITION');
    });
  });

  describe('TopstepX — Numeric action codes', () => {
    it('handles numeric action field without crashing', () => {
      // TopstepX sends action: 1 (Buy) or action: 2 (Sell) as numbers
      expect(() => classifyAction('/api/Order', { action: 1, symbol: 'NQU26', qty: 2 })).not.toThrow();
      expect(() => classifyAction('/api/Order', { action: 2, symbol: 'NQU26', qty: 1 })).not.toThrow();
    });

    it('classifies numeric action as OPEN_POSITION (not close)', () => {
      const result = classifyAction('/api/Order', { action: 1, symbol: 'NQU26', qty: 2 });
      expect(result).toBe('OPEN_POSITION');
    });
  });

  describe('Size Checking', () => {
    it('detects oversized order', () => {
      expect(isOversized({ qty: 5 }, 2)).toBe(true);
      expect(isOversized({ quantity: 10 }, 3)).toBe(true);
      expect(isOversized({ positionSize: 4 }, 2)).toBe(true);
    });

    it('allows correctly sized order', () => {
      expect(isOversized({ qty: 2 }, 2)).toBe(false);
      expect(isOversized({ qty: 1 }, 5)).toBe(false);
    });

    it('handles missing body gracefully', () => {
      expect(isOversized(null, 2)).toBe(false);
      expect(isOversized(undefined, 2)).toBe(false);
    });
  });

  describe('Symbol Extraction', () => {
    it('extracts symbol from various field names', () => {
      expect(extractSymbol({ symbol: 'NQU26' })).toBe('NQU26');
      expect(extractSymbol({ symbolId: 'ESZ25' })).toBe('ESZ25');
      expect(extractSymbol({ instrument: 'MNQ' })).toBe('MNQ');
    });

    it('handles numeric symbol field', () => {
      expect(extractSymbol({ symbol: 12345 })).toBe('12345');
    });

    it('returns empty string for missing body', () => {
      expect(extractSymbol(null)).toBe('');
      expect(extractSymbol({})).toBe('');
    });
  });
});
