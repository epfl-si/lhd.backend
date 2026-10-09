import {builder} from "../../builder";
import {OptimisticLock} from "../../../lib/optimisticLock";
import {UnitRef} from "../unit";
import {
	Authorization,
	AuthorizationHasChemical,
	AuthorizationHasHolder,
	AuthorizationHasRoom
} from "../../../../generated/prisma";

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
			type: UnitRef,
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
		date_expiry_notified: parent.dateExpiryNotified,
		id_unit: parent.idUnit,
		expiration_date: parent.expirationDate,
		status: parent.status,
		creation_date: parent.creationDate,
		renewals: parent. renewals,
		type: parent.type
	};
}

export async function getAuthorizationOriginalObject (tx: any, opLock: string, name: string) {
	return await OptimisticLock.ensureDBObjectIsTheSame(opLock, 'Authorization', 'idAuthorization', tx, name, getAuthorizationToString);
}
