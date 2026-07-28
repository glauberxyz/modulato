import { transition, resolveTokens } from 'modulato'
import tokens from './home__screen.motion'
import { plateRegistration } from '../lib/transitions'

/**
 * Index → The Screen: plate registration — the index separates into four
 * CMYK ghosts along the screen angles while the chapter lands in register.
 * A dot in the clicked link's ink floods from the exact click point.
 */
export default transition({
  symmetric: true,
  async run(ctx) {
    await plateRegistration(ctx, resolveTokens(tokens).registration)
  },
})
