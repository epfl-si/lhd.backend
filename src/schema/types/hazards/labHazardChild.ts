import {builder} from "../../builder";
import {OptimisticLock} from "../../../lib/optimisticLock";
import {LabHasHazardsChild} from "../../../../generated/prisma";

export const LabHazardChildRef = builder.prismaObject('LabHasHazardsChild', {
	name: 'LabHasHazardsChild',
	fields: (t: any) => ({
		submission: t.exposeString('submission'),
		hazardFormChildHistory: t.field({
			type: 'HazardFormChildHistory',
			resolve: async (parent: any, _: any, context: any) => {
				return await context.prisma.HazardFormChildHistory.findUnique({
					where: { idHazardFormChildHistory: parent.idHazardFormChildHistory},
					include: { hazardFormChild: true }
				})
			},
		}),
		hazards: t.field({
			type: 'LabHasHazards',
			resolve: async (parent: any, _: any, context: any) => {
				return await context.prisma.LabHasHazards.findUnique({
					where: { idLabHasHazards: parent.idLabHasHazards},
				})
			},
		}),
		opLock: t.string({
			resolve: async (parent: any, _: any, context: any) => {
				return OptimisticLock.createOpLock(parent.idLabHasHazardsChild, getLabHasHazardChildToString(parent));
			},
		})
	}),
});

export function getLabHasHazardChildToString(parent: LabHasHazardsChild) {
	return {
		idLabHasHazardsChild: parent.idLabHasHazardsChild,
		idLabHasHazards: parent.idLabHasHazards,
		idHazardFormChildHistory: parent.idHazardFormChildHistory,
		submission: parent.submission
	};
}

export async function getLabHasHazardChildOriginalObject (tx: any, opLock: string, name: string) {
	return await OptimisticLock.ensureDBObjectIsTheSame(opLock, 'LabHasHazardsChild', 'idLabHasHazardsChild', tx, name, getLabHasHazardChildToString);
}
