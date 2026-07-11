import type { ModulatoContent } from 'modulato'

// Types flow FROM the content: `modulato content` generates
// .modulato/content.d.ts, which augments ModulatoContent with the snapshot's
// real shape — so this derives from content/projects.json, not the reverse.
export type Project = ModulatoContent['projects'][number]
