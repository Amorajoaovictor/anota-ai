import AppPage from '../AppPage'

export const dynamic = 'force-dynamic'

export default function Page() {
  return AppPage({ route: { kind: 'global', section: "Prazos" } })
}
