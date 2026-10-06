import {builder} from "../../builder";
import {OptimisticLock} from "../../../lib/optimisticLock";
import {Dispensation} from "../../../../generated/prisma";

const DispensationRef = builder.prismaObject('Dispensation', {
  name: 'Dispensation',
  fields: (t: any) => ({
    renewals: t.exposeString('renewals'),
    subjectOther: t.exposeString('subjectOther'),
    dateExpiryNotified: t.expose('dateExpiryNotified', { type: 'DateTime' }),
    description: t.exposeString('description'),
    comment: t.exposeString('comment'),
    status: t.exposeString('status'),
    dateStart: t.expose('dateStart', { type: 'DateTime' }),
    dateEnd: t.expose('dateEnd', { type: 'DateTime' }),
    createdBy: t.exposeString('createdBy'),
    createdOn: t.expose('createdOn', { type: 'DateTime' }),
    modifiedBy: t.exposeString('modifiedBy'),
    modifiedOn: t.expose('modifiedOn', { type: 'DateTime' }),

    dispensation: t.field({
      type: "String",
      resolve: async (parent: any, _: any, context: any) => {
        return `DISP-${parent.idDispensation}`;
      }
    }),

    subject: t.field({
      type: "String",
      resolve: async (parent: any, _: any, context: any) => {
        const subject = await context.prisma.DispensationSubject.findUnique({
          where: { idDispensationSubject: parent.idDispensationSubject }
        });
        return subject ? subject.subject : null;
      }
    }),

    // dispensation_rooms: t.prismaField({
    //   type: [RoomRef],
    //   resolve: async (query: any, parent: any, _: any, context: any) => {
    //     const dispensationsAndRooms = await context.prisma.DispensationHasRoom.findMany({
    //       where: { idDispensation: parent.idDispensation }
    //     });
    //     const roomIDs = new Set(dispensationsAndRooms.map((dispensationAndRoom: DispensationHasRoom) => dispensationAndRoom.idLab));
    //     return await context.prisma.Room.findMany({
    //       where: { id: { in: [...roomIDs] }}
    //     })
    //   },
    // }),
    //
    // t.nonNull.list.nonNull.field('dispensation_holders', {
    //   type: PersonStruct,
    //   resolve: async (parent, _, context) => {
    //     const dispensationsAndPeople = await context.prisma.DispensationHasHolder.findMany({
    //       where: { id_dispensation: parent.id_dispensation }
    //     });
    //     const peopleIDs = new Set(dispensationsAndPeople.map((dispensationAndPerson) => dispensationAndPerson.id_person));
    //     return await context.prisma.Person.findMany({
    //       where: { id_person: { in: [...peopleIDs] }}
    //     })
    //   },
    // });
    //
    // t.nonNull.list.nonNull.field('dispensation_units', {
    //   type: UnitStruct,
    //   resolve: async (parent, _, context) => {
    //     const dispensationsAndUnits = await context.prisma.DispensationHasUnit.findMany({
    //       where: { id_dispensation: parent.id_dispensation }
    //     });
    //     const unitIDs = new Set(dispensationsAndUnits.map((dispensationsAndUnit) => dispensationsAndUnit.id_unit));
    //     return await context.prisma.Unit.findMany({
    //       where: { id: { in: [...unitIDs] }}
    //     })
    //   },
    // });
    //
    // t.nonNull.list.nonNull.field('dispensation_tickets', {
    //   type: TicketStruct,
    //   resolve: async (parent, _, context) => {
    //     return await context.prisma.DispensationHasTicket.findMany({
    //       where: { id_dispensation: parent.id_dispensation }
    //     });
    //   },
    // });
    //
    // t.nonNull.list.nonNull.field('dispensation_files', {
    //   type: FileDispensationStruct,
    //   resolve: async (parent, _, context) => {
    //     return await context.prisma.DispensationHasFile.findMany({
    //       where: { id_dispensation: parent.id_dispensation }
    //     });
    //   },
    // });

    opLock: t.field({
      type: 'String',
      resolve: async (parent: any, _: any, context: any) => {
        return OptimisticLock.createOpLock(parent.idDispensation, getDispensationToString(parent));
      },
    })
  }),
});

export function getDispensationToString(parent: Dispensation) {
  return {
    id: parent.idDispensation,
    renewals: parent.renewals,
    id_dispensation_subject: parent.idDispensationSubject,
    subject_other: parent.subjectOther,
    date_expiry_notified: parent.dateExpiryNotified,
    description: parent.description,
    comment: parent.comment,
    status: parent.status,
    date_start: parent.dateStart,
    date_end: parent.dateEnd,
    created_by: parent.createdBy,
    created_on: parent.createdOn,
    modified_by: parent.modifiedBy,
    modified_on: parent.modifiedOn
  };
}

export async function getDispensationOriginalObject (tx: any, opLock: string, name: string) {
  return await OptimisticLock.ensureDBObjectIsTheSame(opLock, 'Dispensation', 'idDispensation', tx, name, getDispensationToString);
}
