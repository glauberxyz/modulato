import { transition, resolveTokens } from 'modulato'
import tokens from '../tokens/motion'
import { wordFlight } from '../lib/transitions'

/**
 * Four Screens, One Sheet → The Press on the GPU. The same move as index → chapter, started from the
 * next-chapter card at the tail instead of the contents list: the card wears
 * the index's `.entry` clothes, so the flight finds its words and its
 * abstract without knowing which page it was launched from.
 *
 * NOT symmetric — the reverse is a Back, and the reader going back from
 * /gpu expects /angles's own next-card, not this one played
 * in reverse. Each direction is its own pair.
 */
export default transition({
  async run(ctx) {
    await wordFlight(ctx, resolveTokens(tokens).flight)
  },
})
