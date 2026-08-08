/**
 * Bureau of Labor Statistics (BLS) Provider
 * 
 * Events: NFP, CPI, PPI, JOLTS
 * 
 * BLS publishes release schedules annually.
 * NFP: First Friday of each month at 8:30 AM ET
 * CPI: Usually mid-month at 8:30 AM ET
 * PPI: Usually 1-2 days after CPI at 8:30 AM ET
 * 
 * Source: https://www.bls.gov/schedule/news_release/
 */

import { EconomicCalendarProvider, EconomicEvent, ProviderSyncResult, EVENT_MARKET_IMPACT, EVENT_BLOCK_WINDOWS } from '../types';

// Generate NFP dates: First Friday of each month
function generateNfpDates(year: number): string[] {
  const dates: string[] = [];
  for (let month = 0; month < 12; month++) {
    const firstDay = new Date(year, month, 1);
    const dayOfWeek = firstDay.getDay(); // 0=Sun, 5=Fri
    const firstFriday = dayOfWeek <= 5 ? (5 - dayOfWeek + 1) : (12 - dayOfWeek + 1);
    const date = new Date(year, month, firstFriday);
    dates.push(date.toISOString().split('T')[0]);
  }
  return dates;
}

// CPI release dates for 2025-2026 (from BLS schedule)
const CPI_DATES = [
  // 2025
  '2025-01-15', '2025-02-12', '2025-03-12', '2025-04-10', '2025-05-13',
  '2025-06-11', '2025-07-11', '2025-08-12', '2025-09-10', '2025-10-14',
  '2025-11-12', '2025-12-10',
  // 2026
  '2026-01-14', '2026-02-11', '2026-03-11', '2026-04-14', '2026-05-12',
  '2026-06-10', '2026-07-14', '2026-08-12', '2026-09-15', '2026-10-13',
  '2026-11-10', '2026-12-10',
];

// PPI release dates (typically 1 day after CPI)
const PPI_DATES = [
  // 2025
  '2025-01-14', '2025-02-13', '2025-03-13', '2025-04-11', '2025-05-15',
  '2025-06-12', '2025-07-15', '2025-08-14', '2025-09-11', '2025-10-09',
  '2025-11-13', '2025-12-11',
  // 2026
  '2026-01-15', '2026-02-13', '2026-03-12', '2026-04-09', '2026-05-14',
  '2026-06-11', '2026-07-16', '2026-08-13', '2026-09-11', '2026-10-15',
  '2026-11-12', '2026-12-11',
];

export class BlsProvider implements EconomicCalendarProvider {
  id = 'bls';
  name = 'Bureau of Labor Statistics';

  async fetchEvents(): Promise<ProviderSyncResult> {
    try {
      const now = new Date().toISOString().split('T')[0];
      const events: EconomicEvent[] = [];

      // NFP — 8:30 AM ET = 12:30 UTC (standard) or 12:30 UTC (DST aware handled by absolute time)
      const nfpDates = [...generateNfpDates(2025), ...generateNfpDates(2026)];
      nfpDates.filter(d => d >= now).forEach(date => {
        events.push({
          id: `nfp-${date}`,
          name: 'Non-Farm Payrolls',
          eventType: 'NFP',
          startsAtUtc: `${date}T12:30:00.000Z`, // 8:30 AM ET (EST, approximate — DST shifts this by 1hr)
          impact: 'high',
          source: this.id,
          affectedMarkets: EVENT_MARKET_IMPACT.NFP,
          blockMinutesBefore: EVENT_BLOCK_WINDOWS.NFP.before,
          blockMinutesAfter: EVENT_BLOCK_WINDOWS.NFP.after,
        });
      });

      // CPI
      CPI_DATES.filter(d => d >= now).forEach(date => {
        events.push({
          id: `cpi-${date}`,
          name: 'CPI (Consumer Price Index)',
          eventType: 'CPI',
          startsAtUtc: `${date}T12:30:00.000Z`,
          impact: 'high',
          source: this.id,
          affectedMarkets: EVENT_MARKET_IMPACT.CPI,
          blockMinutesBefore: EVENT_BLOCK_WINDOWS.CPI.before,
          blockMinutesAfter: EVENT_BLOCK_WINDOWS.CPI.after,
        });
      });

      // PPI
      PPI_DATES.filter(d => d >= now).forEach(date => {
        events.push({
          id: `ppi-${date}`,
          name: 'PPI (Producer Price Index)',
          eventType: 'PPI',
          startsAtUtc: `${date}T12:30:00.000Z`,
          impact: 'medium',
          source: this.id,
          affectedMarkets: EVENT_MARKET_IMPACT.PPI,
          blockMinutesBefore: EVENT_BLOCK_WINDOWS.PPI.before,
          blockMinutesAfter: EVENT_BLOCK_WINDOWS.PPI.after,
        });
      });

      return { success: true, events, source: this.id };
    } catch (error: any) {
      return { success: false, events: [], error: error.message, source: this.id };
    }
  }
}
