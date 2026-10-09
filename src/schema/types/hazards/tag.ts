import {builder} from "../../builder";

export const TagRef = builder.prismaObject('Tag', {
	name: 'Tag',
	fields: (t: any) => ({
		tagName: t.exposeString('tagName'),
	}),
});
