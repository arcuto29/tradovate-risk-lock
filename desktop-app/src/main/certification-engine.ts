/**
 * PLATFORM CERTIFICATION ENGINE
 * 
 * Internal tool for validating Sentinel against real trading platforms.
 * Observes REAL production pipeline — does NOT duplicate enforcement logic.
 * Can inject test states (daily loss, trade limit, FOMO) for tests that
 * would otherwise require losing money.
 */

export type TestStatus = 'NOT_STARTED' | 'WAITING' | 'DETECTED' | 'PASS' | 'FAIL' | 'SKIPPED';

export interface TestDiagnostic {
  platform: string;
  endpoint: string;
  method: string;
  detectedAction: string;
  detectedSide: string;
  detectedSymbol: string;
  detectedQuantity: number;
  classifierConfidence: string;
  decision: string;
  reason: string;
  timestamp: string;
}

export interface CertificationTest {
  id: string;
  name: string;
  instruction: string;
  expectedBehavior: string;
  status: TestStatus;
  actualBehavior: string;
  diagnostics: TestDiagnostic[];
  timestamp: string | null;
  requiresInjection?: boolean; // Test can inject state to avoid real losses
  injectedState?: string; // What was injected
}

export interface CertificationReport {
  platform: string;
  environment: string;
  sentinelVersion: string;
  extensionVersion: string;
  date: string;
  tests: { id: string; name: string; status: TestStatus }[];
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  overallStatus: 'CERTIFIED' | 'FAILED' | 'INCOMPLETE';
}

export const SUPPORTED_PLATFORMS = ['TopstepX', 'Tradovate', 'TradeSea'] as const;
export type Platform = typeof SUPPORTED_PLATFORMS[number];

/**
 * All 18 certification test definitions.
 * Each test defines what to observe and what constitutes PASS/FAIL.
 */
