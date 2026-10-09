import {LabHasHazardsAdditionalInfo} from "../../../../generated/prisma";
import {OptimisticLock} from "../../../lib/optimisticLock";
import {builder} from "../../builder";
import {HazardCategoryRef} from "./hazardCategory";
import {HazardsAdditionalInfoHasTagRef} from "./hazardAdditionalInfoHasTag";
import {FileAdditionalInfoRef} from "./hazardAdditionalInfoFile";

export const HazardsAdditionalInfoRef = builder.prismaObject('LabHasHazardsAdditionalInfo', {
	name: 'LabHasHazardsAdditionalInfo',
	fields: (t: any) => ({
		comment: t.exposeString('comment'),
		modified_by: t.exposeString('modified_by'),
		modifiedOn: t.expose('modifiedOn', { type: 'DateTime' }),
		opLock: t.string({
			resolve: async (parent: any, _: any, context: any) => {
				return OptimisticLock.createOpLock(parent.idLabHasHazardsAdditionalInfo, getLabHasHazardsAdditionalInfoToString(parent));
			},
		}),
		hazardCategory: t.field({
			type: 'HazardCategory',
			resolve: async (parent: any, _: any, context: any) => {
				return await context.prisma.HazardCategory.findUnique({
					where: { idHazardCategory: parent.idHazardCategory}
				});
			},
		}),
		hazardsAdditionalInfoHasTag: t.field({
			type: ['HazardsAdditionalInfoHasTag'],
			resolve: async (parent: any, _: any, context: any) => {
				return await context.prisma.HazardsAdditionalInfoHasTag.findMany({
					where: { idLabHasHazardsAdditionalInfo: parent.idLabHasHazardsAdditionalInfo }
				});
			},
		}),
		hazardsAdditionalInfoHasFile: t.field({
			type: ['HazardsAdditionalInfoHasFile'],
			resolve: async (parent: any, _: any, context: any) => {
				return await context.prisma.HazardsAdditionalInfoHasFile.findMany({
					where: { idLabHasHazardsAdditionalInfo: parent.idLabHasHazardsAdditionalInfo }
				});
			},
		}),
	}),
});

export function getLabHasHazardsAdditionalInfoToString(parent: LabHasHazardsAdditionalInfo) {
	return {
		idLabHasHazardsAdditionalInfo: parent.idLabHasHazardsAdditionalInfo,
		idLab: parent.idLab,
		idHazardCategory: parent.idHazardCategory,
		comment: parent.comment,
		modifiedBy: parent.modifiedBy,
		modifiedOn: parent.modifiedOn,
	};
}

export async function getLabHasHazardsAdditionalInfoOriginalObject (tx: any, opLock: string, name: string) {
	return await OptimisticLock.ensureDBObjectIsTheSame(opLock, 'LabHasHazardsAdditionalInfo', 'idLabHasHazardsAdditionalInfo', tx, name, getLabHasHazardsAdditionalInfoToString);
}
