import {builder} from "../../builder";
import {OptimisticLock} from "../../../lib/optimisticLock";
import {getUnitOriginalObject} from "../unit";
import {
	$Enums,
	Authorization,
	AuthorizationHasChemical,
	AuthorizationHasHolder,
	AuthorizationHasRoom
} from "../../../../generated/prisma";
import {z} from "zod";
import {
	sanitizeCasMutationTypes,
	sanitizeHolderMutationTypes,
	sanitizeMutationTypes,
	sanitizeSearchString
} from "../../../lib/searchStrings";
import {
	alphanumericRegexp,
	casRegexp,
	chemicalNameRegexp,
	fileContentValidator,
	opLockValidator,
	pathRegexp,
	reqRegexp
} from "../../../lib/lhdValidators";
import {acceptDateString, acceptSubstringInList, fromSanitizer} from "../../../lib/fieldValidatePlugin";
import {
	createAuthorization,
	getAuthorizationByRoom,
	getAuthorizations,
	setAuthorizationRelations,
	updateAuthorization
} from "../../../model/authorization";
import {FileMutationInput, HolderMutationType, OthersMutationType} from "../../../lib/mutationTypes";
import {success} from "../../../lib/statuses";
import {ensurePerson} from "../../../model/persons";
import {getRoomOriginalObject} from "../room";
import authorization_status = $Enums.authorization_status;

const AuthorizationRef = builder.prismaObject('Authorization', {
	name: 'Authorization',
	fields: (t: any) => ({
		authorization: t.exposeString('authorization'),
		expirationDate: t.expose('expirationDate', { type: 'DateTime' }),
		status: t.exposeString('status'),
		renewals: t.exposeInt('renewals'),
		type: t.exposeString('type'),
		creationDate: t.expose('creationDate', { type: 'DateTime' }),
		authority: t.exposeString('authority'),
		dateExpiryNotified: t.expose('dateExpiryNotified', { type: 'DateTime' }),
		unit: t.field({
			type: 'Unit',
			resolve: async (parent: any, _: any, context: any) => {
				return await context.prisma.Unit.findUnique({
					where: { id: parent.idUnit ?? 0 }
				});
			}
		}),
		authorizationRooms: t.field({
			type: ['Room'],
			resolve: async (parent: any, _: any, context: any) => {
				const authorizationsAndRooms = await context.prisma.AuthorizationHasRoom.findMany({
					where: { idAuthorization: parent.idAuthorization }
				});
				const roomIDs = new Set(authorizationsAndRooms.map((authorizationAndRoom: AuthorizationHasRoom) => authorizationAndRoom.idLab));
				return await context.prisma.Room.findMany({
					where: { id: { in: [...roomIDs] }}
				})
			},
		}),
		authorizationHolders: t.field({
			type: ['Person'],
			resolve: async (parent: any, _: any, context: any) => {
				const authorizationsAndPeople = await context.prisma.AuthorizationHasHolder.findMany({
					where: { idAuthorization: parent.idAuthorization }
				});
				const peopleIDs = new Set(authorizationsAndPeople.map((authorizationAndPerson: AuthorizationHasHolder) => authorizationAndPerson.idPerson));
				return await context.prisma.Person.findMany({
					where: { idPerson: { in: [...peopleIDs] }}
				})
			},
		}),
		authorizationChemicals: t.field({
			type: ['AuthChem'],
			resolve: async (parent: any, _: any, context: any) => {
				const authorizationsAndChemical = await context.prisma.AuthorizationHasChemical.findMany({
					where: { idAuthorization: parent.idAuthorization }
				});
				const chemicalIDs = new Set(authorizationsAndChemical.map((authorizationAndChemical: AuthorizationHasChemical) => authorizationAndChemical.idChemical));
				return await context.prisma.AuthChem.findMany({
					where: { idAuthChem: { in: [...chemicalIDs] }}
				})
			},
		}),
		authorizationRadiations: t.field({
			type: ['AuthorizationHasRadiation'],
			resolve: async (parent: any, _: any, context: any) => {
				return await context.prisma.AuthorizationHasRadiation.findMany({
					where: { idAuthorization: parent.idAuthorization }
				});
			},
		}),
		authorizationFiles: t.field({
			type: ['AuthorizationHasFile'],
			resolve: async (parent: any, _: any, context: any) => {
				return await context.prisma.AuthorizationHasFile.findMany({
					where: { idAuthorization: parent.idAuthorization }
				});
			},
		}),
		opLock: t.string({
			resolve: async (parent: any, _: any, context: any) => {
				return OptimisticLock.createOpLock(parent.idAuthorization, getAuthorizationToString(parent));
			},
		})
	}),
});

