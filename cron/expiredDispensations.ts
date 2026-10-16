import { getPrismaForUser } from "../src/lib/auditablePrisma";
import {cronUser} from "./lib/cronUser";
import {expireDispensation, getDispensation, getExpiringDispensations} from "../src/model/dispensation";
import {sendEmailForDispensation} from "../src/lib/email/mailer";
import "dotenv/config";

const prisma = getPrismaForUser(cronUser);

/**
 * Check for all expired dispensations
 *
 * Where “expired” is defined as being still `Active`, but with an
 * expiration date already past.
 *
 * For each expired dispensation, update its status to `Expired` and notify
 * the related holders.
 */
export async function expireAndNotifyDispensations () {
	const expiredDisps =  await getExpiringDispensations(prisma, 0);
	for (const disp of expiredDisps) {
		console.log(`Expire dispensation: DISP-${disp.idDispensation}`);
		const updated = await getDispensation(prisma, disp.idDispensation);
		await prisma.$transaction(async (tx) => {
			await expireDispensation(tx, disp, cronUser);
			await sendEmailForDispensation(cronUser.name, cronUser.userEmail, updated, 'expiredDispensation');
		},{
			maxWait: 10000, // Max time (ms) to wait for a transaction slot (default: 2000)
			timeout: 30000, // Max time (ms) the transaction can run (default: 5000)
		});
	}
}

expireAndNotifyDispensations();
