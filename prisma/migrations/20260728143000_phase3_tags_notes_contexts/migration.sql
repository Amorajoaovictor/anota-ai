-- CreateTable
CREATE TABLE "ProjectTag" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL DEFAULT '#68d7a7',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectTag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskTag" (
  "taskId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  CONSTRAINT "TaskTag_pkey" PRIMARY KEY ("taskId", "tagId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectTag_projectId_name_key" ON "ProjectTag"("projectId", "name");

-- AddForeignKey
ALTER TABLE "ProjectTag" ADD CONSTRAINT "ProjectTag_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskTag" ADD CONSTRAINT "TaskTag_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskTag" ADD CONSTRAINT "TaskTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "ProjectTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
-- Nota passa a exigir projeto (PRD Fase 3: "notas privadas e contextos vinculados a
-- projeto e, opcionalmente, card"). Nenhuma tela jamais gravou nota no banco, então
-- a tabela deve estar vazia; ainda assim a coluna nasce nullable e recebe backfill
-- antes do NOT NULL, para a migração não falhar em base que tenha linhas.
ALTER TABLE "Note" ADD COLUMN "projectId" TEXT;
ALTER TABLE "Note" ADD COLUMN "taskId" TEXT;
ALTER TABLE "Note" ADD COLUMN "position" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Backfill: projeto mais antigo do mesmo dono.
UPDATE "Note" SET "projectId" = (
  SELECT "Project"."id" FROM "Project"
  WHERE "Project"."ownerId" = "Note"."ownerId"
  ORDER BY "Project"."createdAt" ASC
  LIMIT 1
) WHERE "projectId" IS NULL;

-- Nota cujo dono não tem projeto algum não tem destino possível: não existe nota solta.
DELETE FROM "Note" WHERE "projectId" IS NULL;

ALTER TABLE "Note" ALTER COLUMN "projectId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Note_projectId_idx" ON "Note"("projectId");

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Note" ADD CONSTRAINT "Note_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
