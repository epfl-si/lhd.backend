import {builder} from "../builder";
import {Role} from '../../../generated/prisma/client';

export const UnitHasProfileRef = builder.prismaObject('UnitHasProfile', {
	name: 'UnitHasProfile',
	fields: (t: any) => ({
		role: t.exposeString('role'),
		unit: t.relation('unit'),
		person: t.relation('person'),
		expirationDate: t.expose('expirationDate', { type: 'DateTime' })
	}),
});

const RoleEnum = builder.enumType(Role, { name: 'Role' });

builder.queryType({
	fields: (t) => ({
		roles: t.field({
			type: [RoleEnum],
			authScopes: {
				needPermission: 'canListPeople'
			},
			resolve: () => Object.values(Role),
		}),
	}),
});
