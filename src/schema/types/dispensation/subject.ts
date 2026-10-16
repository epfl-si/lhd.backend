import {builder} from "../../builder";

export const SubjectRef = builder.prismaObject('DispensationSubject', {
	name: 'DispensationSubject',
	fields: (t: any) => ({
		subject: t.exposeString('subject')
	}),
});

builder.queryType({
	fields: (t) => ({
		dispensationSubjects: t.prismaField({
			type: [SubjectRef],
			authScopes: {
				needPermission: 'canListDispensations'
			},
			resolve: async (query, root, args, ctx: any, info) => {
				return await ctx.prisma.DispensationSubject.findMany();
			},
		}),
	}),
});
