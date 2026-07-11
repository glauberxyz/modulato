import { Img, Shared } from 'modulato'
import type { Project } from '../../content/types'

export default function Home({ featured }: { featured: Project[] }) {
  return (
    <main className="home">
      <header className="home__hero">
        <h1 className="home__headline">
          Motion is the
          <br />
          message.
        </h1>
        <p className="home__intro">
          Modulato is an animation-first framework. This demo site exists to prove its
          moves: watch the menu indicator and the floating marker while you navigate.
        </p>
      </header>
      <section className="home__grid">
        {featured.map((project) => (
          <a key={project.slug} className="home__card" href={`/work/${project.slug}`}>
            <Shared id={`cover:${project.slug}`}>
              <Img src={project.image} alt={project.title} ratio="3/2" />
            </Shared>
            <span>{project.title}</span>
          </a>
        ))}
      </section>
    </main>
  )
}
