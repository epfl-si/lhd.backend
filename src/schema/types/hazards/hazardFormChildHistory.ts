import {builder} from "../../builder";
import {HazardFormChildRef} from "./hazardFormChild";

export const HazardFormChildHistoryRef = builder.prismaObject('HazardFormChildHistory', {
	name: 'HazardFormChildHistory',
	fields: (t: any) => ({
		form: t.exposeString('form'),
		version: t.exposeString('version'),
		hazardFormChild: t.field({
			type: 'HazardFormChild',
			resolve: async (parent: any, _: any, context: any) => {
				return await context.prisma.HazardFormChild.findUnique({
					where: { idHazardFormChild: parent.idHazardFormChild}
				});
			},
		})
	}),
});
