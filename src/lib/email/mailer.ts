import * as nodemailer from "nodemailer";
import {
	cancelledDispensation,
	chemical,
	expiredDispensation,
	expiringDispensation,
	hazardsCae,
	hazardsCosec,
	logAction,
	logRecipients,
	modifiedDispensation,
	newDispensation,
	renewDispensation
} from "./EmailTemplates";
import {getFormattedDate} from "../date";
import {AuthChem, UnitHasProfile} from "../../../generated/prisma";
import {getHazardLevel} from "../hazardsParser";
import {getRoomWithHazards} from "../../model/rooms";
import {getUserString, UserInfo} from "../userType";
import "dotenv/config";

export const mailer = nodemailer.createTransport({
	host: process.env.SMTP_HOST,
	port: Number(process.env.SMTP_PORT) || 587,
	secure: false,
	auth: {
		user: process.env.SMTP_USER,
		pass: process.env.LHD_API_PASSWORD
	},
});

async function sendEmailCAE (modifiedByName: string,
														modifiedByEmail: string,
														room: string,
														action: {'fr': string, 'en': string},
														hazardType: string,
														comments: string) {
	const template = hazardsCae;

	const body = template.body.replaceAll("{{modifiedByName}}", modifiedByName)
		.replaceAll("{{modifiedOn}}", getFormattedDate(new Date()))
		.replaceAll("{{room}}", room)
		.replaceAll("{{action.fr}}", action['fr'])
		.replaceAll("{{action.en}}", action['en'])
		.replaceAll("{{hazardType}}", hazardType)
		.replaceAll("{{comments}}", decodeURIComponent(comments))
		.replaceAll('\n', '<br />');

	await mailer.sendMail({
		from: `"LHD" <${process.env.SMTP_USER}>`,
		to: process.env.ENVIRONMENT === 'prod' ? process.env.CAE_TO : modifiedByEmail,
		cc: process.env.ENVIRONMENT === 'prod' ? [modifiedByEmail, process.env.CAE_CC!] : modifiedByEmail,
		subject: template.subject,
		html: process.env.ENVIRONMENT === 'prod' ? body : `${logRecipients([process.env.CAE_TO!], [modifiedByEmail, process.env.CAE_CC!], [])}\n${body}`
	});
}

async function sendEmailCosec (modifiedByName: string,
															modifiedByEmail: string,
															room: string,
															action: {'fr': string, 'en': string},
															hazardType: string,
															cosecs: string[]) {
	const template = hazardsCosec;

	const body = template.body.replaceAll("{{modifiedByName}}", modifiedByName)
		.replaceAll("{{modifiedOn}}", getFormattedDate(new Date()))
		.replaceAll("{{room}}", room)
		.replaceAll("{{action.fr}}", action['fr'])
		.replaceAll("{{action.en}}", action['en'])
		.replaceAll("{{hazardType}}", hazardType)
		.replaceAll('\n', '<br />');

	await mailer.sendMail({
		from: `"LHD" <${process.env.SMTP_USER}>`,
		to: process.env.ENVIRONMENT === 'prod' ? cosecs : modifiedByEmail,
		bcc: process.env.ENVIRONMENT === 'prod' ? [modifiedByEmail, process.env.COSEC_BCC!] : modifiedByEmail,
		subject: template.subject,
		html: process.env.ENVIRONMENT === 'prod' ? body : `${logRecipients(cosecs, [], [modifiedByEmail, process.env.COSEC_BCC!] )}\n${body}`
	});
}

export async function sendEmailsForHazards (
	prisma: any,
	args: any,
	oldRoom: any,
	cosecs: string[],
	userInfo: UserInfo
) {
	if ( process.env.HAZARD_TYPES_TO_EMAIL_AFTER_UPDATE!.includes(args.category) ) {
		const newRoom = await getRoomWithHazards(prisma, args.room);

		const oldValues = getHazardLevel(oldRoom.labHasHazards, args.category);
		const newValues = getHazardLevel(newRoom.labHasHazards, args.category);
		const created = (oldValues.laser.length == 0 && newValues.laser.length > 0) || (oldValues.bio.length == 0 && newValues.bio.length > 0);
		const deleted = (oldValues.laser.length > 0 && newValues.laser.length == 0) || (oldValues.bio.length > 0 && newValues.bio.length == 0);
		if ( created || deleted ) {
			if ( userInfo.userEmail !== '' ) {
				if (!newRoom.labHasHazardsAdditionalInfo
					.find((info: any) => info.hazardCategory.hazardCategoryName === args.category)
					.hazardsAdditionalInfoHasTag
					.find((t: any) => t.tag.tagName === 'Exception AxS')) {
					await sendEmailCAE(getUserString(userInfo), userInfo.userEmail, args.room,
						logAction(created, deleted), args.category, args.additionalInfo.comment);
				}
				await sendEmailCosec(getUserString(userInfo), userInfo.userEmail, args.room,
					logAction(created, deleted), args.category, cosecs);
			}
		}
	}
}

