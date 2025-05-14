import { useState } from 'react';
import type { StockMover } from '@/interfaces/stocks';

interface Props {
  movers: {
    timestamp: string;
    topGainers: StockMover[];
    topLosers: StockMover[];
  } | null;
}

export default function TopStockPerformers({ movers }: Props) {

  if (!movers) {
    return (
      <div className="flex items-center justify-center">
        <span className="text-slate-400 text-sm animate-pulse">
          Connecting to stock feed…
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col md:flex-row gap-3 md:overflow-hidden">
        <StockColumn
          title="Top Gainers"
          items={movers.topGainers}
          time={movers.timestamp}
          positive
        />
        <StockColumn
          title="Top Losers"
          items={movers.topLosers}
          time={movers.timestamp}
          positive={false}
        />
      </div>
    </div>
  );
}


// COLUMN
function StockColumn({
  title,
  items,
  time,
  positive,
}: {
  title: string;
  items: StockMover[];
  time: string;
  positive: boolean;
}) {
  const accent = positive ? 'text-emerald-400' : 'text-rose-400';

  return (
    <div
      className="
        flex-1 rounded-md bg-white/5 border border-white/10 flex flex-col h-[45dvh] sm:h-[70dvh] md:h-auto overflow-hidden"
    >
      <div className="px-3 pt-2 pb-1">
        <h4 className={`text-sm font-semibold ${accent}`}>
          {positive ? '▲' : '▼'} {title}
        </h4>
      </div>

      <div className="grid grid-cols-[30px_1fr_70px_70px] md:grid-cols-[40px_1fr_90px_90px] text-[11px] text-slate-400 px-7 pb-1">
        <span>#</span>
        <span>Symbol</span>
        <span className="text-right">Price</span>
        <span className="text-right">Change %</span>
      </div>

      <div className="flex-1 overflow-y-auto thin-scrollbar px-2 pb-4 space-y-1">
        {items.map((stock, idx) => (
          <StockRow key={stock.symbol} stock={stock} index={idx} timestamp={time} />
        ))}
      </div>
    </div>
  );
}

//  ROW (click to expand)
function StockRow({
  stock,
  index,
  timestamp,
}: {
  stock: StockMover;
  index: number;
  timestamp: string;
}) {
  const [open, setOpen] = useState(false);

  const price = stock.currentPrice;
  const changePct = stock.changePercent;

  return (
    <>
      {/* Main row */}
      <div
        onClick={() => setOpen(v => !v)}
        className="cursor-pointer grid grid-cols-1 md:grid-cols-[40px_1fr_90px_90px] gap-y-1 items-center px-2 py-2 rounded-md
                   bg-black/20 hover:bg-black/30 transition text-sm"
      >

        {/* MOBILE VIEW */}
        <div className="flex justify-between md:hidden">
          <div className="flex items-center gap-2">
            <span className="text-white font-medium">{stock.symbol}</span>
            <span className="text-xs text-slate-500">{open ? '▾' : '▸'}</span>
          </div>

          <div className="text-right">
            <div className="font-mono text-white">
              ${price < 1 ? price.toFixed(4) : price.toFixed(2)}
            </div>
            <div
              className={`text-xs font-mono ${changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
            >
              {changePct >= 0 ? '+' : ''}
              {changePct.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* DESKTOP VIEW */}
        <div className="hidden md:contents">
          <span className="text-xs text-slate-400">#{index + 1}</span>

          <div className="flex items-center gap-2">
            <span className="text-white font-medium">{stock.symbol}</span>
            <span className="text-xs text-slate-500">{open ? '▾' : '▸'}</span>
          </div>

          <span className="text-right font-mono text-white">
            ${price < 1 ? price.toFixed(4) : price.toFixed(2)}
          </span>

          <span
            className={`text-right font-mono ${changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
          >
            {changePct >= 0 ? '+' : ''}
            {changePct.toFixed(2)}%
          </span>
        </div>

      </div>

      {/* Expanded overlay */}
      {open && (
        <div className="mx-2 mb-2 rounded-md bg-black/30 border border-white/10
                        px-3 py-2 text-xs text-slate-300 animate-in fade-in slide-in-from-top-1">
          <div className="grid grid-cols-2 gap-y-1">
            <span>Open</span>
            <span className="text-right font-mono">
              ${stock.open.toFixed(2)}
            </span>

            <span>High</span>
            <span className="text-right font-mono">
              ${stock.high.toFixed(2)}
            </span>

            <span>Low</span>
            <span className="text-right font-mono">
              ${stock.low.toFixed(2)}
            </span>

            <span>Prev Close</span>
            <span className="text-right font-mono">
              ${stock.previousClose.toFixed(2)}
            </span>

            <span className="col-span-2 pt-1 text-[10px] text-slate-500 text-right">
              Last updated: {new Date(timestamp).toUTCString().slice(17, 25)} UTC
            </span>
          </div>
        </div>
      )}
    </>
  );
}
