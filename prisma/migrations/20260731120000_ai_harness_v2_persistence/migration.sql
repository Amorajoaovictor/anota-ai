-- CreateEnum
CREATE TYPE "AiRunStatus" AS ENUM ('RECEIVED', 'TRANSCRIBING', 'TRANSCRIBED', 'ORGANIZING', 'AWAITING_MARKDOWN_APPROVAL', 'RETRIEVING_REFERENCES', 'MATERIALIZING', 'AWAITING_ENTITY_APPROVAL', 'EXECUTING', 'PROCESSED', 'FAILED', 'DISCARDED');
CREATE TYPE "AiRunStep" AS ENUM ('TRANSCRIBING', 'ORGANIZING', 'RETRIEVING_REFERENCES', 'MATERIALIZING', 'EXECUTING', 'CLEANING_AUDIO');
CREATE TYPE "TranscriptSource" AS ENUM ('TEXT', 'STT');
CREATE TYPE "AiRevisionSource" AS ENUM ('AI', 'USER');
CREATE TYPE "AiApprovalType" AS ENUM ('MARKDOWN', 'ENTITIES');
CREATE TYPE "AiExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "ProposalOperation" AS ENUM ('CREATE', 'LINK');
CREATE TYPE "ProposalEntityType" AS ENUM ('TASK', 'MEETING', 'NOTE', 'MILESTONE', 'PROJECT', 'ALIAS', 'MODULE', 'TAG', 'CONTEXT', 'DEPENDENCY', 'TASK_MILESTONE');

