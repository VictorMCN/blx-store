ALTER TABLE "User"
ADD COLUMN "fullName" VARCHAR(150);

UPDATE "User" AS user_record
SET "fullName" = profile."fullName"
FROM "CustomerProfile" AS profile
WHERE
  profile."userId" = user_record."id"
  AND profile."fullName" IS NOT NULL
  AND BTRIM(profile."fullName") <> '';
