import {buildSearchConditions} from "../lib/searchConditionBuilder";
import {Authorization} from "../../generated/prisma";
import {saveBase64File} from "../lib/fileUtilities";
import {NotFoundError} from "../lib/errors";
import {acceptDateString} from "../lib/fieldValidatePlugin";

export async function createAuthorization (tx: any, authorization: string, status: string, creationDate: Date, expirationDate: Date, type: string, authority: string, unitId: number) {
	return await tx.Authorization.create({
		data: {
			authorization: authorization,
			status: status,
			creationDate: creationDate,
			expirationDate: expirationDate,
			idUnit: unitId,
			renewals: 0,
			type: type,
			authority: authority
		}
	});
}

export async function updateAuthorization (prisma: any, newData: any, oldAuth: any, tx = undefined) {
	if (tx) {
		await doUpdateAuthorization(tx);
	} else {
		await prisma.$transaction(async (tx: any) => doUpdateAuthorization(tx));
	}

	async function doUpdateAuthorization (tx: any) {
		const ren = newData.renewals ?? (acceptDateString(newData.expirationDate).setHours(12,0,0,0) > oldAuth.expirationDate.setHours(12,0,0,0) ? (oldAuth.renewals + 1) : oldAuth.renewals);
		const data: any = {
			status: newData.status,
			expirationDate: acceptDateString(newData.expirationDate),
			authority: newData.authority ?? oldAuth.authority,
			renewals: ren,
			dateExpiryNotified: oldAuth.dateExpiryNotified && ren > oldAuth.renewals ? null : oldAuth.dateExpiryNotified
		}
		if (newData.idUnit) {
			data['idUnit'] = newData.idUnit;
		}

		const updatedAuthorization = await tx.Authorization.update(
			{ where: { idAuthorization: oldAuth.idAuthorization },
				data: data
			});

		await setAuthorizationRelations(tx, Number(updatedAuthorization.idAuthorization), newData);
	}
}

export async function getAuthorizations (prisma: any, type: string, conditions?: Partial<{
	unit: string,
	authorization: string,
	status: string,
	room: string,
	holder: string,
	cas: string,
	source: string
}>, take = 0, skip = 0) {
	const { unit, authorization, status, room, holder, cas, source } = conditions || {};
	const whereCondition = [];
	whereCondition.push({ type: type});
	if (unit) {
		const unitSearch = buildSearchConditions(unit);
		whereCondition.push({ unit: { is: {name: unitSearch} }})
	}
	if (authorization) {
		whereCondition.push({ authorization: { contains: authorization }})
	}
	if (status) {
		whereCondition.push({ status: status })
	}
	if (room) {
		whereCondition.push({ authorizationHasRoom: { some: {room: {is: {name: {contains: room}}}} }})
	}
	if (holder) {
		whereCondition.push({
			authorizationHasHolder: {
				some: {
					holder: {
						OR: [
							{ name: { contains: String(holder) } },
							{ surname: { contains: String(holder) } },
							{ email: { contains: String(holder) } },
							{ sciper: parseInt(holder) },
						],
					},
				},
			}
		})
	}
	if (cas) {
		whereCondition.push({ authorizationHasChemical: { some: {chemical: {
						OR: [
							{ casAuthChem: { contains: cas } },
							{ authChemEn: { contains: cas } }
						],
					}} }})
	}
	if (source) {
		whereCondition.push({ authorizationHasRadiation: { some: {source: {contains: source}} }})
	}

	const authorizationList = await prisma.Authorization.findMany({
		where: {
			AND: whereCondition
		},
		include: { authorizationHasChemical: { include: { chemical: true } } },
		orderBy: [
			{
				authorization: 'asc',
			},
		]
	});

	const authorizations = take == 0 ? authorizationList : authorizationList.slice(skip, skip + take);
	const totalCount = authorizationList.length;

	return { authorizations, totalCount };
}

export async function getAuthorizationByRoom (prisma: any, roomId: string, type: string) {
	return await prisma.Authorization.findMany({
		where: {
			AND: [
				{type: type},
				{
					authorizationHasRoom: {
						some: {
							room: {
								is: {
									id: roomId
								}
							}
						}
					}
				}
			]
		},
		orderBy: [
			{
				authorization: 'asc',
			},
		]
	});
}

