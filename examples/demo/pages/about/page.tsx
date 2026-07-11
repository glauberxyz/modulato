import { useEffect, useRef } from 'react'
import { resolveTokens, useFormAction, useScroll } from 'modulato'
import { useMotion } from '@modulato/gsap'
import tokens from './motion'
import { subscribe } from './server'

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
        <p data-reveal>
          The menu indicator and the colored marker are persistent shell components —
          they never unmount. They receive navigation events and change state while the
          URL changes, which is the framework&apos;s signature move.
        </p>
        <p data-reveal>
          Pages are server-rendered for SEO, hydrated once, and swapped client-side with
          coexisting page trees so transitions can choreograph both the outgoing and the
          incoming page at the same time.
        </p>
      </div>

      <ParallaxImage
        src="https://picsum.photos/seed/modulato/1600/900"
        alt="Placeholder"
      />

      <Marquee text="Mount · Animate · Destroy" />

      <div className="about__body">
        <p data-reveal>
          Everything animated on this page is owned by the page: the marquee loop, the
          parallax subscription and the reveals below are created on mount and torn down
          on unmount — the strict lifecycle Modulato inherits from Lisergia.
        </p>
      </div>
      <SubscribeForm />

      <div className="about__gallery">
        <img
          data-reveal
          src="https://picsum.photos/seed/lifecycle/900/1100"
          alt="Placeholder"
          loading="lazy"
        />
        <img
          data-reveal
          data-reveal-delay="0.15"
          src="https://picsum.photos/seed/ticker/900/1100"
          alt="Placeholder"
          loading="lazy"
        />
      </div>
    </main>
  )
}

/**
 * A server action, progressively enhanced: the form renders a real action
 * URL (works without JS via redirect), and with JS `useFormAction` posts it
 * over fetch and drives idle → pending → ok|error for animated feedback.
 * The handler lives in ./server.ts and never ships to the browser.
 */
function SubscribeForm() {
  const { attrs, state, data, error } = useFormAction(subscribe)
  return (
    <form className="about__form" data-state={state} {...attrs}>
      <h2>Get the launch note</h2>
      {state === 'ok' ? (
        <p className="about__form-done">{data?.message}</p>
      ) : (
        <div className="about__form-row">
          <input
            name="email"
            type="email"
            required
            placeholder="you@studio.com"
            aria-label="Email"
          />
          <button type="submit" disabled={state === 'pending'}>
            {state === 'pending' ? 'Subscribing…' : 'Subscribe'}
          </button>
        </div>
      )}
      {state === 'error' && <p className="about__form-error">{error}</p>}
    </form>
  )
}

/**
 * Scroll-linked parallax through the page's smooth-scroll frames (Lenis).
 * The subscription dies with the page — useScroll cleans up on unmount.
 */
function ParallaxImage({ src, alt }: { src: string; alt: string }) {
  const frame = useRef<HTMLElement>(null)
  const img = useRef<HTMLImageElement>(null)

  const apply = () => {
    if (!frame.current || !img.current) return
    const rect = frame.current.getBoundingClientRect()
    const progress =
      (rect.top + rect.height / 2 - window.innerHeight / 2) / window.innerHeight
    // Resolved per frame — token edits AND breakpoint changes apply live.
    const { strength } = resolveTokens(tokens).parallax
    img.current.style.transform = `translate3d(0, ${(-11.5 + progress * strength).toFixed(3)}%, 0)`
  }

  useScroll(apply)
  useEffect(() => {
    apply()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <figure ref={frame} className="about__parallax">
      <img ref={img} src={src} alt={alt} />
    </figure>
  )
}

/**
 * An infinite loop owned by the page: useMotion runs inside a gsap.context
 * scoped to this page's element, so the tween is reverted automatically when
 * the page unmounts mid-navigation. No leaked RAF work, ever.
 */
function Marquee({ text }: { text: string }) {
  useMotion(({ q, gsap }) => {
    // useMotion re-runs on breakpoint/reduced-motion changes, so this reads
    // fresh values. Reduced motion resolves duration to 0: no loop at all.
    const { duration } = resolveTokens(tokens).marquee
    if (duration <= 0) return
    gsap.to(q('.about__marquee-track'), {
      xPercent: -50,
      duration,
      ease: 'none',
      repeat: -1,
    })
  })

  const sequence = `${Array.from({ length: 4 }, () => text).join(' · ')} · `
  return (
    <div className="about__marquee" aria-hidden="true">
      <div className="about__marquee-track">
        <span>{sequence}</span>
        <span>{sequence}</span>
      </div>
    </div>
  )
}
