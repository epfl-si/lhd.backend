import {builder} from "../builder";
import {getUsersFromApi} from "../../lib/callAPI";
import {findPersonByName} from "../../model/persons";

builder.prismaObject('Person', {
	name: 'Person',
	fields: (t: any) => ({
		name: t.exposeString('name'),
		surname: t.exposeString('surname'),
		sciper: t.exposeInt('sciper'),
		email: t.exposeString('email')
	}),
});

export type PersonShape = {
	name?: string | null;
	surname?: string | null;
	email?: string | null;
	sciper?: number | null;
	type?: string | null;
};

export const PersonResult = builder.objectRef<PersonShape>('PersonResult').implement({
	fields: (t) => ({
		name: t.exposeString('name', { nullable: true }),
		surname: t.exposeString('surname', { nullable: true }),
		email: t.exposeString('email', { nullable: true }),
		sciper: t.exposeInt('sciper', { nullable: true }),
		type: t.exposeString('type', { nullable: true }),
	}),
});

builder.queryType({
	fields: (t) => ({
		people: t.prismaField({
			type: ['Person'],
			authScopes: {
				needPermission: 'canListPeople'
			},
			resolve: async (query, root, args, ctx: any, info) => {
				return await ctx.prisma.Person.findMany();
			},
		}),
		personFullText: t.field({
			type: [PersonResult],
			authScopes: {
				needPermission: 'canListPeople'
			},
			args: {
				search: t.arg.string({defaultValue: '', required: true}),
				lhdOnly: t.arg.boolean({defaultValue: false}),
			},
			resolve: async (root, args, ctx: any) => {
				const lhdPeople = await findPersonByName(ctx, args.search);
				const lhdPeopleTyped = lhdPeople.map((p: any) => ({
					type: 'Person',
					name: p.name,
					surname: p.surname,
					email: p.email,
					sciper: p.sciper
				}));

				const filteredLdapUsers: PersonShape[] = [];
				if (!args.lhdOnly) {
					const ldapUsers = await getUsersFromApi(args.search);
					ldapUsers["persons"].forEach((u: any) => {
						if (!lhdPeopleTyped.find((p: any) => p.sciper == u.id)) {
							filteredLdapUsers.push({
								type: 'DirectoryPerson',
								surname: u.lastname,
								name: u.firstname,
								email: u.email,
								sciper: u.id
							});
						}
					});
				}
				return lhdPeopleTyped.concat(filteredLdapUsers);
			},
		}),
	}),
});
