import { useTopMovers } from '@/hooks/useCryptoMovers';
import type { CryptoAsset } from '@/interfaces/crypto';

export default function CryptoMoversCard() {
  const movers = useTopMovers();

  if (!movers) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-slate-400 text-sm animate-pulse">
          Connecting to crypto feed…
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Columns */}
      <div className="flex flex-1 gap-3 overflow-hidden">
        <MoversColumn
          title="Top Gainers"
          items={movers.topGainers.data}
          positive
        />
        <MoversColumn
          title="Top Losers"
          items={movers.topLosers.data}
          positive={false}
        />
      </div>
    </div>
  );
}

/* ============================================================
   COLUMN
   ============================================================ */

function MoversColumn({
  title,
  items,
  positive,
}: {
  title: string;
  items: CryptoAsset[];
  positive: boolean;
}) {
  const accent = positive ? 'text-emerald-400' : 'text-rose-400';

  return (
    <div className="flex-1 rounded-md bg-white/5 border border-white/10 flex flex-col overflow-hidden">
      {/* Column title */}
      <div className="px-3 pt-2 pb-1">
        <h4 className={`text-sm font-semibold ${accent}`}>
          {positive ? '▲' : '▼'} {title}
        </h4>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[40px_1fr_90px_70px_90px] text-[11px] text-slate-400 px-7 pb-1">
        <span>#</span>
        <span>Name</span>
        <span className="text-right">Price</span>
        <span className="text-right">1h %</span>
        <span className="text-right">Volume</span>
      </div>

      {/* Scrollable rows ONLY */}
      <div className="flex-1 overflow-y-auto thin-scrollbar px-2 pb-2 space-y-1">
        {items.map((coin) => (
          <MoverRow key={coin.id} coin={coin} />
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   ROW
   ============================================================ */

function MoverRow({ coin }: { coin: CryptoAsset }) {
  const price = Number(coin.currentPrice) || 0;
  const change1h = Number(coin.priceChangePercentage1h ?? 0);
  const volume = Number(coin.totalVolume) || 0;

  return (
    <div className="grid grid-cols-[40px_1fr_90px_70px_90px] items-center px-2 py-2 rounded-md bg-black/20 hover:bg-black/30 transition text-sm">
      <span className="text-xs text-slate-400">
        #{coin.marketCapRank}
      </span>

      <div className="flex items-center gap-2 min-w-0">
        <img src={coin.image} className="w-5 h-5 rounded-full" />
        <span className="text-white font-medium truncate">
          {coin.symbol.toUpperCase()}
        </span>
      </div>

      <span className="text-right font-mono text-white">
        ${price < 1 ? price.toFixed(4) : price.toFixed(2)}
      </span>

      <span
        className={`text-right font-mono ${
          change1h >= 0 ? 'text-emerald-400' : 'text-rose-400'
        }`}
      >
        {change1h >= 0 ? '+' : ''}
        {change1h.toFixed(2)}%
      </span>

      <span className="text-right font-mono text-slate-300">
        {formatVolume(volume)}
      </span>
    </div>
  );
}

/* ============================================================
   HELPERS
   ============================================================ */

function formatVolume(value: number) {
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toString();
}

