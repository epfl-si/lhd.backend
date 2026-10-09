import {builder} from "../../builder";
import {OptimisticLock} from "../../../lib/optimisticLock";
import {HazardsAdditionalInfoHasTag} from "../../../../generated/prisma";

export const HazardsAdditionalInfoHasTagRef = builder.prismaObject('HazardsAdditionalInfoHasTag', {
	name: 'HazardsAdditionalInfoHasTag',
	fields: (t: any) => ({
		comment: t.exposeString('comment'),
		tag: t.field({
			type: 'Tag',
			resolve: async (parent: any, _: any, context: any) => {
				return await context.prisma.Tag.findUnique({
					where: { idTag: parent.idTag }
				});
			},
		}),
		opLock: t.string({
			resolve: async (parent: any, _: any, context: any) => {
				return OptimisticLock.createOpLock(parent.idHazardsAdditionalInfoHasTag, getHazardAdditionalInfoHasTagToString(parent));
			},
		})
	}),
});

function getHazardAdditionalInfoHasTagToString(parent: HazardsAdditionalInfoHasTag) {
	return {
		idHazardsAdditionalInfoHasTag: parent.idHazardsAdditionalInfoHasTag,
		idTag: parent.idTag,
		idLabHasHazardsAdditionalInfo: parent.idLabHasHazardsAdditionalInfo,
		comment: parent.comment
	};
}
