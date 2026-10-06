import {builder} from "../../builder";

export const TicketANDRef = builder.prismaObject('AssessmentDecisionHasTicket', {
	name: 'AssessmentDecisionHasTicket',
	fields: (t: any) => ({
		ticketNumber: t.exposeString('ticketNumber')
	}),
});
