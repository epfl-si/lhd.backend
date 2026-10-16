import {getPrismaForUser} from "../src/lib/auditablePrisma";
import {getExpiringAuthorizations, setAuthorizationNotified} from "../src/model/authorization";
import {sendEmailForAuthorization} from "../src/lib/email/mailer";
import {expiringAuthorization} from "../src/lib/email/EmailTemplates";
import {cronUser} from "./lib/cronUser";
import "dotenv/config";

const prisma = getPrismaForUser(cronUser);

/**
 * Check for all expiring authorizations
 *
 * Where “expiring” is defined as being still `Active`, but with an
 * expiration date either already past, or no later than 30 days from now.
 *
 * For each expiring authorization, notify the related holders.
 */
async function notifyExpiringAuthorizations () {
	const expiringAuths =  await getExpiringAuthorizations(prisma);
	for (const auth of expiringAuths) {
		console.log(`Sending reminders for expiring authorization: ${auth.authorization}`);
		await prisma.$transaction(async (tx) => {
			await sendEmailForAuthorization(auth.modifiedBy, cronUser.userEmail, auth, expiringAuthorization);
			await setAuthorizationNotified(tx, auth);
		},{
			maxWait: 10000, // Max time (ms) to wait for a transaction slot (default: 2000)
			timeout: 30000, // Max time (ms) the transaction can run (default: 5000)
		});
	}
}

notifyExpiringAuthorizations();
