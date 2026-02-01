
import logo from "@/assets/logo.png";

const Header = () => {
  return (
    <header className="w-full px-6 py-3 border-b border-slate-700/40 bg-[#1b1b1b]">
      <div className="flex flex-col items-start gap-0.5">
        {/* Logo */}
        <img
          src={logo}
          alt="Flux logo"
          className="h-12 w-auto object-contain"
        />

        {/* Subtitle */}
        <span className="text-xs text-slate-300">
          An event-driven real-time data platform
        </span>

        <span className="text-[11px] text-slate-400">
          Weather · News · Stocks · Crypto
        </span>
      </div>
    </header>
  );
};

export default Header;