export async function sendEmailsForChemical (prisma: any, userEmail: string, oldChemical?: AuthChem, newChemical?: AuthChem) {
	const chemicals = await prisma.AuthChem.findMany({where: {flagAuthChem: true}});
	const template = chemical;
	const body = template.body
		.replaceAll("{{action}}", oldChemical && newChemical ?
			'Mise à jour' : (oldChemical ? 'Suppression' : 'Création'))
		.replaceAll("{{oldValue}}", oldChemical ?
			`Ancien valeur: ${oldChemical.casAuthChem} - ${oldChemical.authChemEn} (${oldChemical.flagAuthChem ? 'Actif' : 'Archivé'})` :
			'')
		.replaceAll("{{newValue}}", newChemical ?
			`Nouvelle valeur: ${newChemical.casAuthChem} - ${newChemical.authChemEn} (${newChemical.flagAuthChem ? 'Actif' : 'Archivé'})` :
			'');

	const csv: string = chemicals.map((chem: AuthChem) => `${chem.casAuthChem},"${chem.authChemEn}"`).join('\n');

	if (userEmail !== '') {
		await mailer.sendMail({
			from: `"LHD" <${process.env.SMTP_USER}>`,
			to: process.env.ENVIRONMENT === 'prod' ? process.env.CATALYSE_EMAIL : userEmail,
			subject: template.subject,
			html: process.env.ENVIRONMENT === 'prod' ? body : `${logRecipients([process.env.CATALYSE_EMAIL!], [], [])}\n${body}`,
			attachments: [{raw: ["Content-Type: text/csv; charset=utf-8", `Content-Disposition: attachment; filename="chemicals-${getFormattedDate(new Date(), '')}.csv"`, "", csv].join("\r\n"),}]
		});
	}
}

export async function sendEmailForDispensation (modifiedByName: string,
															modifiedByEmail: string,
															dispensation: any,
															action: 'newDispensation' |
																'renewDispensation' |
																'expiredDispensation' |
																'modifiedDispensation' |
																'cancelledDispensation' |
																'expiringDispensation'
) {
	let template = newDispensation;
	let status = dispensation.status;
	switch ( action ) {
		case "newDispensation":
			template = newDispensation;
			break;
		case "renewDispensation":
			template = renewDispensation;
			break;
		case "expiredDispensation":
			template = expiredDispensation;
			status = 'Expired';
			break;
		case "modifiedDispensation":
			template = modifiedDispensation;
			break;
		case "cancelledDispensation":
			template = cancelledDispensation;
			break;
		case "expiringDispensation":
			template = expiringDispensation;
			break;
	}
	const body = template.body.replaceAll("{{modifiedByName}}", modifiedByName)
		.replaceAll("{{dispNumber}}", `DISP-${dispensation.idDispensation}`)
		.replaceAll("{{subject}}", dispensation.subject.subject)
		.replaceAll("{{dateStart}}", getFormattedDate(dispensation.dateStart))
		.replaceAll("{{dateEnd}}", getFormattedDate(dispensation.dateEnd))
		.replaceAll("{{requirements}}", dispensation.description)
		.replaceAll("{{comments}}", dispensation.comment)
		.replaceAll("{{status}}", status)
		.replaceAll("{{rooms}}", dispensation.dispensationHasRoom.map((dhr: any) => `<a href="${process.env.APP_BASE_PATH}/roomdetails?room=${dhr.room.name}">${dhr.room.name}</a>`).join(', '))
		.replaceAll("{{holders}}", dispensation.dispensationHasHolder.map((dhr: any) => `${dhr.holder.name} ${dhr.holder.surname} (${dhr.holder.sciper})`).join(', '))
		.replaceAll("{{tickets}}", dispensation.dispensationHasTicket.map((dhr: any) => `<a href="https://go.epfl.ch/${dhr.ticket_number}">${dhr.ticket_number}</a>`).join(', '))
		.replaceAll('\n', '<br />');

	const holders = dispensation.dispensationHasHolder.map((dhr: any) => dhr.holder.email);
	const profs = dispensation.dispensationHasUnit.flatMap((dhu: any) => dhu.unit.unitHasProfiles).filter((p: UnitHasProfile) => p.role === 'Professor').map((pers: any) => pers.person.email);
	const cosecs = dispensation.dispensationHasUnit.flatMap((dhu: any) => dhu.unit.unitHasProfiles).filter((p: UnitHasProfile) => p.role === 'Cosec').map((pers: any) => pers.person.email);
	const cc = [modifiedByEmail, process.env.DISPENSATION_CC, profs, cosecs];
	await mailer.sendMail({
		from: `"LHD" <${process.env.SMTP_USER}>`,
		to: process.env.ENVIRONMENT === 'prod' ? holders : modifiedByEmail,
		cc: process.env.ENVIRONMENT === 'prod' ? cc : modifiedByEmail,
		subject: template.subject.replaceAll("{{dispNumber}}", `DISP-${dispensation.idDispensation}`),
		html: process.env.ENVIRONMENT === 'prod' ? body : `${logRecipients(holders, cc, [] )}\n${body}`
	});
}

export async function sendEmailForAuthorization (modifiedByName: string,
																							 modifiedByEmail: string,
																							 authorization: any,
																							 template: { body: string; subject: string; }) {
	const body = template.body.replaceAll("{{authNumber}}", authorization.authorization)
		.replaceAll('\n', '<br />');

	const holders: string [] = [];
	await mailer.sendMail({
		from: `"LHD" <${process.env.SMTP_USER}>`,
		to: process.env.ENVIRONMENT === 'prod' ? holders : modifiedByEmail,
		cc: process.env.ENVIRONMENT === 'prod' ? [modifiedByEmail] : modifiedByEmail,
		subject: template.subject.replaceAll("{{authNumber}}", authorization.authorization),
		html: process.env.ENVIRONMENT === 'prod' ? body : `${logRecipients(holders, [modifiedByEmail], [] )}\n${body}`
	});
}
