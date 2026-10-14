import {builder} from "../builder";
import {OptimisticLock} from "../../lib/optimisticLock";
import {Room, UnitHasRoom} from "../../../generated/prisma";
import {getRoomsFromApi} from "../../lib/callAPI";
import {z} from "zod";
import {deleteRoom, getRoomByName, getRooms, saveNewRoom, updateRoom} from "../../model/rooms";
import {sanitizeSearchString} from "../../lib/searchStrings";
import {alphanumericRegexp, roomNameRegexp, unitNameRegexp} from "../../lib/lhdValidators";
import {acceptNumberFromString} from "../../lib/fieldValidatePlugin";
import {UnitInputType} from "./unit";
import {createUnitRoom, deleteUnitRoom, findSingleUnitByName} from "../../model/units";
import {sendEmailForDispensation} from "../../lib/email/mailer";
import {getUserString} from "../../lib/userType";

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
		kind: t.relation('kind'),
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

const RoomsFromAPIResult = builder.objectRef<RoomFromAPIShape>('RoomsFromAPIResult').implement({
	fields: (t) => ({
		name: t.exposeString('name'),
		floor: t.exposeString('floor', { nullable: true }),
		id: t.exposeInt('id'),
		sector: t.exposeString('sector', { nullable: true }),
		site: t.exposeString('site', { nullable: true }),
		building: t.exposeString('building', { nullable: true }),
		vol: t.exposeFloat('vol', { nullable: true }),
		facultyuse: t.exposeString('facultyuse', { nullable: true }),
	}),
});

export type RoomFromAPIShape = {
	name: string;
	floor?: string | null | undefined;
	id: number;
	sector?: string | null | undefined;
	site?: string | null | undefined;
	building?: string | null | undefined;
	vol?: number | null | undefined;
	facultyuse?: string | null | undefined;
};

const RoomCreationInput = builder.inputType('RoomCreationType', {
	fields: (t) => ({
		id: t.int({ required: true }),
		name: t.string({ required: true }),
		status: t.string({ required: true }),
		site: t.string(),
		floor: t.string(),
		building: t.string(),
		sector: t.string(),
		vol: t.float(),
		facultyuse: t.string(),
	}),
});

const roomCreationSchema = z.object({
	id: z.number().int(),
	name: z.string().regex(roomNameRegexp),
	site: z.string().regex(alphanumericRegexp).nullish(),
	floor: z.string().regex(alphanumericRegexp).nullish(),
	building: z.string().regex(alphanumericRegexp).nullish(),
	sector: z.string().regex(alphanumericRegexp).nullish(),
	vol: z.number().nullish(),
	facultyuse: z.string().regex(alphanumericRegexp).nullish(),
	status: z.enum(['New', 'Default', 'Deleted']),
});

builder.queryType({
	fields: (t) => ({
		rooms: t.prismaField({
			type: [RoomRef],
			authScopes: {
				needPermission: 'canListRooms'
			},
			resolve: async (query, root, args, ctx: any, info) => {
				return await ctx.prisma.Room.findMany();
			},
		}),
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
		roomDetails: t.field({
			type: RoomRef,
			authScopes: {
				needPermission: 'canListRooms'
			},
			args: {
				name: t.arg.string({required: true, validate: z.string().regex(roomNameRegexp)}),
				isDeleted: t.arg.boolean({defaultValue: false})
			},
			resolve: async (root, args, ctx: any) => {
				return await getRoomByName(ctx.prisma, args.name);
			},
		}),
		roomsFromAPI: t.field({
			type: [RoomsFromAPIResult],
			authScopes: {
				needPermission: 'canListRooms'
			},
			args: {
				search: t.arg.string({required: true, validate: z.string().regex(alphanumericRegexp)}),
			},
			resolve: async (root, args, ctx: any) => {
				const rooms = await getRoomsFromApi(args.search);
				const roomsList: RoomFromAPIShape[] = [];
				rooms["rooms"].forEach((u: any) =>
				{
					roomsList.push({
						name: u.name,
						floor: u.floor,
						id: u.id,
						building: u.building['name'],
						sector: u.zone != 'Z' ? u.zone : '',
						site: u.building?.site?.label,
						vol: Math.round(((u.surface || 0) * (u.height || 0)) * 100) / 100,
						facultyuse: u.facultyuse.trim()
					});
				});
				return roomsList;
			},
		})
	}),
});

builder.mutationType({
	fields: (t) => ({
		createRoom: t.string({
			authScopes: {
				needPermission: 'canEditRooms'
			},
			args: {
				rooms: t.arg({
					type: [RoomCreationInput],
					required: true,
					validate: z.array(roomCreationSchema),
				}),
			},
			resolve: async (root, args, ctx: any) => {
				return await ctx.prisma.$transaction(async (tx: any) => {
					for (const room of args.rooms) {
						if (room.status === 'New') {
							await saveNewRoom(tx, room);
						}
					}
					return ;
				});
			},
		}),
		updateRoom: t.string({
			authScopes: {
				needPermission: 'canEditRooms'
			},
			args: {
				opLock: t.arg.string({ required: true }),
				name: t.arg.string({ required: true }),
				kind: t.arg.string(),
				vent: t.arg.string({required: true}),
				labTypeIsDifferent: t.arg.boolean({required: true}),
				units: t.arg({
					type: [UnitInputType],
					required: true
				}),
			},
			resolve: async (root, args, ctx: any) => {
				return await ctx.prisma.$transaction(async (tx: any) => {
					const room = await getRoomOriginalObject(tx, args.opLock, "Room");

					await updateRoom(tx,room.id, args.kind, args.vent, args.labTypeIsDifferent);

					for (const unitToChange of args.units) {
						const unit = await findSingleUnitByName(ctx, unitToChange.name);
						if (unitToChange.status === 'New') {
							await createUnitRoom(tx, room.id, unit.id);
						}
						else if (unitToChange.status === 'Deleted') {
							await deleteUnitRoom(tx, room.id, unit.id);
						}
					}

					return room.name;
				});
			},
		}),
		deleteRoom: t.string({
			authScopes: {
				needPermission: 'canEditRooms'
			},
			args: {
				opLock: t.arg.string({ required: true })
			},
			resolve: async (root, args, ctx: any) => {
				let emails = {dispensations: []};
				const result = await ctx.prisma.$transaction(async (tx: any) => {
					const room = await getRoomOriginalObject(tx, args.opLock, "Room");
					emails = await deleteRoom(tx, ctx, room, ctx.user);
					return room.name;
				});
				for ( const disp of emails.dispensations ) {
					await sendEmailForDispensation(getUserString(ctx.user), ctx.user.userEmail, disp, 'expiredDispensation');
				}
				return result;
			},
		}),
	}),
});
