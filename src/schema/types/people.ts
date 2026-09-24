import {builder} from "../builder";

builder.prismaObject('Person', {
	name: 'Person',
	fields: (t: any) => ({
		name: t.exposeString('name'),
		surname: t.exposeString('surname'),
		sciper: t.int('sciper'),
		email: t.string('email'),
		type: t.string()
	}),
});

builder.queryType({
	fields: (t) => ({
		people: t.prismaField({
			type: ['Person'],
			resolve: async (query, root, args, ctx: any, info) => {
				return await ctx.prisma.person.findMany();
			},
		}),
	}),
});
