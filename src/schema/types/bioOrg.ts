import {builder} from "../builder";
import {OptimisticLock} from "../../lib/optimisticLock";
import {z} from "zod";
import {buildSearchConditions} from "../../lib/searchConditionBuilder";
import {fileNameRegexp, organismRegexp} from "../../lib/lhdValidators";
import {sanitizeBase64DataUrl} from "../../lib/fieldValidatePlugin";
import {getUserString} from "../../lib/userType";
import {saveBase64File} from "../../lib/fileUtilities";

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
				return OptimisticLock.createOpLock(parent.id_bio_org, getBioOrgToString(parent));
			},
		})
	}),
});

export function getBioOrgToString(parent: any) {
	return {
		id: parent.id_bio_org,
		organism: parent.organism,
		risk_group: parent.risk_group,
		filePath: parent.filePath
	};
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
	}),
});

builder.queryField('organismsFromFullText', (t) =>
	t.field({
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
			const bioList =  await ctx.prisma.BioOrg.findMany({
				where: { organism: buildSearchConditions(args.search) },
				orderBy: [
					{
						organism: 'asc',
					},
				]
			});

			const bios = args.take == 0 ? bioList : bioList.slice(args.skip, args.skip + args.take);
			const totalCount = bioList.length;

			return { bios, totalCount };
		},
	})
);

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
					const organism = await tx.BioOrg.create({
						data: {
							organism: args.organismName,
							riskGroup: args.risk,
							updatedOn: new Date(),
							updatedBy: getUserString(ctx.user),
						}
					});

					if (args.fileContent && args.fileName) {
						await tx.BioOrg.update({
							data: {
								filePath: saveBase64File(args.fileContent, 'd_bio/' + organism.idBioOrg + '/', args.fileName)
							},
							where: {
								idBioOrg: organism.idBioOrg
							}
						});
					}

					return organism.organism;
				});
			},
		}),
	}),
});
