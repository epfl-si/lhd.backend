import {builder} from "../../builder";

export const FileDispensationRef = builder.prismaObject('DispensationHasFile', {
	name: 'DispensationHasFile',
	fields: (t: any) => ({
		filePath: t.exposeString('filePath')
	}),
});
