import {builder} from "../builder";

export const UnitHasProfileRef = builder.prismaObject('UnitHasProfile', {
	name: 'UnitHasProfile',
	fields: (t: any) => ({
		role: t.exposeString('role'),
		unit: t.relation('unit'),
		person: t.relation('person'),
		expirationDate: t.expose('expirationDate', { type: 'DateTime' })
	}),
});
