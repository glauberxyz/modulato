import { defineConfig } from 'modulato/config'
import { localJson } from '@modulato/content-local'

export default defineConfig({
  // content/*.json → typed snapshot. Pull + typegen: npx modulato content
  content: localJson({ dir: 'content' }),
  // Defined once, used everywhere: useViewport(), motion-token overrides
  // (phone: {...} blocks in motion.ts), the Tweak overlay switcher.
  breakpoints: {
    phone: '(max-width: 767px)',
    tablet: '(min-width: 768px) and (max-width: 1279px)',
  },
  // One house curve, declared once. GSAP tokens name it; transition tokens
  // hold the cubic-bezier (WAAPI only speaks CSS). See MODULATO.md §7.
  eases: {
    press: 'cubic-bezier(0.16, 1, 0.3, 1)',
    roller: 'cubic-bezier(0.62, 0.05, 0.01, 0.99)',
  },
  // Runs once per SSR request, before the page renders — the one place a
  // response header can be set. Server-only, so it may read secrets; it sees
  // the request but not the matched route.
  response({ headers }) {
    headers.set('x-content-type-options', 'nosniff')
    headers.set('referrer-policy', 'strict-origin-when-cross-origin')
  },
  head: {
    lang: 'en',
    link: [
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'preconnect', href: 'https://use.typekit.net', crossorigin: true },
      // Franklin Gothic URW + Adobe Garamond Pro
      { rel: 'stylesheet', href: 'https://use.typekit.net/ujh5gkg.css' },
    ],
    meta: [
      { name: 'theme-color', content: '#14110f' },
      { property: 'og:site_name', content: 'Halftone' },
      { property: 'og:type', content: 'website' },
    ],
  },
})
