import {builder} from "../../builder";
import {OpLock, OptimisticLock} from "../../../lib/optimisticLock";
import {LabHasHazardsChild, Prisma} from "../../../../generated/prisma";
import {z} from "zod";
import {alphanumericRegexp, hazardCategoryNameRegexp, roomNameRegexp} from "../../../lib/lhdValidators";
import {sanitizeSearchString} from "../../../lib/searchStrings";
import {getLabHasHazardToString} from "./labHazard";

export const LabHazardChildRef = builder.prismaObject('LabHasHazardsChild', {
	name: 'LabHasHazardsChild',
	fields: (t: any) => ({
		submission: t.exposeString('submission'),
		hazardFormChildHistory: t.field({
			type: 'HazardFormChildHistory',
			resolve: async (parent: any, _: any, context: any) => {
				return await context.prisma.HazardFormChildHistory.findUnique({
					where: { idHazardFormChildHistory: parent.idHazardFormChildHistory},
					include: { hazardFormChild: true }
				})
			},
		}),
		hazards: t.field({
			type: 'LabHasHazards',
			resolve: async (parent: any, _: any, context: any) => {
				return await context.prisma.LabHasHazards.findUnique({
					where: { idLabHasHazards: parent.idLabHasHazards},
				})
			},
		}),
		opLock: t.string({
			resolve: async (parent: any, _: any, context: any) => {
				return OptimisticLock.createOpLock(parent.idLabHasHazardsChild, getLabHasHazardChildToString(parent));
			},
		})
	}),
});

export function getLabHasHazardChildToString(parent: LabHasHazardsChild) {
	return {
		idLabHasHazardsChild: parent.idLabHasHazardsChild,
		idLabHasHazards: parent.idLabHasHazards,
		idHazardFormChildHistory: parent.idHazardFormChildHistory,
		submission: parent.submission
	};
}

export async function getLabHasHazardChildOriginalObject (tx: any, opLock: OpLock, name: string) {
	return await OptimisticLock.getObjectByObfuscatedId(opLock, 'LabHasHazardsChild', 'idLabHasHazardsChild', tx, name, getLabHasHazardChildToString);
}

const searchSpec = {
	chemical:  {rename: 'chemical.haz_en', validate: alphanumericRegexp},
	organism:  {rename: 'organism.organism', validate: alphanumericRegexp},
	container: {rename: 'container.name', validate: alphanumericRegexp},
	Room:      {rename: 'room', validate: alphanumericRegexp},
	Cosec:     {rename: 'cosec', validate: alphanumericRegexp},
	Prof:      {rename: 'prof', validate: alphanumericRegexp},
	Unit:      {rename: 'unit', validate: alphanumericRegexp}
};

const searchSchema = z
	.string()
	.superRefine((s, ctx) => {
		try {
			sanitizeSearchString(s, searchSpec);
		} catch (e) {
			ctx.addIssue({
				code: 'custom',
				message: `Invalid search parameters: ${(e as Error).message}`,
			});
		}
	})
	.nullish();

export type HazardFlatShape = {
	labDisplay: string;
	hazardCategoryName: string;
	parentSubmission: string;
	childSubmission: string;
	idLabHasHazardsChild: string;
	idLabHasHazards: string;
	globalComment: string;
	modifiedBy: string;
	modifiedOn: Date;
	tags: string;
};

const HazardFlatRef = builder.objectRef<HazardFlatShape>('HazardFlatRef').implement({
	fields: (t) => ({
		labDisplay: t.exposeString('labDisplay'),
		hazardCategoryName: t.exposeString('hazardCategoryName'),
		parentSubmission: t.exposeString('parentSubmission'),
		childSubmission: t.exposeString('childSubmission'),
		idLabHasHazardsChild: t.exposeString('idLabHasHazardsChild'),
		idLabHasHazards: t.exposeString('idLabHasHazards'),
		globalComment: t.exposeString('globalComment'),
		modifiedBy: t.exposeString('modifiedBy'),
		modifiedOn: t.expose('modifiedOn', { type: 'DateTime' }),
		tags: t.exposeString('tags'),
	}),
});

const HazardListResult = builder.objectRef<{
	totalCount: number;
	hazards: any[];
}>('HazardListResult').implement({
	fields: (t) => ({
		totalCount: t.exposeInt('totalCount'),
		hazards: t.field({
			type: [HazardFlatRef],
			resolve: (parent) => parent.hazards,
		}),
	}),
});

