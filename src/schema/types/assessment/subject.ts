import {builder} from "../../builder";

export const SubjectANDRef = builder.prismaObject('AssessmentDecisionSubject', {
	name: 'AssessmentDecisionSubject',
	fields: (t: any) => ({
		subject: t.exposeString('subject')
	}),
});

builder.queryType({
	fields: (t) => ({
		assessmentDecisionSubjects: t.prismaField({
			type: [SubjectANDRef],
			authScopes: {
				needPermission: 'canListAssessments'
			},
			resolve: async (query, root, args, ctx: any, info) => {
				return await ctx.prisma.AssessmentDecisionSubject.findMany();
			},
		}),
	}),
});
