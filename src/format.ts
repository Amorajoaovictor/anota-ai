export function slug(value: string): string {
  return value.toLocaleLowerCase().replaceAll(' ', '-').normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function formatDate(value: string): string {
  const [year, month, day] = value.split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}

export const statusClass = slug

export function formatHistoryDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

/** Aliases e módulos são digitados como lista separada por vírgula. */
export function splitList(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

export function compareDue(left: string, right: string) {
  const [leftDay, leftMonth] = left.split('/')
  const [rightDay, rightMonth] = right.split('/')
  return `${leftMonth}${leftDay}`.localeCompare(`${rightMonth}${rightDay}`)
}
