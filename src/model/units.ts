import {Unit} from "../../generated/prisma";
import {buildSearchConditions} from "../lib/searchConditionBuilder";

export async function deleteUnitCascade(tx: any, context: any, u:Unit) {
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
		await deleteUnitCascade(tx, context, subUnit);
	}

	await tx.Unit.delete({
		where: {
			id: u.id,
		},
	});
}

export async function getUnitByName(prisma: any, unitName: string) {
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

export async function getParentUnit(prisma: any, nameParent: string) {
	return await prisma.Unit.findMany({
		where: {name: nameParent},
		orderBy: [
			{
				name: 'asc',
			},
		]
	});
}
