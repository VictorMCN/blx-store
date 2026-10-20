ALTER TABLE "User"
ADD COLUMN "emailVerificationTokenHash" VARCHAR(64),
ADD COLUMN "emailVerificationExpiresAt" TIMESTAMPTZ(3);

UPDATE "User"
SET "emailVerifiedAt" = CURRENT_TIMESTAMP
WHERE "emailVerifiedAt" IS NULL;

CREATE UNIQUE INDEX "User_emailVerificationTokenHash_key"
ON "User"("emailVerificationTokenHash");
