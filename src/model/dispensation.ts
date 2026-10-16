import {Dispensation} from "../../generated/prisma";
import {getUserString, UserInfo} from "../lib/userType";
import {buildSearchConditions} from "../lib/searchConditionBuilder";
import {saveBase64File} from "../lib/fileUtilities";

export async function expireDispensation (tx: any, disp: Dispensation, userInfo: UserInfo) {
	return await tx.Dispensation.update({
		where: { idDispensation: disp.idDispensation },
		data: {
			status: 'Expired',
			modifiedBy: userInfo.userName,
			modifiedOn: new Date()
		}
	});
}

export async function setDispensationNotified (tx: any, disp: Dispensation) {
	return await tx.Dispensation.update({
		where: { idDispensation: disp.idDispensation },
		data: {
			dateExpiryNotified: new Date()
		}
	});
}

export async function getDispensation (prisma: any, id: number) {
	return await prisma.Dispensation.findUnique({
		where: { idDispensation: id },
		include: {
			subject: true,
			dispensationHasRoom : { include: { room: true } },
			dispensationHasHolder: { include: { holder: true } },
			dispensationHasUnit: { include: { unit: { include: { unitHasProfiles: { include: { person: true } } } } } },
			dispensationHasTicket: true
		}
	});
}

export async function getExpiringDispensations (prisma: any, expiringInDays: number = 30) {
	const expirationDay = new Date();
	expirationDay.setDate(expirationDay.getDate() + expiringInDays);

	const conditions: any = {
		dateEnd: {
			lt: expirationDay     // less than `expiringInDays` from now
		},
		status: 'Active'
	};

	if (expiringInDays !== 0) {
		conditions['dateExpiryNotified'] = null;
	}
	return await prisma.Dispensation.findMany({
		where: conditions,
		include: {
			subject: true,
			dispensationHasRoom : { include: { room: true } },
			dispensationHasHolder: { include: { holder: true } },
			dispensationHasUnit: { include: { unit: { include: { unitHasProfiles: { include: { person: true } } } } } },
			dispensationHasTicket: true
		}
	});
}

export async function getDispensations (prisma: any, dictionary?: Partial<{
	unit:         string,
	dispensation: string,
	status:       string,
	room:         string,
	holder:       string,
	subject:      string,
	ticket:       string,
}>, take = 0, skip = 0) {
	const { unit, dispensation, status, room, holder, subject, ticket } = dictionary || {};
	const whereCondition = [];
	if (dispensation) {
		const disp = dispensation.split('-');
		const dispNumber = Number(disp.length > 1 ? disp[1] : disp[0]);
		if (!isNaN(dispNumber)) {
			whereCondition.push({idDispensation: Number(dispNumber)})
		} else {
			whereCondition.push({idDispensation: -1})
		}
	}
	if (status) {
		whereCondition.push({ status: status })
	}
	if (room) {
		whereCondition.push({ dispensationHasRoom: { some: {room: {is: {name: {contains: room}}}} }})
	}
	if (unit) {
		const unitSearch = buildSearchConditions(unit);
		whereCondition.push({
			OR: [
				{ dispensationHasUnit: { some: {unit: {is: {name: unitSearch}}} }},
				{ dispensationHasUnit: { some: {unit: {is: {institute: {is: {name: unitSearch}}}}} }},
				{ dispensationHasUnit: { some: {unit: {is: {institute: {is: {school: {is: {name: unitSearch}}}}}}} }}
			]
		})
	}
	if (holder) {
		whereCondition.push({
			dispensationHasHolder: {
				some: {
					holder: {
						OR: [
							{ name: { contains: holder } },
							{ surname: { contains: holder } },
							{ email: { contains: holder } },
							{ sciper: parseInt(holder) },
						],
					},
				},
			}
		})
	}
	if (subject) {
		whereCondition.push({ subject: {is: {subject: {contains: subject}}}})
	}
	if (ticket) {
		whereCondition.push({ dispensationHasTicket: { some: {ticketNumber: {contains: ticket}} }})
	}

	const dispensationList = await prisma.Dispensation.findMany({
		where: {
			AND: whereCondition
		},
		orderBy: [
			{
				idDispensation: 'desc',
			},
		]
	});

	const dispensations = take == 0 ? dispensationList : dispensationList.slice(skip, skip + take);
	const totalCount = dispensationList.length;

	return { dispensations, totalCount };
}

