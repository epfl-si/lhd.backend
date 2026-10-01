import {BioOrg} from "../../generated/prisma";

export async function updateBioOrg(tx: any, oldBioOrgName: string, newBioOrg: BioOrg) {
	const children = await tx.lab_has_hazards_child.findMany({where: {submission: {contains: `"organism":"${oldBioOrgName}"`}}});
	for ( const child of children ) {
		const newSubmission = JSON.parse(child.submission);
		newSubmission.data.organism.organism = newBioOrg.organism;
		newSubmission.data.organism.risk_group = newBioOrg.riskGroup;
		newSubmission.data.organism.filePath = newBioOrg.filePath;
		newSubmission.data.fileLink = newBioOrg.filePath;
		newSubmission.data.riskGroup = newBioOrg.riskGroup;
		await tx.lab_has_hazards_child.update(
			{
				where: {id_lab_has_hazards_child: child.id_lab_has_hazards_child},
				data: {
					submission: JSON.stringify(newSubmission)
				}
			});
	}
}
