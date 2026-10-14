import {builder} from "../../builder";
import {OptimisticLock} from "../../../lib/optimisticLock";
import {HazardFormChild} from "../../../../generated/prisma";
import {z} from "zod";
import {hazardCategoryNameRegexp, hazardFormVersionRegexp, opLockValidator} from "../../../lib/lhdValidators";
import {acceptJson} from "../../../lib/fieldValidatePlugin";
import {findCategoryByName} from "../../../model/hazardCategory";
import {
	createHazardFormChild,
	createHazardFormChildHistory,
	findHazardFormByCategory,
	findHazardFormChildByName,
	updateHazardFormChild
} from "../../../model/hazardForm";
import {success} from "../../../lib/statuses";

export const HazardFormChildRef = builder.prismaObject('HazardFormChild', {
	name: 'HazardFormChild',
	fields: (t: any) => ({
		form: t.exposeString('form'),
		version: t.exposeString('version'),
		hazardFormChildName: t.exposeString('hazardFormChildName'),
		opLock: t.string({
			resolve: async (parent: any, _: any, context: any) => {
				return OptimisticLock.createOpLock(parent.idHazardFormChild, getHazardFormChildToString(parent));
			},
		}),
		parentForm: t.field({
			type: 'HazardForm',
			resolve: async (parent: any, _: any, context: any) => {
				return await context.prisma.HazardForm.findUnique({
					where: { idHazardForm: parent.idHazardForm },
				})
			},
		})
	}),
});

function getHazardFormChildToString(parent: HazardFormChild) {
	return {
		idHazardFormChild: parent.idHazardFormChild,
		idHazardForm: parent.idHazardForm,
		hazardFormChildName: parent.hazardFormChildName,
		form: parent.form,
		version: parent.version
	};
}

export async function getHazardFormChildOriginalObject (tx: any, opLock: string, name: string) {
	return await OptimisticLock.ensureDBObjectIsTheSame(opLock, 'HazardFormChild', 'idHazardFormChild', tx, name, getHazardFormChildToString);
}

builder.queryType({
	fields: (t) => ({
		hazardFormChildren: t.prismaField({
			type: [HazardFormChildRef],
			authScopes: {
				needPermission: 'isAdmin'
			},
			resolve: async (query, root, args, ctx: any, info) => {
				return await ctx.prisma.HazardFormChild.findMany();
			},
		}),
		hazardFormChildByName: t.prismaField({
			type: HazardFormChildRef,
			authScopes: {
				needPermission: 'isAdmin'
			},
			args: {
				name: t.arg.string({required: true, validate: z.string().regex(hazardCategoryNameRegexp)}),
			},
			resolve: async (query, root, args, ctx: any, info) => {
				return await findHazardFormChildByName(ctx.prisma, args.name);
			},
		}),
	}),
});

builder.mutationType({
	fields: (t) => ({
		createNewHazardFormChild: t.string({
			authScopes: {
				needPermission: 'isAdmin'
			},
			args: {
				form: t.arg.string({required: true, validate: z.string().refine(
						(value) => acceptJson(value))}),
				version: t.arg.string({required: true, validate: z.string().regex(hazardFormVersionRegexp)}),
				hazardFormChildName: t.arg.string({required: true, validate: z.string().regex(hazardCategoryNameRegexp)}),
				category: t.arg.string({required: true, validate: z.string().regex(hazardCategoryNameRegexp)}),
			},
			resolve: async (root, args, ctx: any) => {
				const category = await findCategoryByName(ctx.prisma, args.category);
				if (!category) {
					throw new Error(`Category ${args.category} not found`);
				}
				const hazardForm = await findHazardFormByCategory(ctx.prisma, category.idHazardCategory);
				if (!hazardForm) {
					throw new Error(`Form not found for category ${args.category} not found`);
				}
				return await ctx.prisma.$transaction(async (tx: any) => {
					const form = await createHazardFormChild(tx, args.form, args.version, args.hazardFormChildName, hazardForm.idHazardForm);
					await createHazardFormChildHistory(tx, args.form, args.version, form.idHazardFormChild, ctx.user.userName);
					return success();
				});
			},
		}),
		updateHazardFormChild: t.string({
			authScopes: {
				needPermission: 'isAdmin'
			},
			args: {
				opLock: t.arg.string({required: true, validate: opLockValidator}),
				form: t.arg.string({required: true, validate: z.string().refine(
						(value) => acceptJson(value))}),
				version: t.arg.string({required: true, validate: z.string().regex(hazardFormVersionRegexp)}),
			},
			resolve: async (root, args, ctx: any) => {
				return await ctx.prisma.$transaction(async (tx: any) => {
					const form = await getHazardFormChildOriginalObject(tx, args.opLock, 'Hazard');
					await updateHazardFormChild(tx, args.form, args.version, form.idHazardFormChild);
					await createHazardFormChildHistory(tx, args.form, args.version, form.idHazardFormChild, ctx.user.userName);
					return success();
				});
			},
		}),
	}),
});