export async function createDispensation (tx: any, user: UserInfo, subjectId: number, description: string, comment: string, subjectOther: string, status: string, dateStart: Date, dateEnd: Date) {
	return await tx.Dispensation.create({
		data: {
			renewals: 0,
			idDispensationSubject: subjectId,
			subjectOther: subjectOther,
			description: decodeURIComponent(description),
			comment: decodeURIComponent(comment),
			status: status,
			dateStart: dateStart,
			dateEnd: dateEnd,
			createdBy: getUserString(user),
			createdOn: new Date(),
			modifiedBy: getUserString(user),
			modifiedOn: new Date()
		}
	});
}

export async function updateDispensation (tx: any, user: UserInfo, idDispensation: number, subjectId: number,
																					description: string, comment: string, subjectOther: string, status: string,
																					dateEnd: Date, dispEndDate: Date, renewals: number, dateExpiryNotified: Date) {
	const ren = dispEndDate.setHours(12,0,0,0) < dateEnd.setHours(12,0,0,0) ? (renewals + 1) : renewals;
	return await tx.Dispensation.update({
		where: { idDispensation: idDispensation },
		data: {
			renewals: ren,
			dateExpiryNotified: dateExpiryNotified && ren > renewals ? null : dateExpiryNotified,
			idDispensationSubject: subjectId,
			subjectOther: subjectOther,
			description: decodeURIComponent(description),
			comment: decodeURIComponent(comment),
			status: status,
			dateEnd: dateEnd,
			modifiedBy: getUserString(user),
			modifiedOn: new Date()
		}
	});
}

export async function setDispensationRelations(tx: any, idDispensation: number, changes: any) {
	for ( const holder of changes.holders || []) {
		const p = await tx.Person.findUnique({where: {sciper: holder.sciper}});
		if ( holder.status === 'New' ) {
			await tx.DispensationHasHolder.create({
				data: {
					idPerson: Number(p.idPerson),
					idDispensation: idDispensation
				}
			});
		} else if ( holder.status === 'Deleted' ) {
			await tx.DispensationHasHolder.deleteMany({
				where: {
					idDispensation: idDispensation,
					idPerson: p.idPerson
				}
			});
		}
	}

	for ( const room of changes.rooms || []) {
		if ( room.status === 'New' ) {
			let r = undefined;
			if ( room.name ) {
				r = await tx.Room.findFirst({where: {name: room.name, isDeleted: false}})
			} else if ( room.id ) {
				r = await tx.Room.findUnique({where: {id: room.id, isDeleted: false}})
			}
			if ( !r ) throw new Error(`Dispensation not created: room not found`);
			await tx.DispensationHasRoom.create({
				data: {
					idLab: Number(r.id),
					idDispensation: idDispensation
				}
			});
		} else if ( room.status === 'Deleted' ) {
			let p = await tx.Room.findFirst({where: {name: room.name}});
			if ( p ) {
				await tx.DispensationHasRoom.deleteMany({
					where: {
						idDispensation: idDispensation,
						idLab: p.id
					}
				});
			}
		}
	}

	for ( const unit of changes.units || []) {
		const u = await tx.Unit.findFirst({where: {name: unit.name}});
		if ( unit.status === 'New' ) {
			if ( !u ) throw new Error(`Dispensation not created: unit not found`);
			await tx.DispensationHasUnit.create({
				data: {
					idUnit: Number(u.id),
					idDispensation: idDispensation
				}
			});
		} else if ( unit.status === 'Deleted' && u) {
			await tx.DispensationHasUnit.deleteMany({
				where: {
					idDispensation: idDispensation,
					idUnit: u.id
				}
			});
		}
	}

	for ( const ticket of changes.tickets || []) {
		if ( ticket.status === 'New' ) {
			await tx.DispensationHasTicket.create({
				data: {
					idDispensation: idDispensation,
					ticketNumber: ticket.name
				}
			});
		} else if ( ticket.status === 'Deleted' ) {
			await tx.DispensationHasTicket.deleteMany({
				where: {
					idDispensation: idDispensation,
					ticketNumber: ticket.name
				}
			});
		}
	}

	for ( const file of changes.files || []) {
		if ( file.status === 'New' ) {
			await tx.DispensationHasFile.create({
				data: {
					idDispensation: idDispensation,
					filePath: saveBase64File(file.base64, process.env.DISPENSATION_DOCUMENT_FOLDER + '/' + idDispensation + '/', file.path)
				}
			});
		} else if ( file.status === 'Deleted' ) {
			await tx.DispensationHasFile.deleteMany({
				where: {
					idDispensation: idDispensation,
					filePath: file.path
				}
			});
		}
	}
}
