import type { ConfigModule } from 'modulato'

export default {
  meta: () => ({
    title: 'Styleguide',
    description: 'The type styles, scale and colors this site is built from.',
    // Nothing to index: this is a working document for the people building
    // the site, not a page anyone should arrive at from a search.
    meta: [{ name: 'robots', content: 'noindex' }],
  }),
} satisfies ConfigModule
