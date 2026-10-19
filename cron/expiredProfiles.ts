import {getPrismaForUser} from "../src/lib/auditablePrisma";
import {cronUser} from "./lib/cronUser";
import "dotenv/config";
import {deleteExpiredProfiles} from "../src/model/persons";

const prisma = getPrismaForUser(cronUser);

/**
 * Check for all expired profiles
 *
 * Where “expired” is defined as being still `Active`, but with an
 * expiration date already past.
 *
 * Delete all expired profiles.
 */
async function expireProfiles () {
		console.log(`Expire profiles`);
		await prisma.$transaction(async (tx) => {
			await deleteExpiredProfiles(tx);
		},{
			maxWait: 10000, // Max time (ms) to wait for a transaction slot (default: 2000)
			timeout: 30000, // Max time (ms) the transaction can run (default: 5000)
		});
}

expireProfiles();
