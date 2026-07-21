import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen hero-gradient text-white flex flex-col">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-8 py-5 max-w-6xl mx-auto w-full">
        <span className="text-xl font-bold tracking-tight">
          Contract<span className="text-cyan-400">IQ</span>
        </span>
        <div className="flex gap-4">
          <Link
            href="/signin"
            className="px-5 py-2 rounded-full border border-white/30 text-sm font-medium hover:border-white/70 transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="px-5 py-2 rounded-full bg-cyan-400 text-gray-900 text-sm font-bold hover:bg-cyan-300 transition-colors"
          >
            Get Started Free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20 max-w-4xl mx-auto w-full">
        <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 text-sm text-cyan-300 mb-8">
          <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block"></span>
          Powered by GPT-4o — Purpose-built for NDAs &amp; MSAs
        </div>

        <h1 className="text-5xl md:text-6xl font-extrabold leading-tight mb-6">
          Understand any contract{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400">
            in 15 minutes
          </span>
        </h1>

        <p className="text-lg md:text-xl text-gray-300 max-w-2xl leading-relaxed mb-10">
          ContractIQ extracts the key terms from your NDA or MSA, tells you exactly where each term lives in the document, scores its confidence, and lets you ask follow-up questions in plain English — without a lawyer on call.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/signup"
            className="px-8 py-3.5 rounded-full bg-cyan-400 text-gray-900 font-bold text-base hover:bg-cyan-300 transition-colors"
          >
            Start reviewing free →
          </Link>
          <Link
            href="/signin"
            className="px-8 py-3.5 rounded-full border border-white/30 text-white font-medium text-base hover:border-white/70 transition-colors"
          >
            Sign in to dashboard
          </Link>
        </div>
      </section>

      {/* Features row */}
      <section className="border-t border-white/10 py-16 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10 text-center">
          <div>
            <div className="text-3xl mb-3">📄</div>
            <h3 className="font-semibold text-white mb-2">Key Term Extraction</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              20–30 standard NDA and MSA terms extracted automatically with page-level attribution.
            </p>
          </div>
          <div>
            <div className="text-3xl mb-3">🎯</div>
            <h3 className="font-semibold text-white mb-2">Confidence Scoring</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Every extracted term shows a confidence score and the verbatim source sentence.
            </p>
          </div>
          <div>
            <div className="text-3xl mb-3">💬</div>
            <h3 className="font-semibold text-white mb-2">Chat with Your Contract</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Ask plain-English questions. Get answers grounded strictly in your document — with page citations.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-6 text-center text-gray-500 text-xs">
        <p>Powered by OpenAI GPT-4o &nbsp;·&nbsp; Not legal advice</p>
      </footer>
    </main>
  )
}
