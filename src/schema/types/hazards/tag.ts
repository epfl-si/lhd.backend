import {builder} from "../../builder";
import {z} from "zod";
import {alphanumericRegexp} from "../../../lib/lhdValidators";

export const TagRef = builder.prismaObject('Tag', {
	name: 'Tag',
	fields: (t: any) => ({
		tagName: t.exposeString('tagName'),
	}),
});

builder.queryType({
	fields: (t) => ({
		availableTags: t.prismaField({
			type: [TagRef],
			authScopes: {
				needPermission: 'canListHazards'
			},
			args: {
				savedTags: t.arg.stringList({
					required: true,
					validate: z.array(z.string().trim().regex(alphanumericRegexp))
				}),
			},
			resolve: async (query, root, args, ctx: any, info) => {
				return await ctx.prisma.Tag.findMany({
					where: {
						tagName: { notIn: args.savedTags },
					}
				});
			},
		}),
	}),
});
