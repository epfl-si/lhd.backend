import {builder} from "../builder";
import {z} from "zod";
import {dbNamesRegexp, opLockValidator} from "../../lib/lhdValidators";
import {OptimisticLock} from "../../lib/optimisticLock";
import {MutationLogs} from "../../../generated/prisma";
import {diffObjects} from "../../lib/jsonUtils";

export const MutationLogsRef = builder.prismaObject('MutationLogs', {
	name: 'MutationLogs',
	fields: (t: any) => ({
		modifiedBy: t.exposeString('modifiedBy'),
		modifiedOn: t.expose('modifiedOn', { type: 'DateTime' }),
		tableName: t.exposeString('tableName'),
		columnName: t.exposeString('columnName'),
		oldValue: t.exposeString('oldValue'),
		newValue: t.exposeString('newValue'),
		action: t.exposeString('action'),
	}),
});

const DiffEntry = builder.objectRef<{
	field: string;
	before: string;
	after: string;
}>('DiffEntry').implement({
	fields: (t) => ({
		field: t.exposeString('field'),
		before: t.exposeString('before'),
		after: t.exposeString('after'),
	}),
});

const DiffResult = builder.objectRef<{
	modifiedBy: string;
	modifiedOn: Date;
	diffs: any[];
}>('DiffResult').implement({
	fields: (t) => ({
		modifiedBy: t.exposeString('modifiedBy'),
		modifiedOn: t.expose('modifiedOn', { type: 'DateTime' }),
		diffs: t.field({
			type: [DiffEntry],
			resolve: (parent) => parent.diffs,
		}),
	}),
});

builder.queryType({
	fields: (t) => ({
		mutationLogsByTable: t.field({
			type: [DiffResult],
			args: {
				tableName: t.arg.stringList({
					required: true,
					validate: z.array(z.string().trim().regex(dbNamesRegexp))
				}),
				tableIdentifier: t.arg.string({required: true, validate: opLockValidator}),
				excludedField: t.arg.stringList({
					required: true,
					validate: z.array(z.string().trim().regex(dbNamesRegexp))
				}),
			},
			authScopes: {
				needPermission: 'canListLogs'
			},
			resolve: async (root, args, ctx: any) => {
				if (args.tableName && args.tableIdentifier) {
					const id = OptimisticLock.getOpLock(args.tableIdentifier);
					const idDeobfuscated = OptimisticLock.getIdDeobfuscated(id);
					const logs = await ctx.prisma.MutationLogs.findMany({
						where: {
							tableName: { in: args.tableName },
							tableId: { equals: idDeobfuscated }
						},
						orderBy: [{ modifiedOn: 'desc' }]
					});
					const res: { modifiedOn: Date; modifiedBy: string; diff: Record<string, any>; }[] = [];
					logs.forEach((log: MutationLogs) => {
						const newValue = log.newValue !== '' ? JSON.parse(log.newValue) : {};
						if (newValue.status !== 'Draft') {
							const oldValue = log.oldValue !== '' ? JSON.parse(log.oldValue)[0] : {};
							const diff = diffObjects(oldValue, newValue, [...args.excludedField]);
							if ( Object.keys(diff).length > 0 ) {
								res.push({
									modifiedOn: log.modifiedOn,
									modifiedBy: log.modifiedBy,
									diff: diff
								});
							}
						}
					});
					return await groupByModifiedOn(ctx.prisma, res);
				}
				return [];
			},
		})
	}),
});

async function groupByModifiedOn(prisma: any, data: { modifiedOn: Date; modifiedBy: string; diff: Record<string, any>; }[]) {
	const result = [];
	for (const entry of data) {
		const diffs = await Promise.all(Object.entries(entry.diff).map(
			async ([field, change]) => {
				if (field === 'idDispensationSubject') {
					const oldSubject = change["before"] ? await prisma.DispensationSubject.findUnique({where: {idDispensationSubject: Number(change["before"]) }}) : '';
					const newSubject = change["after"] ? await prisma.DispensationSubject.findUnique({where: {idDispensationSubject: Number(change["after"]) }}) : '';
					return {
						field,
						before: oldSubject ? `${oldSubject.subject}` : '',
						after: newSubject ? `${newSubject.subject}` : ''
					}
				}
				else if (field === 'idAssessmentAndDecisionSubject') {
					const oldSubject = change["before"] ? await prisma.AssessmentDecisionSubject.findUnique({where: {idAssessmentAndDecisionSubject: Number(change["before"]) }}) : '';
					const newSubject = change["after"] ? await prisma.AssessmentDecisionSubject.findUnique({where: {idAssessmentAndDecisionSubject: Number(change["after"]) }}) : '';
					return {
						field,
						before: oldSubject ? `${oldSubject.subject}` : '',
						after: newSubject ? `${newSubject.subject}` : ''
					}
				}
				else if (field === 'idPerson') {
					const oldValue = change["before"] ? await prisma.person.findUnique({where: {idPerson: Number(change["before"]) }}) : undefined;
					const newValue = change["after"] ? await prisma.person.findUnique({where: {idPerson: Number(change["after"]) }}) : undefined;
					return {
						field,
						before: oldValue ? `${oldValue.name} ${oldValue.surname}` : '',
						after: newValue ? `${newValue.name} ${newValue.surname}` : ''
					}
				}
				else if (field === 'idUnit') {
					const oldValue = change["before"] ? await prisma.Unit.findUnique({where: {id: Number(change["before"]) }}) : undefined;
					const newValue = change["after"] ? await prisma.Unit.findUnique({where: {id: Number(change["after"]) }}) : undefined;
					return {
						field,
						before: oldValue ? oldValue.name : '',
						after: newValue ? newValue.name : ''
					}
				}
				else if (field === 'idLab') {
					const oldValue = change["before"] ? await prisma.room.findUnique({where: {id: Number(change["before"]) }}) : undefined;
					const newValue = change["after"] ? await prisma.room.findUnique({where: {id: Number(change["after"]) }}) : undefined;
					return {
						field,
						before: oldValue ? `${oldValue.name}` : '',
						after: newValue ? `${newValue.name}` : ''
					}
				}
				else if (field === 'dateEnd') {
					return {
						field,
						before: change["before"] ? new Intl.DateTimeFormat('en-GB').format(new Date(change["before"])) : '',
						after: change["after"] ? new Intl.DateTimeFormat('en-GB').format(new Date(change["after"])) : '',
					}
				}
				else if (field === 'filePath') {
					return {
						field,
						before: change["before"] ? change["before"].split('/').pop() : '',
						after: change["after"] ? change["after"].split('/').pop() : '',
					}
				}
				return {
					field,
					before: !change["before"] || change["before"] === 'undefined' ? '' : change["before"],
					after: !change["after"] || change["after"] === 'undefined' ? '' : change["after"],
				}
			}
		));
		result.push({
			modifiedOn: new Intl.DateTimeFormat('en-GB', {
				day: '2-digit',
				month: '2-digit',
				year: 'numeric',
				hour: '2-digit',
				minute: '2-digit',
				hour12: false
			}).format(entry.modifiedOn),
			modifiedBy: entry.modifiedBy,
			diffs,
		});
	}
	const grouped: any[] = Object.values(
		result.reduce((acc, item) => {
			const key = `${item.modifiedOn}|${item.modifiedBy}`

			if (!acc[key]) {
				acc[key] = {
					modifiedOn: item.modifiedOn,
					modifiedBy: item.modifiedBy,
					diffs: [],
				}
			}

			acc[key].diffs.push(...item.diffs)

			return acc
		}, {} as Record<string, any>)
	)
	return grouped;
}
