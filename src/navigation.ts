import type { Phase1Section, ProjectSection } from './phase1'

export type Section = 'Hoje' | Phase1Section
export type Route =
  | { kind: 'global'; section: Section }
  | { kind: 'project'; projectId: string; section: ProjectSection }

export const globalPaths: Record<Section, string> = {
  "Hoje": "/hoje",
  "Projetos": "/projetos",
  "Planilha": "/planilha",
  "Kanban": "/kanban",
  "Marcos": "/marcos",
  "Roadmap": "/roadmap",
  "Prazos": "/prazos",
  "Calendário": "/calendario",
  "Reuniões": "/reunioes",
  "Notas": "/notas",
  "Caixa de entrada": "/caixa-de-entrada",
  "Revisão IA": "/revisao-ia",
  "Integrações": "/integracoes"
}
export const projectPaths: Record<ProjectSection, string> = {
  "Visão geral": "",
  "Planilha": "planilha",
  "Kanban": "kanban",
  "Marcos": "marcos",
  "Reuniões": "reunioes",
  "Roadmap": "roadmap",
  "Prazos": "prazos",
  "Calendário": "calendario",
  "Notas": "notas",
  "Contexto": "contexto"
}

export function routeToPath(route: Route): string {
  if (route.kind === 'global') return globalPaths[route.section]
  const section = projectPaths[route.section]
  return `/projetos/${encodeURIComponent(route.projectId)}${section ? `/${section}` : ''}`
}

export function routeFromPath(pathname: string): Route | null {
  const path = pathname.replace(/\/$/, '') || '/'
  if (path === '/') return { kind: 'global', section: 'Hoje' }
  const global = Object.entries(globalPaths).find(([, value]) => value === path)
  if (global) return { kind: 'global', section: global[0] as Section }
  const match = /^\/projetos\/([^/]+)(?:\/([^/]+))?$/.exec(path)
  if (!match) return null
  const project = Object.entries(projectPaths).find(([, value]) => value === (match[2] ?? ''))
  if (!project) return null
  try {
    return { kind: 'project', projectId: decodeURIComponent(match[1]!), section: project[0] as ProjectSection }
  } catch {
    // Um segmento malformado não representa uma rota da aplicação.
    return null
  }
}
