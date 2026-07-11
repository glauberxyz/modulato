import { PageOutlet } from 'modulato'
import { Menu } from './shell/Menu'
import { Marker } from './shell/Marker'
import { Scene } from './shell/Scene'
import './styles/global.scss'

export default function App() {
  return (
    <>
      <Menu />
      <Marker />
      <Scene />
      <PageOutlet />
    </>
  )
}
