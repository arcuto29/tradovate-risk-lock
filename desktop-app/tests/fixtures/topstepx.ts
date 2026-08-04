/**
 * TopstepX Platform Fixtures
 * Sanitized request/response samples for testing order classification.
 */

export const TOPSTEPX_FIXTURES = {
  // Buy order (open position)
  buyOrder: {
    url: 'https://userapi.topstepx.com/Order',
    method: 'POST',
    body: { action: 1, symbol: 'NQU26', qty: 2, orderType: 'Market', timeInForce: 'Day' },
    expected: { action: 'OPEN_POSITION', allow: false, reason: 'oversized' }, // if max=1
  },

  // Sell order (open short)
  sellOrder: {
    url: 'https://userapi.topstepx.com/Order',
    method: 'POST',
    body: { action: 2, symbol: 'ESU26', qty: 1, orderType: 'Market', timeInForce: 'Day' },
    expected: { action: 'OPEN_POSITION', allow: true },
  },

  // Close position
  closeOrder: {
    url: 'https://userapi.topstepx.com/Order',
    method: 'POST',
    body: { action: 1, symbol: 'NQU26', qty: 2, isClose: true, reduceOnly: true },
    expected: { action: 'CLOSE_POSITION', allow: true },
  },

  // Cancel order
  cancelOrder: {
    url: 'https://userapi.topstepx.com/Order/cancel',
    method: 'POST',
    body: { orderId: 12345 },
    expected: { action: 'CANCEL_ORDER', allow: true },
  },

  // Modify stop
  modifyStop: {
    url: 'https://userapi.topstepx.com/Order/editStopLoss',
    method: 'POST',
    body: { orderId: 12345, stopPrice: 15000 },
    expected: { action: 'MODIFY_PROTECTIVE_ORDER', allow: true },
  },

  // Numeric action field (the bug that was fixed)
  numericAction: {
    url: 'https://userapi.topstepx.com/Order',
    method: 'POST',
    body: { action: 1, symbol: 'NQU26', qty: 15 },
    expected: { action: 'OPEN_POSITION', shouldNotCrash: true },
  },
};
