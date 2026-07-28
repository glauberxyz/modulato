import { transition, resolveTokens } from 'modulato'
import tokens from './screen__angles.motion'
import { paperFeed } from '../lib/transitions'

/** Chapter → chapter: the paper feed. */
export default transition({
  symmetric: true,
  async run(ctx) {
    await paperFeed(ctx, resolveTokens(tokens).feed)
  },
})
