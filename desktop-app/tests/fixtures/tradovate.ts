/**
 * Tradovate Platform Fixtures
 * Sanitized WebSocket + REST request samples.
 */

export const TRADOVATE_FIXTURES = {
  // WebSocket order (Tradovate uses endpoint\nrequestId\n\n{json} format)
  wsMarketBuy: {
    raw: 'order/placeorder\n64\n\n{"accountId":"demo123","action":"Buy","symbol":"NQU6","orderQty":2,"orderType":"Market","timeInForce":"Day"}',
    parsed: { endpoint: 'order/placeorder', body: { accountId: 'demo123', action: 'Buy', symbol: 'NQU6', orderQty: 2, orderType: 'Market', timeInForce: 'Day' } },
    expected: { action: 'OPEN_POSITION' },
  },

  wsMarketSell: {
    raw: 'order/placeorder\n65\n\n{"accountId":"demo123","action":"Sell","symbol":"ESZ6","orderQty":1,"orderType":"Market","timeInForce":"Day"}',
    parsed: { endpoint: 'order/placeorder', body: { accountId: 'demo123', action: 'Sell', symbol: 'ESZ6', orderQty: 1 } },
    expected: { action: 'OPEN_POSITION' },
  },

  // REST close position
  restClose: {
    url: 'https://demo.tradovateapi.com/v1/order/closeposition',
    method: 'POST',
    body: { accountId: 'demo123' },
    expected: { action: 'CLOSE_POSITION', allow: true },
  },

  // REST cancel order
  restCancel: {
    url: 'https://demo.tradovateapi.com/v1/order/cancelorder',
    method: 'POST',
    body: { orderId: 789 },
    expected: { action: 'CANCEL_ORDER', allow: true },
  },

  // REST modify order (protective stop)
  restModify: {
    url: 'https://demo.tradovateapi.com/v1/order/modifyorder',
    method: 'POST',
    body: { orderId: 789, stopPrice: 14800 },
    expected: { action: 'MODIFY_PROTECTIVE_ORDER', allow: true },
  },

  // Market data socket (should NEVER be intercepted)
  wsMarketData: {
    url: 'wss://md-demo.tradovateapi.com/v1/websocket',
    note: 'Market data socket — must not intercept',
    expected: { intercept: false },
  },

  // Trading socket (orders go here)
  wsTradingSocket: {
    url: 'wss://demo.tradovateapi.com/v1/websocket',
    note: 'Trading socket — orders intercepted here',
    expected: { intercept: true },
  },
};
