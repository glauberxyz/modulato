import { useState } from 'react'
import { ArrowUpRight, Check, Copy } from 'lucide-react'
import { Scene } from './scene'

const COMMAND = 'npm create modulato@latest my-site'

const LINKS = [
  { href: 'https://github.com/glauberxyz/modulato', label: 'Github' },
  { href: 'https://www.npmjs.com/package/modulato', label: 'NPM' },
  { href: 'https://modulato-demo.vercel.app', label: 'Demo' },
]

export default function Home() {
  return (
    <main className="home">
      <Scene />
      <div className="home__column">
        <h1 className="home__title">Modulato</h1>
        <p className="home__tagline">
          A visual-design-first React framework for making websites, leveraging
          custom transitions and animations. Built for humans and LLMs alike.
        </p>
        <CommandBox />
        <p className="home__note">
          Modulato has a rich internal docs ready for all AI agents.
          <br />
          Maintained by{' '}
          <a href="https://x.com/glauberxyz" target="_blank" rel="noreferrer">
            Glauber
          </a>{' '}
          &amp; <a href="https://x.com/claudeai" target="_blank" rel="noreferrer">Claude</a>
        </p>
        <nav className="home__links" aria-label="External links">
          {LINKS.map((link) => (
            <a key={link.label} href={link.href} target="_blank" rel="noreferrer">
              {link.label}
              <ArrowUpRight size={13} strokeWidth={2.25} aria-hidden="true" />
            </a>
          ))}
        </nav>
      </div>
    </main>
  )
}

function CommandBox() {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(COMMAND)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable — the command is selectable text anyway */
    }
  }

  return (
    <div className="home__command" data-copied={copied || undefined}>
      <code>{COMMAND}</code>
      <button type="button" onClick={copy} aria-label="Copy command">
        {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
      </button>
    </div>
  )
}