builder.queryType({
	fields: (t) => ({
		hazardsWithPagination: t.field({
			type: HazardListResult,
			authScopes: {
				needPermission: 'canListHazards'
			},
			args: {
				search: t.arg.string({required: true, validate: z.string().regex(hazardCategoryNameRegexp)}),
				queryString: t.arg.string({defaultValue: '', validate: searchSchema}),
				skip: t.arg.int({defaultValue: 0, validate: z.number().int().min(0).nullish()}),
				take: t.arg.int({defaultValue: 20, validate: z.number().int().min(0).nullish()}),
			},
			resolve: async (root, args, ctx: any) => {
				const queryString = sanitizeSearchString(args.queryString ?? '', searchSpec, true);
				const conditions = queryString as any || {};
				const sql = Object.keys(conditions).map(key => {
					if (key === 'room') {
						return Prisma.sql`l.lab_display ilike ${Prisma.raw(`'%${conditions[key]}%'`)}`;
					} else if (key === 'cosec') {
						return Prisma.sql`(cos.email_person ilike ${Prisma.raw(`'%${conditions[key]}%'`)} 
						or cos.name_person ilike ${Prisma.raw(`'%${conditions[key]}%'`)} 
						or cos.surname_person ilike ${Prisma.raw(`'%${conditions[key]}%'`)})`;
					} else if (key === 'prof') {
						return Prisma.sql`(prof.email_person ilike ${Prisma.raw(`'%${conditions[key]}%'`)} 
						or prof.name_person ilike ${Prisma.raw(`'%${conditions[key]}%'`)} 
						or prof.surname_person ilike ${Prisma.raw(`'%${conditions[key]}%'`)})`;
					} else if (key === 'unit') {
						return Prisma.sql`(u.name_unit ilike ${Prisma.raw(`'%${conditions[key]}%'`)} 
						or i.name_institut ilike ${Prisma.raw(`'%${conditions[key]}%'`)} 
						or f.name_faculty ilike ${Prisma.raw(`'%${conditions[key]}%'`)})`;
					} else {
						return Prisma.sql`
	((lhh.submission::jsonb #>> ${Prisma.raw(`'{data,${key.replaceAll('.',',')}}'`)}) ilike ${Prisma.raw(`'%${conditions[key]}%'`)} OR 
	 (lhhc.submission::jsonb #>> ${Prisma.raw(`'{data,${key.replaceAll('.',',')}}'`)}) ilike ${Prisma.raw(`'%${conditions[key]}%'`)})`;
					}
				});
				const jsonCondition =
					sql.length > 0 ? Prisma.sql`${Prisma.join(sql, ` AND `)}` : Prisma.sql`1=1`;

				const rawQuery = Prisma.sql`select distinct l.lab_display as "labDisplay",
l.id_lab,
hc.hazard_category_name as "hazardCategoryName",
lhh.submission as "parentSubmission",
lhhc.submission as "childSubmission",
lhhc.id_lab_has_hazards_child as "idLabHasHazardsChild",
lhh.id_lab_has_hazards as "idLabHasHazards",
lhhc.id_hazard_form_child_history,
hfh.id_hazard_form_history,
lhhai.comment as "globalComment",
lhhai.modified_by as "modifiedBy",
lhhai.modified_on as "modifiedOn",
(select STRING_AGG(tag_name || '=' || comment, '&&') AS tags
 from tag
     inner join hazards_additional_info_has_tag on hazards_additional_info_has_tag.id_tag = tag.id_tag
 where hazards_additional_info_has_tag.id_lab_has_hazards_additional_info = lhhai.id_lab_has_hazards_additional_info) as tags
from lab_has_hazards_child lhhc 
right join lab_has_hazards lhh on lhh.id_lab_has_hazards = lhhc.id_lab_has_hazards
inner join hazard_form_history hfh on hfh.id_hazard_form_history =lhh.id_hazard_form_history
inner join hazard_form hf on hf.id_hazard_form = hfh.id_hazard_form
inner join hazard_category hc on hc.id_hazard_category = hf.id_hazard_category 
inner join lab l on l.id_lab = lhh.id_lab
left join unit_has_room uhr on uhr.id_lab = l.id_lab
left join unit u on u.id_unit = uhr.id_unit
left join unit_has_cosec uhc on uhc.id_unit = u.id_unit
left join person cos on cos.id_person = uhc.id_person
left join subunpro s on s.id_unit = u.id_unit
left join person prof on s.id_person = prof.id_person
left join institut i on i.id_institut = u.id_institut
left join faculty f on f.id_faculty = i.id_faculty
left join lab_has_hazards_additional_info lhhai on lhhai.id_lab = l.id_lab
where hc.hazard_category_name = ${args.search}
and lhhai.id_hazard_category = hc.id_hazard_category 
and ${jsonCondition}
order by l.lab_display asc
`;
				const hazardList = await ctx.prisma.$queryRaw<any[]>`${rawQuery}`;
				const hazardsFiltered = args.take == 0 ? hazardList : hazardList.slice(args.skip, (args.skip ?? 0) + (args.take ?? 20));
				const hazards = hazardsFiltered.map((h: any) => {
					if (h.id_lab_has_hazards_child) {
						h.submission = h.child_submission;
						const encryptedID = OptimisticLock.obfuscate({id: h.id_lab_has_hazards_child, obj: getLabHasHazardChildToString(h)});
						h.id_lab_has_hazards_child = JSON.stringify(encryptedID);
					}
					h.submission = h.parent_submission;
					const encryptedIDForParent = OptimisticLock.obfuscate({id: h.id_lab_has_hazards, obj: getLabHasHazardToString(h)});
					h.id_lab_has_hazards = JSON.stringify(encryptedIDForParent);
					return h;
				});
				const totalCount = hazardList.length;

				return {hazards, totalCount};
			},
		}),
	}),
});
