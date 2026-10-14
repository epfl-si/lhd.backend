import {getUserString, UserInfo} from "../lib/userType";
import {saveBase64File} from "../lib/fileUtilities";

export async function createAdditionalInfo (tx: any, user: UserInfo, idCategory: number, idRoom: number, comment?: string) {
	return await tx.LabHasHazardsAdditionalInfo.create({
		data: {
			modifiedBy: getUserString(user),
			modifiedOn: new Date(),
			comment: comment ? comment : '',
			idHazardCategory: idCategory,
			idLab: idRoom
		}
	});
}

export async function updateAdditionalInfo (tx: any, user: UserInfo, idLabHasHazardsAdditionalInfo: number, comment?: string) {
	await tx.LabHasHazardsAdditionalInfo.update(
		{ where: { idLabHasHazardsAdditionalInfo: idLabHasHazardsAdditionalInfo },
			data: {
				modifiedBy: getUserString(user),
				modifiedOn: new Date(),
				comment: comment ? comment : '',
			}
		});
}

export async function createTagForAdditionalInfo (tx: any, idTag: number, idLabHasHazardsAdditionalInfo: number, comment: string = '') {
	return await tx.HazardsAdditionalInfoHasTag.create(
		{ data: {
				idTag: idTag,
				idLabHasHazardsAdditionalInfo: idLabHasHazardsAdditionalInfo,
				comment: decodeURIComponent(comment ?? '')
			}
		});
}

export async function updateTagForAdditionalInfo (tx: any, idHazardsAdditionalInfoHasTag: number, comment: string = '') {
	return await tx.HazardsAdditionalInfoHasTag.update(
		{ where: { idHazardsAdditionalInfoHasTag: idHazardsAdditionalInfoHasTag },
			data: {
				comment: decodeURIComponent(comment)
			}
		});
}

export async function deleteTagForAdditionalInfo (tx: any, idHazardsAdditionalInfoHasTag: number) {
	await tx.HazardsAdditionalInfoHasTag.delete(
		{ where: { idHazardsAdditionalInfoHasTag: idHazardsAdditionalInfoHasTag }
		});
}

export async function findAdditionalInfoByCategoryAndLab (tx: any, idCategory: number, idLab: number) {
	return await tx.labHasHazardsAdditionalInfo.findFirst({
		where: {
			idHazardCategory: idCategory,
			idLab: idLab
		}});
}

export async function setAdditionaInfoRelations(tx: any, idInfo: number, changes: any, idRoom: number) {
	for ( const file of changes.files || []) {
		if ( file.status === 'New' ) {
			await tx.HazardsAdditionalInfoHasFile.create({
				data: {
					idLabHasHazardsAdditionalInfo: idInfo,
					filePath: saveBase64File(file.base64, process.env.HAZARD_DOCUMENT_FOLDER + changes.category + '/' + idRoom + '/', file.path)
				}
			});
		} else if ( file.status === 'Deleted' ) {
			await tx.HazardsAdditionalInfoHasFile.deleteMany({
				where: {
					idLabHasHazardsAdditionalInfo: idInfo,
					filePath: file.path
				}
			});
		}
	}
}
