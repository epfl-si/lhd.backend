import {builder} from "../../builder";
import {OpLock, OptimisticLock, submission} from "../../../lib/optimisticLock";
import {LabHasHazards} from "../../../../generated/prisma";
import {z} from "zod";
import {
	fileContentValidator,
	hazardCategoryNameRegexp,
	opLockValidator,
	pathRegexp,
	roomNameRegexp
} from "../../../lib/lhdValidators";
import {acceptJson} from "../../../lib/fieldValidatePlugin";
import {FileMutationInput} from "../../../lib/mutationTypes";
import {AdditionalInfoType} from "./hazardAdditionalInfoFile";
import {sendEmailsForHazards} from "../../../lib/email/mailer";
import {getRoomWithUnitByName} from "../../../model/rooms";
import {success} from "../../../lib/statuses";
import {findHazardFormByCategory, findHazardFormHistory, updateLabHasHazardsChild} from "../../../model/hazardForm";
import {findCategoryByName} from "../../../model/hazardCategory";
import {
	createLabHasHazard,
	deleteLabHasHazard,
	deleteLabHasHazardChildByParent,
	updateLabHasHazard
} from "../../../model/labHazard";
import {
	createAdditionalInfo,
	findAdditionalInfoByCategoryAndLab,
	setAdditionaInfoRelations,
	updateAdditionalInfo
} from "../../../model/hazardAdditionalInfo";

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
				return OptimisticLock.createOpLock(parent.idLabHasHazards, getLabHasHazardToString(parent));
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

export async function getLabHasHazardOriginalObject (tx: any, opLock: OpLock, name: string) {
	return await OptimisticLock.getObjectByObfuscatedId(opLock, 'LabHasHazards', 'idLabHasHazards', tx, name, getLabHasHazardToString);
}

builder.mutationType({
	fields: (t) => ({
		addHazardToRoom: t.string({
			authScopes: {
				needPermission: 'canEditHazards'
			},
			args: {
				room: t.arg.string({required: true, validate: z.string().regex(roomNameRegexp)}),
				submission: t.arg.string({required: true, validate: z.string().refine(acceptJson)}),
				category: t.arg.string({required: true, validate: z.string().regex(hazardCategoryNameRegexp)}),
				additionalInfo: t.arg({ type: AdditionalInfoType }),
				files: t.arg({
					type: [FileMutationInput],
					required: { list: false, items: false },
					validate: z.array(z.object({
						status: z.enum(['New', 'Default', 'Deleted']),
						base64: fileContentValidator,
						path: z.string().regex(pathRegexp).optional(),
					}),)
				}),
			},
			resolve: async (root, args, ctx: any) => {
				const room = await getRoomWithUnitByName(ctx.prisma, args.room);
				if (! room) {
					throw new Error(`Room ${args.room} not found.`);
				}
				const category = await findCategoryByName(ctx.prisma, args.category);
				const form = await findHazardFormByCategory(ctx.prisma, category.idHazardCategory);
				const historyLastVersion = await findHazardFormHistory(ctx.prisma, form.idHazardForm, form.version);

				const roomResult = await ctx.prisma.$transaction(async (tx: any) => {
					const submissionsHazards: submission[] = JSON.parse(args.submission);
					for ( const h of submissionsHazards ) {
						OptimisticLock.checkOpLock(h.opLock);

						if (h.opLock.eph_id.startsWith('newHazard') && h.submission.data['status'] === 'Default') {
							const hazard = await createLabHasHazard(tx, room.id, historyLastVersion.idHazardFormHistory, h.submission);

							if (h.children) {
								for await ( const child of h.children ) {
									await updateLabHasHazardsChild(tx, child, hazard.idLabHasHazards, h.submission)
								}
							}
						}
						else if (!h.opLock.eph_id.startsWith('newHazard')) {
							const haz = await getLabHasHazardOriginalObject(tx, h.opLock, 'Hazard');

							if (h.submission.data['status'] === 'Default'){
								const hazard = await updateLabHasHazard(tx, haz.idLabHasHazards, historyLastVersion.idHazardFormHistory, h.submission);

								if (h.children) {
									for await ( const child of h.children ) {
										await updateLabHasHazardsChild(tx, child, hazard.idLabHasHazards, h.submission)
									}
								}
							}
							else if (h.submission.data['status'] === 'Deleted') {
								await deleteLabHasHazardChildByParent(tx, haz.idLabHasHazards);
								await deleteLabHasHazard(tx, haz.idLabHasHazards);
							}
						}
					}

					const additionalInfoResult = await findAdditionalInfoByCategoryAndLab(tx, category.idHazardCategory, room.id);
					if (additionalInfoResult) {
						await updateAdditionalInfo(tx, ctx.user, additionalInfoResult.idLabHasHazardsAdditionalInfo, args.additionalInfo?.comment ?? '');
						await setAdditionaInfoRelations(tx, additionalInfoResult.idLabHasHazardsAdditionalInfo, args, room.id);
					} else {
						const newInfo = await createAdditionalInfo(tx, ctx.user, category.idHazardCategory, room.id, args.additionalInfo?.comment ?? '')
						await setAdditionaInfoRelations(tx, newInfo.idLabHasHazardsAdditionalInfo, args, room.id);
					}

					return room;
				});
				const cosecs: string[] = [];

				roomResult.unitHasRoom.forEach((uhr: any) => {
					uhr.unit.unitHasProfiles.forEach((uhc: any) => {
						if (!cosecs.includes(uhc.person.email) && uhc.role === 'Cosec')
							cosecs.push(uhc.person.email);
					})
				});
				await sendEmailsForHazards(ctx.prisma, args, roomResult, cosecs, ctx.user);
				return success();
			},
		}),
		deleteHazard: t.string({
			authScopes: {
				needPermission: 'canEditHazards'
			},
			args: {
				opLock: t.arg.string({required: true, validate: opLockValidator}),
			},
			resolve: async (root, args, ctx: any) => {
				await ctx.prisma.$transaction(async (tx: any) => {
					const opLock = OptimisticLock.getOpLock(args.opLock);
					OptimisticLock.checkOpLock(opLock);
					const haz = await getLabHasHazardOriginalObject(tx, opLock, 'Hazard');
					await deleteLabHasHazardChildByParent(tx, haz.idLabHasHazards);
					await deleteLabHasHazard(tx, haz.idLabHasHazards);
				});
				return success();
			},
		}),
	}),
});
