import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-[calc(100vh-8.5rem)] flex-col items-center justify-center px-4 sm:px-6 py-20 sm:py-28 text-center">
      <div className="w-full max-w-xl mx-auto space-y-6">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-normal tracking-heading text-text-primary">
          Clarity, even as facts change.
        </h1>
        <p className="text-base sm:text-lg text-text-secondary leading-[1.6] max-w-md mx-auto">
          Check AI-generated answers against current sources.
        </p>

        <div className="pt-2 flex flex-col items-center gap-3">
          <Link
            href="/design"
            className="inline-flex items-center justify-center h-10 sm:h-11 px-5 rounded-[9px] bg-btn-primary text-btn-primary-text text-sm font-medium hover:bg-btn-primary-hover active:opacity-95 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            Explore the design system
          </Link>
          <p className="text-xs text-text-muted">
            Design preview · Verification is not available yet.
          </p>
        </div>
      </div>
    </main>
  );
}
