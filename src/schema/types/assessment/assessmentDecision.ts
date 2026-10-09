import {builder} from "../../builder";
import {OptimisticLock} from "../../../lib/optimisticLock";
import {
  AssessmentDecision,
  AssessmentDecisionHasContact,
  AssessmentDecisionHasRoom,
  AssessmentDecisionHasUnit
} from "../../../../generated/prisma";

const AssessmentDecisionRef = builder.prismaObject('AssessmentDecision', {
  name: 'AssessmentDecision',
  fields: (t: any) => ({
    subjectOther: t.exposeString('subjectOther'),
    description: t.exposeString('description'),
    conclusion: t.exposeString('conclusion'),
    status: t.exposeString('status'),
    date: t.exposeString('date'),
    createdBy: t.exposeString('createdBy'),
    createdOn: t.expose('createdOn', { type: 'DateTime' }),
    modifiedBy: t.exposeString('modifiedBy'),
    modifiedOn: t.expose('modifiedOn', { type: 'DateTime' }),
    assessment: t.string({
      resolve: async (parent: any, _: any, context: any) => {
        return `ASMT-${parent.idAssessmentAndDecision}`;
      }
    }),
    subject: t.string({
      resolve: async (parent: any, _: any, context: any) => {
        const subject = await context.prisma.AssessmentDecisionSubject.findUnique({
          where: { idAssessmentAndDecisionSubject: parent.idAssessmentAndDecisionSubject }
        });
        return subject ? subject.subject : null;
      }
    }),
    assessmentRooms: t.field({
      type: ['Room'],
      resolve: async (parent: any, _: any, context: any) => {
        const assessmentAndRooms = await context.prisma.AssessmentDecisionHasRoom.findMany({
          where: { idAssessmentAndDecision: parent.idAssessmentAndDecision }
        });
        const roomIDs = new Set(assessmentAndRooms.map((assessmentAndRoom: AssessmentDecisionHasRoom) => assessmentAndRoom.idLab));
        return await context.prisma.Room.findMany({
          where: { id: { in: [...roomIDs] }}
        })
      },
    }),
    assessmentContacts: t.field({
      type: ['Person'],
      resolve: async (parent: any, _: any, context: any) => {
        const assessmentAndPeople = await context.prisma.AssessmentDecisionHasContact.findMany({
          where: { idAssessmentAndDecision: parent.idAssessmentAndDecision }
        });
        const peopleIDs = new Set(assessmentAndPeople.map((assessmentAndPerson: AssessmentDecisionHasContact) => assessmentAndPerson.idPerson));
        return await context.prisma.Person.findMany({
          where: { idPerson: { in: [...peopleIDs] }}
        })
      },
    }),
    assessmentUnits: t.field({
      type: ['Unit'],
      resolve: async (parent: any, _: any, context: any) => {
        const assessmentAndUnits = await context.prisma.AssessmentDecisionHasUnit.findMany({
          where: { idAssessmentAndDecision: parent.idAssessmentAndDecision }
        });
        const unitIDs = new Set(assessmentAndUnits.map((assessmentAndUnit: AssessmentDecisionHasUnit) => assessmentAndUnit.idUnit));
        return await context.prisma.Unit.findMany({
          where: { id: { in: [...unitIDs] }}
        })
      },
    }),
    assessmentTickets: t.field({
      type: ['AssessmentDecisionHasTicket'],
      resolve: async (parent: any, _: any, context: any) => {
        return await context.prisma.AssessmentDecisionHasTicket.findMany({
          where: { idAssessmentAndDecision: parent.idAssessmentAndDecision }
        });
      },
    }),
    assessmentFiles: t.field({
      type: ['AssessmentDecisionHasFile'],
      resolve: async (parent: any, _: any, context: any) => {
        return await context.prisma.AssessmentDecisionHasFile.findMany({
          where: { idAssessmentAndDecision: parent.idAssessmentAndDecision }
        });
      },
    }),
    opLock: t.string({
      resolve: async (parent: any, _: any, context: any) => {
        return OptimisticLock.createOpLock(parent.idAssessmentAndDecision, getAssessmentDecisionToString(parent));
      },
    })
  }),
});

export function getAssessmentDecisionToString(parent: AssessmentDecision) {
  return {
    id: parent.idAssessmentAndDecision,
    id_assessment_and_decision_subject: parent.idAssessmentAndDecisionSubject,
    subject_other: parent.subjectOther,
    description: parent.description,
    conclusion: parent.conclusion,
    status: parent.status,
    date: parent.date,
    created_by: parent.createdBy,
    created_on: parent.createdOn,
    modified_by: parent.modifiedBy,
    modified_on: parent.modifiedOn
  };
}

export async function getAssessmentDecisionOriginalObject (tx: any, opLock: string, name: string) {
  return await OptimisticLock.ensureDBObjectIsTheSame(opLock, 'AssessmentDecision', 'idAssessmentAndDecision', tx, name, getAssessmentDecisionToString);
}

