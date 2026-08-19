import { defineConfig } from 'modulato/config'

export default defineConfig({
  // Site-wide <head>, SSR'd — favicon + Adobe Fonts (Franklin Gothic URW,
  // Adobe Garamond Pro).
  head: {
    link: [
      { rel: 'icon', href: '/icon.svg', type: 'image/svg+xml' },
      { rel: 'preconnect', href: 'https://use.typekit.net', crossorigin: true },
      { rel: 'stylesheet', href: 'https://use.typekit.net/ujh5gkg.css' },
    ],
    // SimpleAnalytics — auto-tracks History API navigations, so the script
    // tag alone covers the client-side route changes.
    script: [{ src: 'https://scripts.simpleanalyticscdn.com/latest.js', async: true }],
  },
})
