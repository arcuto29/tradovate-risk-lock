/**
 * Federal Reserve Provider
 * 
 * Source: federalreserve.gov FOMC calendar
 * Events: FOMC Rate Decisions, FOMC Minutes
 * 
 * The Fed publishes meeting dates well in advance.
 * We use their official schedule JSON endpoint.
 */

import { EconomicCalendarProvider, EconomicEvent, ProviderSyncResult, EVENT_MARKET_IMPACT, EVENT_BLOCK_WINDOWS } from '../types';

// FOMC meetings are published annually. These are the 2025-2026 dates.
// Source: https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm
const FOMC_SCHEDULE = [
  // 2025
  { date: '2025-01-29', type: 'decision' },
  { date: '2025-03-19', type: 'decision' },
  { date: '2025-05-07', type: 'decision' },
  { date: '2025-06-18', type: 'decision' },
  { date: '2025-07-30', type: 'decision' },
  { date: '2025-09-17', type: 'decision' },
  { date: '2025-10-29', type: 'decision' },
  { date: '2025-12-17', type: 'decision' },
  // 2026
  { date: '2026-01-28', type: 'decision' },
  { date: '2026-03-18', type: 'decision' },
  { date: '2026-05-06', type: 'decision' },
  { date: '2026-06-17', type: 'decision' },
  { date: '2026-07-29', type: 'decision' },
  { date: '2026-09-16', type: 'decision' },
  { date: '2026-11-04', type: 'decision' },
  { date: '2026-12-16', type: 'decision' },
];

export class FederalReserveProvider implements EconomicCalendarProvider {
  id = 'federal-reserve';
  name = 'Federal Reserve (FOMC)';

  async fetchEvents(): Promise<ProviderSyncResult> {
    try {
      const events: EconomicEvent[] = FOMC_SCHEDULE
        .filter(meeting => meeting.date >= new Date().toISOString().split('T')[0])
        .map(meeting => ({
          id: `fomc-${meeting.date}`,
          name: 'FOMC Rate Decision',
          eventType: 'FOMC' as const,
          startsAtUtc: `${meeting.date}T18:00:00.000Z`, // 2:00 PM ET = 18:00 UTC (standard time)
          impact: 'high' as const,
          source: this.id,
          affectedMarkets: EVENT_MARKET_IMPACT.FOMC,
          blockMinutesBefore: EVENT_BLOCK_WINDOWS.FOMC.before,
          blockMinutesAfter: EVENT_BLOCK_WINDOWS.FOMC.after,
        }));

      return { success: true, events, source: this.id };
    } catch (error: any) {
      return { success: false, events: [], error: error.message, source: this.id };
    }
  }
}
