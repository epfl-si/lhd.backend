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

export async function findHazardFormChildByName (prisma: any, name: string) {
	return await prisma.HazardFormChild.findFirst({
		where: {
			hazardFormChildName: name
		}
	});
}

export async function findHazardFormByCategoryName (prisma: any, categoryName: string) {
	return await prisma.HazardForm.findFirst({
		where: { hazardCategory: {hazardCategoryName: { contains: categoryName }}}
	});
}

export async function updateLabHasHazardsChild(tx: any, child: submission, parentHazard: number, parent: any) {
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

export async function createHazardFormChild (tx: any, form: string, version: string, hazardFormChildName: string, idHazardForm: number) {
	return await tx.HazardFormChild.create(
		{ data: {
				form: form,
				version: version,
				hazardFormChildName: hazardFormChildName,
				idHazardForm: idHazardForm
			}
		});
}

export async function updateHazardFormChild (tx: any, form: string, version: string, idHazardFormChild: number) {
	return await tx.HazardFormChild.update(
		{ where: { idHazardFormChild: idHazardFormChild },
			data: {
				form: form,
				version: version
			}
		});
}

export async function createHazardFormChildHistory (tx: any, form: string, version: string, idHazardFormChild: string, userName: string) {
	await tx.HazardFormChildHistory.create(
		{ data: {
				form: form,
				version: version,
				idHazardFormChild: idHazardFormChild,
				modifiedBy: userName,
				modifiedOn: new Date()
			}
		});
}

export async function createHazardCategory (tx: any, categoryName: string) {
	return await tx.HazardCategory.create(
		{ data: {
				hazardCategoryName: categoryName
			}
		});
}

export async function createHazardForm (tx: any, form: string, version: string, idHazardCategory: number) {
	return await tx.HazardForm.create(
		{ data: {
				form: form,
				version: version,
				idHazardCategory: idHazardCategory
			}
		});
}

export async function updateHazardForm (tx: any, form: string, version: string, idHazardForm: number) {
	return await tx.HazardForm.update(
		{ where: { idHazardForm: idHazardForm },
			data: {
				form: form,
				version: version
			}
		});
}

export async function createHazardFormHistory (tx: any, form: string, version: string, idHazardForm: string, userName: string) {
	await tx.HazardFormHistory.create(
		{ data: {
				form: form,
				version: version,
				idHazardForm: idHazardForm,
				modifiedBy: userName,
				modifiedOn: new Date()
			}
		});
}
