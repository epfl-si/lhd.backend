import {builder} from "../builder";

export const RoomKindRef = builder.prismaObject('RoomKind', {
	name: 'RoomKind',
	fields: (t: any) => ({
		name: t.exposeString('name'),
	}),
});

builder.queryType({
	fields: (t) => ({
		roomKinds: t.prismaField({
			type: [RoomKindRef],
			authScopes: {
				needPermission: 'canListRooms'
			},
			resolve: async (query, root, args, ctx: any, info) => {
				return await ctx.prisma.RoomKind.findMany();
			},
		}),
	}),
});
