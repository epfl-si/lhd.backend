import {getLabHasHazardChildToString} from "./labHazardChild";
import {builder} from "../../builder";
import {OptimisticLock} from "../../../lib/optimisticLock";
import {LabHasHazards} from "../../../../generated/prisma";

export const LabHazardRef = builder.prismaObject('LabHasHazards', {
	name: 'LabHasHazards',
	fields: (t: any) => ({
		submission: t.exposeString('submission'),
		hazardFormHistory: t.field({
			type: 'HazardFormHistory',
			resolve: async (parent: any, _: any, context: any) => {
				return await context.prisma.HazardFormHistory.findUnique({
					where: { idHazardFormHistory: parent.idHazardFormHistory},
					include: { hazardForm: true }
				});
			},
		}),
		children: t.field({
			type: ['LabHasHazardsChild'],
			resolve: async (parent: any, _: any, context: any) => {
				return await context.prisma.LabHasHazardsChild.findMany({
					where: { idLabHasHazards: (parent as any).idLabHasHazards },
					include: { hazardFormChildHistory: true }
				});
			}
		}),
		room: t.field({
			type: 'Room',
			resolve: async (parent: any, _: any, context: any) => {
				return await context.prisma.Room.findUnique({
					where: { id: (parent as any).idLab }
				});
			}
		}),
		opLock: t.string({
			resolve: async (parent: any, _: any, context: any) => {
				return OptimisticLock.createOpLock(parent.idLabHasHazardsChild, getLabHasHazardChildToString(parent));
			},
		})
	}),
});

export function getLabHasHazardToString(parent: LabHasHazards) {
	return {
		idLabHasHazards: parent.idLabHasHazards,
		idLab: parent.idLab,
		idHazardFormHistory: parent.idHazardFormHistory,
		submission: parent.submission
	};
}

export async function getLabHasHazardOriginalObject (tx: any, opLock: string, name: string) {
	return await OptimisticLock.ensureDBObjectIsTheSame(opLock, 'LabHasHazards', 'idLabHasHazards', tx, name, getLabHasHazardToString);
}
