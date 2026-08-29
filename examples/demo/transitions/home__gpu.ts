import { transition, resolveTokens } from 'modulato'
import tokens from '../tokens/motion'
import { wordFlight } from '../lib/transitions'

/**
 * Index → The Press on the GPU. The title's words fly from the contents list to the top
 * of the chapter, scaling up and stacking as they go; the abstract follows
 * and lands beneath them. Symmetric, so the way back reverses it.
 */
export default transition({
  symmetric: true,
  async run(ctx) {
    await wordFlight(ctx, resolveTokens(tokens).flight)
  },
})
