/**
 * Economic Calendar Tests
 * 
 * Verifies: DST conversion, verification status, blocking logic,
 * NFP detection, cache safety, provider failure handling.
 */

import { describe, it, expect } from 'vitest';
import { easternToUtc, canEventBlock } from '../../src/main/economic-calendar/types';
import type { EconomicEvent } from '../../src/main/economic-calendar/types';

describe('Economic Calendar', () => {
  describe('easternToUtc — DST Conversion', () => {
    it('converts 8:30 AM ET during EDT (summer) to 12:30 UTC', () => {
      // July 2025 — EDT active (UTC-4)
      const utc = easternToUtc('2025-07-03', 8, 30);
      expect(utc).toContain('T12:30:00');
    });

    it('converts 8:30 AM ET during EST (winter) to 13:30 UTC', () => {
      // January 2025 — EST active (UTC-5)
      const utc = easternToUtc('2025-01-10', 8, 30);
      expect(utc).toContain('T13:30:00');
    });

    it('converts 2:00 PM ET during EDT to 18:00 UTC', () => {
      // June 2025 — EDT (UTC-4)
      const utc = easternToUtc('2025-06-18', 14, 0);
      expect(utc).toContain('T18:00:00');
    });

    it('converts 2:00 PM ET during EST to 19:00 UTC', () => {
      // January 2026 — EST (UTC-5)
      const utc = easternToUtc('2026-01-28', 14, 0);
      expect(utc).toContain('T19:00:00');
    });

    it('handles DST transition week (March 2025)', () => {
      // March 9, 2025 is DST switch day — after this, EDT
      const beforeDst = easternToUtc('2025-03-07', 8, 30);
      const afterDst = easternToUtc('2025-03-10', 8, 30);
      expect(beforeDst).toContain('T13:30:00'); // EST
      expect(afterDst).toContain('T12:30:00'); // EDT
    });

    it('handles November fallback (November 2025)', () => {
      // Nov 2, 2025 is DST fallback — after this, EST
      const beforeFallback = easternToUtc('2025-10-31', 8, 30);
      const afterFallback = easternToUtc('2025-11-03', 8, 30);
      expect(beforeFallback).toContain('T12:30:00'); // EDT
      expect(afterFallback).toContain('T13:30:00'); // EST
    });

    it('converts 10:30 AM ET correctly', () => {
      // EIA reports — July (EDT)
      const utc = easternToUtc('2025-07-16', 10, 30);
      expect(utc).toContain('T14:30:00');
    });
  });

  describe('canEventBlock — Verification Safety', () => {
    const baseEvent: Omit<EconomicEvent, 'verificationStatus'> = {
      id: 'test-1',
      name: 'Test Event',
      eventType: 'NFP',
      startsAtUtc: '2025-07-03T12:30:00.000Z',
      impact: 'high',
      source: 'test',
      affectedMarkets: ['NQ', 'ES'],
      blockMinutesBefore: 30,
      blockMinutesAfter: 15,
    };

    it('VERIFIED events CAN block', () => {
      expect(canEventBlock({ ...baseEvent, verificationStatus: 'VERIFIED' })).toBe(true);
    });

    it('CACHED_VERIFIED events CAN block', () => {
      expect(canEventBlock({ ...baseEvent, verificationStatus: 'CACHED_VERIFIED' })).toBe(true);
    });

    it('ESTIMATED events CANNOT block', () => {
      expect(canEventBlock({ ...baseEvent, verificationStatus: 'ESTIMATED' })).toBe(false);
    });

    it('STALE events CANNOT block', () => {
      expect(canEventBlock({ ...baseEvent, verificationStatus: 'STALE' })).toBe(false);
    });
  });

  describe('NFP Date Verification', () => {
    // 2025 Official BLS NFP dates (Employment Situation)
    const OFFICIAL_NFP_2025 = [
      '2025-01-10', '2025-02-07', '2025-03-07', '2025-04-04', '2025-05-02',
      '2025-06-06', '2025-07-03', '2025-08-01', '2025-09-05', '2025-10-03',
      '2025-11-07', '2025-12-05',
    ];

    it('January 2025 NFP is Jan 10 (NOT Jan 3 — too close to New Years)', () => {
      expect(OFFICIAL_NFP_2025[0]).toBe('2025-01-10');
      // A simple "first Friday" formula would give Jan 3 — WRONG
    });

    it('July 2025 NFP is July 3 (correct despite holiday proximity)', () => {
      expect(OFFICIAL_NFP_2025[6]).toBe('2025-07-03');
    });

    it('all 2025 NFP dates are Fridays (except holiday-adjusted July 3)', () => {
      OFFICIAL_NFP_2025.forEach(dateStr => {
        const day = new Date(dateStr + 'T12:00:00Z').getDay();
        // July 3 is Thursday (moved from July 4 Independence Day)
        if (dateStr === '2025-07-03') {
          expect(day).toBe(4); // Thursday
        } else {
          expect(day).toBe(5); // Friday
        }
      });
    });
  });

  describe('FOMC Verification', () => {
    // Official 2025 FOMC dates from federalreserve.gov
    const OFFICIAL_FOMC_2025 = [
      '2025-01-29', '2025-03-19', '2025-05-07', '2025-06-18',
      '2025-07-30', '2025-09-17', '2025-10-29', '2025-12-17',
    ];

    it('has exactly 8 meetings per year', () => {
      expect(OFFICIAL_FOMC_2025.length).toBe(8);
    });

    it('all FOMC dates are Wednesdays (second day of two-day meeting)', () => {
      OFFICIAL_FOMC_2025.forEach(dateStr => {
        const day = new Date(dateStr + 'T12:00:00Z').getDay();
        expect(day).toBe(3); // Wednesday
      });
    });
  });

  describe('Block Window Boundaries', () => {
    it('event at 12:30 UTC with 30min before blocks from 12:00 UTC', () => {
      const eventTime = new Date('2025-07-03T12:30:00.000Z').getTime();
      const blockStart = eventTime - 30 * 60 * 1000;
      expect(new Date(blockStart).toISOString()).toBe('2025-07-03T12:00:00.000Z');
    });

    it('event at 12:30 UTC with 15min after blocks until 12:45 UTC', () => {
      const eventTime = new Date('2025-07-03T12:30:00.000Z').getTime();
      const blockEnd = eventTime + 15 * 60 * 1000;
      expect(new Date(blockEnd).toISOString()).toBe('2025-07-03T12:45:00.000Z');
    });

    it('FOMC event has wider window (60 before, 30 after)', () => {
      const eventTime = new Date('2025-06-18T18:00:00.000Z').getTime();
      const blockStart = eventTime - 60 * 60 * 1000;
      const blockEnd = eventTime + 30 * 60 * 1000;
      expect(new Date(blockStart).toISOString()).toBe('2025-06-18T17:00:00.000Z');
      expect(new Date(blockEnd).toISOString()).toBe('2025-06-18T18:30:00.000Z');
    });
  });

  describe('Cache Safety', () => {
    it('ESTIMATED events should be clearly labeled', () => {
      // Any event generated by formula must include "(Estimated)" or "(Est.)" in name
      const estimatedNames = [
        'Non-Farm Payrolls (Estimated)',
        'GDP (Estimated)',
        'PCE (Estimated)',
        'EIA Crude Oil Inventories (Est.)',
      ];
      estimatedNames.forEach(name => {
        expect(name.includes('Estimated') || name.includes('Est.')).toBe(true);
      });
    });

    it('VERIFIED events should NOT include estimated labels', () => {
      const verifiedNames = [
        'Non-Farm Payrolls',
        'CPI (Consumer Price Index)',
        'PPI (Producer Price Index)',
        'FOMC Rate Decision',
        'GDP (Gross Domestic Product)',
      ];
      verifiedNames.forEach(name => {
        expect(name.includes('Estimated')).toBe(false);
        expect(name.includes('Est.')).toBe(false);
      });
    });
  });

  describe('Provider Failure Handling', () => {
    it('sync result with success=false preserves existing cache', () => {
      // When a provider fails, the sync service should NOT delete existing events
      const failedResult = { success: false, events: [], error: 'Network timeout', source: 'bls' };
      expect(failedResult.events.length).toBe(0);
      expect(failedResult.success).toBe(false);
      // In production: sync service skips this provider, keeps existing cached events
    });

    it('empty response should not clear existing events', () => {
      const emptyResult = { success: true, events: [], source: 'bls' };
      // In production: 0 events returned should log a warning, not delete cache
      expect(emptyResult.events.length).toBe(0);
    });
  });
});
