import {builder} from "../schema/builder";

export const OthersMutationType = builder.inputType('OthersMutationType', {
	fields: (t) => ({
		status: t.string({ required: true }),
		name: t.string(),
		id: t.int()
	}),
});

export const HolderMutationType = builder.inputType('HolderMutationType', {
	fields: (t) => ({
		status: t.string({ required: true }),
		sciper: t.int({ required: true }),
	}),
});

export const StringMutationType = builder.inputType('StringMutationType', {
	fields: (t) => ({
		status: t.string({ required: true }),
		name: t.string({ required: true }),
	}),
});

export const FileMutationInput = builder.inputType('FileMutationType', {
	fields: (t) => ({
		status: t.string({ required: true }),
		path: t.string(),
		base64: t.string(),
	}),
});
