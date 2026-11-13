-- AlterTable
ALTER TABLE "Secret" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "passwordChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "Secret_userId_deletedAt_idx" ON "Secret"("userId", "deletedAt");

-- Los secretos que ya existían toman su fecha de creación como último cambio de contraseña
UPDATE "Secret" SET "passwordChangedAt" = "createdAt";

-- Bitácora inmutable: la base de datos rechaza borrar o alterar registros de auditoría.
-- Solo se permite que userId / secretId pasen a NULL, que es lo que hace PostgreSQL
-- automáticamente (ON DELETE SET NULL) cuando se elimina un usuario o un secreto.
CREATE OR REPLACE FUNCTION auditlog_inmutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'AuditLog es inmutable: no se permite DELETE';
  END IF;

  IF NEW."id" IS DISTINCT FROM OLD."id"
     OR NEW."action" IS DISTINCT FROM OLD."action"
     OR NEW."ipAddress" IS DISTINCT FROM OLD."ipAddress"
     OR NEW."userAgent" IS DISTINCT FROM OLD."userAgent"
     OR NEW."details" IS DISTINCT FROM OLD."details"
     OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
     OR (NEW."userId" IS DISTINCT FROM OLD."userId" AND NEW."userId" IS NOT NULL)
     OR (NEW."secretId" IS DISTINCT FROM OLD."secretId" AND NEW."secretId" IS NOT NULL) THEN
    RAISE EXCEPTION 'AuditLog es inmutable: no se permite modificar registros';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auditlog_inmutable_trg
BEFORE UPDATE OR DELETE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION auditlog_inmutable();
