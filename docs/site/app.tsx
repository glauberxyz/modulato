import { PageOutlet } from 'modulato'
import { Links } from './shell/Links'
import './styles/global.scss'

export default function App() {
  return (
    <>
      <Links />
      <PageOutlet />
    </>
  )
}
