import {OptimisticLock, submission} from "../lib/optimisticLock";
import {getLabHasHazardChildOriginalObject} from "../schema/types/hazards/labHazardChild";

export async function findHazardFormByCategory (prisma: any, idCategory: number) {
	return await prisma.HazardForm.findFirst({ where: { idHazardCategory: idCategory}})
}

export async function findHazardFormHistory (prisma: any, formId: number, version: string) {
	return await prisma.HazardFormHistory.findFirst({
		where: {
			idHazardForm: formId,
			version: version
		}
	});
}

export async function updateHazardFormChild(tx: any, child: submission, parentHazard: number, category: string, parent: any) {
	OptimisticLock.checkOpLock(child.opLock);

	const formChild = await tx.HazardFormChild.findFirst({where: {hazardFormChildName: child.formName}});
	const historyChildLastVersion = await tx.HazardFormChildHistory.findFirst({
		where: {
			idHazardFormChild: formChild.idHazardFormChild,
			version: formChild.version
		}
	});

	if ( child.opLock.eph_id.startsWith('newHazardChild') ) {
		if (child.submission.data['status'] === 'Default') {
			await tx.LabHasHazardsChild.create({
				data: {
					idLabHasHazards: parentHazard,
					idHazardFormChildHistory: historyChildLastVersion.idHazardFormChildHistory,
					submission: JSON.stringify(child.submission)
				}
			})
		}
	} else {
		const haz = await getLabHasHazardChildOriginalObject(tx, child.opLock, 'Hazard');

		if ( child.submission.data['status'] === 'Default' ) {
			await tx.LabHasHazardsChild.update(
				{
					where: {idLabHasHazardsChild: haz.idLabHasHazardsChild},
					data: {
						idHazardFormChildHistory: historyChildLastVersion.idHazardFormChildHistory,
						submission: JSON.stringify(child.submission)
					}
				});
		} else if ( child.submission.data['status'] === 'Deleted' ) {
			await tx.LabHasHazardsChild.delete({
				where: {
					idLabHasHazardsChild: haz.idLabHasHazardsChild
				}
			});
			const lab_has_hazardsList = await tx.LabHasHazardsChild.findMany({where: {idLabHasHazards: parentHazard}});
			if (lab_has_hazardsList.length == 0 && !parent['data']['canDeleteChildren']) {
				await tx.LabHasHazards.delete({
					where: {
						idLabHasHazards: parentHazard
					}
				});
			}
		}
	}
}
