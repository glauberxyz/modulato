import { Styleguide } from 'modulato/styleguide'
import type from '../../type'
import colors from '../../color'

/**
 * The specimen — the framework's styleguide page, fed this site's tokens.
 *
 * The markup and the chrome ship with Modulato (`modulato/styleguide`), so
 * this file is the data and nothing else. Nothing here says what a style is
 * FOR — the setting is the specification, and where a style gets used is a
 * decision this page has no business restating.
 */
export default function Styles() {
  return <Styleguide type={type} colors={colors} />
}
