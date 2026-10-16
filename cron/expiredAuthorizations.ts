import { getPrismaForUser } from "../src/lib/auditablePrisma";
import {cronUser} from "./lib/cronUser";
import {expireAuthorization, getExpiringAuthorizations} from "../src/model/authorization";
import {sendEmailForAuthorization} from "../src/lib/email/mailer";
import {expiredAuthorization} from "../src/lib/email/EmailTemplates";
import "dotenv/config";

const prisma = getPrismaForUser(cronUser);

/**
 * Check for all expired authorizations
 *
 * Where “expired” is defined as being still `Active`, but with an
 * expiration date already past.
 *
 * For each expired authorization, update its status to `Expired` and notify
 * the related holders.
 */
async function expireAndNotifyAuthorizations () {
	const expiredAuths =  await getExpiringAuthorizations(prisma, 0);
	for (const auth of expiredAuths) {
		console.log(`Expire authorization: ${auth.authorization}`);
		await prisma.$transaction(async (tx) => {
			const updated = await expireAuthorization(tx, auth);
			await sendEmailForAuthorization(cronUser.name, cronUser.userEmail, updated, expiredAuthorization);
		},{
			maxWait: 10000, // Max time (ms) to wait for a transaction slot (default: 2000)
			timeout: 30000, // Max time (ms) the transaction can run (default: 5000)
		});
	}
}

expireAndNotifyAuthorizations();
