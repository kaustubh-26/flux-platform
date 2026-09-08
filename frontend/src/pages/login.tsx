import Header from "@/components/Header";

const LoginPage = () => {
  return (
    <div className="min-h-screen bg-neutral-800 text-slate-100">
      <Header />

      <main className="flex min-h-[calc(100vh-109px)] items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-3xl border border-slate-700/50 bg-gradient-to-br from-slate-900 via-[#151515] to-slate-950 p-8 shadow-2xl shadow-black/30">
          <div className="mb-6 text-left">
            <a
              href="/"
              className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-slate-200"
            >
              <div className="align-middle">
                <span className="text-3xl" aria-hidden="true">&larr;</span>
                <span>Back to dashboard</span>
              </div>
            </a>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-emerald-400/80">
              Secure Access
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              Sign in to Flux
            </h1>
            <p className="text-sm leading-6 text-slate-300">
              Choose a provider to continue into Flux.
            </p>
          </div>

          <div className="mt-8 space-y-3">
            <a
              href="/auth/google"
              className="flex w-full items-center justify-center rounded-2xl border border-slate-600/60 bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white transition hover:border-cyan-400 hover:bg-slate-800"
            >
              <span>Continue with Google</span>
            </a>

            <a
              href="/auth/github"
              className="flex w-full items-center justify-center rounded-2xl border border-slate-700/70 bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white transition hover:border-cyan-400 hover:bg-slate-800"
            >
              <span>Continue with GitHub</span>
            </a>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LoginPage;
