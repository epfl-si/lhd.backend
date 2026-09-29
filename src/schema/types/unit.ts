import {builder} from "../builder";
import {OptimisticLock} from "../../lib/optimisticLock";
import {UnitHasProfileRef} from "./unitHasProfile";
import {z} from "zod";
import {buildSearchConditions} from "../../lib/searchConditionBuilder";
import {getUnitsFromApi} from "../../lib/callAPI";

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
					}
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

builder.queryField('unitsFromFullTextAndPagination', (t) =>
	t.field({
		type: UnitListResult,
		args: {
			search: t.arg.string({defaultValue: '', required: true}),
			skip: t.arg.int({defaultValue: 0, required: true}),
			take: t.arg.int({defaultValue: 20, required: true}),
		},
		validate: z.object({
			search: z.string().optional(),
			skip: z.number().int().nonnegative().optional(),
			take: z.number().int().nonnegative().optional()
		}),
		authScopes: {
			needPermission: 'canListUnits'
		},
		resolve: async (root, args, ctx: any) => {
			const search = buildSearchConditions(args.search);
			const unitList = await ctx.prisma.Unit.findMany({
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

			const units = args.take == 0 ? unitList : unitList.slice(args.skip, args.skip + args.take);
			const totalCount = unitList.length;

			return { units, totalCount };
		},
	})
);
