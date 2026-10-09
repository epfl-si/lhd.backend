import {builder} from "../../builder";
import {OptimisticLock} from "../../../lib/optimisticLock";
import {
  Dispensation,
  DispensationHasHolder,
  DispensationHasRoom,
  DispensationHasUnit
} from "../../../../generated/prisma";

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
    dispensation: t.string({
      resolve: async (parent: any, _: any, context: any) => {
        return `DISP-${parent.idDispensation}`;
      }
    }),
    subject: t.string({
      resolve: async (parent: any, _: any, context: any) => {
        const subject = await context.prisma.DispensationSubject.findUnique({
          where: { idDispensationSubject: parent.idDispensationSubject }
        });
        return subject ? subject.subject : null;
      }
    }),
    dispensationRooms: t.field({
      type: ['Room'],
      resolve: async (parent: any, _: any, context: any) => {
        const dispensationsAndRooms = await context.prisma.DispensationHasRoom.findMany({
          where: { idDispensation: parent.idDispensation }
        });
        const roomIDs = new Set(dispensationsAndRooms.map((dispensationAndRoom: DispensationHasRoom) => dispensationAndRoom.idLab));
        return await context.prisma.Room.findMany({
          where: { id: { in: [...roomIDs] }}
        })
      },
    }),
    dispensationHolders: t.field({
      type: ['Person'],
      resolve: async (parent: any, _: any, context: any) => {
        const dispensationsAndPeople = await context.prisma.DispensationHasHolder.findMany({
          where: { idDispensation: parent.idDispensation }
        });
        const peopleIDs = new Set(dispensationsAndPeople.map((dispensationAndPerson: DispensationHasHolder) => dispensationAndPerson.idPerson));
        return await context.prisma.Person.findMany({
          where: { idPerson: { in: [...peopleIDs] }}
        })
      },
    }),
    dispensationUnits: t.field({
      type: ['Unit'],
      resolve: async (parent: any, _: any, context: any) => {
        const dispensationsAndUnits = await context.prisma.DispensationHasUnit.findMany({
          where: { idDispensation: parent.idDispensation }
        });
        const unitIDs = new Set(dispensationsAndUnits.map((dispensationsAndUnit: DispensationHasUnit) => dispensationsAndUnit.idUnit));
        return await context.prisma.Unit.findMany({
          where: { id: { in: [...unitIDs] }}
        })
      },
    }),
    dispensationTickets: t.field({
      type: ['DispensationHasTicket'],
      resolve: async (parent: any, _: any, context: any) => {
        return await context.prisma.DispensationHasTicket.findMany({
          where: { idDispensation: parent.idDispensation }
        });
      },
    }),
    dispensationFiles: t.field({
      type: ['DispensationHasFile'],
      resolve: async (parent: any, _: any, context: any) => {
        return await context.prisma.DispensationHasFile.findMany({
          where: { idDispensation: parent.idDispensation }
        });
      },
    }),
    opLock: t.string({
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
