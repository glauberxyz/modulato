import { Styleguide } from 'modulato/styleguide'
import type from '../../tokens/type'
import colors from '../../tokens/color'

/**
 * The styleguide: what this site is built out of.
 *
 * The page is Modulato's, not the site's — its markup and styles ship with
 * the framework, so it looks the same in every project and nothing here is
 * to be restyled. It reads `type.ts` and `color.ts`, and renders the specimens
 * through the site's own `.type-*` rules, so it cannot disagree with what the
 * site shows. Motion numbers are not on it: they are worked on live in the
 * overlay (✦), against the animation they drive.
 *
 * Add your own sections as children, with `Section` from the same module.
 * DELETE THIS FOLDER (and the entry in shell/Menu.tsx) if you don't want the
 * page — nothing else imports it.
 */
export default function Page() {
  return <Styleguide type={type} colors={colors} />
}
