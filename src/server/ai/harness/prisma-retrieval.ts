import { Prisma } from '@prisma/client'
import {
  InMemoryRetrievalProvider,
  type RetrievalProvider,
  type RetrievalRequest,
  type RetrievalResult,
  type RetrievalSource,
  type RetrievalReferenceType,
} from './retrieval'

type FullTextRow = {
  id: string
  kind: RetrievalReferenceType
  projectId: string
  title: string
  content: string | null
  updatedAt: Date | string
}

type PrismaRetrievalRepository = {
  project: { findMany(args: any): Promise<any[]> }
  projectAlias: { findMany(args: any): Promise<any[]> }
  projectModule: { findMany(args: any): Promise<any[]> }
  projectTag: { findMany(args: any): Promise<any[]> }
  $queryRaw<T = unknown>(query: Prisma.Sql): Promise<T>
}

/** Exact via Prisma e full-text via PostgreSQL, ambos isolados por owner. */
export class PrismaRetrievalProvider implements RetrievalProvider {
  constructor(private readonly repository: PrismaRetrievalRepository) {}

  async retrieve(input: RetrievalRequest): Promise<RetrievalResult> {
    const [projects, aliases, modules, tags, fullText] = await Promise.all([
      this.repository.project.findMany({
        where: { ownerId: input.ownerId, status: 'ACTIVE' },
        select: { id: true, ownerId: true, name: true, updatedAt: true },
      }),
      this.repository.projectAlias.findMany({
        where: { project: { ownerId: input.ownerId, status: 'ACTIVE' } },
        select: { id: true, value: true, createdAt: true, projectId: true },
      }),
      this.repository.projectModule.findMany({
        where: { project: { ownerId: input.ownerId, status: 'ACTIVE' } },
        select: { id: true, name: true, createdAt: true, projectId: true },
      }),
      this.repository.projectTag.findMany({
        where: { project: { ownerId: input.ownerId, status: 'ACTIVE' } },
        select: { id: true, name: true, createdAt: true, projectId: true },
      }),
      this.loadFullText(input),
    ])

    const sources: RetrievalSource[] = [
      ...projects.map((project) => ({
        id: project.id, ownerId: input.ownerId, kind: 'PROJECT' as const, title: project.name,
        active: true, updatedAt: iso(project.updatedAt),
      })),
      ...aliases.map((alias) => ({
        id: alias.id, ownerId: input.ownerId, kind: 'ALIAS' as const, projectId: alias.projectId,
        title: alias.value, active: true, updatedAt: iso(alias.createdAt),
      })),
      ...modules.map((module) => ({
        id: module.id, ownerId: input.ownerId, kind: 'MODULE' as const, projectId: module.projectId,
        title: module.name, active: true, updatedAt: iso(module.createdAt),
      })),
      ...tags.map((tag) => ({
        id: tag.id, ownerId: input.ownerId, kind: 'TAG' as const, projectId: tag.projectId,
        title: tag.name, active: true, updatedAt: iso(tag.createdAt),
      })),
      ...fullText.map((row) => ({
        id: row.id,
        ownerId: input.ownerId,
        kind: row.kind,
        projectId: row.projectId,
        title: row.title,
        content: row.content ?? undefined,
        approved: row.kind === 'CONTEXT' ? true : undefined,
        updatedAt: iso(row.updatedAt),
      })),
    ]
    return new InMemoryRetrievalProvider(deduplicate(sources)).retrieve(input)
  }

  private async loadFullText(input: RetrievalRequest): Promise<FullTextRow[]> {
    const rows: FullTextRow[] = []
    const limit = Math.min(300, Math.max(10, input.limits.perTopic * input.limits.perType * 2))
    for (const topic of input.topics) {
      if (!topic.text.trim()) continue
      const matches = await this.repository.$queryRaw<FullTextRow[]>(Prisma.sql`
        SELECT * FROM (
          SELECT t."id", 'TASK'::text AS "kind", t."projectId", t."title",
                 t."description" AS "content", t."updatedAt"
          FROM "Task" t
          INNER JOIN "Project" p ON p."id" = t."projectId"
          WHERE p."ownerId" = ${input.ownerId}
            AND to_tsvector('portuguese', coalesce(t."title", '') || ' ' || coalesce(t."description", ''))
                @@ websearch_to_tsquery('portuguese', ${topic.text})
          UNION ALL
          SELECT m."id", 'MILESTONE'::text AS "kind", m."projectId", m."name" AS "title",
                 m."description" AS "content", m."updatedAt"
          FROM "Milestone" m
          INNER JOIN "Project" p ON p."id" = m."projectId"
          WHERE p."ownerId" = ${input.ownerId}
            AND to_tsvector('portuguese', coalesce(m."name", '') || ' ' || coalesce(m."description", ''))
                @@ websearch_to_tsquery('portuguese', ${topic.text})
          UNION ALL
          SELECT c."id", 'CONTEXT'::text AS "kind", c."projectId", c."title",
                 c."content", c."updatedAt"
          FROM "ProjectContext" c
          INNER JOIN "Project" p ON p."id" = c."projectId"
          WHERE p."ownerId" = ${input.ownerId}
            AND to_tsvector('portuguese', coalesce(c."title", '') || ' ' || coalesce(c."content", ''))
                @@ websearch_to_tsquery('portuguese', ${topic.text})
        ) AS matches
        ORDER BY matches."updatedAt" DESC
        LIMIT ${limit}
      `)
      rows.push(...matches)
    }
    return deduplicate(rows)
  }
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function deduplicate<T extends { id: string; kind: string }>(items: readonly T[]): T[] {
  return [...new Map(items.map((item) => [`${item.kind}:${item.id}`, item])).values()]
}
