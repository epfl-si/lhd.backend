import {builder} from "../../builder";

export const TicketRef = builder.prismaObject('DispensationHasTicket', {
	name: 'DispensationHasTicket',
	fields: (t: any) => ({
		ticketNumber: t.exposeString('ticketNumber')
	}),
});
