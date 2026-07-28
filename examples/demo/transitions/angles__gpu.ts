import { transition, resolveTokens } from 'modulato'
import tokens from './angles__gpu.motion'
import { paperFeed } from '../lib/transitions'

/** Chapter → chapter: the paper feed. */
export default transition({
  symmetric: true,
  async run(ctx) {
    await paperFeed(ctx, resolveTokens(tokens).feed)
  },
})
