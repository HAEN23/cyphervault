-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- Las cuentas que ya existían quedan aprobadas; las nuevas empiezan en PENDING
ALTER TABLE "User" ADD COLUMN "status" "AccountStatus" NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "User" ALTER COLUMN "status" SET DEFAULT 'PENDING';
