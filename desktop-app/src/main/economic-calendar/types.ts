/**
 * Economic Calendar Types
 * 
 * Normalized model for all economic event data regardless of source.
 * All timestamps are absolute UTC to avoid DST bugs.
 */

export interface EconomicEvent {
  id: string;
  name: string;
  eventType: EconomicEventType;
  startsAtUtc: string; // ISO 8601 UTC timestamp
  impact: 'high' | 'medium' | 'low';
  source: string;
  affectedMarkets: string[];
  blockMinutesBefore: number;
  blockMinutesAfter: number;
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
