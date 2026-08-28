import { Styleguide } from 'modulato/styleguide'
import type from '../../type'
import colors from '../../color'
import motion from '../../motion'

/**
 * The styleguide: what this site is built out of.
 *
 * The page is Modulato's, not the site's — its markup and styles ship with
 * the framework, so it looks the same in every project and nothing here is
 * to be restyled. It reads `type.ts`, `color.ts` and the motion modules you
 * hand it, and renders the specimens through the site's own `.type-*` rules,
 * so it cannot disagree with what the site shows.
 *
 * Add a page's tokens to the sheet by importing its `motion.ts` and naming it
 * in `motion`. Add your own sections as children, with `Section` from the
 * same module. DELETE THIS FOLDER (and the entry in shell/Menu.tsx) if you
 * don't want the page — nothing else imports it.
 */
export default function Page() {
  return <Styleguide type={type} colors={colors} motion={{ shell: motion }} />
}
