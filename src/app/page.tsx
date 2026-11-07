export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <div className="max-w-2xl space-y-6 rounded-xl border border-line bg-panel p-10 shadow-sm">
        <div className="inline-block rounded-full bg-accent/10 px-4 py-1 text-sm font-medium text-accent">
          Foundation Scaffold (Task B01)
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-ink">
          Afterfact
        </h1>
        <p className="text-lg text-ink/80">
          Stale-Answer Detector — Evidence-grounded temporal verification for AI-generated answers.
        </p>
        <div className="rounded-lg border border-line/60 bg-paper p-4 text-sm text-ink/70">
          <p className="font-semibold text-ink">Verification Workflow Under Construction</p>
          <p className="mt-1">
            Core toolchain and contract verification active. Automated claim extraction, web retrieval, and verification pipelines will land in Phase 1.
          </p>
        </div>
      </div>
    </main>
  );
}
