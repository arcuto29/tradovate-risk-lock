/**
 * SESSION JOURNEY DATA CONTRACT
 * 
 * One typed interface for the complete session picture.
 * Review components should use getSessionJourney() and this contract
 * rather than independently querying random tables.
 */

export interface SessionRecord {
  id: string;
  started_at: string;
  ended_at: string | null;
  starting_state: string;
  ending_state: string | null;
  peak_state: string;
  total_trades: number;
  pnl: number;
  escalation_count: number;
  recovery_count: number;
  first_escalation_at: string | null;
  worst_trigger: string | null;
  recovered_before_end: boolean;
  status: 'ACTIVE' | 'COMPLETED' | 'CRASH_RECOVERED' | 'ABORTED';
  time_in_normal: number;
  time_in_caution: number;
  time_in_elevated: number;
  time_in_high_risk: number;
  time_in_lockdown: number;
  checkpoint_json: string | null;
  summary_json: string | null;
}

export interface StateTransition {
  id: number;
  timestamp: string;
  type: 'state_transition';
  details: string; // JSON: { sessionId, from, to, reason, triggeringEvent, tiltScore, consecutiveLosses, tradeCount, pnlSnapshot, pnlSnapshotAt, pnlSource, pnlConfidence }
}

export interface TradeRecord {
  id: number;
  symbol: string;
  size: number;
  direction: string;
  entryTime: string;
  exitTime: string;
  pnl: number;
  result: 'win' | 'loss';
  durationSeconds: number;
}

export interface BlockEvent {
  id: number;
  timestamp: string;
  type: 'size_blocked' | 'session_blocked' | 'symbol_blocked' | 'coach_blocked' | 'stacking_blocked' | 'bypass_attempt';
  details: string;
}

export interface WarningEvent {
  id: number;
  timestamp: string;
  type: 'coach_warn' | 'fomo_warn' | 'win_streak_warn';
  details: string;
}

/**
 * SessionJourney — The complete typed data contract for one session.
 * Returned by getSessionJourney(sessionId).
 * Review components consume this directly.
 */
export interface SessionJourney {
  session: SessionRecord | null;
  transitions: StateTransition[];
  trades: TradeRecord[];
  blocks: BlockEvent[];
  warnings: WarningEvent[];
}

/**
 * P&L Confidence metadata attached to state transitions.
 */
export interface PnlMetadata {
  pnlSnapshot: number | null;
  pnlSnapshotAt: string | null;
  pnlSource: 'DOM';
  pnlConfidence: 'approximate' | 'stale';
}

/**
 * Session behavior summary — computed at session end.
 * Stored in sessions.summary_json.
 */
export interface SessionBehaviorSummary {
  sessionId: string;
  startingState: string;
  endingState: string;
  peakState: string;
  timeInNormal: number;
  timeInCaution: number;
  timeInElevated: number;
  timeInHighRisk: number;
  timeInLockdown: number;
  escalationCount: number;
  recoveryCount: number;
  worstTrigger: string;
  firstEscalationTime: string | null;
  transitionCount: number;
  tradeCount: number;
  recoveredBeforeEnd: boolean;
  timestamp: string;
}
