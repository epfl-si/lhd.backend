import {builder} from "../builder";
import {OptimisticLock} from "../../lib/optimisticLock";
import {UnitHasProfileRef} from "./unitHasProfile";
import {z} from "zod";
import {buildSearchConditions} from "../../lib/searchConditionBuilder";
import {getUnitsFromApi} from "../../lib/callAPI";
import {opLockValidator, personNameRegexp, unitNameRegexp} from "../../lib/lhdValidators";
import {findOrCreatePerson} from "../../model/persons";
import {
	createInstitute,
	createSchool, createUnit,
	deleteUnitCascade, findInstituteByName, findSchoolByName,
	findSingleUnitByName,
	findUniqueUnit,
	getUnitListBySearch,
	updateProfiles,
	updateSubUnits,
	updateUnit
} from "../../model/units";
import {Role, Unit} from "../../../generated/prisma";

export const UnitRef = builder.prismaObject('Unit', {
	name: 'Unit',
	fields: (t: any) => ({
		name: t.exposeString('name'),
		unitId: t.exposeInt('unitId'),
		institute: t.relation('institute'),
		responsible: t.relation('responsible'),
		subUnits: t.field({
			type: ['Unit'],
			resolve: async (parent: any, _: any, context: any) => {
				return context.prisma.Unit.findMany({
					where: {
						unitId: null,
						name: {
							startsWith: `${parent.name} (`,
						},
					},
				});
			},
		}),
		profiles: t.prismaField({
			type: [UnitHasProfileRef],
			resolve: async (query: any, parent: any, _: any, context: any) => {
				return await context.prisma.UnitHasProfile.findMany({
					...query,
					where: {
						idUnit: parent.id,
					},
					orderBy: [
						{
							expirationDate: 'desc'
						},
						{
							role: 'desc'
						}
					]
				})
			},
		}),
		unitType: t.string({
			resolve: async (parent: any, _: any, context: any) => {
				const units: any = await getUnitsFromApi(parent.name);
				return (units && units["units"].length > 0 && units["units"][0].unittype) ? units["units"][0].unittype.label : '';
			},
		}),
		opLock: t.field({
			type: 'String',
			resolve: async (parent: any, _: any, context: any) => {
				return OptimisticLock.createOpLock(parent.id, getUnitToString(parent));
			},
		}),
	}),
});

export function getUnitToString(parent: Unit) {
	return {
		id: parent.id,
		unitId: parent.unitId,
		name: parent.name,
		idInstitute: parent.idInstitute
	};
}

export async function getUnitOriginalObject (tx: any, opLock: string, name: string) {
	return await OptimisticLock.ensureDBObjectIsTheSame(opLock,
		'Unit', 'id',
		tx, name, getUnitToString);
}

const UnitListResult = builder.objectRef<{
	totalCount: number;
	units: any[];
}>('UnitListResult').implement({
	fields: (t) => ({
		totalCount: t.exposeInt('totalCount'),
		units: t.field({
			type: [UnitRef],
			resolve: (parent) => parent.units,
		}),
	}),
});

const PersonInputType = builder.inputType('PersonInputType', {
	fields: (t) => ({
		sciper: t.int({ required: true, validate: z.number().int().min(10000) }),
		name: t.string({ required: true, validate: z.string().regex(personNameRegexp)}),
		surname: t.string({ required: true, validate: z.string().regex(personNameRegexp) }),
		type: t.string(),
		email: t.string({ required: true, validate: z.email() }),
	}),
});

const ProfileInputType = builder.inputType('ProfileInputType', {
	fields: (t) => ({
		status: t.string({ required: true, validate: z.enum(['New', 'Deleted', 'Default']) }),
		role: t.field({ type: Role, required: true }),
		expirationDate: t.string({ validate: z.iso.date() }),
		person: t.field({ type: PersonInputType, required: true }),
	}),
});

const UnitInputType = builder.inputType('UnitInputType', {
	fields: (t) => ({
		status: t.string({ required: true, validate: z.enum(['New', 'Deleted', 'Default']) }),
		name: t.string({ required: true, validate: z.string().regex(unitNameRegexp) })
	}),
});

export const UnitCreationInput = builder.inputType('UnitCreationType', {
	fields: (t) => ({
		name: t.string({ required: true, validate: z.string().regex(unitNameRegexp) }),
		unitId: t.int({ required: true, validate: z.number().int().min(10000) }),
		responsibleId: t.int({ validate: z.number().int().min(1000) }),
		path: t.string({ required: true, validate: z.string().regex(unitNameRegexp) }),
		responsibleFirstName: t.string({ validate: z.string().regex(personNameRegexp) }),
		responsibleLastName: t.string({ validate: z.string().regex(personNameRegexp) }),
		responsibleEmail: t.string({ validate: z.email().nullish() }),
	}),
});

const unitCreationArgs = builder.args((t) => ({
	units: t.field({
		type: [UnitCreationInput],
		required: { list: true, items: true },
	}),
}));

type UnitFromAPIShape = {
	name?: string | null;
	path?: string | null;
	unitId?: string | null;
	responsibleId?: string | null;
	responsibleFirstName?: string | null;
	responsibleLastName?: string | null;
	responsibleEmail?: string | null;
};

