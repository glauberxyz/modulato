import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

const COMMAND = 'npm create modulato@latest my-site'

export default function Home() {
  return (
    <main className="home">
      <h1 className="home__title">Modulato</h1>
      <p className="home__description">
        The animation-first React framework. Page transitions with coexisting
        layouts, a persistent URL-aware shell, and motion tokens you tweak
        live — built for humans and LLMs alike.
      </p>
      <CommandBox />
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
        {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
      </button>
    </div>
  )
}
