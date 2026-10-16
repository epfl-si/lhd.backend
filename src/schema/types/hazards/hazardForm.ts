import {builder} from "../../builder";
import {OptimisticLock} from "../../../lib/optimisticLock";
import {HazardForm} from "../../../../generated/prisma";
import {z} from "zod";
import {hazardCategoryNameRegexp, hazardFormVersionRegexp, opLockValidator} from "../../../lib/lhdValidators";
import {
	createHazardCategory,
	createHazardForm,
	createHazardFormHistory,
	findHazardFormByCategoryName,
	updateHazardForm
} from "../../../model/hazardForm";
import {acceptJson} from "../../../lib/fieldValidatePlugin";
import {success} from "../../../lib/statuses";

export const HazardFormRef = builder.prismaObject('HazardForm', {
	name: 'HazardForm',
	fields: (t: any) => ({
		form: t.exposeString('form'),
		version: t.exposeString('version'),
		opLock: t.string({
			resolve: async (parent: any, _: any, context: any) => {
				return OptimisticLock.createOpLock(parent.idHazardForm, getHazardFormToString(parent));
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
		children: t.field({
			type: ['HazardFormChild'],
			resolve: async (parent: any, _: any, context: any) => {
				return await context.prisma.HazardFormChild.findMany({
					where: { idHazardForm: (parent as any).idHazardForm }});
			},
		})
	}),
});

function getHazardFormToString(parent: HazardForm) {
	return {
		idHazardForm: parent.idHazardForm,
		idHazardCategory: parent.idHazardCategory,
		form: parent.form,
		version: parent.version
	};
}

export async function getHazardFormOriginalObject (tx: any, opLock: string, name: string) {
	return await OptimisticLock.ensureDBObjectIsTheSame(opLock, 'HazardForm', 'idHazardForm', tx, name, getHazardFormToString);
}

builder.queryType({
	fields: (t) => ({
		hazardForms: t.prismaField({
			type: [HazardFormRef],
			authScopes: {
				needPermission: 'canListForms'
			},
			resolve: async (query, root, args, ctx: any, info) => {
				return await ctx.prisma.HazardForm.findMany();
			},
		}),
		hazardFormByCategoryName: t.prismaField({
			type: HazardFormRef,
			authScopes: {
				needPermission: 'canListForms'
			},
			args: {
				categoryName: t.arg.string({required: true, validate: z.string().regex(hazardCategoryNameRegexp)}),
			},
			resolve: async (query, root, args, ctx: any, info) => {
				return await findHazardFormByCategoryName(ctx.prisma, args.categoryName);
			},
		}),
	}),
});

builder.mutationType({
	fields: (t) => ({
		createNewHazardCategory: t.string({
			authScopes: {
				needPermission: 'isAdmin'
			},
			args: {
				form: t.arg.string({required: true, validate: z.string().refine(
						(value) => acceptJson(value))}),
				version: t.arg.string({required: true, validate: z.string().regex(hazardFormVersionRegexp)}),
				hazardCategoryName: t.arg.string({required: true, validate: z.string().regex(hazardCategoryNameRegexp)}),
			},
			resolve: async (root, args, ctx: any) => {
				return await ctx.prisma.$transaction(async (tx: any) => {
					const category = await createHazardCategory(tx, args.hazardCategoryName);
					const form = await createHazardForm(tx, args.form, args.version, category.idHazardCategory);
					await createHazardFormHistory(tx, args.form, args.version, form.idHazardForm, ctx.user.userName);
					return success();
				});
			},
		}),
		updateForm: t.string({
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
					const form = await getHazardFormOriginalObject(tx, args.opLock, "hazard form");

					await updateHazardForm(tx, args.form, args.version, form.idHazardForm);
					await createHazardFormHistory(tx, args.form, args.version, form.idHazardForm, ctx.user.userName);
					return success();
				});
			},
		}),
	}),
});
