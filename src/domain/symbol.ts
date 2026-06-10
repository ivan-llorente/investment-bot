/**
 * Normalización de símbolos: TradingView entrega "BTCUSDT", ccxt y el
 * dominio trabajan con "BTC/USDT". Las quotes se prueban de más larga a
 * más corta para que "XUSDC" no matchee antes con "USD".
 */
const KNOWN_QUOTES = ['USDT', 'USDC', 'EUR', 'USD', 'BTC', 'ETH'];

export function normalizeTicker(tvTicker: string): string {
  const ticker = tvTicker.trim().toUpperCase();
  if (ticker.includes('/')) return ticker;
  for (const quote of KNOWN_QUOTES) {
    if (ticker.endsWith(quote) && ticker.length > quote.length) {
      return `${ticker.slice(0, -quote.length)}/${quote}`;
    }
  }
  return ticker;
}
