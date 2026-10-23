import {builder} from "../builder";
import {Role} from '../../../generated/prisma/client';

export const UnitHasProfileRef = builder.prismaObject('UnitHasProfile', {
	name: 'UnitHasProfile',
	fields: (t: any) => ({
		role: t.string({
			resolve: async (parent: any, _: any, context: any) => {
				return splitCamelCase(parent.role);
			},
		}),
		unit: t.relation('unit'),
		person: t.relation('person'),
		expirationDate: t.expose('expirationDate', { type: 'DateTime' })
	}),
});

function splitCamelCase(str: string) {
	const label = str.replace(/([a-z])([A-Z])/g, '$1 $2') // Insert a space between lowercase and uppercase letters
	const txt = label.charAt(0).toUpperCase() + label.slice(1);
	return txt.replaceAll('_', ' ');
}

export const labelToRole = Object.fromEntries(
	Object.values(Role).map((r) => [splitCamelCase(r), r])
) as Record<string, Role>;

const RoleEnum = builder.enumType(Role, { name: 'Role' });

builder.queryType({
	fields: (t) => ({
		roles: t.stringList({
			authScopes: {
				needPermission: 'canListPeople'
			},
			resolve: () => {
				const roles = Object.values(Role);
				return roles.map(r => splitCamelCase(r));
			},
		}),
	}),
});