-- CreateTable
CREATE TABLE "Meeting" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "projectId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3),
  "durationMinutes" INTEGER,
  "timezone" TEXT NOT NULL,
  "link" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiRun" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "inboxItemId" TEXT NOT NULL,
  "status" "AiRunStatus" NOT NULL DEFAULT 'RECEIVED',
  "version" INTEGER NOT NULL DEFAULT 0,
  "failedStep" "AiRunStep",
  "errorCode" TEXT,
  "retryable" BOOLEAN NOT NULL DEFAULT false,
  "activeTranscriptId" TEXT,
  "activeMarkdownRevisionId" TEXT,
  "activeProposalRevisionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "discardedAt" TIMESTAMP(3),
  "processedAt" TIMESTAMP(3),
  CONSTRAINT "AiRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TranscriptRevision" (
  "id" TEXT NOT NULL,
  "aiRunId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "source" "TranscriptSource" NOT NULL,
  "provider" TEXT,
  "model" TEXT,
  "language" TEXT,
  "durationMs" INTEGER,
  "inputBytes" INTEGER NOT NULL,
  "tokenCount" INTEGER NOT NULL,
  "speakerSegments" JSONB,
  "timestamps" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TranscriptRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarkdownRevision" (
  "id" TEXT NOT NULL,
  "aiRunId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "parentRevisionId" TEXT,
  "source" "AiRevisionSource" NOT NULL,
  "content" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "tokenCount" INTEGER NOT NULL,
  "topics" JSONB NOT NULL DEFAULT '[]',
  "promptVersion" TEXT,
  "model" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarkdownRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RetrievalSnapshot" (
  "id" TEXT NOT NULL,
  "aiRunId" TEXT NOT NULL,
  "markdownRevisionId" TEXT NOT NULL,
  "queryVersion" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "candidates" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RetrievalSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProposalRevision" (
  "id" TEXT NOT NULL,
  "aiRunId" TEXT NOT NULL,
  "markdownRevisionId" TEXT NOT NULL,
  "retrievalSnapshotId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "parentRevisionId" TEXT,
  "source" "AiRevisionSource" NOT NULL,
  "schemaVersion" INTEGER NOT NULL,
  "rawOutput" JSONB,
  "validatedPlan" JSONB NOT NULL,
  "contentHash" TEXT NOT NULL,
  "promptVersion" TEXT,
  "provider" TEXT,
  "model" TEXT,
  "inputTokens" INTEGER,
  "outputTokens" INTEGER,
  "latencyMs" INTEGER,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProposalRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProposalItem" (
  "id" TEXT NOT NULL,
  "proposalRevisionId" TEXT NOT NULL,
  "localKey" TEXT NOT NULL,
  "entityType" "ProposalEntityType" NOT NULL,
  "operation" "ProposalOperation" NOT NULL,
  "payload" JSONB NOT NULL,
  "dependsOn" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "evidence" JSONB NOT NULL,
  "confidence" JSONB NOT NULL,
  "duplicateCandidates" JSONB NOT NULL,
  "selected" BOOLEAN NOT NULL DEFAULT true,
  "userEdited" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProposalItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiApproval" (
  "id" TEXT NOT NULL,
  "aiRunId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "type" "AiApprovalType" NOT NULL,
  "targetId" TEXT NOT NULL,
  "targetHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiApproval_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiExecution" (
  "id" TEXT NOT NULL,
  "aiRunId" TEXT NOT NULL,
  "proposalRevisionId" TEXT NOT NULL,
  "status" "AiExecutionStatus" NOT NULL DEFAULT 'PENDING',
  "idempotencyKey" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiExecution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EntityOrigin" (
  "id" TEXT NOT NULL,
  "proposalItemId" TEXT NOT NULL,
  "entityType" "ProposalEntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EntityOrigin_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiCallAttempt" (
  "id" TEXT NOT NULL,
  "aiRunId" TEXT NOT NULL,
  "step" "AiRunStep" NOT NULL,
  "attempt" INTEGER NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "promptVersion" TEXT,
  "inputHash" TEXT NOT NULL,
  "providerRequestId" TEXT,
  "inputTokens" INTEGER,
  "outputTokens" INTEGER,
  "latencyMs" INTEGER,
  "estimatedCost" DECIMAL(14,6),
  "technicalResult" TEXT NOT NULL,
  "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiCallAttempt_pkey" PRIMARY KEY ("id")
);

-- ExtendTable
ALTER TABLE "Job"
  ADD COLUMN "ownerId" TEXT,
  ADD COLUMN "aiRunId" TEXT,
  ADD COLUMN "step" "AiRunStep",
  ADD COLUMN "inputVersion" INTEGER,
  ADD COLUMN "inputHash" TEXT,
  ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "leaseExpiresAt" TIMESTAMP(3),
  ADD COLUMN "heartbeatAt" TIMESTAMP(3),
  ADD COLUMN "timeoutMs" INTEGER,
  ADD COLUMN "cancelledAt" TIMESTAMP(3);

-- CreateIndex
-- Índices funcionais usados pelo retrieval v1. O idioma é explícito para que
-- PostgreSQL possa reutilizar o índice na mesma expressão parametrizada.
CREATE INDEX "Task_harness_search_idx" ON "Task" USING GIN (
  to_tsvector('portuguese'::regconfig, coalesce("title", '') || ' ' || coalesce("description", ''))
);
CREATE INDEX "Milestone_harness_search_idx" ON "Milestone" USING GIN (
  to_tsvector('portuguese'::regconfig, coalesce("name", '') || ' ' || coalesce("description", ''))
);
CREATE INDEX "ProjectContext_harness_search_idx" ON "ProjectContext" USING GIN (
  to_tsvector('portuguese'::regconfig, coalesce("title", '') || ' ' || coalesce("content", ''))
);
CREATE INDEX "Meeting_ownerId_startsAt_idx" ON "Meeting"("ownerId", "startsAt");
CREATE INDEX "Meeting_projectId_idx" ON "Meeting"("projectId");
CREATE INDEX "AiRun_ownerId_createdAt_idx" ON "AiRun"("ownerId", "createdAt");
CREATE INDEX "AiRun_status_updatedAt_idx" ON "AiRun"("status", "updatedAt");
CREATE INDEX "AiRun_inboxItemId_createdAt_idx" ON "AiRun"("inboxItemId", "createdAt");
CREATE UNIQUE INDEX "TranscriptRevision_aiRunId_version_key" ON "TranscriptRevision"("aiRunId", "version");
CREATE UNIQUE INDEX "MarkdownRevision_aiRunId_version_key" ON "MarkdownRevision"("aiRunId", "version");
CREATE INDEX "RetrievalSnapshot_aiRunId_createdAt_idx" ON "RetrievalSnapshot"("aiRunId", "createdAt");
CREATE INDEX "RetrievalSnapshot_markdownRevisionId_idx" ON "RetrievalSnapshot"("markdownRevisionId");
CREATE UNIQUE INDEX "ProposalRevision_aiRunId_version_key" ON "ProposalRevision"("aiRunId", "version");
CREATE INDEX "ProposalRevision_markdownRevisionId_idx" ON "ProposalRevision"("markdownRevisionId");
CREATE INDEX "ProposalRevision_retrievalSnapshotId_idx" ON "ProposalRevision"("retrievalSnapshotId");
CREATE UNIQUE INDEX "ProposalItem_proposalRevisionId_localKey_key" ON "ProposalItem"("proposalRevisionId", "localKey");
CREATE UNIQUE INDEX "AiApproval_type_targetId_key" ON "AiApproval"("type", "targetId");
CREATE INDEX "AiApproval_ownerId_createdAt_idx" ON "AiApproval"("ownerId", "createdAt");
CREATE INDEX "AiApproval_aiRunId_idx" ON "AiApproval"("aiRunId");
CREATE UNIQUE INDEX "AiExecution_proposalRevisionId_key" ON "AiExecution"("proposalRevisionId");
CREATE UNIQUE INDEX "AiExecution_idempotencyKey_key" ON "AiExecution"("idempotencyKey");
CREATE INDEX "AiExecution_aiRunId_createdAt_idx" ON "AiExecution"("aiRunId", "createdAt");
CREATE UNIQUE INDEX "EntityOrigin_entityType_entityId_key" ON "EntityOrigin"("entityType", "entityId");
CREATE INDEX "EntityOrigin_proposalItemId_idx" ON "EntityOrigin"("proposalItemId");
CREATE UNIQUE INDEX "AiCallAttempt_aiRunId_step_attempt_key" ON "AiCallAttempt"("aiRunId", "step", "attempt");
CREATE INDEX "AiCallAttempt_aiRunId_createdAt_idx" ON "AiCallAttempt"("aiRunId", "createdAt");
CREATE INDEX "Job_aiRunId_idx" ON "Job"("aiRunId");
CREATE INDEX "Job_status_priority_runAt_idx" ON "Job"("status", "priority", "runAt");

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiRun" ADD CONSTRAINT "AiRun_inboxItemId_fkey" FOREIGN KEY ("inboxItemId") REFERENCES "InboxItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TranscriptRevision" ADD CONSTRAINT "TranscriptRevision_aiRunId_fkey" FOREIGN KEY ("aiRunId") REFERENCES "AiRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarkdownRevision" ADD CONSTRAINT "MarkdownRevision_aiRunId_fkey" FOREIGN KEY ("aiRunId") REFERENCES "AiRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarkdownRevision" ADD CONSTRAINT "MarkdownRevision_parentRevisionId_fkey" FOREIGN KEY ("parentRevisionId") REFERENCES "MarkdownRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RetrievalSnapshot" ADD CONSTRAINT "RetrievalSnapshot_aiRunId_fkey" FOREIGN KEY ("aiRunId") REFERENCES "AiRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RetrievalSnapshot" ADD CONSTRAINT "RetrievalSnapshot_markdownRevisionId_fkey" FOREIGN KEY ("markdownRevisionId") REFERENCES "MarkdownRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProposalRevision" ADD CONSTRAINT "ProposalRevision_aiRunId_fkey" FOREIGN KEY ("aiRunId") REFERENCES "AiRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProposalRevision" ADD CONSTRAINT "ProposalRevision_markdownRevisionId_fkey" FOREIGN KEY ("markdownRevisionId") REFERENCES "MarkdownRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProposalRevision" ADD CONSTRAINT "ProposalRevision_retrievalSnapshotId_fkey" FOREIGN KEY ("retrievalSnapshotId") REFERENCES "RetrievalSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProposalRevision" ADD CONSTRAINT "ProposalRevision_parentRevisionId_fkey" FOREIGN KEY ("parentRevisionId") REFERENCES "ProposalRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProposalItem" ADD CONSTRAINT "ProposalItem_proposalRevisionId_fkey" FOREIGN KEY ("proposalRevisionId") REFERENCES "ProposalRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiApproval" ADD CONSTRAINT "AiApproval_aiRunId_fkey" FOREIGN KEY ("aiRunId") REFERENCES "AiRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiExecution" ADD CONSTRAINT "AiExecution_aiRunId_fkey" FOREIGN KEY ("aiRunId") REFERENCES "AiRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiExecution" ADD CONSTRAINT "AiExecution_proposalRevisionId_fkey" FOREIGN KEY ("proposalRevisionId") REFERENCES "ProposalRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EntityOrigin" ADD CONSTRAINT "EntityOrigin_proposalItemId_fkey" FOREIGN KEY ("proposalItemId") REFERENCES "ProposalItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiCallAttempt" ADD CONSTRAINT "AiCallAttempt_aiRunId_fkey" FOREIGN KEY ("aiRunId") REFERENCES "AiRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Job" ADD CONSTRAINT "Job_aiRunId_fkey" FOREIGN KEY ("aiRunId") REFERENCES "AiRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
