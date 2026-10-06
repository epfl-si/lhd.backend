import {builder} from "../builder";
import {OptimisticLock} from "../../lib/optimisticLock";
import {z} from "zod";
import {buildSearchConditions} from "../../lib/searchConditionBuilder";
import {fileNameRegexp, opLockValidator, organismRegexp} from "../../lib/lhdValidators";
import {sanitizeBase64DataUrl} from "../../lib/fieldValidatePlugin";
import {createBioOrg, deleteBioOrg, getBioOrgByName, updateBioOrg, updateBioOrgInHazards} from "../../model/bioOrg";

const BioOrgRef = builder.prismaObject('BioOrg', {
	name: 'BioOrg',
	fields: (t: any) => ({
		organism: t.exposeString('organism'),
		riskGroup: t.exposeInt('riskGroup'),
		filePath: t.exposeString('filePath'),
		updatedOn: t.expose('updatedOn', { type: 'DateTime' }),
		updatedBy: t.exposeString('updatedBy'),
		opLock: t.field({
			type: 'String',
			resolve: async (parent: any, _: any, context: any) => {
				return OptimisticLock.createOpLock(parent.idBioOrg, getBioOrgToString(parent));
			},
		})
	}),
});

export function getBioOrgToString(parent: any) {
	return {
		id: parent.idBioOrg,
		organism: parent.organism,
		riskGroup: parent.riskGroup,
		filePath: parent.filePath
	};
}

export async function getBioOrgOriginalObject (tx: any, opLock: string, name: string) {
	return await OptimisticLock.ensureDBObjectIsTheSame(opLock, 'BioOrg', 'idBioOrg', tx, name, getBioOrgToString);
}

const BioOrgListResult = builder.objectRef<{
	totalCount: number;
	bios: any[];
}>('BioOrgListResult').implement({
	fields: (t) => ({
		totalCount: t.exposeInt('totalCount'),
		bios: t.field({
			type: [BioOrgRef],
			resolve: (parent) => parent.bios,
		}),
	}),
});

builder.queryType({
	fields: (t) => ({
		bioOrgs: t.prismaField({
			type: ['BioOrg'],
			authScopes: {
				needPermission: 'canListOrganisms'
			},
			resolve: async (query, root, args, ctx: any, info) => {
				return await ctx.prisma.BioOrg.findMany();
			},
		}),
		organismsFromFullText: t.field({
			type: BioOrgListResult,
			args: {
				search: t.arg.string({defaultValue: '', required: true}),
				skip: t.arg.int({defaultValue: 0, required: true}),
				take: t.arg.int({defaultValue: 20, required: true}),
			},
			validate: z.object({
				search: z.string().optional(),
				skip: z.number().int().nonnegative().optional(),
				take: z.number().int().nonnegative().optional()
			}),
			authScopes: {
				needPermission: 'canListOrganisms'
			},
			resolve: async (root, args, ctx: any) => {
				const bioList = await getBioOrgByName(ctx, args.search);

				const bios = args.take == 0 ? bioList : bioList.slice(args.skip, args.skip + args.take);
				const totalCount = bioList.length;

				return { bios, totalCount };
			},
		})
	}),
});

builder.mutationType({
	fields: (t) => ({
		addOrganism: t.string({
			authScopes: {
				needPermission: 'canEditOrganisms'
			},
			args: {
				organismName: t.arg.string({required: true}),
				risk: t.arg.int({required: true}),
				fileContent: t.arg.string(),
				fileName: t.arg.string(),
			},
			validate: z.object({
				organismName: z.string().regex(organismRegexp),
				risk: z.number().int().lte(3).gte(1),
				fileContent: z.string().optional().refine(
						(value) => value === undefined || sanitizeBase64DataUrl(value), {
							message: 'Invalid file content',
						}
					),
				fileName: z.string().regex(fileNameRegexp).optional(),
			}),
			resolve: async (root, args, ctx: any) => {
				return await ctx.prisma.$transaction(async (tx: any) => {
					const organism = await createBioOrg(tx, ctx.user, args.organismName, args.risk);
					await updateBioOrg(tx, organism.idBioOrg, ctx.user, args.organismName, args.risk, args.fileContent, args.fileName);
					return organism.organism;
				});
			},
		}),
		updateOrganism: t.string({
			authScopes: {
				needPermission: 'canEditOrganisms'
			},
			args: {
				opLock: t.arg.string({required: true}),
				organismName: t.arg.string({required: true}),
				risk: t.arg.int({required: true}),
				fileContent: t.arg.string(),
				fileName: t.arg.string(),
			},
			validate: z.object({
				opLock: opLockValidator,
				organismName: z.string().regex(organismRegexp),
				risk: z.number().int().lte(3).gte(1),
				fileContent: z.string().optional().refine(
					(value) => value === undefined || sanitizeBase64DataUrl(value), {
						message: 'Invalid file content',
					}
				),
				fileName: z.string().regex(fileNameRegexp).optional(),
			}),
			resolve: async (root, args, ctx: any) => {
				return await ctx.prisma.$transaction(async (tx: any) => {
					const org = await getBioOrgOriginalObject(tx, args.opLock, args.organismName);
					const updatedOrganism = await updateBioOrg(tx, org.idBioOrg, ctx.user, args.organismName, args.risk, args.fileContent, args.fileName);
					await updateBioOrgInHazards(tx, org.organism, updatedOrganism);
					return org.organism;
				});
			},
		}),
		deleteOrganism: t.string({
			authScopes: {
				needPermission: 'canEditOrganisms'
			},
			args: {
				opLock: t.arg.string({required: true, validate: opLockValidator}),
			},
			resolve: async (root, args, ctx: any) => {
				return await ctx.prisma.$transaction(async (tx: any) => {
					const org = await getBioOrgOriginalObject(tx, args.opLock, 'Organism');
					await deleteBioOrg(tx, org.idBioOrg);
					return true;
					})
			},
		}),
	}),
});