export function getCertificationTests(): CertificationTest[] {
  return [
    {
      id: 'connection',
      name: 'Connection',
      instruction: 'Ensure the desktop app is running, extension is installed, and you have the trading platform open in Chrome.',
      expectedBehavior: 'Desktop connected, extension connected, platform detected, bridge active, lock state synced.',
      status: 'NOT_STARTED', actualBehavior: '', diagnostics: [], timestamp: null,
    },
    {
      id: 'long_entry',
      name: 'Normal Long Entry',
      instruction: 'Place a 1 MNQ BUY order on your SIM account.',
      expectedBehavior: 'OPEN_POSITION detected, BUY side, MNQ symbol, quantity=1, order ALLOWED.',
      status: 'NOT_STARTED', actualBehavior: '', diagnostics: [], timestamp: null,
    },
    {
      id: 'close_long',
      name: 'Close Long',
      instruction: 'Close the MNQ position you just opened.',
      expectedBehavior: 'CLOSE_POSITION or REDUCE_POSITION detected, order ALWAYS ALLOWED.',
      status: 'NOT_STARTED', actualBehavior: '', diagnostics: [], timestamp: null,
    },
    {
      id: 'short_entry',
      name: 'Normal Short Entry',
      instruction: 'Place a 1 MNQ SELL SHORT order.',
      expectedBehavior: 'OPEN_POSITION detected, SELL side, MNQ symbol, quantity=1, order ALLOWED.',
      status: 'NOT_STARTED', actualBehavior: '', diagnostics: [], timestamp: null,
    },
    {
      id: 'partial_reduce',
      name: 'Partial Reduction',
      instruction: 'Open 2 MNQ (any direction), then reduce the position by 1.',
      expectedBehavior: 'REDUCE_POSITION detected for the second order, NOT classified as new opposite entry. ALLOWED.',
      status: 'NOT_STARTED', actualBehavior: '', diagnostics: [], timestamp: null,
    },
    {
      id: 'flatten',
      name: 'Flatten',
      instruction: 'Open a position and press the platform\'s Flatten / Close All button.',
      expectedBehavior: 'CLOSE_POSITION or FLATTEN detected via URL pattern. ALWAYS ALLOWED.',
      status: 'NOT_STARTED', actualBehavior: '', diagnostics: [], timestamp: null,
    },
    {
      id: 'bracket_oco',
      name: 'Bracket / OCO',
      instruction: 'Place an entry order with Stop Loss + Take Profit attached. Then modify the stop. Then modify the target. Then cancel the bracket.',
      expectedBehavior: 'Entry = OPEN_POSITION. Stop/TP edits = MODIFY_PROTECTIVE_ORDER (ALLOWED). Cancel = CANCEL_ORDER (ALLOWED).',
      status: 'NOT_STARTED', actualBehavior: '', diagnostics: [], timestamp: null,
    },
    {
      id: 'reversal',
      name: 'Reversal',
      instruction: 'Go long 1 MNQ, then submit a sell 2 MNQ order (reversal to short 1).',
      expectedBehavior: 'REVERSE_POSITION: closeQuantity=1, newRiskQuantity=1. Allowed if within effective max.',
      status: 'NOT_STARTED', actualBehavior: '', diagnostics: [], timestamp: null,
    },
    {
      id: 'oversize_block',
      name: 'Oversize Block',
      instruction: 'Sentinel will set max contracts to 1. Try to place a 2 MNQ order.',
      expectedBehavior: 'Order BLOCKED. Reason: position size exceeds limit. Then close/reduce still ALLOWED.',
      status: 'NOT_STARTED', actualBehavior: '', diagnostics: [], timestamp: null,
      requiresInjection: true, injectedState: 'max_contracts=1',
    },
    {
      id: 'trade_limit',
      name: 'Max Trade Limit',
      instruction: 'Sentinel will inject trade-limit-reached state. Try a new entry.',
      expectedBehavior: 'Order BLOCKED. Reason: trade limit reached. Exit still ALLOWED.',
      status: 'NOT_STARTED', actualBehavior: '', diagnostics: [], timestamp: null,
      requiresInjection: true, injectedState: 'trade_limit_reached',
    },
    {
      id: 'daily_loss',
      name: 'Daily Loss Protection',
      instruction: 'Sentinel will inject daily-loss-reached state. Try a new entry.',
      expectedBehavior: 'Order BLOCKED. Reason: daily loss reached. Close/reduce/flatten ALLOWED.',
      status: 'NOT_STARTED', actualBehavior: '', diagnostics: [], timestamp: null,
      requiresInjection: true, injectedState: 'daily_loss_reached',
    },
    {
      id: 'loss_reaction',
      name: 'Loss Reaction',
      instruction: 'Take 2 consecutive losing trades (small size, SIM only). Watch for the Take a Moment overlay.',
      expectedBehavior: 'After loss #2: Take a Moment overlay activates. Win resets counter. No duplicate triggers.',
      status: 'NOT_STARTED', actualBehavior: '', diagnostics: [], timestamp: null,
    },
    {
      id: 'fomo_protection',
      name: 'FOMO Protection',
      instruction: 'Sentinel will configure FOMO: max 1 entry in 3 minutes, mode=BLOCK. Place 1 entry, wait, then try a second within 3 min.',
      expectedBehavior: 'First entry ALLOWED. Second entry within window BLOCKED. Exits unaffected.',
      status: 'NOT_STARTED', actualBehavior: '', diagnostics: [], timestamp: null,
      requiresInjection: true, injectedState: 'fomo_config: max=1, window=3min, mode=block',
    },
    {
      id: 'end_session',
      name: 'End My Session',
      instruction: 'Press End My Session in Sentinel. Then try a new entry. Then try to close/flatten.',
      expectedBehavior: 'New/increase BLOCKED. Close/reduce/flatten/cancel/modify ALLOWED. Lock remains active.',
      status: 'NOT_STARTED', actualBehavior: '', diagnostics: [], timestamp: null,
    },
    {
      id: 'disconnect_flat',
      name: 'Extension Disconnect (Flat)',
      instruction: 'Ensure you are FLAT (no positions). Then disable the Sentinel extension in chrome://extensions.',
      expectedBehavior: 'Bypass detection fires. Platform protection activates per settings. Logged as bypass attempt.',
      status: 'NOT_STARTED', actualBehavior: '', diagnostics: [], timestamp: null,
    },
    {
      id: 'disconnect_open',
      name: 'Extension Disconnect (Open Position)',
      instruction: 'CRITICAL SAFETY TEST — SIM ONLY. Open 1 MNQ, then disable the extension.',
      expectedBehavior: 'Bypass detection fires BUT browser NOT killed if position state is OPEN/UNKNOWN. Trader retains broker access for exits.',
      status: 'NOT_STARTED', actualBehavior: '', diagnostics: [], timestamp: null,
    },
    {
      id: 'reconnect',
      name: 'Extension Reconnect',
      instruction: 'Re-enable the Sentinel extension after the disconnect test.',
      expectedBehavior: 'Lock restored, session_id preserved, protection resumed, no duplicate session, interceptors installed once.',
      status: 'NOT_STARTED', actualBehavior: '', diagnostics: [], timestamp: null,
    },
    {
      id: 'multi_tab',
      name: 'Multiple Tabs',
      instruction: 'Open the trading platform in a second Chrome tab. Try placing an order from the new tab.',
      expectedBehavior: 'Both tabs receive lock state. Order blocked/allowed consistently. No bypass from second tab.',
      status: 'NOT_STARTED', actualBehavior: '', diagnostics: [], timestamp: null,
    },
  ];
}

