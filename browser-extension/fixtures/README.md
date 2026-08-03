# Sentinel Diagnostic Fixtures

This folder contains sanitized request/response fixtures captured from real trading platforms during paper-trading certification tests.

## How to add fixtures

1. Enable diagnostics on the target platform
2. Perform each trading action (buy, sell, close, reduce, reverse, cancel, move stop, flatten)
3. Export diagnostics using `__sentinelWS.export()` or `__sentinel.exportDiagnostics()`
4. Sanitize: remove any account IDs, tokens, or personal info that slipped through
5. Save as `{platform}-{date}.json` in this folder

## Fixture format

```json
{
  "platform": "TopstepX",
  "capturedAt": "2026-08-03",
  "sentinelVersion": "2.1.0",
  "actions": [
    {
      "testAction": "BUY_OPEN",
      "request": { ... },
      "expectedClassification": "OPEN_POSITION",
      "expectedDecision": "CHECK_RULES"
    }
  ]
}
```

## How to replay

Fixtures can be replayed against `evaluateTradingRequest()` to verify the classifier handles each format correctly without needing the broker online.

## Files

- None yet. Collect by running paper-trading diagnostics.
