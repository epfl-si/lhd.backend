import {builder} from "../builder";
import {OptimisticLock} from "../../lib/optimisticLock";
import {Room, UnitHasRoom} from "../../../generated/prisma";
import {getRoomsFromApi} from "../../lib/callAPI";
import {z} from "zod";
import {getRooms} from "../../model/rooms";
import {sanitizeSearchString} from "../../lib/searchStrings";
import {alphanumericRegexp, unitNameRegexp} from "../../lib/lhdValidators";
import {acceptNumberFromString} from "../../lib/fieldValidatePlugin";

export const RoomRef = builder.prismaObject('Room', {
	name: 'Room',
	fields: (t: any) => ({
		sciperLab: t.exposeInt('sciperLab'),
		site: t.exposeString('site'),
		building: t.exposeString('building'),
		sector: t.exposeString('sector'),
		floor: t.exposeString('floor'),
		roomNo: t.exposeString('roomNo'),
		description: t.exposeString('description'),
		location: t.exposeString('location'),
		vent: t.exposeString('vent'),
		name: t.exposeString('name'),
		isDeleted: t.exposeBoolean('isDeleted'),
		labTypeIsDifferent: t.exposeBoolean('labTypeIsDifferent'),
		vol: t.exposeFloat('vol'),
		opLock: t.string({
			resolve: async (parent: any, _: any, context: any) => {
				return OptimisticLock.createOpLock(parent.id, getRoomToString(parent));
			},
		}),
		adminuse: t.string({
			resolve: async (parent: any, _: any, context: any) => {
				const rooms = await getRoomsFromApi(parent.name);
				return (rooms && rooms["rooms"].length > 0) ? rooms["rooms"][0].adminuse : '';
			},
		}),
		facultyuse: t.string({
			resolve: async (parent: any, _: any, context: any) => {
				const rooms = await getRoomsFromApi(parent.name);
				return (rooms && rooms["rooms"].length > 0) ? rooms["rooms"][0].facultyuse : '';
			},
		}),
		assignedTo: t.string({
			resolve: async (parent: any, _: any, context: any) => {
				const rooms = await getRoomsFromApi(parent.name);
				if (rooms && rooms["rooms"].length > 0) {
					const room = rooms["rooms"][0];
					return room['unit'] ? room['unit']['name'] : '';
				} else {
					return '';
				}
			},
		}),
		lhdUnits: t.field({
			type: ['Unit'],
			resolve: async (parent: any, _: any, context: any) => {
				const unitsAndRooms = await context.prisma.UnitHasRoom.findMany({
					where: { idLab: parent.id }
				});
				const unitIDs = new Set(unitsAndRooms.map((unitAndRoom: UnitHasRoom) => unitAndRoom.idUnit));
				return await context.prisma.Unit.findMany({
					where: { id: { in: [...unitIDs] }}
				})
			},
		}),
		hazards: t.field({
			type: ['LabHasHazards'],
			resolve: async (parent: any, _: any, context: any) => {
				return await context.prisma.LabHasHazards.findMany({
					where: { idLab: (parent as any).id },
					include: { hazardFormHistory: true }
				});
			}
		}),
		hazardAdditionalInfo: t.field({
			type: ['LabHasHazardsAdditionalInfo'],
			resolve: async (parent: any, _: any, context: any) => {
				return await context.prisma.LabHasHazardsAdditionalInfo.findMany({
					where: { idLab: (parent as any).id },
					include: { hazardCategory: true }
				});
			}
		}),
		hazardReferences: t.field({
			type: ['LabHasHazardsChild'],
			resolve: async (parent: any, _: any, context: any) => {
				return await context.prisma.LabHasHazardsChild.findMany({
					where: { submission:  {
							contains: '\"' + (parent as any).name + '\"'
						}},
				});
			}
		}),
	}),
});

export function getRoomToString(parent: Room) {
	return {
		id: parent.id,
		sciperLab: parent.sciperLab,
		building: parent.building,
		sector: parent.sector,
		floor: parent.floor,
		roomNo: parent.roomNo,
		idLabType: parent.idLabType,
		labTypeIsDifferent: parent.labTypeIsDifferent,
		description: parent.description,
		location: parent.location,
		vol: parent.vol,
		vent: parent.vent,
		name: parent.name,
		isDeleted: parent.isDeleted
	};
}

export async function getRoomOriginalObject (tx: any, opLock: string, name: string) {
	return await OptimisticLock.ensureDBObjectIsTheSame(opLock, 'Room', 'id', tx, name, getRoomToString);
}

const RoomListResult = builder.objectRef<{
	totalCount: number;
	rooms: any[];
}>('RoomListResult').implement({
	fields: (t) => ({
		totalCount: t.exposeInt('totalCount'),
		rooms: t.field({
			type: [RoomRef],
			resolve: (parent) => parent.rooms,
		}),
	}),
});

const roomSearchSpec = {
	Hazard:      { rename: 'hazard',      validate: alphanumericRegexp },
	Room:        { rename: 'room',        validate: alphanumericRegexp },
	Designation: { rename: 'designation', validate: alphanumericRegexp },
	Floor:       { rename: 'floor',       validate: alphanumericRegexp },
	Sector:      { rename: 'sector',      validate: alphanumericRegexp },
	Building:    { rename: 'building',    validate: alphanumericRegexp },
	Unit:        { rename: 'unit',        validate: unitNameRegexp },
	Profile:     { rename: 'profile',     validate: alphanumericRegexp },
	Volume:      { rename: 'volume',      validate: acceptNumberFromString },
};

const roomSearchSchema = z
	.string()
	.superRefine((s, ctx) => {
		try {
			sanitizeSearchString(s, roomSearchSpec);
		} catch (e) {
			ctx.addIssue({
				code: 'custom',
				message: `Invalid search parameters: ${(e as Error).message}`,
			});
		}
	})
	.nullish();

builder.queryType({
	fields: (t) => ({
		roomsWithPagination: t.field({
			type: RoomListResult,
			authScopes: {
				needPermission: 'canListRooms'
			},
			args: {
				search: t.arg.string({defaultValue: '', validate: roomSearchSchema}),
				skip: t.arg.int({defaultValue: 0, validate: z.number().int().min(0).nullish()}),
				take: t.arg.int({defaultValue: 20, validate: z.number().int().min(0).nullish()}),
			},
			resolve: async (root, args, ctx: any) => {
				const search = sanitizeSearchString(args.search ?? '', roomSearchSpec);
				return await getRooms(ctx.prisma, search, args.take ?? 20, args.skip ?? 0);
			},
		}),
	}),
});
