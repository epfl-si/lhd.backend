import {builder} from "../../builder";

export const RadiationRef = builder.prismaObject('AuthorizationHasRadiation', {
	name: 'AuthorizationHasRadiation',
	fields: (t: any) => ({
		source: t.exposeString('source')
	}),
});
