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

export async function deleteHazard (tx: any, id: number) {
	await tx.LabHasHazardsChild.deleteMany({
		where: {
			idLabHasHazards: id
		}
	});

	await tx.LabHasHazards.delete({
		where: {
			idLabHasHazards: id
		}
	});
}
