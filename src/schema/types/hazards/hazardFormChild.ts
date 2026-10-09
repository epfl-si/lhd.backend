import {builder} from "../../builder";
import {OptimisticLock} from "../../../lib/optimisticLock";
import {HazardFormChild} from "../../../../generated/prisma";

export const HazardFormChildRef = builder.prismaObject('HazardFormChild', {
	name: 'HazardFormChild',
	fields: (t: any) => ({
		form: t.exposeString('form'),
		version: t.exposeString('version'),
		hazardFormChildName: t.exposeString('hazardFormChildName'),
		opLock: t.string({
			resolve: async (parent: any, _: any, context: any) => {
				return OptimisticLock.createOpLock(parent.idHazardFormChild, getHazardFormChildToString(parent));
			},
		}),
		parentForm: t.field({
			type: 'HazardForm',
			resolve: async (parent: any, _: any, context: any) => {
				return await context.prisma.HazardForm.findUnique({
					where: { idHazardForm: parent.idHazardForm },
				})
			},
		})
	}),
});

function getHazardFormChildToString(parent: HazardFormChild) {
	return {
		idHazardFormChild: parent.idHazardFormChild,
		idHazardForm: parent.idHazardForm,
		hazardFormChildName: parent.hazardFormChildName,
		form: parent.form,
		version: parent.version
	};
}
