import { PageOutlet } from 'modulato'
import { RunningHead } from './shell/RunningHead'
import { PlateMarker } from './shell/PlateMarker'
import './styles/global.scss'

export default function App() {
  return (
    <>
      {/* The shell: mounted once, never unmounts, reacts to the route. */}
      <RunningHead />
      <PlateMarker />
      <PageOutlet />
    </>
  )
}
