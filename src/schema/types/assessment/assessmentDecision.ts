import {builder} from "../../builder";
import {OptimisticLock} from "../../../lib/optimisticLock";
import {AssessmentDecision} from "../../../../generated/prisma";

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

    assessment: t.field({
      type: "String",
      resolve: async (parent: any, _: any, context: any) => {
        return `ASMT-${parent.idAssessmentAndDecision}`;
      }
    }),

    subject: t.field({
      type: "String",
      resolve: async (parent: any, _: any, context: any) => {
        const subject = await context.prisma.AssessmentDecisionSubject.findUnique({
          where: { idAssessmentAndDecisionSubject: parent.idAssessmentAndDecisionSubject }
        });
        return subject ? subject.subject : null;
      }
    }),

    // t.nonNull.list.nonNull.field('assessment_rooms', {
    //   type: RoomStruct,
    //   resolve: async (parent, _, context) => {
    //     const assessmentAndRooms = await context.prisma.AssessmentDecisionHasRoom.findMany({
    //       where: { id_assessment_and_decision: parent.id_assessment_and_decision }
    //     });
    //     const roomIDs = new Set(assessmentAndRooms.map((assessmentAndRoom) => assessmentAndRoom.id_lab));
    //     return await context.prisma.Room.findMany({
    //       where: { id: { in: [...roomIDs] }}
    //     })
    //   },
    // });
    //
    // t.nonNull.list.nonNull.field('assessment_contacts', {
    //   type: PersonStruct,
    //   resolve: async (parent, _, context) => {
    //     const assessmentAndPeople = await context.prisma.AssessmentDecisionHasContact.findMany({
    //       where: { id_assessment_and_decision: parent.id_assessment_and_decision }
    //     });
    //     const peopleIDs = new Set(assessmentAndPeople.map((assessmentAndPerson) => assessmentAndPerson.id_person));
    //     return await context.prisma.Person.findMany({
    //       where: { id_person: { in: [...peopleIDs] }}
    //     })
    //   },
    // });
    //
    // t.nonNull.list.nonNull.field('assessment_units', {
    //   type: UnitStruct,
    //   resolve: async (parent, _, context) => {
    //     const assessmentAndUnits = await context.prisma.AssessmentDecisionHasUnit.findMany({
    //       where: { id_assessment_and_decision: parent.id_assessment_and_decision }
    //     });
    //     const unitIDs = new Set(assessmentAndUnits.map((assessmentAndUnit) => assessmentAndUnit.id_unit));
    //     return await context.prisma.Unit.findMany({
    //       where: { id: { in: [...unitIDs] }}
    //     })
    //   },
    // });
    //
    // t.nonNull.list.nonNull.field('assessment_tickets', {
    //   type: TicketANDStruct,
    //   resolve: async (parent, _, context) => {
    //     return await context.prisma.AssessmentDecisionHasTicket.findMany({
    //       where: { id_assessment_and_decision: parent.id_assessment_and_decision }
    //     });
    //   },
    // });
    //
    // t.nonNull.list.nonNull.field('assessment_files', {
    //   type: FileANDStruct,
    //   resolve: async (parent, _, context) => {
    //     return await context.prisma.AssessmentDecisionHasFile.findMany({
    //       where: { id_assessment_and_decision: parent.id_assessment_and_decision }
    //     });
    //   },
    // });

    opLock: t.field({
      type: 'String',
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

