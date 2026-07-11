import { Shared } from 'modulato'
import type { Project } from '../../../content/projects'

export default function WorkDetail({ project }: { project: Project | null }) {
  if (!project) {
    return (
      <main className="detail">
        <h1 className="detail__title">Project not found</h1>
        <a href="/work">Back to work</a>
      </main>
    )
  }
  return (
    <main className="detail" style={{ ['--project-color' as string]: project.color }}>
      <header className="detail__header">
        <h1 className="detail__title">{project.title}</h1>
        <span className="detail__year">{project.year}</span>
      </header>
      <Shared id={`cover:${project.slug}`}>
        <img className="detail__cover" src={project.image} alt={project.title} />
      </Shared>
      <p className="detail__description">{project.description}</p>
      <a className="detail__back" href="/work">
        ← All work
      </a>
    </main>
  )
}