export function getAuthorizationToString(parent: Authorization) {
	return {
		id: parent.idAuthorization,
		authorization: parent.authorization,
		dateExpiryNotified: parent.dateExpiryNotified,
		idUnit: parent.idUnit,
		expirationDate: parent.expirationDate,
		status: parent.status,
		creationDate: parent.creationDate,
		renewals: parent. renewals,
		type: parent.type
	};
}

export async function getAuthorizationOriginalObject (tx: any, opLock: string, name: string) {
	return await OptimisticLock.ensureDBObjectIsTheSame(opLock, 'Authorization', 'idAuthorization', tx, name, getAuthorizationToString);
}

const searchSpec = {
	Unit:          {rename: 'unit', validate: alphanumericRegexp},
	Authorization: {rename: 'authorization', validate: chemicalNameRegexp},
	Status:        {rename: 'status', validate: (value: string) => acceptSubstringInList(value, Object.values(authorization_status))},
	Room:          {rename: 'room', validate: alphanumericRegexp},
	Holder:        {rename: 'holder', validate: alphanumericRegexp},
	CAS:           {rename: 'cas', validate: casRegexp},
	Source:        {rename: 'source', validate: alphanumericRegexp},
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

const AuthorizationListResult = builder.objectRef<{
	totalCount: number;
	authorizations: any[];
}>('AuthorizationListResult').implement({
	fields: (t) => ({
		totalCount: t.exposeInt('totalCount'),
		authorizations: t.field({
			type: [AuthorizationRef],
			resolve: (parent) => parent.authorizations,
		}),
	}),
});

builder.queryType({
	fields: (t) => ({
		authorizationsWithPagination: t.field({
			type: AuthorizationListResult,
			authScopes: {
				needPermission: 'canListAuthorizations'
			},
			args: {
				search: t.arg.string({defaultValue: '', validate: searchSchema}),
				skip: t.arg.int({defaultValue: 0, validate: z.number().int().min(0).nullish()}),
				take: t.arg.int({defaultValue: 20, validate: z.number().int().min(0).nullish()}),
				type: t.arg.string({required: true, validate: z.enum(['Chemical', 'IonisingRadiation'])})
			},
			resolve: async (root, args, ctx: any) => {
				const search = sanitizeSearchString(args.search ?? '', searchSpec);
				return await getAuthorizations(ctx.prisma, args.type, {...search as any}, args.take ?? 20, args.skip ?? 0);
			},
		}),
		authorizationsByRoom: t.field({
			type: [AuthorizationRef],
			authScopes: {
				needPermission: 'canListAuthorizations'
			},
			args: {
				roomId: t.arg.string({required: true, validate: opLockValidator}),
				skip: t.arg.int({defaultValue: 0, validate: z.number().int().min(0).nullish()}),
				take: t.arg.int({defaultValue: 20, validate: z.number().int().min(0).nullish()}),
				type: t.arg.string({required: true, validate: z.enum(['Chemical', 'IonisingRadiation'])})
			},
			resolve: async (root, args, ctx: any) => {
				const room = await getRoomOriginalObject(ctx.prisma, args.roomId, "Room");
				return await getAuthorizationByRoom(ctx.prisma, room.id, args.type);
			},
		}),
	}),
});

builder.mutationType({
	fields: (t) => ({
		addAuthorization: t.string({
			authScopes: {
				needPermission: 'canEditAuthorizations'
			},
			args: {
				authorization: t.arg.string({ required: true, validate: z.string().regex(reqRegexp) }),
				idUnit: t.arg.string({ required: true, validate: opLockValidator }),
				creationDate: t.arg.string({ required: true, validate: fromSanitizer(acceptDateString) }),
				expirationDate: t.arg.string({ required: true, validate: fromSanitizer(acceptDateString) }),
				status: t.arg.string({
					required: true,
					validate: z.enum(Object.values(authorization_status) as [string, ...string[]]),
				}),
				rooms: t.arg({
					type: [OthersMutationType],
					validate: fromSanitizer(sanitizeMutationTypes),
				}),
				holders: t.arg({
					type: [HolderMutationType],
					validate: fromSanitizer(sanitizeHolderMutationTypes),
				}),
				radiations: t.arg({
					type: [OthersMutationType],
					validate: fromSanitizer(sanitizeMutationTypes),
				}),
				cas: t.arg({
					type: [OthersMutationType],
					validate: fromSanitizer(sanitizeCasMutationTypes),
				}),
				type: t.arg.string({ required: true, validate: z.enum(['Chemical', 'IonisingRadiation']) }),
				authority: t.arg.string({ required: true, validate: z.string().regex(alphanumericRegexp) }),
				files: t.arg({
					type: [FileMutationInput],
					required: { list: false, items: false },
					validate: z.array(z.object({
						status: z.enum(['New', 'Default', 'Deleted']),
						base64: fileContentValidator,
						path: z.string().regex(pathRegexp).optional(),
					}),)
				}),
			},
			resolve: async (root, args, ctx: any) => {
				const unit = await getUnitOriginalObject(ctx.prisma, args.idUnit, 'Unit');
				const newHolders = (args.holders ?? []).filter(holder => holder.status === 'New');
				await ensurePerson(ctx.prisma, newHolders);
				await ctx.prisma.$transaction(async (tx: any) => {
					const authorization = await createAuthorization (tx, args.authorization, args.status, acceptDateString(args.creationDate), acceptDateString(args.expirationDate), args.type, unit.id, args.authority);
					await setAuthorizationRelations(tx, Number(authorization.idAuthorization),
						{
							holders: args.holders,
							rooms: args.rooms ?? [],
							radiations: args.radiations,
							cas: args.cas,
							files: args.files
						});
				});
				return success();
			},
		}),
		updateAuthorization: t.string({
			authScopes: {
				needPermission: 'canEditAuthorizations'
			},
			args: {
				opLock: t.arg.string({required: true, validate: opLockValidator}),
				idUnit: t.arg.string({ required: true, validate: opLockValidator }),
				expirationDate: t.arg.string({ required: true, validate: fromSanitizer(acceptDateString) }),
				status: t.arg.string({
					required: true,
					validate: z.enum(Object.values(authorization_status) as [string, ...string[]]),
				}),
				rooms: t.arg({
					type: [OthersMutationType],
					validate: fromSanitizer(sanitizeMutationTypes),
				}),
				holders: t.arg({
					type: [HolderMutationType],
					validate: fromSanitizer(sanitizeHolderMutationTypes),
				}),
				radiations: t.arg({
					type: [OthersMutationType],
					validate: fromSanitizer(sanitizeMutationTypes),
				}),
				authority: t.arg.string({ required: true, validate: z.string().regex(alphanumericRegexp) }),
				files: t.arg({
					type: [FileMutationInput],
					required: { list: false, items: false },
					validate: z.array(z.object({
						status: z.enum(['New', 'Default', 'Deleted']),
						base64: fileContentValidator,
						path: z.string().regex(pathRegexp).optional(),
					}),)
				}),
			},
			resolve: async (root, args, ctx: any) => {
				const auth = await getAuthorizationOriginalObject(ctx.prisma, args.opLock, 'Authorization');
				const unit = await getUnitOriginalObject(ctx.prisma, args.idUnit, 'Unit');
				const newHolders = (args.holders ?? []).filter(holder => holder.status === 'New');
				await ensurePerson(ctx.prisma, newHolders);
				await ctx.prisma.$transaction(async (tx: any) => {
					await updateAuthorization(ctx.prisma, {...args, idUnit: unit.id}, auth, tx);
				});
				return success();
			}
		}),
		deleteAuthorization: t.string({
			authScopes: {
				needPermission: 'canEditAuthorizations'
			},
			args: {
				opLock: t.arg.string({required: true, validate: opLockValidator}),
			},
			resolve: async (root, args, ctx: any) => {
				return await ctx.prisma.$transaction(async (tx: any) => {
					const auth = await getAuthorizationOriginalObject(ctx.prisma, args.opLock, 'Authorization');

					await tx.AuthorizationHasRoom.deleteMany({ where: { idAuthorization: auth.idAuthorization }});
					await tx.AuthorizationHasChemical.deleteMany({ where: { idAuthorization: auth.idAuthorization }});
					await tx.AuthorizationHasHolder.deleteMany({ where: { idAuthorization: auth.idAuthorization }});
					await tx.AuthorizationHasRadiation.deleteMany({ where: { idAuthorization: auth.idAuthorization }});
					await tx.AuthorizationHasFile.deleteMany({ where: { idAuthorization: auth.idAuthorization }});
					await tx.Authorization.delete({ where: { idAuthorization: auth.idAuthorization }});

					return success();
				});
			},
		}),
	}),
});