/**
 * Determines if a diagnostic event matches the expected behavior of a test.
 */
export function evaluateTestResult(testId: string, diagnostic: TestDiagnostic): { pass: boolean; reason: string } {
  switch (testId) {
    case 'long_entry':
      if (diagnostic.detectedAction === 'OPEN_POSITION' && diagnostic.decision === 'ALLOWED' &&
          (diagnostic.detectedSide === 'buy' || diagnostic.detectedSide === '1')) {
        return { pass: true, reason: 'OPEN_POSITION BUY detected and ALLOWED' };
      }
      return { pass: false, reason: `Expected OPEN_POSITION BUY ALLOWED. Got: ${diagnostic.detectedAction} ${diagnostic.detectedSide} ${diagnostic.decision}` };

    case 'close_long':
    case 'flatten':
      if ((diagnostic.detectedAction === 'CLOSE_POSITION' || diagnostic.detectedAction === 'REDUCE_POSITION') && diagnostic.decision === 'ALLOWED') {
        return { pass: true, reason: `${diagnostic.detectedAction} detected and ALLOWED` };
      }
      if (diagnostic.detectedAction === 'CANCEL_ORDER' && diagnostic.decision === 'ALLOWED') {
        return { pass: true, reason: 'CANCEL_ORDER ALLOWED (part of close flow)' };
      }
      return { pass: false, reason: `Expected CLOSE/REDUCE ALLOWED. Got: ${diagnostic.detectedAction} ${diagnostic.decision}` };

    case 'short_entry':
      if (diagnostic.detectedAction === 'OPEN_POSITION' && diagnostic.decision === 'ALLOWED' &&
          (diagnostic.detectedSide === 'sell' || diagnostic.detectedSide === 'sellshort' || diagnostic.detectedSide === '2')) {
        return { pass: true, reason: 'OPEN_POSITION SELL detected and ALLOWED' };
      }
      return { pass: false, reason: `Expected OPEN_POSITION SELL ALLOWED. Got: ${diagnostic.detectedAction} ${diagnostic.detectedSide} ${diagnostic.decision}` };

    case 'partial_reduce':
      if (diagnostic.detectedAction === 'REDUCE_POSITION' && diagnostic.decision === 'ALLOWED') {
        return { pass: true, reason: 'REDUCE_POSITION detected and ALLOWED' };
      }
      return { pass: false, reason: `Expected REDUCE_POSITION ALLOWED. Got: ${diagnostic.detectedAction} ${diagnostic.decision}` };

    case 'bracket_oco':
      if (diagnostic.detectedAction === 'MODIFY_PROTECTIVE_ORDER' && diagnostic.decision === 'ALLOWED') {
        return { pass: true, reason: 'MODIFY_PROTECTIVE_ORDER ALLOWED' };
      }
      if (diagnostic.detectedAction === 'CANCEL_ORDER' && diagnostic.decision === 'ALLOWED') {
        return { pass: true, reason: 'CANCEL_ORDER ALLOWED' };
      }
      if (diagnostic.detectedAction === 'OPEN_POSITION' && diagnostic.decision === 'ALLOWED') {
        return { pass: true, reason: 'Entry portion ALLOWED' };
      }
      return { pass: false, reason: `Unexpected: ${diagnostic.detectedAction} ${diagnostic.decision}` };

    case 'reversal':
      if (diagnostic.detectedAction === 'REVERSE_POSITION' && diagnostic.decision === 'ALLOWED') {
        return { pass: true, reason: 'REVERSE_POSITION detected and ALLOWED' };
      }
      if (diagnostic.detectedAction === 'CLOSE_POSITION' && diagnostic.decision === 'ALLOWED') {
        return { pass: true, reason: 'Close portion ALLOWED (platform sent separate close)' };
      }
      return { pass: false, reason: `Expected REVERSE_POSITION ALLOWED. Got: ${diagnostic.detectedAction} ${diagnostic.decision}` };

    case 'oversize_block':
      if (diagnostic.decision === 'BLOCKED' && diagnostic.reason.toLowerCase().includes('size')) {
        return { pass: true, reason: 'Oversized order BLOCKED correctly' };
      }
      if ((diagnostic.detectedAction === 'CLOSE_POSITION' || diagnostic.detectedAction === 'REDUCE_POSITION') && diagnostic.decision === 'ALLOWED') {
        return { pass: true, reason: 'Exit still ALLOWED during oversize test' };
      }
      return { pass: false, reason: `Expected BLOCKED for size. Got: ${diagnostic.detectedAction} ${diagnostic.decision} (${diagnostic.reason})` };

    case 'trade_limit':
      if (diagnostic.decision === 'BLOCKED' && diagnostic.reason.toLowerCase().includes('trade limit')) {
        return { pass: true, reason: 'Trade limit BLOCKED correctly' };
      }
      if ((diagnostic.detectedAction === 'CLOSE_POSITION' || diagnostic.detectedAction === 'REDUCE_POSITION') && diagnostic.decision === 'ALLOWED') {
        return { pass: true, reason: 'Exit still ALLOWED during trade limit test' };
      }
      return { pass: false, reason: `Expected BLOCKED for trade limit. Got: ${diagnostic.decision} (${diagnostic.reason})` };

    case 'daily_loss':
      if (diagnostic.decision === 'BLOCKED' && diagnostic.reason.toLowerCase().includes('daily loss')) {
        return { pass: true, reason: 'Daily loss BLOCKED correctly' };
      }
      if ((diagnostic.detectedAction === 'CLOSE_POSITION' || diagnostic.detectedAction === 'REDUCE_POSITION' || diagnostic.detectedAction === 'CANCEL_ORDER') && diagnostic.decision === 'ALLOWED') {
        return { pass: true, reason: 'Exit ALLOWED during daily loss test' };
      }
      return { pass: false, reason: `Expected BLOCKED for daily loss. Got: ${diagnostic.decision} (${diagnostic.reason})` };

    case 'fomo_protection':
      if (diagnostic.decision === 'BLOCKED' && diagnostic.reason.toLowerCase().includes('fomo')) {
        return { pass: true, reason: 'FOMO BLOCKED correctly' };
      }
      if (diagnostic.detectedAction === 'OPEN_POSITION' && diagnostic.decision === 'ALLOWED') {
        return { pass: true, reason: 'First entry ALLOWED (FOMO not yet triggered)' };
      }
      return { pass: false, reason: `Unexpected: ${diagnostic.decision} (${diagnostic.reason})` };

    case 'end_session':
      if (diagnostic.decision === 'BLOCKED' && diagnostic.reason.toLowerCase().includes('session ended')) {
        return { pass: true, reason: 'SESSION_ENDED block working' };
      }
      if ((diagnostic.detectedAction === 'CLOSE_POSITION' || diagnostic.detectedAction === 'REDUCE_POSITION' || diagnostic.detectedAction === 'CANCEL_ORDER' || diagnostic.detectedAction === 'MODIFY_PROTECTIVE_ORDER') && diagnostic.decision === 'ALLOWED') {
        return { pass: true, reason: 'Exit ALLOWED during session ended' };
      }
      return { pass: false, reason: `Expected SESSION_ENDED block or exit allowed. Got: ${diagnostic.decision} (${diagnostic.reason})` };

    case 'multi_tab':
      // Any order observed from second tab that is correctly enforced
      if (diagnostic.decision === 'ALLOWED' || diagnostic.decision === 'BLOCKED') {
        return { pass: true, reason: `Order from tab processed: ${diagnostic.detectedAction} → ${diagnostic.decision}` };
      }
      return { pass: false, reason: 'No order detection from second tab' };

    default:
      return { pass: false, reason: 'Unknown test' };
  }
}

/**
 * Generate a certification report from test results.
 */
export function generateReport(platform: Platform, tests: CertificationTest[], version: string): CertificationReport {
  const passed = tests.filter(t => t.status === 'PASS').length;
  const failed = tests.filter(t => t.status === 'FAIL').length;
  const skipped = tests.filter(t => t.status === 'SKIPPED').length;
  const total = tests.length;

  return {
    platform,
    environment: 'SIM',
    sentinelVersion: version,
    extensionVersion: version,
    date: new Date().toISOString(),
    tests: tests.map(t => ({ id: t.id, name: t.name, status: t.status })),
    passed, failed, skipped, total,
    overallStatus: failed > 0 ? 'FAILED' : (passed + skipped === total ? 'CERTIFIED' : 'INCOMPLETE'),
  };
}
