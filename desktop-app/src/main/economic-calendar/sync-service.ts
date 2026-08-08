/**
 * Economic Calendar Sync Service
 * 
 * Orchestrates all providers, manages caching, and provides the sync lifecycle.
 * 
 * - Syncs on app startup
 * - Syncs periodically in background (every 6 hours)
 * - Caches all events in SQLite
 * - Blocking continues offline using last successful cache
 * - Never silently clears the calendar on failure
 */

import { DatabaseManager } from '../database';
import { EconomicCalendarProvider, EconomicEvent, ProviderSyncResult } from './types';
import { FederalReserveProvider } from './providers/federal-reserve';
import { BlsProvider } from './providers/bls';
import { BeaProvider } from './providers/bea';
import { EiaProvider } from './providers/eia';

const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const STARTUP_DELAY_MS = 10 * 1000; // 10 seconds after app start

export class EconomicCalendarSyncService {
  private db: DatabaseManager;
  private providers: EconomicCalendarProvider[];
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private isSyncing = false;

  constructor(db: DatabaseManager) {
    this.db = db;
    this.providers = [
      new FederalReserveProvider(),
      new BlsProvider(),
      new BeaProvider(),
      new EiaProvider(),
    ];
  }

  /** Start the sync service (called on app startup) */
  start(): void {
    // Initial sync after short delay (don't block startup)
    setTimeout(() => this.syncAll(), STARTUP_DELAY_MS);

    // Periodic sync every 6 hours
    this.syncInterval = setInterval(() => this.syncAll(), SYNC_INTERVAL_MS);

    console.log('[EconomicCalendar] Sync service started. Next sync in 10s, then every 6h.');
  }

  /** Stop the sync service */
  stop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /** Force a manual sync (called from UI) */
  async forceSyncAll(): Promise<{ success: boolean; eventsAdded: number; eventsUpdated: number; errors: string[] }> {
    return this.syncAll();
  }

  /** Run all providers and cache results */
  private async syncAll(): Promise<{ success: boolean; eventsAdded: number; eventsUpdated: number; errors: string[] }> {
    if (this.isSyncing) return { success: false, eventsAdded: 0, eventsUpdated: 0, errors: ['Sync already in progress'] };
    this.isSyncing = true;

    const syncId = this.db.addSyncHistoryEntry({ syncType: 'full', status: 'running' });
    let totalAdded = 0;
    let totalUpdated = 0;
    const errors: string[] = [];

    console.log('[EconomicCalendar] Starting full sync...');

    for (const provider of this.providers) {
      try {
        const result = await provider.fetchEvents();
        
        if (result.success && result.events.length > 0) {
          // Count existing events for this source to determine added vs updated
          const existingEvents = this.db.getEconomicEvents();
          const existingIds = new Set(existingEvents.map(e => e.id));

          let added = 0;
          let updated = 0;

          result.events.forEach(event => {
            if (existingIds.has(event.id)) updated++;
            else added++;
          });

          this.db.upsertManyEconomicEvents(result.events);
          totalAdded += added;
          totalUpdated += updated;

          this.db.updateSourceStatus(provider.id, {
            lastSyncAt: new Date().toISOString(),
            lastSuccessAt: new Date().toISOString(),
            eventsCount: result.events.length,
            status: 'success',
          });

          console.log(`[EconomicCalendar] ${provider.name}: ${added} added, ${updated} updated`);
        } else if (!result.success) {
          errors.push(`${provider.name}: ${result.error}`);
          this.db.updateSourceStatus(provider.id, {
            lastSyncAt: new Date().toISOString(),
            lastError: result.error || 'Unknown error',
            status: 'error',
          });
          console.warn(`[EconomicCalendar] ${provider.name} failed: ${result.error}`);
        }
      } catch (err: any) {
        errors.push(`${provider.name}: ${err.message}`);
        this.db.updateSourceStatus(provider.id, {
          lastSyncAt: new Date().toISOString(),
          lastError: err.message,
          status: 'error',
        });
        console.error(`[EconomicCalendar] ${provider.name} exception:`, err.message);
      }
    }

    const overallSuccess = errors.length === 0;
    this.db.completeSyncHistoryEntry(syncId, {
      eventsAdded: totalAdded,
      eventsUpdated: totalUpdated,
      errors: errors.length > 0 ? errors.join('; ') : undefined,
      status: overallSuccess ? 'success' : 'partial',
    });

    if (overallSuccess) {
      this.db.logActivity('economic_sync_success', `Synced ${totalAdded + totalUpdated} events from ${this.providers.length} sources`);
    }

    console.log(`[EconomicCalendar] Sync complete: ${totalAdded} added, ${totalUpdated} updated, ${errors.length} errors`);
    this.isSyncing = false;

    return { success: overallSuccess, eventsAdded: totalAdded, eventsUpdated: totalUpdated, errors };
  }

  /** Get all upcoming events (from cache) */
  getUpcomingEvents(limit: number = 20): any[] {
    return this.db.getUpcomingEconomicEvents(limit);
  }

  /** Get the next NFP event */
  getNextNfp(): any | null {
    return this.db.getNextNfpEvent();
  }

  /** Get sync status for all sources */
  getSourceStatuses(): any[] {
    return this.db.getSourceStatuses();
  }

  /** Get last successful sync time */
  getLastSyncTime(): string | null {
    return this.db.getLastSyncTime();
  }

  /** Check if an event is currently in its block window */
  isEventBlocking(event: any): boolean {
    const now = Date.now();
    const eventTime = new Date(event.starts_at_utc).getTime();
    const blockStart = eventTime - (event.block_minutes_before || 30) * 60 * 1000;
    const blockEnd = eventTime + (event.block_minutes_after || 15) * 60 * 1000;
    return now >= blockStart && now <= blockEnd;
  }

  /** Get any currently blocking events */
  getCurrentlyBlockingEvents(): any[] {
    const upcoming = this.db.getUpcomingEconomicEvents(50);
    return upcoming.filter(event => this.isEventBlocking(event));
  }
}
