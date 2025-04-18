import { useCryptoTopCoins } from '@/hooks/useCryptoTopCoins';
import { useCryptoTickers } from '@/hooks/useCryptoTicker';
import type { TopCoin } from '@/interfaces/crypto';
import { usePriceDelta } from '@/hooks/usePriceDelta';

export default function LiveTickerCard() {
  const topCoins = useCryptoTopCoins();
  const tickers = useCryptoTickers(true);
  const isLoading = !topCoins || topCoins.length === 0;


  return (
    <div className="flex flex-col h-full rounded-md bg-white/5 border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="px-3 pt-2 pb-1">
        <h4 className="text-sm font-semibold text-sky-400">
          ⏱ Top 10 Crypto Coins
        </h4>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[40px_1fr_120px_90px_110px_90px] text-[11px] text-slate-400 px-5 pb-1">
        <span>#</span>
        <span>Name</span>
        <span className="text-right">Price</span>
        <span className="text-right">24h %</span>
        <span className="text-right">Volume</span>
        <span className="text-right">24h Low / High</span>
      </div>

      {/* Rows OR Loader */}
      <div className="relative flex-1 overflow-y-auto thin-scrollbar px-2 pb-2 space-y-1">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="h-5 w-5 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
              <span className="text-slate-400 text-sm animate-pulse">
                Connecting to live prices…
              </span>
            </div>
          </div>
        ) : (
          topCoins?.map((coin, index) => (
            <LiveTickerRow
              key={coin.symbol}
              coin={coin}
              ticker={tickers[coin.symbol]}
              index={index}
            />
          ))
        )}
      </div>
    </div>
  );
}


function LiveTickerRow({
  coin,
  ticker,
  index,
}: {
  coin: TopCoin;
  ticker?: any;
  index: number;
}) {
  const price = ticker ? Number(ticker.price) : null;
  const change = ticker ? Number(ticker.price_percent_chg_24_h) : null;
  const volume = ticker ? Number(ticker.volume_24_h) : null;
  const low = ticker ? Number(ticker.low_24_h) : null;
  const high = ticker ? Number(ticker.high_24_h) : null;

  const { direction, flash } = usePriceDelta(price ?? undefined);

  return (
    <div
      className={`grid grid-cols-[40px_1fr_120px_90px_110px_90px]
        items-center px-2 py-2 rounded-md text-sm transition`}
    >
      {/* Rank */}
      <span className="text-xs text-slate-400">#{index + 1}</span>

      {/* Name */}
      <div className="flex flex-col min-w-0">
        <span className="text-white font-medium truncate">{coin.name}</span>
        <span className="text-xs text-slate-400">{coin.symbol}</span>
      </div>



      {/* Price + ▲▼ */}
      <span className={`text-right font-mono flex items-center justify-end gap-2
          rounded px-2 py-1 transition-colors duration-300
          ${flash === 'up'
          ? 'bg-emerald-500/20 text-emerald-300'
          : flash === 'down'
            ? 'bg-rose-500/20 text-rose-300'
            : 'text-white'
        }
        `}
      >
        {direction === 'up' && (
          <span className="text-emerald-400 text-xs">▲</span>
        )}
        {direction === 'down' && (
          <span className="text-rose-400 text-xs">▼</span>
        )}

        {price ? `$${price.toFixed(4)}` : '—'}
      </span>



      {/* 24h % */}
      <span
        className={`text-right font-mono ${change == null
          ? 'text-slate-400'
          : change >= 0
            ? 'text-emerald-400'
            : 'text-rose-400'
          }`}
      >
        {change != null ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}%` : '—'}
      </span>

      {/* Volume */}
      <span className="text-right font-mono text-slate-300">
        {volume ? formatVolume(volume) : '—'}
      </span>

      {/* Low / High */}
      <div className="text-right font-mono text-xs leading-tight">
        <div className="text-rose-400">
          {low != null ? `$${formatPrice(low)}` : '—'}
        </div>
        <div className="text-emerald-400">
          {high != null ? `$${formatPrice(high)}` : '—'}
        </div>
      </div>
    </div>
  );
}

function formatPrice(value: number) {
  if (value < 1) return value.toFixed(4);
  return value.toFixed(2);
}


function formatVolume(value: number) {
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toFixed(0);
}
