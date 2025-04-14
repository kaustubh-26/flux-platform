import { useState } from 'react';
import CryptoMoversCard from './TopMoversCard';

type Tab = 'movers' | 'ticker';

export default function CryptoCard() {
  const [activeTab, setActiveTab] = useState<Tab>('movers');

  return (
    <div className="h-full bg-slate-800 rounded-lg shadow-md border border-slate-700/40 flex flex-col overflow-hidden">
      {/* Tabs */}
      <div className="flex items-center border-b border-white/10">
        <TabButton
          active={activeTab === 'movers'}
          onClick={() => setActiveTab('movers')}
        >
          📈 Crypto Movers
        </TabButton>
        <TabButton
          active={activeTab === 'ticker'}
          onClick={() => setActiveTab('ticker')}
        >
          Live Ticker
        </TabButton>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden p-3">
        {activeTab === 'movers' && <CryptoMoversCard />}
        {activeTab === 'ticker' && (
          <div className="h-full flex items-center justify-center text-slate-400">
            Live Ticker coming soon…
          </div>
        )}
      </div>
    </div>
  );
}

// Tab Button

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium transition border-b-2 ${active
          ? 'text-emerald-400 border-emerald-400'
          : 'text-slate-400 border-transparent hover:text-slate-200'
        }`}
    >
      {children}
    </button>
  );
}