const UnitsFromAPIResult = builder.objectRef<UnitFromAPIShape>('UnitsFromAPIResult').implement({
	fields: (t) => ({
		name: t.exposeString('name', { nullable: true }),
		path: t.exposeString('path', { nullable: true }),
		unitId: t.exposeString('unitId', { nullable: true }),
		responsibleId: t.exposeString('responsibleId', { nullable: true }),
		responsibleFirstName: t.exposeString('responsibleFirstName', { nullable: true }),
		responsibleLastName: t.exposeString('responsibleLastName', { nullable: true }),
		responsibleEmail: t.exposeString('responsibleEmail', { nullable: true })
	}),
});

builder.queryType({
	fields: (t) => ({
		unitByName: t.prismaField({
			type: 'Unit',
			authScopes: {
				needPermission: 'canListUnits'
			},
			args: {
				name: t.arg.string({required: true, validate: z.string().regex(unitNameRegexp)}),
			},
			resolve: async (query, root, args, ctx: any, info) => {
				return await findSingleUnitByName(ctx, args.name);
			},
		}),
		unitsFromFullTextAndPagination: t.field({
			type: UnitListResult,
			authScopes: {
				needPermission: 'canListUnits'
			},
			args: {
				search: t.arg.string({defaultValue: '', required: true}),
				skip: t.arg.int({defaultValue: 0, required: true, validate: z.number().int().min(0)}),
				take: t.arg.int({defaultValue: 20, required: true, validate: z.number().int().min(20)}),
			},
			resolve: async (root, args, ctx: any) => {
				const unitList = await getUnitListBySearch(ctx, buildSearchConditions(args.search));

				const units = args.take == 0 ? unitList : unitList.slice(args.skip, args.skip + args.take);
				const totalCount = unitList.length;

				return { units, totalCount };
			},
		}),
		unitsFromAPI: t.field({
			type: [UnitsFromAPIResult],
			authScopes: {
				needPermission: 'canListUnits'
			},
			args: {
				search: t.arg.string({required: true}),
			},
			resolve: async (root, args, ctx: any) => {
				const units = await getUnitsFromApi(args.search);
				const unitList: UnitFromAPIShape[] = [];
				units["units"].forEach((u: any) =>
				{
					unitList.push({
						name: u.name,
						path: u.path,
						unitId: u.id,
						responsibleId: u.responsibleid !== "" ? u.responsibleid : -1,
						responsibleFirstName: u.responsible ? u.responsible.firstname : '',
						responsibleLastName: u.responsible ? u.responsible.lastname : '',
						responsibleEmail: u.responsible ? u.responsible.email : ''

					});
				});
				return unitList;
			},
		})
	}),
});

builder.mutationType({
	fields: (t) => ({
		createUnit: t.boolean({
			authScopes: {
				needPermission: 'canEditUnits'
			},
			args: unitCreationArgs,
			resolve: async (root, args, ctx: any) => {
				return await ctx.prisma.$transaction(async (tx: any) => {
					for (const unit of args.units) {
							const newUnit = await findUniqueUnit(tx, unit.unitId);
							if (!newUnit) {
								const parts: string[] = unit.path.split(' ');
								const instituteName: string = parts[2];
								let institute = await findInstituteByName(tx, instituteName);

								if (!institute) {
									const facultyName: string = parts[1];
									let faculty = await findSchoolByName(tx, facultyName);
									if (!faculty) {
										faculty = await createSchool(tx, facultyName);
									}
									institute = await createInstitute(tx, instituteName, faculty.id)
								}

								let responsibleID = null;
								if (unit.responsibleId) {
									const responsible = await findOrCreatePerson(tx, unit.responsibleId, unit.responsibleFirstName ?? '', unit.responsibleLastName ?? '', unit.responsibleEmail ?? '');
									responsibleID = responsible.idPerson;
								}

								await createUnit(tx, unit.name, unit.unitId, institute.id, responsibleID);
							}
					}
					return true;
				});
			},
		}),
		updateUnit: t.string({
			authScopes: {
				needPermission: 'canEditUnits'
			},
			args: {
				opLock: t.arg.string({required: true, validate: opLockValidator}),
				profiles: t.arg({
					type: [ProfileInputType],
					required: { list: true, items: true },
				}),
				subUnits: t.arg({
					type: [UnitInputType],
					required: { list: true, items: true },
				}),
				unit: t.arg.string({required: true})
			},
			resolve: async (root, args, ctx: any) => {
				return await ctx.prisma.$transaction(async (tx: any) => {
					const unit = await getUnitOriginalObject(tx, args.opLock, args.unit);
					if (!unit.unitId) {
						await updateUnit(tx, unit.id, args.unit);
					}
					await updateProfiles(tx, args.profiles, unit.id);
					await updateSubUnits(tx, ctx, args.subUnits, unit.idInstitute);
					return unit.name;
				});
			},
		}),
		deleteUnit: t.field({
			type: 'Boolean',
			authScopes: {
				needPermission: 'canEditUnits'
			},
			args: {
				opLock: t.arg.string({required: true, validate: opLockValidator})
			},
			resolve: async (root, args, ctx: any) => {
				return await ctx.prisma.$transaction(async (tx: any) => {
					const unit = await getUnitOriginalObject(tx, args.opLock, "Unit");
					await deleteUnitCascade(tx, unit);
					return true;
				});
			},
		})
	}),
});
