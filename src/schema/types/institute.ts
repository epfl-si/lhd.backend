import {builder} from "../builder";

export const InstituteRef = builder.prismaObject('Institute', {
	name: 'Institute',
	fields: (t: any) => ({
		name: t.exposeString('name'),
		school: t.relation('school')
	}),
});
