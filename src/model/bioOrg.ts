import {getUserString, UserInfo} from "../lib/userType";
import {saveBase64File} from "../lib/fileUtilities";
import {BioOrg} from "../../generated/prisma";
import {buildSearchConditions} from "../lib/searchConditionBuilder";

export async function createBioOrg (tx: any, user: UserInfo, organismName: string, risk: number) {
	return await tx.BioOrg.create({
		data: {
			organism: organismName,
			riskGroup: risk,
			updatedOn: new Date(),
			updatedBy: getUserString(user),
		}
	});
}

export async function updateBioOrg (tx: any, idBioOrg: number, user: UserInfo, organismName: string, risk: number, fileContent: string | null | undefined, fileName?: string | null | undefined) {
	return await tx.BioOrg.update({
		data: {
			organism: organismName,
			riskGroup: risk,
			updatedOn: new Date(),
			updatedBy: getUserString(user),
			filePath: fileContent && fileName ? saveBase64File(fileContent, 'd_bio/' + idBioOrg + '/', fileName) : null
		},
		where: {
			idBioOrg: idBioOrg
		}
	});
}

export async function deleteBioOrg (tx: any, idBioOrg: number) {
	await tx.BioOrg.delete({ where: { idBioOrg: idBioOrg }});
}

export async function updateBioOrgInHazards (tx: any, oldBioOrgName: string, newBioOrg: BioOrg) {
	const children = await tx.LabHasHazardsChild.findMany({where: {submission: {contains: `"organism":"${oldBioOrgName}"`}}});
	for ( const child of children ) {
		const newSubmission = JSON.parse(child.submission);
		newSubmission.data.organism.organism = newBioOrg.organism;
		newSubmission.data.organism.risk_group = newBioOrg.riskGroup;
		newSubmission.data.organism.filePath = newBioOrg.filePath;
		newSubmission.data.fileLink = newBioOrg.filePath;
		newSubmission.data.riskGroup = newBioOrg.riskGroup;
		await tx.LabHasHazardsChild.update(
			{
				where: {idLabHasHazardsChild: child.idLabHasHazardsChild},
				data: {
					submission: JSON.stringify(newSubmission)
				}
			});
	}
}

export async function getBioOrgByName (ctx: any, search: string) {
	return await ctx.prisma.BioOrg.findMany({
		where: { organism: buildSearchConditions(search) },
		orderBy: [
			{
				organism: 'asc',
			},
		]
	});
}
