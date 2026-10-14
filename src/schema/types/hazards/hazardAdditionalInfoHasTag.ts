import {builder} from "../../builder";
import {OptimisticLock} from "../../../lib/optimisticLock";
import {HazardsAdditionalInfoHasTag} from "../../../../generated/prisma";
import {z} from "zod";
import {freeFormTextRegexp, hazardCategoryNameRegexp, opLockValidator} from "../../../lib/lhdValidators";
import {getLabHasHazardsAdditionalInfoOriginalObject} from "./hazardsAdditionalInfo";
import {getRoomOriginalObject} from "../room";
import {
	createAdditionalInfo,
	createTagForAdditionalInfo,
	deleteTagForAdditionalInfo,
	updateTagForAdditionalInfo
} from "../../../model/hazardAdditionalInfo";
import {success} from "../../../lib/statuses";

export const HazardsAdditionalInfoHasTagRef = builder.prismaObject('HazardsAdditionalInfoHasTag', {
	name: 'HazardsAdditionalInfoHasTag',
	fields: (t: any) => ({
		comment: t.exposeString('comment'),
		tag: t.field({
			type: 'Tag',
			resolve: async (parent: any, _: any, context: any) => {
				return await context.prisma.Tag.findUnique({
					where: { idTag: parent.idTag }
				});
			},
		}),
		opLock: t.string({
			resolve: async (parent: any, _: any, context: any) => {
				return OptimisticLock.createOpLock(parent.idHazardsAdditionalInfoHasTag, getHazardAdditionalInfoHasTagToString(parent));
			},
		})
	}),
});

function getHazardAdditionalInfoHasTagToString(parent: HazardsAdditionalInfoHasTag) {
	return {
		idHazardsAdditionalInfoHasTag: parent.idHazardsAdditionalInfoHasTag,
		idTag: parent.idTag,
		idLabHasHazardsAdditionalInfo: parent.idLabHasHazardsAdditionalInfo,
		comment: parent.comment
	};
}

export async function getLabHasHazardsAdditionalInfoHasTagOriginalObject (tx: any, opLock: string, name: string) {
	return await OptimisticLock.ensureDBObjectIsTheSame(opLock,
		'HazardsAdditionalInfoHasTag', 'idHazardsAdditionalInfoHasTag',
		tx, name, getHazardAdditionalInfoHasTagToString);
}

builder.mutationType({
	fields: (t) => ({
		addTag: t.string({
			authScopes: {
				needPermission: 'canEditHazards'
			},
			args: {
				tag: t.arg.string({required: true, validate: z.enum(['Exception AxS'])}),
				comment: t.arg.string({defaultValue: '', validate: z.string().regex(freeFormTextRegexp)}),
				additionalInfoId: t.arg.string(),
				categoryName: t.arg.string({validate: z.string().regex(hazardCategoryNameRegexp)}),
				roomId: t.arg.string({required: true, validate: opLockValidator})
			},
			resolve: async (root, args, ctx: any) => {
				return await ctx.prisma.$transaction(async (tx: any) => {
					let additionalInfo;
					if (args.additionalInfoId && args.additionalInfoId !== '') {
						additionalInfo = await getLabHasHazardsAdditionalInfoOriginalObject(tx, args.additionalInfoId, 'Additional Info');
					} else if (args.roomId) {
						const room = await getRoomOriginalObject(tx, args.roomId, "room");

						const category = await tx.HazardCategory.findFirst({where: {hazardCategoryName: args.categoryName}});
						if (!category) {
							throw new Error(`Category ${args.categoryName} not found`);
						}

						additionalInfo = await createAdditionalInfo(tx, ctx.user, category.idHazardCategory, room.id);
					}

					const tag = await tx.Tag.findUnique({ where: { tagName: args.tag }});
					await createTagForAdditionalInfo(tx, tag.idTag, additionalInfo.idLabHasHazardsAdditionalInfo, args.comment ?? '');
					return tag.tagName;
				});
			},
		}),
		updateTag: t.string({
			authScopes: {
				needPermission: 'canEditHazards'
			},
			args: {
				opLock: t.arg.string({required: true, validate: opLockValidator}),
				comment: t.arg.string({defaultValue: '', validate: z.string().regex(freeFormTextRegexp)}),
			},
			resolve: async (root, args, ctx: any) => {
				return await ctx.prisma.$transaction(async (tx: any) => {
					const tag = await getLabHasHazardsAdditionalInfoHasTagOriginalObject(tx, args.opLock, 'Additional Info');

					await updateTagForAdditionalInfo(tx, tag.idHazardsAdditionalInfoHasTag, args.comment ?? '');
					return success();
				});
			},
		}),
		deleteTag: t.string({
			authScopes: {
				needPermission: 'canEditHazards'
			},
			args: {
				opLock: t.arg.string({required: true, validate: opLockValidator}),
			},
			resolve: async (root, args, ctx: any) => {
				return await ctx.prisma.$transaction(async (tx) => {
					const tag = await getLabHasHazardsAdditionalInfoHasTagOriginalObject(tx, args.opLock, 'Additional Info');

					await deleteTagForAdditionalInfo(tx, tag.idHazardsAdditionalInfoHasTag);
					return success();
				});
			},
		}),
	}),
});
