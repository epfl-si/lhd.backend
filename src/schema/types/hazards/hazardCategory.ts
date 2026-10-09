import {builder} from "../../builder";

export const HazardCategoryRef = builder.prismaObject('HazardCategory', {
	name: 'HazardCategory',
	fields: (t: any) => ({
		hazardCategoryName: t.exposeString('hazardCategoryName'),
	}),
});
