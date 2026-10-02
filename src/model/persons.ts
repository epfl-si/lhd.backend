import {Person} from "../../generated/prisma";
import {getUsersFromApi} from "../lib/callAPI";

export async function findOrCreatePerson(tx: any, sciperId: number, firstName: string, lastName: string, email: string): Promise<Person> {
	let p = await tx.Person.findUnique({ where: { sciper: sciperId }});

	if (!p) {
		p = await tx.Person.create({
			data: {
				name: firstName,
				surname: lastName,
				sciper: sciperId,
				email: email
			}
		});
	}
	return p;
}

export async function ensurePerson(prisma: any, persons: any) {
	for ( const holder of persons ) {
		let p = await prisma.Person.findUnique({where: {sciper: holder.sciper}});

		if ( !p ) {
			const ldapUsers = await getUsersFromApi(holder.sciper + "");
			const ldapUser = ldapUsers["persons"].find((p: { id: string; }) => p.id == holder.sciper + "");
			await prisma.$transaction(async (tx: any) => {
				await tx.Person.create({
					data: {
						surname: ldapUser.lastname,
						name: ldapUser.firstname,
						email: ldapUser.email,
						sciper: parseInt(ldapUser.id)
					}
				});
			});
		}
	}
}

export async function findPersonByName (ctx: any, search: string) {
	return await ctx.prisma.Person.findMany({
		where: {
			OR: [
				{ name: { contains: search }},
				{ surname : { contains: search }},
			]
		}
	});
}
