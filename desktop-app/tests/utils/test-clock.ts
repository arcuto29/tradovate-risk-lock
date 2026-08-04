/**
 * TestClock — Time manipulation for automated tests.
 * 
 * Production uses real system clock. Tests can advance time instantly.
 * Used for: lock expiry, session boundaries, news windows, midnight reset,
 * weekday rules, cooldown expiry, DST tests.
 * 
 * Does NOT change the operating system clock.
 */

let mockNow: number | null = null;

export class TestClock {
  /** Set a fixed time for all Date.now() calls */
  static freeze(date: Date | string | number): void {
    if (typeof date === 'string') mockNow = new Date(date).getTime();
    else if (date instanceof Date) mockNow = date.getTime();
    else mockNow = date;
  }

  /** Advance the frozen clock by milliseconds */
  static advance(ms: number): void {
    if (mockNow === null) mockNow = Date.now();
    mockNow += ms;
  }

  /** Advance by seconds */
  static advanceSeconds(s: number): void {
    TestClock.advance(s * 1000);
  }

  /** Advance by minutes */
  static advanceMinutes(m: number): void {
    TestClock.advance(m * 60 * 1000);
  }

  /** Advance by hours */
  static advanceHours(h: number): void {
    TestClock.advance(h * 60 * 60 * 1000);
  }

  /** Get the current mock time (or real time if not frozen) */
  static now(): number {
    return mockNow ?? Date.now();
  }

  /** Reset to real system time */
  static reset(): void {
    mockNow = null;
  }

  /** Check if clock is frozen */
  static isFrozen(): boolean {
    return mockNow !== null;
  }

  /** Install mock into global Date.now (call in beforeEach) */
  static install(): void {
    const original = Date.now;
    vi.spyOn(Date, 'now').mockImplementation(() => mockNow ?? original());
  }

  /** Restore original Date.now (call in afterEach) */
  static uninstall(): void {
    vi.restoreAllMocks();
    mockNow = null;
  }
}
