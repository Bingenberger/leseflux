UPDATE "SessionTemplate"
SET "isDefault" = false
WHERE "teacherId" IS NULL
  AND "id" <> 'standard-12-min';

UPDATE "SessionTemplate"
SET "isDefault" = true
WHERE "id" = 'standard-12-min'
  AND "teacherId" IS NULL;
