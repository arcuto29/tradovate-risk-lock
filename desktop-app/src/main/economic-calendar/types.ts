/**
 * Economic Calendar Types
 * 
 * Normalized model for all economic event data regardless of source.
 * All timestamps are absolute UTC to avoid DST bugs.
 * 
 * CRITICAL SAFETY RULE:
 * ESTIMATED events must NEVER silently become authoritative blocking events.
 * Only VERIFIED events should trigger automatic order blocking.
 */

export type VerificationStatus =
  | 'VERIFIED'         // Confirmed from official source with specific date
  | 'CACHED_VERIFIED'  // Was verified, source temporarily unavailable
  | 'ESTIMATED'        // Generated from formula/pattern, not officially confirmed
  | 'STALE';           // Last verification too old, may be inaccurate

export interface EconomicEvent {
  id: string;
  name: string;
  eventType: EconomicEventType;
  startsAtUtc: string; // ISO 8601 UTC timestamp
  impact: 'high' | 'medium' | 'low';
  source: string;
  sourceUrl?: string;  // Official source URL for audit trail
  affectedMarkets: string[];
  blockMinutesBefore: number;
  blockMinutesAfter: number;
  verificationStatus: VerificationStatus;
  verifiedAt?: string; // ISO timestamp when last verified
}

export type EconomicEventType =
  | 'NFP'        // Non-Farm Payrolls (BLS)
  | 'CPI'        // Consumer Price Index (BLS)
  | 'PPI'        // Producer Price Index (BLS)
  | 'FOMC'       // Federal Reserve Rate Decision
  | 'FOMC_MINS'  // FOMC Minutes
  | 'GDP'        // Gross Domestic Product (BEA)
  | 'PCE'        // Personal Consumption Expenditures (BEA)
  | 'RETAIL'     // Retail Sales (Census)
  | 'JOLTS'      // Job Openings (BLS)
  | 'EIA_OIL'    // Crude Oil Inventories (EIA)
  | 'JOBLESS'    // Weekly Jobless Claims (DOL)
  | 'ISM'        // ISM Manufacturing/Services
  | 'OTHER';     // Other high-impact events

export interface ProviderSyncResult {
  success: boolean;
  events: EconomicEvent[];
  error?: string;
  source: string;
}

/**
 * Interface that all economic data providers must implement.
 * Modular: can swap or add sources without changing the sync service or UI.
 */
export interface EconomicCalendarProvider {
  /** Unique provider ID */
  id: string;
  /** Human-readable name */
  name: string;
  /** Fetch events from this source */
  fetchEvents(): Promise<ProviderSyncResult>;
}

/** Market impact ratings for each event type */
export const EVENT_MARKET_IMPACT: Record<EconomicEventType, string[]> = {
  NFP: ['NQ', 'ES', 'MNQ', 'MES', 'YM', 'RTY', 'ZN', 'ZB', 'GC'],
  CPI: ['NQ', 'ES', 'MNQ', 'MES', 'YM', 'RTY', 'ZN', 'ZB', 'GC'],
  PPI: ['NQ', 'ES', 'ZN', 'ZB', 'GC'],
  FOMC: ['NQ', 'ES', 'MNQ', 'MES', 'YM', 'RTY', 'ZN', 'ZB', 'GC', 'CL'],
  FOMC_MINS: ['NQ', 'ES', 'ZN', 'ZB'],
  GDP: ['NQ', 'ES', 'MNQ', 'MES', 'YM', 'RTY'],
  PCE: ['NQ', 'ES', 'ZN', 'ZB', 'GC'],
  RETAIL: ['NQ', 'ES', 'MNQ', 'MES', 'YM', 'RTY'],
  JOLTS: ['NQ', 'ES', 'ZN'],
  EIA_OIL: ['CL', 'MCL', 'NG'],
  JOBLESS: ['NQ', 'ES', 'ZN'],
  ISM: ['NQ', 'ES', 'YM', 'RTY'],
  OTHER: ['NQ', 'ES'],
};

/** Default block windows per event type (minutes before/after) */
export const EVENT_BLOCK_WINDOWS: Record<EconomicEventType, { before: number; after: number }> = {
  NFP: { before: 30, after: 15 },
  CPI: { before: 30, after: 15 },
  PPI: { before: 15, after: 10 },
  FOMC: { before: 60, after: 30 },
  FOMC_MINS: { before: 15, after: 10 },
  GDP: { before: 15, after: 10 },
  PCE: { before: 15, after: 10 },
  RETAIL: { before: 15, after: 10 },
  JOLTS: { before: 10, after: 5 },
  EIA_OIL: { before: 10, after: 5 },
  JOBLESS: { before: 10, after: 5 },
  ISM: { before: 15, after: 10 },
  OTHER: { before: 15, after: 10 },
};

/**
 * Convert a date + time in US Eastern to UTC.
 * Handles DST correctly: EDT (March-Nov) vs EST (Nov-March).
 * 
 * 8:30 AM ET:
 *   - During EDT: 12:30 UTC
 *   - During EST: 13:30 UTC
 * 
 * 2:00 PM ET:
 *   - During EDT: 18:00 UTC
 *   - During EST: 19:00 UTC
 */
export function easternToUtc(dateStr: string, hours: number, minutes: number): string {
  // Create a date in the target timezone by constructing it
  const date = new Date(`${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
  
  // Determine if this date falls in EDT or EST
  // EDT: Second Sunday of March to First Sunday of November
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed
  
  // March: Second Sunday
  const marchFirst = new Date(year, 2, 1);
  const marchSecondSunday = 14 - marchFirst.getDay(); // day of month for second Sunday
  const edtStart = new Date(year, 2, marchSecondSunday, 2, 0, 0);
  
  // November: First Sunday
  const novFirst = new Date(year, 10, 1);
  const novFirstSunday = novFirst.getDay() === 0 ? 1 : 8 - novFirst.getDay();
  const edtEnd = new Date(year, 10, novFirstSunday, 2, 0, 0);
  
  const isEdt = date >= edtStart && date < edtEnd;
  const utcOffset = isEdt ? 4 : 5; // EDT = UTC-4, EST = UTC-5
  
  const utcHours = hours + utcOffset;
  const utcDate = new Date(Date.UTC(
    parseInt(dateStr.split('-')[0]),
    parseInt(dateStr.split('-')[1]) - 1,
    parseInt(dateStr.split('-')[2]),
    utcHours,
    minutes,
    0
  ));
  
  return utcDate.toISOString();
}

/**
 * Determine if an event should trigger blocking.
 * Only VERIFIED and CACHED_VERIFIED events can block.
 * ESTIMATED events generate warnings but do NOT automatically block.
 */
export function canEventBlock(event: EconomicEvent): boolean {
  return event.verificationStatus === 'VERIFIED' || event.verificationStatus === 'CACHED_VERIFIED';
}
