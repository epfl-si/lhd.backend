import {builder} from "../../builder";

export const SubjectRef = builder.prismaObject('DispensationSubject', {
	name: 'DispensationSubject',
	fields: (t: any) => ({
		subject: t.exposeString('subject')
	}),
});
