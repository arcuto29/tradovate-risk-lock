/**
 * News Event Information Panels
 * 
 * Lightweight context for each event type.
 * NOT trading education. NOT strategy advice.
 * Only explains: what it is, why it matters, why Sentinel blocked.
 */

export interface MarketImpact {
  symbol: string;
  rating: 1 | 2 | 3 | 4 | 5;
}

export interface NewsEventInfo {
  id: string;
  what: string;
  why: string;
  markets: MarketImpact[];
  sentinelReason: string;
}

const SENTINEL_DEFAULT_REASON = 'Sentinel is preventing NEW risk during this news window because rapid volatility increases the likelihood of emotional decision-making.';

export const NEWS_EVENT_INFO: Record<string, NewsEventInfo> = {
  fomc: {
    id: 'fomc',
    what: 'The Federal Reserve announces interest rate decisions and monetary policy guidance.',
    why: 'These announcements often create large, sudden volatility spikes across index futures and bonds.',
    markets: [
      { symbol: 'NQ', rating: 5 },
      { symbol: 'ES', rating: 5 },
      { symbol: 'MNQ', rating: 5 },
      { symbol: 'MES', rating: 5 },
      { symbol: 'YM', rating: 4 },
      { symbol: 'RTY', rating: 4 },
      { symbol: 'ZN', rating: 5 },
      { symbol: 'ZB', rating: 5 },
      { symbol: 'GC', rating: 3 },
      { symbol: 'SI', rating: 2 },
      { symbol: 'CL', rating: 2 },
      { symbol: 'MCL', rating: 2 },
    ],
    sentinelReason: SENTINEL_DEFAULT_REASON,
  },

  nfp: {
    id: 'nfp',
    what: 'The Bureau of Labor Statistics releases monthly employment data including jobs added, unemployment rate, and wage growth.',
    why: 'NFP frequently causes sharp price movement in the first minutes after release, especially in index and bond futures.',
    markets: [
      { symbol: 'NQ', rating: 5 },
      { symbol: 'ES', rating: 5 },
      { symbol: 'MNQ', rating: 5 },
      { symbol: 'MES', rating: 5 },
      { symbol: 'YM', rating: 4 },
      { symbol: 'RTY', rating: 4 },
      { symbol: 'ZN', rating: 4 },
      { symbol: 'ZB', rating: 4 },
      { symbol: 'GC', rating: 3 },
      { symbol: 'SI', rating: 2 },
      { symbol: 'CL', rating: 3 },
      { symbol: 'MCL', rating: 3 },
    ],
    sentinelReason: SENTINEL_DEFAULT_REASON,
  },

  cpi: {
    id: 'cpi',
    what: 'The Consumer Price Index measures inflation by tracking price changes across goods and services.',
    why: 'CPI surprises can trigger fast repricing of rate expectations, causing large moves in equity and bond futures.',
    markets: [
      { symbol: 'NQ', rating: 5 },
      { symbol: 'ES', rating: 5 },
      { symbol: 'MNQ', rating: 5 },
      { symbol: 'MES', rating: 5 },
      { symbol: 'YM', rating: 4 },
      { symbol: 'RTY', rating: 4 },
      { symbol: 'ZN', rating: 5 },
      { symbol: 'ZB', rating: 5 },
      { symbol: 'GC', rating: 4 },
      { symbol: 'SI', rating: 3 },
      { symbol: 'CL', rating: 2 },
      { symbol: 'MCL', rating: 2 },
    ],
    sentinelReason: SENTINEL_DEFAULT_REASON,
  },

  ppi: {
    id: 'ppi',
    what: 'The Producer Price Index measures wholesale price changes before they reach consumers.',
    why: 'PPI is a leading indicator of inflation trends and can cause moderate movement in index and bond futures.',
    markets: [
      { symbol: 'NQ', rating: 3 },
      { symbol: 'ES', rating: 3 },
      { symbol: 'MNQ', rating: 3 },
      { symbol: 'MES', rating: 3 },
      { symbol: 'YM', rating: 3 },
      { symbol: 'RTY', rating: 2 },
      { symbol: 'ZN', rating: 4 },
      { symbol: 'ZB', rating: 4 },
      { symbol: 'GC', rating: 3 },
      { symbol: 'SI', rating: 2 },
      { symbol: 'CL', rating: 2 },
      { symbol: 'MCL', rating: 2 },
    ],
    sentinelReason: SENTINEL_DEFAULT_REASON,
  },

  gdp: {
    id: 'gdp',
    what: 'Gross Domestic Product measures the total economic output of the United States.',
    why: 'GDP surprises can shift market sentiment across all asset classes, especially index futures.',
    markets: [
      { symbol: 'NQ', rating: 4 },
      { symbol: 'ES', rating: 4 },
      { symbol: 'MNQ', rating: 4 },
      { symbol: 'MES', rating: 4 },
      { symbol: 'YM', rating: 3 },
      { symbol: 'RTY', rating: 3 },
      { symbol: 'ZN', rating: 3 },
      { symbol: 'ZB', rating: 3 },
      { symbol: 'GC', rating: 2 },
      { symbol: 'SI', rating: 2 },
      { symbol: 'CL', rating: 2 },
      { symbol: 'MCL', rating: 2 },
    ],
    sentinelReason: SENTINEL_DEFAULT_REASON,
  },

  jobless: {
    id: 'jobless',
    what: 'Weekly Initial Jobless Claims tracks the number of new unemployment filings.',
    why: 'Unexpected spikes or drops can cause short-term volatility, particularly in index futures.',
    markets: [
      { symbol: 'NQ', rating: 2 },
      { symbol: 'ES', rating: 2 },
      { symbol: 'MNQ', rating: 2 },
      { symbol: 'MES', rating: 2 },
      { symbol: 'YM', rating: 2 },
      { symbol: 'RTY', rating: 2 },
      { symbol: 'ZN', rating: 3 },
      { symbol: 'ZB', rating: 3 },
      { symbol: 'GC', rating: 1 },
      { symbol: 'SI', rating: 1 },
      { symbol: 'CL', rating: 1 },
      { symbol: 'MCL', rating: 1 },
    ],
    sentinelReason: SENTINEL_DEFAULT_REASON,
  },

  ism: {
    id: 'ism',
    what: 'The ISM Manufacturing and Services Index measures business activity and economic health.',
    why: 'ISM readings above or below 50 can shift sentiment quickly in equity futures.',
    markets: [
      { symbol: 'NQ', rating: 3 },
      { symbol: 'ES', rating: 3 },
      { symbol: 'MNQ', rating: 3 },
      { symbol: 'MES', rating: 3 },
      { symbol: 'YM', rating: 3 },
      { symbol: 'RTY', rating: 3 },
      { symbol: 'ZN', rating: 2 },
      { symbol: 'ZB', rating: 2 },
      { symbol: 'GC', rating: 2 },
      { symbol: 'SI', rating: 1 },
      { symbol: 'CL', rating: 2 },
      { symbol: 'MCL', rating: 2 },
    ],
    sentinelReason: SENTINEL_DEFAULT_REASON,
  },

  retail: {
    id: 'retail',
    what: 'Retail Sales measures monthly consumer spending across major retail categories.',
    why: 'Consumer spending drives the majority of US GDP, so surprises can move equity futures.',
    markets: [
      { symbol: 'NQ', rating: 3 },
      { symbol: 'ES', rating: 3 },
      { symbol: 'MNQ', rating: 3 },
      { symbol: 'MES', rating: 3 },
      { symbol: 'YM', rating: 3 },
      { symbol: 'RTY', rating: 3 },
      { symbol: 'ZN', rating: 2 },
      { symbol: 'ZB', rating: 2 },
      { symbol: 'GC', rating: 1 },
      { symbol: 'SI', rating: 1 },
      { symbol: 'CL', rating: 1 },
      { symbol: 'MCL', rating: 1 },
    ],
    sentinelReason: SENTINEL_DEFAULT_REASON,
  },

  custom: {
    id: 'custom',
    what: 'A custom event you added to your calendar.',
    why: 'You determined this event could cause unpredictable market conditions.',
    markets: [],
    sentinelReason: 'You configured Sentinel to block new entries around this event. Existing positions can still be reduced or closed.',
  },
};

