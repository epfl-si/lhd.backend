import {builder} from "../builder";
import {Role} from '../../../generated/prisma/client';
import { splitCamelCase } from "../../lib/stringFormatter";

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
