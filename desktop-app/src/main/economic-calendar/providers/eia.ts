/**
 * Energy Information Administration (EIA) Provider
 * 
 * Events: Crude Oil Inventories (weekly, Wednesdays 10:30 AM ET)
 * Source: https://www.eia.gov/petroleum/supply/weekly/
 */

import { EconomicCalendarProvider, EconomicEvent, ProviderSyncResult, EVENT_MARKET_IMPACT, EVENT_BLOCK_WINDOWS } from '../types';

// Generate Wednesday dates for the next 6 months
function generateWednesdays(months: number = 6): string[] {
  const dates: string[] = [];
  const start = new Date();
  const end = new Date();
  end.setMonth(end.getMonth() + months);

  const current = new Date(start);
  // Find the next Wednesday
  while (current.getDay() !== 3) current.setDate(current.getDate() + 1);

  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 7); // Next Wednesday
  }
  return dates;
}

export class EiaProvider implements EconomicCalendarProvider {
  id = 'eia';
  name = 'Energy Information Administration';

  async fetchEvents(): Promise<ProviderSyncResult> {
    try {
      const events: EconomicEvent[] = generateWednesdays(6).map(date => ({
        id: `eia-oil-${date}`,
        name: 'EIA Crude Oil Inventories',
        eventType: 'EIA_OIL' as const,
        startsAtUtc: `${date}T14:30:00.000Z`, // 10:30 AM ET = 14:30 UTC
        impact: 'medium' as const,
        source: this.id,
        affectedMarkets: EVENT_MARKET_IMPACT.EIA_OIL,
        blockMinutesBefore: EVENT_BLOCK_WINDOWS.EIA_OIL.before,
        blockMinutesAfter: EVENT_BLOCK_WINDOWS.EIA_OIL.after,
      }));

      return { success: true, events, source: this.id };
    } catch (error: any) {
      return { success: false, events: [], error: error.message, source: this.id };
    }
  }
}
