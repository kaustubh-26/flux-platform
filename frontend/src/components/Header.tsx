import { useInternet } from "../hooks/useInternet";

const Header = () => {
  const online = useInternet();

  return (
    <header className="w-full px-6 py-3 flex items-center justify-between border-b border-slate-700/40">
      {/* Left: Brand */}
      <div className="flex flex-col">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Flux
        </h1>

        <span className="text-xs text-slate-400">
          An event-driven real-time data platform
        </span>

        <span className="text-[11px] text-slate-500 mt-0.5">
          Weather · News · Stocks · Crypto
        </span>
      </div>
    </header>
  );
};

export default Header;
