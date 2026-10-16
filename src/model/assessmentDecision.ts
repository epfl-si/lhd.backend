import {buildSearchConditions} from "../lib/searchConditionBuilder";
import {getUserString, UserInfo} from "../lib/userType";
import {saveBase64File} from "../lib/fileUtilities";

export async function getAssessments (prisma: any, dictionary?: Partial<{
	unit: string,
	assessment: string,
	status: string,
	room: string,
	contact: string,
	subject: string,
	ticket: string,
	before: Date,
	after: Date
}>, take = 0, skip = 0) {
	const { unit, assessment, status, room, contact, subject, ticket, before, after } = dictionary as any || {};
	const whereCondition = [];
	if (assessment) {
		const disp = assessment.split('-');
		const assessmentNumber = Number(disp.length > 1 ? disp[1] : disp[0]);
		if (!isNaN(assessmentNumber)) {
			whereCondition.push({idAssessmentAndDecision: Number(assessmentNumber)})
		} else {
			whereCondition.push({idAssessmentAndDecision: -1})
		}
	}
	if (status) {
		whereCondition.push({ status: status })
	}
	if (before) {
		whereCondition.push({ date: { lte: before } })
	}
	if (after) {
		whereCondition.push({ date: { gte: after } })
	}
	if (room) {
		whereCondition.push({ assessmentAndDecisionHasRoom: { some: {room: {is: {name: {contains: room}}}} }})
	}
	if (unit) {
		const unitSearch = buildSearchConditions(unit);
		whereCondition.push({
			OR: [
				{ assessmentAndDecisionHasUnit: { some: {unit: {is: {name: unitSearch}}} }},
				{ assessmentAndDecisionHasUnit: { some: {unit: {is: {institute: {is: {name: unitSearch}}}}} }},
				{ assessmentAndDecisionHasUnit: { some: {unit: {is: {institute: {is: {school: {is: {name: unitSearch}}}}}}} }}
			]
		})
	}
	if (contact) {
		whereCondition.push({
			assessmentAndDecisionHasContact: {
				some: {
					contact: {
						OR: [
							{ name: { contains: contact } },
							{ surname: { contains: contact } },
							{ email: { contains: contact } },
							{ sciper: parseInt(contact) },
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
		whereCondition.push({ assessmentAndDecisionHasTicket: { some: {ticketNumber: {contains: ticket}} }})
	}

	const assessmentList = await prisma.AssessmentDecision.findMany({
		where: {
			AND: whereCondition
		},
		orderBy: [
			{
				idAssessmentAndDecision: 'desc',
			},
		]
	});

	const assessmentFiltered = take == 0 ? assessmentList : assessmentList.slice(skip, skip + take);
	const totalCount = assessmentList.length;

	return { assessment: assessmentFiltered, totalCount };
}

export async function createAssessmentDecision (tx: any, user: UserInfo, subjectId: number, description: string, conclusion: string, subjectOther: string, status: string, date: Date) {
	return await tx.AssessmentDecision.create({
		data: {
			idAssessmentAndDecisionSubject: subjectId,
			subjectOther: subjectOther,
			description: decodeURIComponent(description),
			conclusion: decodeURIComponent(conclusion),
			status: status,
			date: date,
			createdBy: getUserString(user),
			createdOn: new Date(),
			modifiedBy: getUserString(user),
			modifiedOn: new Date()
		}
	});
}

export async function updateAssessmentDecision (tx: any, idAssessmentAndDecision: number, user: UserInfo, subjectId: number, description: string, conclusion: string, subjectOther: string, status: string, date: Date) {
	return await tx.AssessmentDecision.update({
		where: { idAssessmentAndDecision: idAssessmentAndDecision },
		data: {
			idAssessmentAndDecisionSubject: subjectId,
			subjectOther: subjectOther,
			description: decodeURIComponent(description),
			conclusion: decodeURIComponent(conclusion),
			status: status,
			modifiedBy: getUserString(user),
			modifiedOn: new Date()
		}
	});
}

export async function setAssessmentDecisionRelations(tx: any, idAssessmentAndDecision: number, changes: any) {
	for ( const contact of changes.contacts || []) {
		const p = await tx.Person.findUnique({where: {sciper: contact.sciper}});
		if ( contact.status === 'New' ) {
			await tx.AssessmentDecisionHasContact.create({
				data: {
					idPerson: Number(p.idPerson),
					idAssessmentAndDecision: idAssessmentAndDecision
				}
			});
		} else if ( contact.status === 'Deleted' ) {
			await tx.AssessmentDecisionHasContact.deleteMany({
				where: {
					idAssessmentAndDecision: idAssessmentAndDecision,
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
			if ( !r ) throw new Error(`AssessmentDecision not created: room not found`);
			await tx.AssessmentDecisionHasRoom.create({
				data: {
					idLab: Number(r.id),
					idAssessmentAndDecision: idAssessmentAndDecision
				}
			});
		} else if ( room.status === 'Deleted' ) {
			let p = await tx.Room.findFirst({where: {name: room.name}});
			if ( p ) {
				await tx.AssessmentDecisionHasRoom.deleteMany({
					where: {
						idAssessmentAndDecision: idAssessmentAndDecision,
						idLab: p.id
					}
				});
			}
		}
	}

	for ( const unit of changes.units || []) {
		const u = await tx.Unit.findFirst({where: {name: unit.name}});
		if ( unit.status === 'New' ) {
			if ( !u ) throw new Error(`AssessmentDecision not created: unit not found`);
			await tx.AssessmentDecisionHasUnit.create({
				data: {
					idUnit: Number(u.id),
					idAssessmentAndDecision: idAssessmentAndDecision
				}
			});
		} else if ( unit.status === 'Deleted' && u) {
			await tx.AssessmentDecisionHasUnit.deleteMany({
				where: {
					idAssessmentAndDecision: idAssessmentAndDecision,
					idUnit: u.id
				}
			});
		}
	}

	for ( const ticket of changes.tickets || []) {
		if ( ticket.status === 'New' ) {
			await tx.AssessmentDecisionHasTicket.create({
				data: {
					idAssessmentAndDecision: idAssessmentAndDecision,
					ticketNumber: ticket.name
				}
			});
		} else if ( ticket.status === 'Deleted' ) {
			await tx.AssessmentDecisionHasTicket.deleteMany({
				where: {
					idAssessmentAndDecision: idAssessmentAndDecision,
					ticketNumber: ticket.name
				}
			});
		}
	}

	for ( const file of changes.files || []) {
		if ( file.status === 'New' ) {
			await tx.AssessmentDecisionHasFile.create({
				data: {
					idAssessmentAndDecision: idAssessmentAndDecision,
					filePath: saveBase64File(file.base64, process.env.ASSESSMENT_DECISION_DOCUMENT_FOLDER + '/' + idAssessmentAndDecision + '/', file.path)
				}
			});
		} else if ( file.status === 'Deleted' ) {
			await tx.AssessmentDecisionHasFile.deleteMany({
				where: {
					idAssessmentAndDecision: idAssessmentAndDecision,
					filePath: file.path
				}
			});
		}
	}
}
