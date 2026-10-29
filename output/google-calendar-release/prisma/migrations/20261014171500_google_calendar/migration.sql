ALTER TABLE "Meeting" ADD COLUMN "googleEventId" TEXT;
CREATE UNIQUE INDEX "Meeting_googleEventId_key" ON "Meeting"("googleEventId");
CREATE TABLE "GoogleCalendarConnection" (
  "ownerId" TEXT NOT NULL PRIMARY KEY,
  "refreshToken" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "GoogleOAuthState" (
  "stateHash" TEXT NOT NULL PRIMARY KEY,
  "ownerId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "GoogleOAuthState_expiresAt_idx" ON "GoogleOAuthState"("expiresAt");
