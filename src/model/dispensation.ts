import {Dispensation} from "../../generated/prisma";
import {UserInfo} from "../lib/userType";

export async function expireDispensation (tx: any, disp: Dispensation, userInfo: UserInfo) {
	return await tx.Dispensation.update({
		where: { id_dispensation: disp.idDispensation },
		data: {
			status: 'Expired',
			modified_by: userInfo.userName,
			modified_on: new Date()
		}
	});
}

export async function setDispensationNotified (tx: any, disp: Dispensation) {
	return await tx.Dispensation.update({
		where: { id_dispensation: disp.idDispensation },
		data: {
			date_expiry_notified: new Date()
		}
	});
}

export async function getDispensation (prisma: any, id: number) {
	return await prisma.Dispensation.findUnique({
		where: { id_dispensation: id },
		include: {
			subject: true,
			dispensation_has_room : { include: { room: true } },
			dispensation_has_holder: { include: { holder: true } },
			dispensation_has_unit: { include: { unit: { include: { subunpro: { include: { person: true } }, unit_has_cosec: { include: { cosec: true } } } } } },
			dispensation_has_ticket: true
		}
	});
}

export async function getExpiringDispensations (prisma: any, expiringInDays: number = 30) {
	const expirationDay = new Date();
	expirationDay.setDate(expirationDay.getDate() + expiringInDays);

	const conditions: any = {
		date_end: {
			lt: expirationDay     // less than `expiringInDays` from now
		},
		status: 'Active'
	};

	if (expiringInDays !== 0) {
		conditions['date_expiry_notified'] = null;
	}
	return await prisma.Dispensation.findMany({
		where: conditions,
		include: {
			subject: true,
			dispensation_has_room : { include: { room: true } },
			dispensation_has_holder: { include: { holder: true } },
			dispensation_has_unit: { include: { unit: { include: { subunpro: { include: { person: true } }, unit_has_cosec: { include: { cosec: true } } } } } },
			dispensation_has_ticket: true
		}
	});
}
