/**
 * Bureau of Economic Analysis (BEA) Provider
 * 
 * Events: GDP, PCE (Personal Consumption Expenditures)
 * Source: https://www.bea.gov/news/schedule
 * 
 * GDP: Quarterly releases (advance, second, third estimates)
 * PCE: Monthly releases
 * 
 * Verification: VERIFIED for 2025 (from official BEA schedule)
 * 2026 dates are ESTIMATED based on historical patterns.
 */

import { EconomicCalendarProvider, EconomicEvent, ProviderSyncResult, EVENT_MARKET_IMPACT, EVENT_BLOCK_WINDOWS, easternToUtc } from '../types';

// VERIFIED GDP release dates for 2025
// Source: https://www.bea.gov/news/schedule
// Last verified: 2025-07-22
const GDP_DATES_2025_VERIFIED = [
  '2025-01-30', '2025-02-27', '2025-03-27', '2025-04-30', '2025-05-29',
  '2025-06-26', '2025-07-30', '2025-08-28', '2025-09-25', '2025-10-30',
  '2025-11-26', '2025-12-23',
];

// ESTIMATED GDP dates for 2026 (pattern-based, not officially published)
const GDP_DATES_2026_ESTIMATED = [
  '2026-01-29', '2026-02-26', '2026-03-26', '2026-04-29', '2026-05-28',
  '2026-06-25', '2026-07-30', '2026-08-27', '2026-09-24', '2026-10-29',
  '2026-11-25', '2026-12-23',
];

// VERIFIED PCE release dates for 2025
const PCE_DATES_2025_VERIFIED = [
  '2025-01-31', '2025-02-28', '2025-03-28', '2025-04-25', '2025-05-30',
  '2025-06-27', '2025-07-31', '2025-08-29', '2025-09-26', '2025-10-31',
  '2025-11-26', '2025-12-24',
];

// ESTIMATED PCE dates for 2026
const PCE_DATES_2026_ESTIMATED = [
  '2026-01-30', '2026-02-27', '2026-03-27', '2026-04-30', '2026-05-29',
  '2026-06-26', '2026-07-31', '2026-08-28', '2026-09-25', '2026-10-30',
  '2026-11-25', '2026-12-23',
];

const SOURCE_URL = 'https://www.bea.gov/news/schedule';

export class BeaProvider implements EconomicCalendarProvider {
  id = 'bea';
  name = 'Bureau of Economic Analysis';

  async fetchEvents(): Promise<ProviderSyncResult> {
    try {
      const now = new Date().toISOString().split('T')[0];
      const events: EconomicEvent[] = [];

      // GDP 2025 — VERIFIED
      GDP_DATES_2025_VERIFIED.filter(d => d >= now).forEach(date => {
        events.push({
          id: `gdp-${date}`,
          name: 'GDP (Gross Domestic Product)',
          eventType: 'GDP',
          startsAtUtc: easternToUtc(date, 8, 30),
          impact: 'high',
          source: this.id,
          sourceUrl: SOURCE_URL,
          affectedMarkets: EVENT_MARKET_IMPACT.GDP,
          blockMinutesBefore: EVENT_BLOCK_WINDOWS.GDP.before,
          blockMinutesAfter: EVENT_BLOCK_WINDOWS.GDP.after,
          verificationStatus: 'VERIFIED',
          verifiedAt: '2025-07-22',
        });
      });

      // GDP 2026 — ESTIMATED
      GDP_DATES_2026_ESTIMATED.filter(d => d >= now).forEach(date => {
        events.push({
          id: `gdp-${date}`,
          name: 'GDP (Estimated)',
          eventType: 'GDP',
          startsAtUtc: easternToUtc(date, 8, 30),
          impact: 'high',
          source: this.id,
          sourceUrl: SOURCE_URL,
          affectedMarkets: EVENT_MARKET_IMPACT.GDP,
          blockMinutesBefore: EVENT_BLOCK_WINDOWS.GDP.before,
          blockMinutesAfter: EVENT_BLOCK_WINDOWS.GDP.after,
          verificationStatus: 'ESTIMATED',
          verifiedAt: undefined,
        });
      });

      // PCE 2025 — VERIFIED
      PCE_DATES_2025_VERIFIED.filter(d => d >= now).forEach(date => {
        events.push({
          id: `pce-${date}`,
          name: 'PCE (Personal Consumption)',
          eventType: 'PCE',
          startsAtUtc: easternToUtc(date, 8, 30),
          impact: 'high',
          source: this.id,
          sourceUrl: SOURCE_URL,
          affectedMarkets: EVENT_MARKET_IMPACT.PCE,
          blockMinutesBefore: EVENT_BLOCK_WINDOWS.PCE.before,
          blockMinutesAfter: EVENT_BLOCK_WINDOWS.PCE.after,
          verificationStatus: 'VERIFIED',
          verifiedAt: '2025-07-22',
        });
      });

      // PCE 2026 — ESTIMATED
      PCE_DATES_2026_ESTIMATED.filter(d => d >= now).forEach(date => {
        events.push({
          id: `pce-${date}`,
          name: 'PCE (Estimated)',
          eventType: 'PCE',
          startsAtUtc: easternToUtc(date, 8, 30),
          impact: 'high',
          source: this.id,
          sourceUrl: SOURCE_URL,
          affectedMarkets: EVENT_MARKET_IMPACT.PCE,
          blockMinutesBefore: EVENT_BLOCK_WINDOWS.PCE.before,
          blockMinutesAfter: EVENT_BLOCK_WINDOWS.PCE.after,
          verificationStatus: 'ESTIMATED',
          verifiedAt: undefined,
        });
      });

      return { success: true, events, source: this.id };
    } catch (error: any) {
      return { success: false, events: [], error: error.message, source: this.id };
    }
  }
}
