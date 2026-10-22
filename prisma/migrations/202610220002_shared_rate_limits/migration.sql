CREATE TABLE "RateBucket" (
  "key" TEXT PRIMARY KEY,
  "hits" INTEGER NOT NULL,
  "resetAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "RateBucket_resetAt_idx" ON "RateBucket"("resetAt");
