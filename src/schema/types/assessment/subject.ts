import {builder} from "../../builder";

export const SubjectANDRef = builder.prismaObject('AssessmentDecisionSubject', {
	name: 'AssessmentDecisionSubject',
	fields: (t: any) => ({
		subject: t.exposeString('subject')
	}),
});
