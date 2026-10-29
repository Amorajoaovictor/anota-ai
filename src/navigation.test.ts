import { describe, expect, it } from 'vitest'
import { globalPaths, projectPaths, routeFromPath, routeToPath } from './navigation'

// URLs compartilhadas/recargas devem abrir a mesma seção e manter o projeto.
describe('Rotas de navegação', () => {
  it.each(Object.entries(globalPaths))('preserva a seção global %s', (section, path) => {
    const route = routeFromPath(path)
    expect(route).toEqual({ kind: 'global', section })
    expect(routeToPath(route!)).toBe(path)
  })
  it.each(Object.entries(projectPaths))('preserva projeto e seção %s', (section, slug) => {
    const path = `/projetos/projeto%20teste${slug ? `/${slug}` : ''}`
    const route = routeFromPath(path)
    expect(route).toEqual({ kind: 'project', projectId: 'projeto teste', section })
    expect(routeToPath(route!)).toBe(path)
  })
  it('mantém a raiz como entrada para Hoje', () => {
    expect(routeFromPath('/')).toEqual({ kind: 'global', section: 'Hoje' })
  })
  it.each(['/inexistente', '/projetos/p1/inexistente', '/projetos/p1/kanban/extra', '/projetos/%E0%A4%A'])('rejeita URL inválida %s', (path) => {
    expect(routeFromPath(path)).toBeNull()
  })
})
