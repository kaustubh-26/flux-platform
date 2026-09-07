import { useState } from "react";
import logo from "@/assets/logo.png";
import useAuthSession from "@/hooks/useAuthSession";

const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { isAuthenticated, isLoading, logout, logoutPending } = useAuthSession();

  const handleLogout = async () => {
    try {
      await logout();
      setMenuOpen(false);
      window.location.assign("/");
    } catch {
      // Error is already logged inside the auth provider.
    }
  };

  return (
    <header className="w-full border-b border-slate-700/40 bg-[#1b1b1b] px-6 py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col items-start gap-0.5">
          <img
            src={logo}
            alt="Flux logo"
            className="h-12 w-auto object-contain"
          />

          <span className="text-xs text-slate-300">
            An event-driven real-time data platform
          </span>

          <span className="text-[11px] text-slate-400">
            Weather · News · Stocks · Crypto
          </span>
        </div>

        <div className="relative">
          <button
            type="button"
            aria-label="Open navigation menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-600/70 bg-slate-900/80 text-slate-100 transition hover:border-emerald-500/70 hover:text-emerald-300"
          >
            <span className="flex flex-col gap-1.5">
              <span className="block h-0.5 w-5 rounded-full bg-current" />
              <span className="block h-0.5 w-5 rounded-full bg-current" />
              <span className="block h-0.5 w-5 rounded-full bg-current" />
            </span>
          </button>

          {menuOpen ? (
            <div className="absolute right-0 top-full z-20 mt-3 w-52 rounded-2xl border border-slate-700/60 bg-slate-950/95 p-2 shadow-2xl shadow-black/40 backdrop-blur">
              {isLoading ? (
                <div className="px-4 py-3 text-sm text-slate-400">
                  Checking session...
                </div>
              ) : null}

              {!isLoading && isAuthenticated ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={logoutPending}
                  className="flex w-full items-center gap-2 cursor-pointer rounded-xl px-4 py-3 text-left text-sm font-medium text-slate-100 transition hover:bg-slate-800 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-4 w-4 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                    <path d="M14 8V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-2" />
                    <path d="M9 12h12l-3-3" />
                    <path d="M18 15l3-3" />
                  </svg>
                  {logoutPending ? "Logging out..." : "Logout"}
                </button>
              ) : null}

              {!isLoading && !isAuthenticated ? (
                <a
                  href="/login"
                  className="flex items-center gap-2 cursor-pointer rounded-xl px-4 py-3 text-sm font-medium text-slate-100 transition hover:bg-slate-800 hover:text-emerald-300"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-4 w-4 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                    <path d="M15 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-2" />
                    <path d="M21 12H8l3-3" />
                    <path d="M11 15l-3-3" />
                  </svg>
                  Login
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
};

export default Header;
