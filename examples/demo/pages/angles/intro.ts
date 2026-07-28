import { intro } from 'modulato'
import { chapterIntro } from '../../lib/chapter-intro'
import tokens from './motion'

/** First load only — navigations use transitions/ instead. */
export default intro({
  async run({ element }) {
    await chapterIntro(element, tokens)
  },
})