/**
 * Match an event name to its info panel data.
 * Uses substring matching since event names vary slightly.
 */
export function getEventInfo(eventName: string): NewsEventInfo {
  const name = eventName.toLowerCase();
  if (name.includes('fomc') || name.includes('rate decision') || name.includes('federal reserve')) return NEWS_EVENT_INFO.fomc;
  if (name.includes('non-farm') || name.includes('nonfarm') || name.includes('payroll') || name.includes('nfp')) return NEWS_EVENT_INFO.nfp;
  if (name.includes('cpi') || name.includes('consumer price') || name.includes('inflation')) return NEWS_EVENT_INFO.cpi;
  if (name.includes('ppi') || name.includes('producer price')) return NEWS_EVENT_INFO.ppi;
  if (name.includes('gdp') || name.includes('gross domestic')) return NEWS_EVENT_INFO.gdp;
  if (name.includes('jobless') || name.includes('unemployment claim')) return NEWS_EVENT_INFO.jobless;
  if (name.includes('ism') || name.includes('manufacturing index') || name.includes('services index')) return NEWS_EVENT_INFO.ism;
  if (name.includes('retail sales') || name.includes('retail')) return NEWS_EVENT_INFO.retail;
  return NEWS_EVENT_INFO.custom;
}

/**
 * Render star rating as string
 */
export function renderStars(rating: number): string {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}
