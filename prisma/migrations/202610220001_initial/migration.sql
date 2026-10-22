CREATE TYPE "Status" AS ENUM ('AWAITING_PAYMENT','UNDER_REVIEW','APPROVED','REJECTED');
CREATE TABLE "Settings" (
 "id" INTEGER PRIMARY KEY DEFAULT 1 CHECK ("id" = 1), "name" TEXT NOT NULL DEFAULT 'DHANDALSHA PREMIER LEAGUE',
 "description" TEXT NOT NULL DEFAULT 'Cricket. Community. A new chapter.', "fee" INTEGER NOT NULL DEFAULT 100 CHECK ("fee">0),
 "capacity" INTEGER NOT NULL DEFAULT 150 CHECK ("capacity">0), "open" BOOLEAN NOT NULL DEFAULT true,
 "opensAt" TIMESTAMP(3), "closesAt" TIMESTAMP(3), "rules" TEXT NOT NULL DEFAULT 'আয়োজকের অনুমোদিত নিয়মাবলি শীঘ্রই প্রকাশিত হবে।',
 "contact" TEXT NOT NULL DEFAULT '', "fields" JSONB NOT NULL DEFAULT '{}',
 CONSTRAINT "valid_window" CHECK ("opensAt" IS NULL OR "closesAt" IS NULL OR "opensAt" < "closesAt")
);
CREATE TABLE "Registration" (
 "id" TEXT PRIMARY KEY, "reference" TEXT NOT NULL, "mobile" TEXT NOT NULL CHECK ("mobile" ~ '^[6-9][0-9]{9}$'),
 "fullName" TEXT NOT NULL, "team" TEXT NOT NULL DEFAULT '', "data" JSONB NOT NULL, "fee" INTEGER NOT NULL CHECK ("fee">0),
 "status" "Status" NOT NULL DEFAULT 'AWAITING_PAYMENT', "tokenHash" TEXT NOT NULL, "requestKey" TEXT NOT NULL, "requestHash" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "Registration_reference_key" ON "Registration"("reference");
CREATE UNIQUE INDEX "Registration_mobile_key" ON "Registration"("mobile");
CREATE UNIQUE INDEX "Registration_tokenHash_key" ON "Registration"("tokenHash");
CREATE UNIQUE INDEX "Registration_requestKey_key" ON "Registration"("requestKey");
CREATE INDEX "Registration_status_createdAt_idx" ON "Registration"("status","createdAt");
CREATE INDEX "Registration_fullName_idx" ON "Registration"("fullName");
CREATE TABLE "Payment" (
 "id" TEXT PRIMARY KEY, "registrationId" TEXT NOT NULL REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "transactionId" TEXT NOT NULL, "storageKey" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Payment_transactionId_key" ON "Payment"("transactionId");
CREATE UNIQUE INDEX "Payment_storageKey_key" ON "Payment"("storageKey");
CREATE INDEX "Payment_registrationId_createdAt_idx" ON "Payment"("registrationId","createdAt");
CREATE TABLE "Admin" ("id" TEXT PRIMARY KEY,"email" TEXT NOT NULL,"passwordHash" TEXT NOT NULL);
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");
CREATE TABLE "Session" (
 "tokenHash" TEXT PRIMARY KEY,"adminId" TEXT NOT NULL REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE,"expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE TABLE "Verification" (
 "id" TEXT PRIMARY KEY,"registrationId" TEXT NOT NULL REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "adminId" TEXT NOT NULL REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE,"status" "Status" NOT NULL,
 "reason" TEXT NOT NULL DEFAULT '',"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "Audit" ("id" TEXT PRIMARY KEY,"adminId" TEXT NOT NULL,"action" TEXT NOT NULL,"target" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "Audit_createdAt_idx" ON "Audit"("createdAt");
INSERT INTO "Settings"("id") VALUES (1);
-- Defence in depth: all approval writers serialize on this one settings row.
CREATE FUNCTION enforce_approved_capacity() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE max_players INTEGER;
BEGIN
 IF NEW."status" = 'APPROVED' THEN
  IF TG_OP = 'UPDATE' THEN
   IF OLD."status" = 'APPROVED' THEN RETURN NEW; END IF;
  END IF;
  SELECT "capacity" INTO max_players FROM "Settings" WHERE "id" = 1 FOR UPDATE;
  IF max_players IS NULL OR (SELECT count(*) FROM "Registration" WHERE "status" = 'APPROVED') >= max_players THEN
   RAISE EXCEPTION 'Accepted registration capacity exceeded' USING ERRCODE = '23514';
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER registration_capacity BEFORE INSERT OR UPDATE OF "status" ON "Registration" FOR EACH ROW EXECUTE FUNCTION enforce_approved_capacity();
CREATE FUNCTION enforce_settings_capacity() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."capacity" < (SELECT count(*) FROM "Registration" WHERE "status" = 'APPROVED') THEN
  RAISE EXCEPTION 'Capacity cannot be lower than approved registrations' USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER settings_capacity BEFORE UPDATE OF "capacity" ON "Settings" FOR EACH ROW EXECUTE FUNCTION enforce_settings_capacity();
