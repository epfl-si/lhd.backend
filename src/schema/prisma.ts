import "dotenv/config";
import {PrismaPg} from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma";

const adapter = new PrismaPg({ connectionString: process.env.LHD_DB_URL });
const prisma = new PrismaClient({
  adapter
});

export { prisma };
