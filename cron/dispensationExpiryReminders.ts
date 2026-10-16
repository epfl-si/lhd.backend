import {cronUser} from "./lib/cronUser";
import {getPrismaForUser} from "../src/lib/auditablePrisma";
import {getExpiringDispensations, setDispensationNotified} from "../src/model/dispensation";
import {sendEmailForDispensation} from "../src/lib/email/mailer";
import "dotenv/config";

const prisma = getPrismaForUser(cronUser);

/**
 * Check for all expiring dispensations
 *
 * Where “expiring” is defined as being still `Active`, but with an
 * expiration date either already past, or no later than 30 days from now.
 *
 * For each expiring dispensation, notify the related holders.
 */
async function notifyExpiringDispensations () {
	const expiringDisps =  await getExpiringDispensations(prisma);
	for (const disp of expiringDisps) {
		console.log(`Sending reminder for expiring dispensation: DISP-${disp.idDispensation}`);
		await prisma.$transaction(async (tx) => {
			await sendEmailForDispensation(disp.modifiedBy, cronUser.userEmail, disp, 'expiringDispensation');
			await setDispensationNotified(tx, disp);
		},{
			maxWait: 10000, // Max time (ms) to wait for a transaction slot (default: 2000)
			timeout: 30000, // Max time (ms) the transaction can run (default: 5000)
		});
	}
}

notifyExpiringDispensations();
