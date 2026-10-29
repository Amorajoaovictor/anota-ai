import { PrismaClient } from '@prisma/client'

let client: PrismaClient | undefined

export function getPrisma() {
  if (!client) client = new PrismaClient()
  return client
}
