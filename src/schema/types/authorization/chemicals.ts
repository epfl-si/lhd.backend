import {builder} from "../../builder";
import {OptimisticLock} from "../../../lib/optimisticLock";
import {AuthChem} from "../../../../generated/prisma";
import {z} from "zod";
import {authCodeRegexp, casRegexp, chemicalNameRegexp, opLockValidator} from "../../../lib/lhdValidators";
import {acceptBooleanString, acceptSubstringInList} from "../../../lib/fieldValidatePlugin";
import {sanitizeSearchString} from "../../../lib/searchStrings";
import {createChemical, deleteChemical, getChemicals, updateChemical} from "../../../model/chemicals";
import {success} from "../../../lib/statuses";
import {sendEmailsForChemical} from "../../../lib/email/mailer";

export const AuthChemRef = builder.prismaObject('AuthChem', {
	name: 'AuthChem',
	fields: (t: any) => ({
		casAuthChem: t.exposeString('casAuthChem'),
		authChemEn: t.exposeString('authChemEn'),
		authChemFr: t.exposeString('authChemFr'),
		flagAuthChem: t.exposeBoolean('flagAuthChem'),
		fastway: t.exposeBoolean('fastway'),
		authCode: t.exposeString('authCode'),
		opLock: t.string({
			resolve: async (parent: any, _: any, context: any) => {
				return OptimisticLock.createOpLock(parent.idAuthChem, getChemicalToString(parent));
			},
		})
	}),
});

function getChemicalToString(parent: AuthChem) {
	return {
		id: parent.idAuthChem,
		casAuthChem: parent.casAuthChem,
		authChemEn: parent.authChemEn,
		authChemFr: parent.authChemFr,
		flagAuthChem: parent.flagAuthChem,
		fastway: parent.fastway,
		authCode: parent.authCode
	};
}

export async function getChemicalOriginalObject (tx: any, opLock: string, name: string) {
	return await OptimisticLock.ensureDBObjectIsTheSame(opLock, 'AuthChem', 'idAuthChem', tx, name, getChemicalToString);
}

const searchSpec = {
	CAS: {rename: 'cas', validate: casRegexp},
	Name: {rename: 'name', validate: chemicalNameRegexp},
	Status: {rename: 'status', validate: (value: string) => {
			const keyword = acceptSubstringInList(value, ['active', 'archived']);
			return keyword === 'active';
		}},
	Fastway: {rename: 'fastway', validate: acceptBooleanString},
	AuthCode: {rename: 'authCode', validate: authCodeRegexp},
};

const searchSchema = z
	.string()
	.superRefine((s, ctx) => {
		try {
			sanitizeSearchString(s, searchSpec);
		} catch (e) {
			ctx.addIssue({
				code: 'custom',
				message: `Invalid search parameters: ${(e as Error).message}`,
			});
		}
	})
	.nullish();

const ChemicalListResult = builder.objectRef<{
	totalCount: number;
	chemicals: any[];
}>('ChemicalListResult').implement({
	fields: (t) => ({
		totalCount: t.exposeInt('totalCount'),
		chemicals: t.field({
			type: [AuthChemRef],
			resolve: (parent) => parent.chemicals,
		}),
	}),
});

builder.queryType({
	fields: (t) => ({
		chemicalsWithPagination: t.field({
			type: ChemicalListResult,
			authScopes: {
				needPermission: 'canListChemicals'
			},
			args: {
				search: t.arg.string({defaultValue: '', validate: searchSchema}),
				skip: t.arg.int({defaultValue: 0, required: true, validate: z.number().int().min(0)}),
				take: t.arg.int({defaultValue: 20, required: true, validate: z.number().int().min(20)}),
			},
			resolve: async (root, args, ctx: any) => {
				const search = sanitizeSearchString(args.search ?? '', searchSpec);
				return await getChemicals(ctx.prisma, {skip: args.skip, take: args.take, ...(search as any)});
			},
		}),
	}),
});


builder.mutationType({
	fields: (t) => ({
		addChemical: t.string({
			authScopes: {
				needPermission: 'canEditChemicals'
			},
			args: {
				casAuthChem: t.arg.string({required: true, validate: z.string().regex(casRegexp)}),
				authChemEn: t.arg.string({required: true, validate: z.string().regex(chemicalNameRegexp)}),
				flagAuthChem: t.arg.boolean(),
				fastway: t.arg.boolean(),
				authCode: t.arg.string({required: true, validate: z.string().regex(authCodeRegexp)})
			},
			resolve: async (root, args, ctx: any) => {
				const newChem = await ctx.prisma.$transaction(async (tx: any) => {
					return await createChemical(tx, args);
				});
				await sendEmailsForChemical(ctx.prisma, ctx.user.userEmail, undefined, newChem);
				return success();
			},
		}),
		updateChemical: t.string({
			authScopes: {
				needPermission: 'canEditChemicals'
			},
			args: {
				opLock: t.arg.string({required: true, validate: opLockValidator}),
				casAuthChem: t.arg.string({required: true, validate: z.string().regex(casRegexp)}),
				authChemEn: t.arg.string({required: true, validate: z.string().regex(chemicalNameRegexp)}),
				flagAuthChem: t.arg.boolean(),
				fastway: t.arg.boolean(),
				authCode: t.arg.string({required: true, validate: z.string().regex(authCodeRegexp)})
			},
			resolve: async (root, args, ctx: any) => {
				const chem = await getChemicalOriginalObject(ctx.prisma, args.opLock, args.casAuthChem);
				const newChem = await ctx.prisma.$transaction(async (tx: any) => {
					return updateChemical(tx, chem.idAuthChem, args);
				});
				await sendEmailsForChemical(ctx.prisma, ctx.user.userEmail, chem, newChem);
				return success();
			},
		}),
		deleteChemical: t.string({
			authScopes: {
				needPermission: 'canEditChemicals'
			},
			args: {
				opLock: t.arg.string({required: true, validate: opLockValidator}),
			},
			resolve: async (root, args, ctx: any) => {
				const chem = await getChemicalOriginalObject(ctx.prisma, args.opLock, 'Chemical');
				await ctx.prisma.$transaction(async (tx: any) => {
					await deleteChemical(tx, chem.idAuthChem);
				});
				await sendEmailsForChemical(ctx.prisma, ctx.user.userEmail, chem, undefined);
				return success();
			},
		}),
	}),
});
