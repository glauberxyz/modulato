import { PageOutlet } from 'modulato'
import { GpuStage } from '@modulato/gpu'
import { RunningHead } from './shell/RunningHead'
import { ScrollBar } from './shell/ScrollBar'
import './styles/global.scss'

export default function App() {
  return (
    <>
      {/* The shell: mounted once, never unmounts, reacts to the route. */}
      <RunningHead />
      <ScrollBar />
      <PageOutlet />
      {/* Draws the plates (lib/PlaneImg) over the pages, wherever they are. */}
      <GpuStage />
    </>
  )
}
