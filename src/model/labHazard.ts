export async function createLabHasHazard (tx: any, roomId: number, idHazardFormHistory: number, submission: {data: any}) {
	return await tx.LabHasHazards.create({
		data: {
			idLab: roomId,
			idHazardFormHistory: idHazardFormHistory,
			submission: JSON.stringify(submission)
		}
	});
}

export async function updateLabHasHazard (tx: any, idLabHasHazards: number, idHazardFormHistory: number, submission: {data: any}) {
	return await tx.LabHasHazards.update(
		{ where: { idLabHasHazards: idLabHasHazards },
			data: {
				idHazardFormHistory: idHazardFormHistory,
				submission: JSON.stringify(submission)
			}
		});
}

export async function deleteLabHasHazard (tx: any, id: number) {
	await tx.LabHasHazards.delete({
		where: {
			idLabHasHazards: id
		}
	});
}

export async function deleteLabHasHazardChild (tx: any, id: number) {
	await tx.LabHasHazardsChild.delete({
		where: {
			idLabHasHazardsChild: id
		}
	});
}

export async function deleteLabHasHazardChildByParent (tx: any, idParent: number) {
	await tx.LabHasHazardsChild.deleteMany({
		where: {
			idLabHasHazards: idParent
		}
	});
}

export async function findLabHasHazardChildByParent (tx: any, idParent: number) {
	return await tx.LabHasHazardsChild.findMany({where: {idLabHasHazards: idParent}});
}
