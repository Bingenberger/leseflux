CREATE TABLE "SystemSetting" (
  "key"       TEXT NOT NULL,
  "value"     TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

INSERT INTO "SystemSetting" ("key", "value", "updatedAt")
VALUES ('childLoginMethods', 'QR_AND_CODE', CURRENT_TIMESTAMP);
