import {builder} from "../../builder";

export const FileAuthorizationRef = builder.prismaObject('AuthorizationHasFile', {
	name: 'AuthorizationHasFile',
	fields: (t: any) => ({
		filePath: t.exposeString('filePath')
	}),
});
