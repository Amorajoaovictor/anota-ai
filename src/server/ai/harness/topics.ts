import { randomUUID } from 'node:crypto'

export type MarkdownTopicMetadata = {
  id: string
  title: string
  order: number
}

/** IDs ficam fora do Markdown visual e sobrevivem a edicoes sob o mesmo titulo. */
export function deriveMarkdownTopics(
  markdown: string,
  previous: readonly MarkdownTopicMetadata[] = [],
  createId: () => string = () => randomUUID(),
): MarkdownTopicMetadata[] {
  const titles = [...markdown.matchAll(/^#{1,3}\s+(.+?)\s*$/gmu)].map((match) => match[1]!.trim())
  if (!titles.length) titles.push('Conteudo')

  const unused = new Set(previous.map((topic) => topic.id))
  return titles.map((title, order) => {
    const normalized = normalizeTitle(title)
    const matched = previous.find((topic) => unused.has(topic.id) && normalizeTitle(topic.title) === normalized)
      ?? (titles.length === 1 && previous.length === 1 ? previous[0] : undefined)
    if (matched) unused.delete(matched.id)
    return { id: matched?.id ?? createId(), title, order }
  })
}

export function topicInputsFromMarkdown(
  markdown: string,
  metadata: readonly MarkdownTopicMetadata[],
): Array<{ id: string; text: string }> {
  const headings = [...markdown.matchAll(/^#{1,3}\s+.+?\s*$/gmu)]
  if (!headings.length) {
    const topic = [...metadata].sort((left, right) => left.order - right.order)[0]
    return topic ? [{ id: topic.id, text: markdown.trim() }] : []
  }
  const sections = headings.map((heading, index) => {
    const start = heading.index ?? 0
    const end = headings[index + 1]?.index ?? markdown.length
    return markdown.slice(start, end).trim()
  })
  return [...metadata]
    .sort((left, right) => left.order - right.order)
    .map((topic, index) => ({ id: topic.id, text: sections[index] ?? topic.title }))
}

function normalizeTitle(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR').replace(/\s+/gu, ' ').trim()
}
