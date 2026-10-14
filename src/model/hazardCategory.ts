export async function findCategoryByName (prisma: any, idCategory: string) {
	return await prisma.HazardCategory.findFirst({ where: { hazardCategoryName: idCategory }});
}
