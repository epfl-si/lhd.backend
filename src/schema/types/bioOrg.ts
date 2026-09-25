import {builder} from "../builder";
import {OptimisticLock} from "../../lib/optimisticLock";

builder.prismaObject('BioOrg', {
	name: 'BioOrg',
	fields: (t: any) => ({
		organism: t.exposeString('organism'),
		riskGroup: t.exposeInt('riskGroup'),
		filePath: t.exposeString('filePath'),
		updatedOn: t.expose('updatedOn', { type: 'DateTime' }),
		updated_by: t.exposeString('updated_by'),
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

builder.queryType({
	fields: (t) => ({
		bioOrgs: t.prismaField({
			type: ['BioOrg'],
			authScopes: {
				needPermission: 'canListOrganisms'
			},
			args: {
				barcode: t.arg.string(),
			},
			validate: z.object({
				barcode: z.string().nonempty(),
			}),
			resolve: async (query, root, args, ctx: any, info) => {
				return await ctx.prisma.BioOrg.findMany();
			},
		}),
	}),
});
