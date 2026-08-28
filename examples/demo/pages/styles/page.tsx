import { Styleguide } from 'modulato/styleguide'
import type from '../../type'
import colors from '../../color'
import shell from '../../motion'
import home from '../home/motion'
import press from '../press/motion'
import screen from '../screen/motion'
import angles from '../angles/motion'
import gpu from '../gpu/motion'
import darkroom from '../darkroom/motion'

/**
 * The specimen — the framework's styleguide page, fed this site's tokens.
 *
 * The markup and the chrome ship with Modulato (`modulato/styleguide`), so
 * this file is the data and nothing else: which token modules go on the sheet.
 * Nothing here says what a style is FOR — the setting is the specification,
 * and where a style gets used is a decision this page has no business
 * restating.
 */
export default function Styles() {
  return (
    <Styleguide
      type={type}
      colors={colors}
      motion={{ shell, home, press, screen, angles, gpu, darkroom }}
    />
  )
}
