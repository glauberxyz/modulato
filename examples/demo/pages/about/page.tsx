export default function About() {
  return (
    <main className="about">
      <h1 className="about__title">About this demo</h1>
      <div className="about__body">
        <p>
          This site is the proving ground for <strong>Modulato</strong>, an
          animation-first React framework. Three pages, dummy content, and every
          framework concept exercised in miniature.
        </p>
        <p>
          The menu indicator and the colored marker are persistent shell components —
          they never unmount. They receive navigation events and change state while the
          URL changes, which is the framework&apos;s signature move.
        </p>
        <p>
          Pages are server-rendered for SEO, hydrated once, and swapped client-side with
          coexisting page trees so transitions can choreograph both the outgoing and the
          incoming page at the same time.
        </p>
      </div>
      <img
        className="about__image"
        src="https://picsum.photos/seed/modulato/1600/900"
        alt="Placeholder"
        loading="lazy"
      />
    </main>
  )
}
