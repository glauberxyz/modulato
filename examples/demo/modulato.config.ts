import { defineConfig } from 'modulato/config'
import { localJson } from '@modulato/content-local'

export default defineConfig({
  // content/*.json → typed snapshot. Pull + typegen: npx modulato content
  content: localJson({ dir: 'content' }),
})
