import {buildSearchConditions} from "../lib/searchConditionBuilder";
import {Room} from "../../generated/prisma";
import {UserInfo} from "../lib/userType";
import {expireDispensation, getDispensation} from "./dispensation";
import {expireAuthorization} from "./authorization";

export async function getRooms (prisma: any, dictionary?: Partial<{
	hazard: string,
	room: string,
	designation: string,
	floor: string,
	sector: string,
	building: string,
	unit: string,
	profile: string,
	volume: number,
}>, take = 0, skip = 0) {
	const { hazard, room, designation, floor, sector, building, unit, profile, volume } = dictionary || {};

	const whereCondition = [];
	whereCondition.push({ isDeleted: false });
	if (room) {
		whereCondition.push({ name: { contains: room }})
	}
	if (hazard) {
		whereCondition.push({ labHasHazards : {some: {hazardFormHistory: { is: {hazardForm: { is: {hazardCategory: { is: {hazardCategoryName: { contains: hazard }}}}}}}}}})
	}
	if (designation) {
		whereCondition.push({ kind : { is: {name: { contains: designation }}}})
	}
	if (floor) {
		whereCondition.push({ floor: { contains: floor }})
	}
	if (sector) {
		whereCondition.push({ sector: { contains: sector }})
	}
	if (building) {
		whereCondition.push({ building: { contains: building }})
	}
	if (unit) {
		const unitSearch = buildSearchConditions(unit);
		whereCondition.push({
			OR: [
				{ unitHasRoom: { some: {unit: {is: {name: unitSearch }}} }},
				{ unitHasRoom: { some: {unit: {is: {institute: {is: {name: unitSearch }}}}} }},
				{ unitHasRoom: { some: {unit: {is: {institute: {is: {school: {is: {name: unitSearch }}}}}}} }}
			]
		})
	}
	if (volume) {
		whereCondition.push({ vol: { gt: volume - 10, lt: volume + 10 } })
	}
	if (profile) {
		whereCondition.push({
			unitHasRoom: {
				some: {
					unit: {
						unitHasProfiles: {
							some: {
								person: {
									OR: [
										{ name: { contains: profile } },
										{ surname: { contains: profile } },
										{ email: { contains: profile } },
									],
								},
							},
						},
					},
				},
			},
		})
	}

	const roomsList = await prisma.Room.findMany({
		where: {
			AND: whereCondition
		},
		include: { unitHasRoom: { include: { unit: true } } },
		orderBy: [
			{
				name: 'asc',
			},
		]
	});

	const rooms = take == 0 ? roomsList : roomsList.slice(skip, skip + take);
	const totalCount = roomsList.length;

	return { rooms, totalCount };
}

export async function deleteRoom (tx: any, context: any, r: Room, infoUser: UserInfo) {
	const emails: any = {dispensations: []};

	const where = { where: { idLab: r.id } }

	const hazards = await context.prisma.LabHasHazards.findMany(where);
	for ( const h of hazards ) {
		await tx.LabHasHazardsChild.deleteMany({
			where: {
				idLabHasHazards: h.idLabHasHazards
			}
		});
	}

	const auth = await context.prisma.authorizationHasRoom.findMany({
		where: {
			AND: [
				{ idLab: r.id },
				{
					authorization: {
						type: 'Chemical',
					},
				}
			]
		}
	});
	for ( const a of auth ) {
		const authChem = await context.prisma.authorizationHasRoom.findMany({
			where: {
				AND: [
					{ idAuthorization: a.idAuthorization },
					{ room: { isDeleted: false },
					}
				]
			}
		});
		if (authChem.length == 1) { // If the current room is the only one still active
			await expireAuthorization(tx, a);
		}
	}

	const disps = await context.prisma.DispensationHasRoom.findMany({
		where: { idLab: r.id }
	});
	for ( const a of disps ) {
		const disp = await context.prisma.DispensationHasRoom.findMany({
			where: {
				AND: [
					{ idDispensation: a.idDispensation },
					{ room: { isDeleted: false },
					}
				]
			}
		});
		if (disp.length == 1) { // If the current room is the only one still active
			await expireDispensation(tx, a, infoUser);
			emails.dispensations.push(await getDispensation(tx, a.idDispensation));
		}
	}

	await tx.LabHasHazards.deleteMany(where);
	const info = await context.prisma.LabHasHazardsAdditionalInfo.findMany(where);
	for ( const i of info ) {
		await tx.HazardsAdditionalInfoHasTag.deleteMany({
			where: {
				idLabHasHazardsAdditionalInfo: i.idLabHasHazardsAdditionalInfo
			}
		});
	}
	await tx.LabHasHazardsAdditionalInfo.deleteMany(where);
	await tx.unitHasRoom.deleteMany(where);

	await tx.Room.update(
		{ where: { id: r.id },
			data: {
				isDeleted: true
			}
		});

	return emails;
}

/**
 * Get rooms with details that are relevant for the AxS API.
 *
 * Rooms are joined (via Prisma) with units, Professors and COSECs.
 * Rooms that are not assigned to a unit are filtered out.
 * @param prisma
 * @param roomName
 */
export async function getRoomByNameForAxs (prisma: any, roomName: string) {
	return await prisma.Room.findFirst({
		where: {
			AND: [
				{ name: { contains: roomName }},
				{ unitHasRoom: { some: { }}} // At least one unit is available for this room
			]
		},
		include: {
			unitHasRoom: {
				include: {
					unit: {
						include: {
							unitHasProfiles: {
								include: {
									person: true
								}
							}
						}
					}
				}
			},
			labHasHazards: true,
			labHasHazardsAdditionalInfo: {
				include: {
					hazardCategory: true,
					hazardsAdditionalInfoHasTag: {
						include: {
							tag: true
						}
					}
				}
			}
		},
	});
}
