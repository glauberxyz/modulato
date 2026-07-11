import { PageOutlet } from 'modulato'
import { Menu } from './shell/Menu'
import { Marker } from './shell/Marker'
import './styles/global.scss'

export default function App() {
  return (
    <>
      <Menu />
      <Marker />
      <PageOutlet />
    </>
  )
}
