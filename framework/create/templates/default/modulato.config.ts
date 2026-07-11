import { defineConfig } from 'modulato/config'
import { localJson } from '@modulato/content-local'

export default defineConfig({
  // content/*.json -> typed snapshot. Pull + typegen: npx modulato content
  content: localJson({ dir: 'content' }),
  // Defined once, used everywhere: useViewport(), motion-token overrides
  // (phone: {...} blocks in motion.ts), the Tweak overlay switcher.
  breakpoints: {
    phone: '(max-width: 767px)',
    tablet: '(min-width: 768px) and (max-width: 1279px)',
  },
})
