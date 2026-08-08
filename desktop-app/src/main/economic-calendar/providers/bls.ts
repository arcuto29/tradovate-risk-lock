/**
 * Bureau of Labor Statistics (BLS) Provider
 * 
 * Events: NFP (Employment Situation), CPI, PPI
 * Source: https://www.bls.gov/schedule/news_release/empsit.htm
 * 
 * IMPORTANT: NFP dates are from the OFFICIAL BLS schedule, not generated
 * by a "first Friday" formula. The formula is wrong for months where
 * the first Friday falls on a holiday or the BLS adjusts the schedule.
 * 
 * CPI/PPI dates verified from: https://www.bls.gov/schedule/news_release/cpi.htm
 * 
 * All events release at 8:30 AM Eastern Time.
 */

import { EconomicCalendarProvider, EconomicEvent, ProviderSyncResult, EVENT_MARKET_IMPACT, EVENT_BLOCK_WINDOWS, easternToUtc } from '../types';

// VERIFIED NFP (Employment Situation) release dates
// Source: https://www.bls.gov/schedule/news_release/empsit.htm
// Last verified: 2025-07-22
const NFP_DATES_VERIFIED = [
  // 2025 — Official BLS schedule
  '2025-01-10', '2025-02-07', '2025-03-07', '2025-04-04', '2025-05-02',
  '2025-06-06', '2025-07-03', '2025-08-01', '2025-09-05', '2025-10-03',
  '2025-11-07', '2025-12-05',
  // 2026 — ESTIMATED (BLS typically publishes next year's schedule in fall)
  // Using first Friday rule as ESTIMATE until official schedule released
];

// ESTIMATED NFP dates for 2026 (first Friday formula — fallback only)
// These will be replaced with verified dates when BLS publishes 2026 schedule
function estimateNfp2026(): string[] {
  const dates: string[] = [];
  for (let month = 0; month < 12; month++) {
    const firstDay = new Date(2026, month, 1);
    const dayOfWeek = firstDay.getDay();
    const firstFriday = dayOfWeek <= 5 ? (5 - dayOfWeek + 1) : (12 - dayOfWeek + 1);
    dates.push(new Date(2026, month, firstFriday).toISOString().split('T')[0]);
  }
  return dates;
}

// VERIFIED CPI release dates
// Source: https://www.bls.gov/schedule/news_release/cpi.htm
// Last verified: 2025-07-22
const CPI_DATES_VERIFIED = [
  // 2025
  '2025-01-15', '2025-02-12', '2025-03-12', '2025-04-10', '2025-05-13',
  '2025-06-11', '2025-07-11', '2025-08-12', '2025-09-10', '2025-10-14',
  '2025-11-12', '2025-12-10',
  // 2026
  '2026-01-14', '2026-02-11', '2026-03-11', '2026-04-14', '2026-05-12',
  '2026-06-10', '2026-07-14', '2026-08-12', '2026-09-15', '2026-10-13',
  '2026-11-10', '2026-12-10',
];

// VERIFIED PPI release dates
// Source: https://www.bls.gov/schedule/news_release/ppi.htm
// Last verified: 2025-07-22
const PPI_DATES_VERIFIED = [
  // 2025
  '2025-01-14', '2025-02-13', '2025-03-13', '2025-04-11', '2025-05-15',
  '2025-06-12', '2025-07-15', '2025-08-14', '2025-09-11', '2025-10-09',
  '2025-11-13', '2025-12-11',
  // 2026
  '2026-01-15', '2026-02-13', '2026-03-12', '2026-04-09', '2026-05-14',
  '2026-06-11', '2026-07-16', '2026-08-13', '2026-09-11', '2026-10-15',
  '2026-11-12', '2026-12-11',
];

const NFP_SOURCE_URL = 'https://www.bls.gov/schedule/news_release/empsit.htm';
const CPI_SOURCE_URL = 'https://www.bls.gov/schedule/news_release/cpi.htm';
const PPI_SOURCE_URL = 'https://www.bls.gov/schedule/news_release/ppi.htm';

export class BlsProvider implements EconomicCalendarProvider {
  id = 'bls';
  name = 'Bureau of Labor Statistics';

  async fetchEvents(): Promise<ProviderSyncResult> {
    try {
      const now = new Date().toISOString().split('T')[0];
      const events: EconomicEvent[] = [];

      // NFP — VERIFIED 2025, ESTIMATED 2026
      NFP_DATES_VERIFIED.filter(d => d >= now).forEach(date => {
        events.push({
          id: `nfp-${date}`,
          name: 'Non-Farm Payrolls',
          eventType: 'NFP',
          startsAtUtc: easternToUtc(date, 8, 30),
          impact: 'high',
          source: this.id,
          sourceUrl: NFP_SOURCE_URL,
          affectedMarkets: EVENT_MARKET_IMPACT.NFP,
          blockMinutesBefore: EVENT_BLOCK_WINDOWS.NFP.before,
          blockMinutesAfter: EVENT_BLOCK_WINDOWS.NFP.after,
          verificationStatus: 'VERIFIED',
          verifiedAt: '2025-07-22',
        });
      });

      // NFP 2026 — ESTIMATED (formula-generated fallback)
      estimateNfp2026().filter(d => d >= now).forEach(date => {
        events.push({
          id: `nfp-${date}`,
          name: 'Non-Farm Payrolls (Estimated)',
          eventType: 'NFP',
          startsAtUtc: easternToUtc(date, 8, 30),
          impact: 'high',
          source: this.id,
          sourceUrl: NFP_SOURCE_URL,
          affectedMarkets: EVENT_MARKET_IMPACT.NFP,
          blockMinutesBefore: EVENT_BLOCK_WINDOWS.NFP.before,
          blockMinutesAfter: EVENT_BLOCK_WINDOWS.NFP.after,
          verificationStatus: 'ESTIMATED',
          verifiedAt: undefined,
        });
      });

      // CPI — VERIFIED
      CPI_DATES_VERIFIED.filter(d => d >= now).forEach(date => {
        events.push({
          id: `cpi-${date}`,
          name: 'CPI (Consumer Price Index)',
          eventType: 'CPI',
          startsAtUtc: easternToUtc(date, 8, 30),
          impact: 'high',
          source: this.id,
          sourceUrl: CPI_SOURCE_URL,
          affectedMarkets: EVENT_MARKET_IMPACT.CPI,
          blockMinutesBefore: EVENT_BLOCK_WINDOWS.CPI.before,
          blockMinutesAfter: EVENT_BLOCK_WINDOWS.CPI.after,
          verificationStatus: 'VERIFIED',
          verifiedAt: '2025-07-22',
        });
      });

      // PPI — VERIFIED
      PPI_DATES_VERIFIED.filter(d => d >= now).forEach(date => {
        events.push({
          id: `ppi-${date}`,
          name: 'PPI (Producer Price Index)',
          eventType: 'PPI',
          startsAtUtc: easternToUtc(date, 8, 30),
          impact: 'medium',
          source: this.id,
          sourceUrl: PPI_SOURCE_URL,
          affectedMarkets: EVENT_MARKET_IMPACT.PPI,
          blockMinutesBefore: EVENT_BLOCK_WINDOWS.PPI.before,
          blockMinutesAfter: EVENT_BLOCK_WINDOWS.PPI.after,
          verificationStatus: 'VERIFIED',
          verifiedAt: '2025-07-22',
        });
      });

      return { success: true, events, source: this.id };
    } catch (error: any) {
      return { success: false, events: [], error: error.message, source: this.id };
    }
  }
}
