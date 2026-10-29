/// <reference types="vite/client" />
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { initialState } from '../domain'
import { UnauthorizedError } from '../server/http'
import { globalPaths, projectPaths } from '../navigation'
import AppPage from './AppPage'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), prisma: vi.fn(), projects: vi.fn(), list: vi.fn(), mapping: vi.fn(),
}))
vi.mock('../App', () => ({ default: () => null }))
vi.mock('../lib/auth/server', () => ({ requireCurrentUser: mocks.auth }))
vi.mock('../lib/prisma', () => ({ getPrisma: mocks.prisma }))
vi.mock('../lib/mapping', () => ({ toAppState: mocks.mapping }))
vi.mock('../server/projects', () => ({ listProjects: mocks.projects }))
vi.mock('../server/tasks', () => ({ listTasks: mocks.list }))
vi.mock('../server/milestones', () => ({ listMilestones: mocks.list }))
vi.mock('../server/notes', () => ({ listNotes: mocks.list }))
vi.mock('../server/contexts', () => ({ listContexts: mocks.list }))
vi.mock('../server/inbox', () => ({ listInboxItems: mocks.list }))
vi.mock('../server/meetings', () => ({ listMeetings: mocks.list }))
vi.mock('next/navigation', () => ({
  redirect: (path: string) => { throw new Error(`redirect:${path}`) },
  notFound: () => { throw new Error('not-found') },
}))
const pages = import.meta.glob<{ default: (props: { params: Promise<{ projectId: string }> }) => ReturnType<typeof AppPage> }>('./**/page.tsx')

// Acesso direto não pode contornar login nem abrir projetos de outro dono.
describe('Páginas autenticadas por diretório', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ id: 'owner', name: 'Teste', email: null })
    mocks.prisma.mockReturnValue({ id: 'db' })
    mocks.projects.mockResolvedValue([{ id: 'p1' }])
    mocks.list.mockResolvedValue([])
    mocks.mapping.mockReturnValue(initialState)
  })
  it.each(Object.entries(globalPaths))('acesso direto abre %s com dados do proprietário', async (section, path) => {
    const page = await pages[`.${path}/page.tsx`]!()
    const result = await page.default({ params: Promise.resolve({ projectId: 'p1' }) })
    expect(result.props.initialRoute).toEqual({ kind: 'global', section })
    expect(mocks.projects).toHaveBeenCalledWith({ id: 'db' }, 'owner')
  })
  it.each(Object.entries(projectPaths))('acesso direto preserva projeto em %s', async (section, slug) => {
    const page = await pages[`./projetos/[projectId]${slug ? `/${slug}` : ''}/page.tsx`]!()
    const result = await page.default({ params: Promise.resolve({ projectId: 'p1' }) })
    expect(result.props.initialRoute).toEqual({ kind: 'project', projectId: 'p1', section })
  })
  it('redireciona sessão ausente antes de carregar dados', async () => {
    mocks.auth.mockRejectedValue(new UnauthorizedError())
    await expect(AppPage({ route: { kind: 'global', section: 'Kanban' } })).rejects.toThrow('redirect:/auth/sign-in')
    expect(mocks.prisma).not.toHaveBeenCalled()
  })
  it('retorna 404 para projeto ausente na lista do proprietário', async () => {
    await expect(AppPage({ route: { kind: 'project', projectId: 'outro-dono', section: 'Kanban' } })).rejects.toThrow('not-found')
  })
  it('preserva erro original de autenticação indisponível', async () => {
    const error = new Error('identity provider unavailable', { cause: new Error('connection reset') })
    mocks.auth.mockRejectedValue(error)
    await expect(AppPage()).rejects.toBe(error)
    expect(mocks.prisma).not.toHaveBeenCalled()
  })
})
