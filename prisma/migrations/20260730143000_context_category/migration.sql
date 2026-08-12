CREATE TYPE "ContextCategory" AS ENUM ('FACT', 'DECISION', 'RULE', 'VOCABULARY', 'MEETING');

ALTER TABLE "ProjectContext"
ADD COLUMN "category" "ContextCategory" NOT NULL DEFAULT 'FACT';
