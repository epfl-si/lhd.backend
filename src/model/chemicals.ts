import {AuthChem} from "../../generated/prisma";
import {sendEmailsForChemical} from "../lib/email/mailer";

export async function createChemical (chemical: AuthChem, {prisma, user}: any) {
	const newChem = await prisma.$transaction(async (tx: any) => {
		return await tx.auth_chem.create({
			data: {
				cas_auth_chem: chemical.casAuthChem,
				auth_chem_en: chemical.authChemEn,
				flag_auth_chem: chemical.flagAuthChem,
				fastway: chemical.fastway ?? false,
				auth_code: chemical.authCode
			}
		});
	});
	await sendEmailsForChemical(prisma, user.username, undefined, newChem);
}

export async function getChemicals (prisma: any, opts?: Partial<{
	name: string;
	status: boolean;
	cas: string;
	fastway: string;
	authCode: string;
	take: number;
	skip: number;
}>) {
	const { name, status, cas, fastway, authCode, take, skip } = opts || {};
	const whereCondition = [];
	if (cas) {
		whereCondition.push({ cas_auth_chem: { contains: cas }})
	}
	if (name) {
		whereCondition.push({ auth_chem_en : { contains: name }})
	}
	if (status !== undefined) {
		whereCondition.push({ flag_auth_chem : status })
	}
	if (fastway) {
		whereCondition.push({ fastway: ['yes', '1', 'true'].indexOf(fastway.toLowerCase()) > -1})
	}
	if (authCode) {
		whereCondition.push({ auth_code: { contains: authCode }})
	}

	const chemicalList = await prisma.auth_chem.findMany({
		where: {
			AND: whereCondition
		},
		orderBy: [
			{
				cas_auth_chem: 'asc',
			},
		]
	});

	const chemicals = take == 0 || !take ? chemicalList : chemicalList.slice(skip, (skip ?? 0) + take);
	const totalCount = chemicalList.length;

	return { chemicals, totalCount };
}
