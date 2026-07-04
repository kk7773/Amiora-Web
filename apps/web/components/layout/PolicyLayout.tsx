interface PolicySection {
  heading: string
  body:    string | string[]
}

interface PolicyLayoutProps {
  title:       string
  lastUpdated: string
  intro?:      string
  sections:    PolicySection[]
}

export function PolicyLayout({ title, lastUpdated, intro, sections }: PolicyLayoutProps) {
  return (
    <div className="max-w-3xl mx-auto section-x py-14 space-y-10">
      <div className="space-y-2">
        <p className="text-2xs uppercase tracking-widest2 text-teal">Legal</p>
        <h1 className="font-display text-display-xl text-ink">{title}</h1>
        <p className="text-xs text-ink-faint">Last updated: {lastUpdated}</p>
        {intro && <p className="text-sm text-ink-muted leading-relaxed pt-2">{intro}</p>}
      </div>

      <div className="w-full h-px bg-divider" />

      <div className="space-y-8">
        {sections.map((s, i) => (
          <section key={i}>
            <h2 className="font-display text-lg text-deep-teal mb-3">{s.heading}</h2>
            {Array.isArray(s.body) ? (
              <ul className="space-y-1.5 list-none">
                {s.body.map((item, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-ink-muted">
                    <span className="text-teal mt-0.5">✦</span>
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted leading-relaxed">{s.body}</p>
            )}
          </section>
        ))}
      </div>

      <div className="bg-surface rounded-2xl p-6 text-sm text-ink-muted">
        Questions? Email us at{' '}
        <a href="mailto:info@amioradiamonds.com" className="text-teal hover:text-deep-teal transition-colors">
          info@amioradiamonds.com
        </a>
        {' '}or call{' '}
        <a href="tel:+919088989888" className="text-teal hover:text-deep-teal transition-colors">
          +91 90889 89888
        </a>
      </div>
    </div>
  )
}
