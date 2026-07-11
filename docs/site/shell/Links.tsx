import { ArrowUpRight } from 'lucide-react'

const LINKS = [
  { href: 'https://github.com/glauberxyz/modulato', label: 'GitHub' },
  { href: 'https://www.npmjs.com/package/modulato', label: 'npm' },
  { href: 'https://modulato-demo.vercel.app', label: 'Demo' },
]

/** Persistent shell: small external links, top right. */
export function Links() {
  return (
    <nav className="links" aria-label="External links">
      {LINKS.map((link) => (
        <a key={link.label} href={link.href} target="_blank" rel="noreferrer">
          {link.label}
          <ArrowUpRight size={13} strokeWidth={2.25} aria-hidden="true" />
        </a>
      ))}
    </nav>
  )
}