export async function getTheAuthorization (prisma: any, authNumber: string, type: string) {
	const whereCondition = [];
	whereCondition.push({ type: type})
	whereCondition.push({ authorization: authNumber })

	const authorizationList = await prisma.Authorization.findMany({
		where: {
			AND: whereCondition
		},
		orderBy: [
			{
				authorization: 'asc',
			},
		]
	});
	if (authorizationList.length === 0) {
		throw new Error(`No ${type} authorization found for ${authNumber}`);
	} else if (authorizationList.length > 1) {
		throw new Error(`More than one ${type} authorization found: ${authorizationList.map((auth: Authorization) => auth.authorization).join(', ')} for ${authNumber}`);
	} else {
		return authorizationList[0];
	}
}

export async function setAuthorizationRelations (tx: any, idAuthorization: number, changes: any) {
	for ( const holder of changes.holders || []) {
		if ( holder.status === 'New' ) {
			let p = await tx.Person.findUnique({where: {sciper: holder.sciper}});

			await tx.AuthorizationHasHolder.create({
				data: {
					idPerson: Number(p.idPerson),
					idAuthorization: idAuthorization
				}
			});
		} else if ( holder.status === 'Deleted' ) {
			let p = await tx.Person.findUnique({where: {sciper: holder.sciper}});
			if ( p ) {
				await tx.AuthorizationHasHolder.deleteMany({
					where: {
						idAuthorization: idAuthorization,
						idPerson: p.idPerson
					}
				});
			}
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
			if ( !r ) throw new Error(`Authorization not created: room not found`);
			await tx.AuthorizationHasRoom.create({
				data: {
					idLab: Number(r.id),
					idAuthorization: idAuthorization
				}
			});
		} else if ( room.status === 'Deleted' ) {
			let p = await tx.Room.findFirst({where: {name: room.name}});
			if ( p ) {
				await tx.AuthorizationHasRoom.deleteMany({
					where: {
						idAuthorization: idAuthorization,
						idLab: p.id
					}
				});
			}
		}
	}

	for ( const source of changes.radiations || []) {
		if ( source.status === 'New' ) {
			await tx.AuthorizationHasRadiation.create({
				data: {
					idAuthorization: idAuthorization,
					source: source.name
				}
			});
		} else if ( source.status === 'Deleted' ) {
			await tx.AuthorizationHasRadiation.deleteMany({
				where: {
					idAuthorization: idAuthorization,
					source: source.name
				}
			});
		}
	}

	for ( const cas of changes.cas || []) {
		if ( cas.status === 'New' ) {
			let p = await tx.AuthChem.findUnique({where: {casAuthChem: cas.name}});

			if ( !p ) {
				throw new NotFoundError(`CAS ${cas.name} not found`);
			}

			await tx.AuthorizationHasChemical.create({
				data: {
					idChemical: Number(p.idAuthChem),
					idAuthorization: idAuthorization
				}
			});
		} else if ( cas.status === 'Deleted' ) {
			let p = await tx.AuthChem.findUnique({where: {casAuthChem: cas.name}});
			if (p) {
				await tx.AuthorizationHasChemical.deleteMany({
					where: {
						idAuthorization: idAuthorization,
						idChemical: p.idAuthChem
					}
				});
			}
		}
	}

	for ( const file of changes.files || []) {
		if ( file.status === 'New' ) {
			await tx.AuthorizationHasFile.create({
				data: {
					idAuthorization: idAuthorization,
					filePath: saveBase64File(file.base64, process.env.AUTHORIZATION_DOCUMENT_FOLDER + '/' + idAuthorization + '/', file.path)
				}
			});
		} else if ( file.status === 'Deleted' ) {
			await tx.AuthorizationHasFile.deleteMany({
				where: {
					idAuthorization: idAuthorization,
					filePath: file.path
				}
			});
		}
	}
}

export async function expireAuthorization (tx: any, auth: Authorization) {
	return await tx.Authorization.update({
		where: { idAuthorization: auth.idAuthorization },
		data: {
			status: 'Expired',
			expirationDate: new Date()
		}
	});
}

export async function setAuthorizationNotified (tx: any, auth: Authorization) {
	return await tx.Authorization.update({
		where: { idAuthorization: auth.idAuthorization },
		data: {
			dateExpiryNotified: new Date()
		}
	});
}

export async function getExpiringAuthorizations (prisma: any, expiringInDays: number = 30) {
	const expirationDay = new Date();
	expirationDay.setDate(expirationDay.getDate() + expiringInDays);

	const conditions: any = {
		expirationDate: {
			lt: expirationDay     // less than `expiringInDays` from now
		},
		status: 'Active'
	};

	if (expiringInDays !== 0) {
		conditions['dateExpiryNotified'] = null;
	}

	return await prisma.Authorization.findMany({
		where: conditions
	});
}
