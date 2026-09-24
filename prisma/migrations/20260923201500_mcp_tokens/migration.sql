CREATE TABLE "McpToken" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "scopes" TEXT[],
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "McpToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "McpToken_tokenHash_key" ON "McpToken"("tokenHash");
CREATE INDEX "McpToken_ownerId_createdAt_idx" ON "McpToken"("ownerId", "createdAt");
