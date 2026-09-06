export default function About() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-text sm:text-4xl">From spreadsheet to system</h1>
      <div className="mt-6 space-y-5 text-muted">
        <p>
          Trader&apos;s Workbook began as an Excel trading journal — rows of trades, hand-built formulas, and a
          growing conviction that the numbers mattered more than the noise. It worked, but spreadsheets don&apos;t
          scale, don&apos;t enforce discipline, and don&apos;t tell you <em>why</em> you keep making the same mistake.
        </p>
        <p>
          So we rebuilt it as a modern performance platform. The philosophy stayed the same:{' '}
          <strong className="text-text">record, analyze, identify mistakes, measure, improve, repeat.</strong> The
          primary metric was never how many trades you took — it was how consistently you executed your edge.
        </p>
        <p>
          Every number in Trader&apos;s Workbook comes from a single, tested calculation engine. If the data to
          compute a metric isn&apos;t there, we say so — we never invent statistics. Accuracy over vanity, always.
        </p>
        <p>
          Our goal is simple: help serious traders become more disciplined, manage risk better, and make better
          decisions — one recorded trade at a time.
        </p>
      </div>
    </div>
  );
}
