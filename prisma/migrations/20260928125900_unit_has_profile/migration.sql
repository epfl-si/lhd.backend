-- CreateEnum
CREATE TYPE "Role" AS ENUM ('Cosec', 'Professor');

-- CreateTable
CREATE TABLE "unit_has_profile" (
    "id_unit" INTEGER NOT NULL,
    "id_person" INTEGER NOT NULL,
    "role" "Role" NOT NULL
);

-- CreateIndex
CREATE INDEX "unit_has_profile_id_person_idx" ON "unit_has_profile"("id_person");

-- CreateIndex
CREATE UNIQUE INDEX "unique_unit_has_profile" ON "unit_has_profile"("id_unit", "id_person", "role");

-- AddForeignKey
ALTER TABLE "unit_has_profile" ADD CONSTRAINT "unit_has_profile_ibfk_1" FOREIGN KEY ("id_unit") REFERENCES "unit"("id_unit") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "unit_has_profile" ADD CONSTRAINT "unit_has_profile_ibfk_2" FOREIGN KEY ("id_person") REFERENCES "person"("id_person") ON DELETE RESTRICT ON UPDATE RESTRICT;
