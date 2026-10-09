import {builder} from "../../builder";

export const FileAdditionalInfoRef = builder.prismaObject('HazardsAdditionalInfoHasFile', {
	name: 'HazardsAdditionalInfoHasFile',
	fields: (t: any) => ({
		filePath: t.exposeString('filePath'),
	}),
});
