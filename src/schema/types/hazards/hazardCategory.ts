import {builder} from "../../builder";

export const HazardCategoryRef = builder.prismaObject('HazardCategory', {
	name: 'HazardCategory',
	fields: (t: any) => ({
		hazardCategoryName: t.exposeString('hazardCategoryName'),
	}),
});

builder.queryType({
	fields: (t) => ({
		hazardCategories: t.prismaField({
			type: [HazardCategoryRef],
			authScopes: {
				needPermission: 'canListHazards'
			},
			resolve: async (query, root, args, ctx: any, info) => {
				return await ctx.prisma.HazardCategory.findMany();
			},
		}),
	}),
});
