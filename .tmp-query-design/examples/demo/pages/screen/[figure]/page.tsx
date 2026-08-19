import type { Figure } from '../../../lib/content'
import { PlateView } from '../../../lib/PlateView'

export default function Plate({ figure }: { figure: Figure }) {
  return <PlateView figure={figure} chapter="screen" />
}
