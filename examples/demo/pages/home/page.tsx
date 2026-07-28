import type { Chapter } from '../../lib/content'

export default function Home({ chapters }: { chapters: Chapter[] }) {
  return (
    <main className="home is-dark" data-page="home">
      <section className="home__hero grid">
        <h1 className="home__claim col-left">
          There is no grey
          <br />
          in a printed
          <br />
          photograph.
        </h1>
        <div className="home__lede col-right">
          <p>
            Look closely at any photograph ever printed on paper — a newspaper, a
            magazine, a book. The greys are not there. What is there is dots:
            thousands of them, larger where the picture is dark, small enough that
            your eye gives up and averages them into tone.
          </p>
          <p className="home__note">
            This site takes apart the halftone shader running behind these words —
            where the technique came from, and how a rule invented for ruled glass
            in 1894 ended up as four floats in a fragment shader.
          </p>
        </div>
      </section>

      <nav className="home__index grid" aria-label="Chapters">
        <div className="home__indexhead col-full">
          <span className="label">Contents</span>
          <span className="label">Four chapters</span>
        </div>
        {chapters.map((c) => (
          <a
            key={c.slug}
            className="home__entry col-full"
            href={`/${c.slug}`}
            data-plate={c.plate}
          >
            <span className="home__numeral">{c.numeral}</span>
            <span className="home__entrytitle">{c.title}</span>
            <span className="home__abstract">{c.abstract}</span>
            <span className={`home__dot home__dot--${c.plate}`} aria-hidden="true" />
          </a>
        ))}
        <a className="home__entry home__entry--alt col-full" href="/darkroom" data-plate="k">
          <span className="home__numeral">·</span>
          <span className="home__entrytitle">Darkroom</span>
          <span className="home__abstract">
            Every uniform in the shader, live. Take the press apart yourself.
          </span>
          <span className="home__dot" aria-hidden="true" />
        </a>
      </nav>

      <footer className="home__foot grid">
        <p className="col-left home__colophon">
          Built with Modulato. The halftone shader is Paper Design's HalftoneCmyk,
          Apache-2.0. Historical images are public domain — sources are credited on
          each plate.
        </p>
        <p className="col-right home__colophon">
          Every number on this site is a motion token: editable live in the dev
          overlay, or by an agent over MCP. The type and colour it is built
          from are set out in the <a href="/styles">specimen</a>.
        </p>
      </footer>
    </main>
  )
}
