export async function createChemical (tx: any, chemical: any) {
	return await tx.AuthChem.create({
		data: {
			casAuthChem: chemical.casAuthChem,
			authChemEn: chemical.authChemEn,
			flagAuthChem: chemical.flagAuthChem,
			fastway: chemical.fastway ?? false,
			authCode: chemical.authCode
		}
	});
}

export async function updateChemical (tx: any, idAuthChem: number, chemical: any) {
	return await tx.AuthChem.update(
		{ where: { idAuthChem: idAuthChem },
			data: {
				casAuthChem: chemical.casAuthChem,
				authChemEn: chemical.authChemEn,
				flagAuthChem: chemical.flagAuthChem,
				fastway: chemical.fastway ?? false,
				authCode: chemical.authCode
			}
		});
}

export async function deleteChemical (tx: any, idAuthChem: number) {
	await tx.AuthChem.delete({ where: { idAuthChem: idAuthChem }});
}

export async function getChemicals (prisma: any, opts?: Partial<{
	name: string;
	status: boolean;
	cas: string;
	fastway: string;
	authCode: string;
	take: number;
	skip: number;
}>) {
	const { name, status, cas, fastway, authCode, take, skip } = opts || {};
	const whereCondition = [];
	if (cas) {
		whereCondition.push({ casAuthChem: { contains: cas }})
	}
	if (name) {
		whereCondition.push({ authChemEn : { contains: name }})
	}
	if (status !== undefined) {
		whereCondition.push({ flagAuthChem : status })
	}
	if (fastway) {
		whereCondition.push({ fastway: ['yes', '1', 'true'].indexOf(fastway.toLowerCase()) > -1})
	}
	if (authCode) {
		whereCondition.push({ authCode: { contains: authCode }})
	}

	const chemicalList = await prisma.AuthChem.findMany({
		where: {
			AND: whereCondition
		},
		orderBy: [
			{
				casAuthChem: 'asc',
			},
		]
	});

	const chemicals = take == 0 || !take ? chemicalList : chemicalList.slice(skip, (skip ?? 0) + take);
	const totalCount = chemicalList.length;

	return { chemicals, totalCount };
}
