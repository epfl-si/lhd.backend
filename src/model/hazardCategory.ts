export async function findCategoryByName (prisma: any, category: string) {
	return await prisma.HazardCategory.findFirst({ where: { hazardCategoryName: category }});
}
