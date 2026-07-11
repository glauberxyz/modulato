import { cloneElement, type ReactElement } from 'react'

/**
 * Mark an element as shared between pages. Elements with the same id on the
 * outgoing and incoming page are matched into FLIP pairs and handed to the
 * transition's `run()` as `shared`.
 *
 *   <Shared id={`cover:${project.slug}`}>
 *     <img src={project.image} alt={project.title} />
 *   </Shared>
 *
 * Renders no wrapper — the id is stamped onto the child element itself.
 */
export function Shared({ id, children }: { id: string; children: ReactElement }) {
  return cloneElement(children, { 'data-shared': id } as Record<string, unknown>)
}
