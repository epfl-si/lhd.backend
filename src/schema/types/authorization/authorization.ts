import {builder} from "../../builder";
import {OptimisticLock} from "../../../lib/optimisticLock";
import {UnitRef} from "../unit";
import {Authorization} from "../../../../generated/prisma";

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

		// t.nonNull.list.nonNull.field('authorization_rooms', {
		// 	type: RoomStruct,
		// 	resolve: async (parent, _, context) => {
		// 		const authorizationsAndRooms = await context.prisma.authorization_has_room.findMany({
		// 			where: { id_authorization: parent.id_authorization }
		// 		});
		// 		const roomIDs = new Set(authorizationsAndRooms.map((authorizationAndRoom) => authorizationAndRoom.id_lab));
		// 		return await context.prisma.Room.findMany({
		// 			where: { id: { in: [...roomIDs] }}
		// 		})
		// 	},
		// });
		//
		// t.nonNull.list.nonNull.field('authorization_holders', {
		// 	type: PersonStruct,
		// 	resolve: async (parent, _, context) => {
		// 		const authorizationsAndPeople = await context.prisma.authorization_has_holder.findMany({
		// 			where: { id_authorization: parent.id_authorization }
		// 		});
		// 		const peopleIDs = new Set(authorizationsAndPeople.map((authorizationAndPerson) => authorizationAndPerson.id_person));
		// 		return await context.prisma.Person.findMany({
		// 			where: { id_person: { in: [...peopleIDs] }}
		// 		})
		// 	},
		// });
		//
		// t.nonNull.list.nonNull.field('authorization_chemicals', {
		// 	type: ChemicalStruct,
		// 	resolve: async (parent, _, context) => {
		// 		const authorizationsAndChemical = await context.prisma.authorization_has_chemical.findMany({
		// 			where: { id_authorization: parent.id_authorization }
		// 		});
		// 		const chemicalIDs = new Set(authorizationsAndChemical.map((authorizationAndChemical) => authorizationAndChemical.id_chemical));
		// 		return await context.prisma.auth_chem.findMany({
		// 			where: { id_auth_chem: { in: [...chemicalIDs] }}
		// 		})
		// 	},
		// });
		//
		// t.nonNull.list.nonNull.field('authorization_radiations', {
		// 	type: RadiationStruct,
		// 	resolve: async (parent, _, context) => {
		// 		return await context.prisma.authorization_has_radiation.findMany({
		// 			where: { id_authorization: parent.id_authorization }
		// 		});
		// 	},
		// });
		//
		// t.nonNull.list.nonNull.field('authorization_files', {
		// 	type: FileAuthorizationStruct,
		// 	resolve: async (parent, _, context) => {
		// 		return await context.prisma.AuthorizationHasFile.findMany({
		// 			where: { id_authorization: parent.id_authorization }
		// 		});
		// 	},
		// });

		opLock: t.field({
			type: 'String',
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
