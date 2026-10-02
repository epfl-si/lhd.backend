import {Role, Unit} from "../../generated/prisma";
import {buildSearchConditions} from "../lib/searchConditionBuilder";
import {findOrCreatePerson} from "./persons";

export async function deleteUnitCascade (tx: any, u:Unit) {
	await tx.UnitHasProfile.deleteMany({
		where: {
			idUnit: u.id,
		}
	});

	await tx.UnitHasRoom.deleteMany({
		where: {
			idUnit: u.id,
		}
	});

	//TODO remove this when deleting table
	await tx.Subunpro.deleteMany({
		where: {
			idUnit: u.id,
		},
	});
	await tx.UnitHasCosec.deleteMany({
		where: {
			idUnit: u.id,
		}
	});

	const subUnitList = await tx.Unit.findMany({
		where: {
			name: { startsWith: u.name },
			id: { not: u.id }
		}
	});
	for await (const subUnit of subUnitList) {
		await deleteUnitCascade(tx, subUnit);
	}

	await tx.Unit.delete({
		where: {
			id: u.id,
		},
	});
}

export async function getUnitByName (prisma: any, unitName: string) {
	const search = buildSearchConditions(unitName);
	return await prisma.Unit.findMany({
		where: {
			OR: [
				{ name: search },
				{ institute : { name: search }},
				{ institute : { school: { name: search } }},
			]
		},
		include: { UnitHasProfile: { include: { person: true } }, institute: { include: { school: true } }, UnitHasRoom: { include: true } },
		orderBy: [
			{
				name: 'asc',
			},
		]
	});
}

export async function getUnitListBySearch (ctx: any, search: object) {
	return await ctx.prisma.Unit.findMany({
		where: {
			OR: [
				{ name: search },
				{ institute : { name: search }},
				{ institute : { school: { name: search } }},
				{ unitHasProfiles: { some: { person: { name: search }}}}
			]
		},
		orderBy: [
			{
				name: 'asc',
			},
		]
	});
}

export async function getParentUnit (prisma: any, nameParent: string) {
	return await prisma.Unit.findMany({
		where: {name: nameParent},
		orderBy: [
			{
				name: 'asc',
			},
		]
	});
}

export async function findSingleUnitByName (ctx: any, name: string) {
	return await ctx.prisma.Unit.findFirst({
		where: {
			name: name
		}
	});
}

export async function findUniqueUnit (tx: any, id: number) {
	return await tx.Unit.findUnique({ where: { unitId: id }});
}

export async function updateUnit (tx: any, id: number, name: string) {
	await tx.Unit.update(
		{ where: { id: id },
			data: {
				name: name
			}
		});
}

export async function updateProfiles (tx: any, profiles: any[], id: number) {
	for (const person of profiles) {
		if (person.status === 'New') {
			const p = await findOrCreatePerson(tx, person.person.sciper, person.person.name, person.person.surname, person.person.email);
			await tx.UnitHasProfile.create({
				data: {
					idPerson: p.idPerson,
					idUnit: id,
					role: person.role,
					expirationDate: person.expirationDate ? new Date(person.expirationDate) : null
				}
			});
		}
		else if (person.status === 'Deleted') {
			let p = await tx.Person.findUnique({ where: { sciper: person.person.sciper }});
			if (!p) continue;
			await tx.UnitHasProfile.deleteMany({
				where: {
					idUnit: id,
					idPerson: p.idPerson,
					role: person.role
				}
			});
		}
	}
}

export async function updateSubUnits (tx: any, ctx: any, subUnits: any[], idInstitute: number) {
	for (const subunit of subUnits) {
		if (subunit.status === 'New') {
			await tx.Unit.create({
				data: {
					name: subunit.name,
					idInstitute: idInstitute
				}
			});
		}
		else if (subunit.status === 'Deleted') {
			const u = await findSingleUnitByName(ctx, subunit.name);
			if (u) await deleteUnitCascade(tx, u);
		}
	}
}

export async function findInstituteByName (tx: any, name: string) {
	return await tx.Institute.findFirst({where: { name: name}});
}

export async function findSchoolByName (tx: any, name: string) {
	return await tx.School.findFirst({where: { name: name}});
}

export async function createInstitute (tx: any, name: string, facultyId: number) {
	return await tx.Institute.create({
		data: {
			name: name,
			id_school: facultyId
		}
	});
}

export async function createSchool (tx: any, name: string) {
	return await tx.School.create({
		data: {
			name: name,
		}
	});
}

export async function createUnit (tx: any, name: string, sciper: number, instituteId: number, responsibleId: number | null) {
	const unit = await tx.Unit.create({
		data: {
			name: name,
			unitId: sciper,
			idInstitute: instituteId,
			responsibleId: responsibleId
		}
	});
	if (responsibleId) {
		await tx.UnitHasProfile.create({
			data: {
				idPerson: responsibleId,
				idUnit: unit.id,
				role: Role.Professor
			}
		});
	}
	return unit;
}
