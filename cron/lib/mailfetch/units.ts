import {cronUser} from "../cronUser";
import {getPrismaForUser} from "../../../src/lib/auditablePrisma";
import { findSingleUnitByName } from "../../../src/model/units";

import "dotenv/config";

const prisma = getPrismaForUser(cronUser);

export async function unitIdByName (nameUnit: string | null): Promise<number | null> {
  if (!nameUnit) {
    return null;
  }
  const unit = await findSingleUnitByName(prisma, nameUnit);
  return unit?.id;
}
