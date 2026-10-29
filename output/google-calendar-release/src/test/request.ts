export function jsonRequest(url: string, body: unknown, init: RequestInit = {}) {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    ...init,
  })
}

export function multipartRequest(
  url: string,
  file: { name: string; type: string; bytes: Uint8Array },
  fields: Record<string, string> = {},
) {
  const form = new FormData()
  form.set('file', new File([file.bytes as unknown as BlobPart], file.name, { type: file.type }))
  for (const [key, value] of Object.entries(fields)) form.set(key, value)
  return new Request(url, { method: 'POST', body: form })
}
