import AppPage from '../../../AppPage'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  return AppPage({ route: { kind: 'project', projectId, section: "Contexto" } })
}
