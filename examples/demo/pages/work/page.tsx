import { Shared } from 'modulato'
import type { Project } from '../../content/projects'

export default function Work({ projects }: { projects: Project[] }) {
  return (
    <main className="work">
      <h1 className="work__title">Selected work</h1>
      <div className="work__list">
        {projects.map((project) => (
          <a key={project.slug} className="work__card" href={`/work/${project.slug}`}>
            <Shared id={`cover:${project.slug}`}>
              <img src={project.image} alt={project.title} loading="lazy" />
            </Shared>
            <div className="work__card-meta">
              <h2>{project.title}</h2>
              <span>{project.year}</span>
            </div>
          </a>
        ))}
      </div>
    </main>
  )
}
