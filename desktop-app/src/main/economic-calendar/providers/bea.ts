/**
 * Bureau of Economic Analysis (BEA) Provider
 * 
 * Events: GDP, PCE (Personal Consumption Expenditures)
 * Source: https://www.bea.gov/news/schedule
 */

import { EconomicCalendarProvider, EconomicEvent, ProviderSyncResult, EVENT_MARKET_IMPACT, EVENT_BLOCK_WINDOWS } from '../types';

// GDP release dates (advance, second, third estimates — quarterly)
const GDP_DATES = [
  // 2025
  '2025-01-30', '2025-02-27', '2025-03-27', '2025-04-30', '2025-05-29',
  '2025-06-26', '2025-07-30', '2025-08-28', '2025-09-25', '2025-10-30',
  '2025-11-26', '2025-12-23',
  // 2026
  '2026-01-29', '2026-02-26', '2026-03-26', '2026-04-29', '2026-05-28',
  '2026-06-25', '2026-07-30', '2026-08-27', '2026-09-24', '2026-10-29',
  '2026-11-25', '2026-12-23',
];

// PCE release dates (monthly, usually last Friday or Thursday)
const PCE_DATES = [
  // 2025
  '2025-01-31', '2025-02-28', '2025-03-28', '2025-04-25', '2025-05-30',
  '2025-06-27', '2025-07-31', '2025-08-29', '2025-09-26', '2025-10-31',
  '2025-11-26', '2025-12-24',
  // 2026
  '2026-01-30', '2026-02-27', '2026-03-27', '2026-04-30', '2026-05-29',
  '2026-06-26', '2026-07-31', '2026-08-28', '2026-09-25', '2026-10-30',
  '2026-11-25', '2026-12-23',
];

export class BeaProvider implements EconomicCalendarProvider {
  id = 'bea';
  name = 'Bureau of Economic Analysis';

  async fetchEvents(): Promise<ProviderSyncResult> {
    try {
      const now = new Date().toISOString().split('T')[0];
      const events: EconomicEvent[] = [];

      // GDP — 8:30 AM ET
      GDP_DATES.filter(d => d >= now).forEach(date => {
        events.push({
          id: `gdp-${date}`,
          name: 'GDP (Gross Domestic Product)',
          eventType: 'GDP',
          startsAtUtc: `${date}T12:30:00.000Z`,
          impact: 'high',
          source: this.id,
          affectedMarkets: EVENT_MARKET_IMPACT.GDP,
          blockMinutesBefore: EVENT_BLOCK_WINDOWS.GDP.before,
          blockMinutesAfter: EVENT_BLOCK_WINDOWS.GDP.after,
        });
      });

      // PCE — 8:30 AM ET
      PCE_DATES.filter(d => d >= now).forEach(date => {
        events.push({
          id: `pce-${date}`,
          name: 'PCE (Personal Consumption)',
          eventType: 'PCE',
          startsAtUtc: `${date}T12:30:00.000Z`,
          impact: 'high',
          source: this.id,
          affectedMarkets: EVENT_MARKET_IMPACT.PCE,
          blockMinutesBefore: EVENT_BLOCK_WINDOWS.PCE.before,
          blockMinutesAfter: EVENT_BLOCK_WINDOWS.PCE.after,
        });
      });

      return { success: true, events, source: this.id };
    } catch (error: any) {
      return { success: false, events: [], error: error.message, source: this.id };
    }
  }
}
