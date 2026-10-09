import {builder} from "../builder";

export const RoomKindRef = builder.prismaObject('RoomKind', {
	name: 'RoomKind',
	fields: (t: any) => ({
		name: t.exposeString('name'),
	}),
});
