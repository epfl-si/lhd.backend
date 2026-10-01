import {builder} from "../builder";
import {OptimisticLock} from "../../lib/optimisticLock";
import {UnitHasProfileRef} from "./unitHasProfile";
import {z} from "zod";
import {buildSearchConditions} from "../../lib/searchConditionBuilder";
import {getUnitsFromApi} from "../../lib/callAPI";
import {personNameRegexp, unitNameRegexp} from "../../lib/lhdValidators";
import {findOrCreatePerson} from "../../model/persons";
import {deleteUnitCascade, getUnitListBySearch} from "../../model/units";
import {Role, Unit} from "../../../generated/prisma";

const UnitRef = builder.prismaObject('Unit', {
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

export function getUnitToString(parent: any) {
	return {
		id: parent.id,
		unitId: parent.unitId,
		name: parent.name,
		idInstitute: parent.idInstitute
	};
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
				return await ctx.prisma.Unit.findFirst({
					where: {
						name: args.name
					}
				});
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
							const newUnit = await tx.Unit.findUnique({ where: { unitId: unit.unitId }});

							if (!newUnit) {
								const parts: string[] = unit.path.split(' ');
								const instituteName: string = parts[2];
								let institute = await tx.Institute.findFirst({where: { name: instituteName}});

								if (!institute) {
									const facultyName: string = parts[1];
									let faculty = await tx.School.findFirst({where: { name: facultyName}});

									if (!faculty) {
										faculty = await tx.School.create({
											data: {
												name: facultyName,
											}
										});
									}

									institute = await tx.Institute.create({
										data: {
											name: instituteName,
											id_school: faculty.id
										}
									});
								}

								let responsibleID = null;
								if (unit.responsibleId) {
									const responsible = await findOrCreatePerson(tx, unit.responsibleId, unit.responsibleFirstName ?? '', unit.responsibleLastName ?? '', unit.responsibleEmail ?? '');
									responsibleID = responsible.idPerson;
								}

								const u = await tx.Unit.create({
									data: {
										name: unit.name,
										unitId: unit.unitId,
										idInstitute: institute.id,
										responsibleId: responsibleID
									}
								});

								if (responsibleID) {
									await tx.UnitHasProfile.create({
										data: {
											idPerson: responsibleID,
											idUnit: u.id,
											role: Role.Professor
										}
									});
								}
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
				opLock: t.arg.string({required: true}),
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
					const unit = await OptimisticLock.ensureDBObjectIsTheSame(args.opLock,
						'Unit', 'id',
						tx, args.unit, getUnitToString);

					if (!unit.unitId) {
						await tx.Unit.update(
							{ where: { id: unit.id },
								data: {
									name: args.unit
								}
							});
					}

					for (const person of args.profiles) {
						if (person.status === 'New') {
							const p = await findOrCreatePerson(tx, person.person.sciper, person.person.name, person.person.surname, person.person.email);
							await tx.UnitHasProfile.create({
								data: {
									idPerson: p.idPerson,
									idUnit: unit.id,
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
									idUnit: unit.id,
									idPerson: p.idPerson,
									role: person.role
								}
							});
						}
					}

					for (const subunit of args.subUnits) {
						if (subunit.status === 'New') {
							await tx.Unit.create({
								data: {
									name: subunit.name,
									idInstitute: unit.idInstitute
								}
							});
						}
						else if (subunit.status === 'Deleted') {
							const u = await tx.Unit.findFirst({ where: { name: subunit.name }});
							if (u) await deleteUnitCascade(tx, ctx, u);
						}
					}

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
				opLock: t.arg.string({required: true})
			},
			resolve: async (root, args, ctx: any) => {
				return await ctx.prisma.$transaction(async (tx: any) => {
					const unit = await OptimisticLock.ensureDBObjectIsTheSame(args.opLock,
						'Unit', 'id',
						tx, 'Unit', getUnitToString);

					await deleteUnitCascade(tx, ctx, unit);
					return true;
				});
			},
		})
	}),
});
