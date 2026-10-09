import {builder} from "../../builder";
import {OptimisticLock} from "../../../lib/optimisticLock";
import {HazardForm} from "../../../../generated/prisma";

export const HazardFormRef = builder.prismaObject('HazardForm', {
	name: 'HazardForm',
	fields: (t: any) => ({
		form: t.exposeString('form'),
		version: t.exposeString('version'),
		opLock: t.string({
			resolve: async (parent: any, _: any, context: any) => {
				return OptimisticLock.createOpLock(parent.idHazardForm, getHazardFormToString(parent));
			},
		}),
		hazardCategory: t.field({
			type: 'HazardCategory',
			resolve: async (parent: any, _: any, context: any) => {
				return await context.prisma.HazardCategory.findUnique({
					where: { idHazardCategory: parent.idHazardCategory}
				});
			},
		}),
		children: t.field({
			type: ['HazardFormChild'],
			resolve: async (parent: any, _: any, context: any) => {
				return await context.prisma.HazardFormChild.findMany({
					where: { idHazardForm: (parent as any).idHazardForm }});
			},
		})
	}),
});

function getHazardFormToString(parent: HazardForm) {
	return {
		idHazardForm: parent.idHazardForm,
		idHazardCategory: parent.idHazardCategory,
		form: parent.form,
		version: parent.version
	};
}
