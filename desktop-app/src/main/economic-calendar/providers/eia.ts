/**
 * Energy Information Administration (EIA) Provider
 * 
 * Events: Weekly Petroleum Status Report (Crude Oil Inventories)
 * Source: https://www.eia.gov/petroleum/supply/weekly/
 * 
 * Verification: ESTIMATED
 * EIA reports are typically released Wednesday at 10:30 AM ET,
 * but move to Thursday when Monday is a holiday.
 * We mark these as ESTIMATED because the exact schedule changes.
 * 
 * ESTIMATED events generate warnings but do NOT automatically block
 * unless the user has opted into blocking estimated events.
 */

import { EconomicCalendarProvider, EconomicEvent, ProviderSyncResult, EVENT_MARKET_IMPACT, EVENT_BLOCK_WINDOWS, easternToUtc } from '../types';

// Generate Wednesday dates for the next 3 months (shorter window since estimated)
function generateWednesdays(months: number = 3): string[] {
  const dates: string[] = [];
  const start = new Date();
  const end = new Date();
  end.setMonth(end.getMonth() + months);

  const current = new Date(start);
  while (current.getDay() !== 3) current.setDate(current.getDate() + 1);

  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 7);
  }
  return dates;
}

export class EiaProvider implements EconomicCalendarProvider {
  id = 'eia';
  name = 'Energy Information Administration';

  async fetchEvents(): Promise<ProviderSyncResult> {
    try {
      const events: EconomicEvent[] = generateWednesdays(3).map(date => ({
        id: `eia-oil-${date}`,
        name: 'EIA Crude Oil Inventories (Est.)',
        eventType: 'EIA_OIL' as const,
        startsAtUtc: easternToUtc(date, 10, 30),
        impact: 'medium' as const,
        source: this.id,
        sourceUrl: 'https://www.eia.gov/petroleum/supply/weekly/',
        affectedMarkets: EVENT_MARKET_IMPACT.EIA_OIL,
        blockMinutesBefore: EVENT_BLOCK_WINDOWS.EIA_OIL.before,
        blockMinutesAfter: EVENT_BLOCK_WINDOWS.EIA_OIL.after,
        verificationStatus: 'ESTIMATED' as const,
        verifiedAt: undefined,
      }));

      return { success: true, events, source: this.id };
    } catch (error: any) {
      return { success: false, events: [], error: error.message, source: this.id };
    }
  }
}
