import {builder} from "../../builder";

export const FileANDRef = builder.prismaObject('AssessmentDecisionHasFile', {
	name: 'AssessmentDecisionHasFile',
	fields: (t: any) => ({
		filePath: t.exposeString('filePath')
	}),
});
