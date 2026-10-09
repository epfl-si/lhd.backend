import {builder} from "../../builder";
import {HazardFormRef} from "./hazardForm";

export const HazardFormHistoryRef = builder.prismaObject('HazardFormHistory', {
	name: 'HazardFormHistory',
	fields: (t: any) => ({
		form: t.exposeString('form'),
		version: t.exposeString('version'),
		hazardForm: t.field({
			type: 'HazardForm',
			resolve: async (parent: any, _: any, context: any) => {
				return await context.prisma.HazardForm.findUnique({
					where: { idHazardForm: parent.idHazardForm},
					include: { hazardCategory: true }
				});
			},
		})
	}),
});
