export type StorageDriver = {
  put(key: string, bytes: Uint8Array): Promise<void>
  read(key: string): Promise<Uint8Array | null>
  delete(key: string): Promise<void>
  list(prefix: string): Promise<Array<{ key: string; updatedAt: Date }>>
}

const invalidKey = /(^\/)|(^[a-zA-Z]:)|(\\)|(\.\.)/

/** Chaves vêm de `${ownerId}/${id}`; qualquer coisa fora disso tentaria escapar do diretório. */
export function assertSafeKey(key: string) {
  if (!key || invalidKey.test(key)) throw new Error(`Chave de armazenamento inválida: ${key}`)
  return key
}
