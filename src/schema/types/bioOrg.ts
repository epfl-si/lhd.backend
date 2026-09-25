import {builder} from "../builder";
import {OptimisticLock} from "../../lib/optimisticLock";
import {z} from "zod";
import {buildSearchConditions} from "../../lib/searchConditionBuilder";

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
