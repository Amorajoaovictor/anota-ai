'use client'

import App from '../../../App'
import { initialState, type Task, type AppState } from '../../../domain'

// Local visual fixture. No API calls or writes to the user's tasks.
const projects = initialState.projects.slice(0, 3)
const examples: Array<[number, string, string, Task['status'], Task['priority']]> = [
  [0, 'Revisar mapa de lotes', '2026-09-30', 'Concluída', 'P1'],
  [0, 'Validar acesso', '2026-10-01', 'Em andamento', 'P2'],
  [0, 'Ajustar dashboard', '2026-10-03', 'Em andamento', 'P1'],
  [0, 'Homologação', '2026-10-05', 'Em andamento', 'P1'],
  [0, 'Ajustar dashboard', '2026-10-07', 'Bloqueada', 'P2'],
  [1, 'Revisar permissões', '2026-10-01', 'Concluída', 'P2'],
  [1, 'Revisar permissões', '2026-10-04', 'Bloqueada', 'P1'],
  [1, 'Ajustar dashboard', '2026-10-05', 'Concluída', 'P2'],
  [1, 'Validar acesso', '2026-10-06', 'Em andamento', 'P2'],
  [2, 'Revisar mapa de lotes', '2026-10-02', 'Em andamento', 'P2'],
  [2, 'Homologação', '2026-10-05', 'Em andamento', 'P1'],
  [2, 'Revisar permissões', '2026-10-07', 'Bloqueada', 'P1'],
  [0, 'Documentar integração', '', 'Backlog', 'P2'],
  [1, 'Refinar requisitos', '', 'Backlog', 'P2'],
  [2, 'Planejar treinamento', '', 'Backlog', 'P3'],
]
export default function RoadmapVisualPreview() {
  const state: AppState = ({ ...initialState, projects, tasks: examples.map(([project, title, due, status, priority], index) => ({ id: `demo-${index}`, title, due, status, priority, project: projects[project].name, color: projects[project].color })), milestones: [{ id: 'demo-milestone', name: 'Homologação CEGEO', project: projects[1].name, targetDate: '2026-10-07', status: 'Planejado', description: 'Marco de demonstração.', color: projects[1].color }] })
  return <App initialState={state} user={{ id: 'impeccable-preview', name: 'João Neri', email: 'ux.review.20260805@example.com' }} />
}
