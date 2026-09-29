import {builder} from "../builder";

export const SchoolRef = builder.prismaObject('School', {
	name: 'School',
	fields: (t: any) => ({
		name: t.exposeString('name'),
	}),
});
