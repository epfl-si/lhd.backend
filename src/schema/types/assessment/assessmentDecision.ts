import {builder} from "../../builder";
import {OptimisticLock} from "../../../lib/optimisticLock";
import {
  $Enums,
  AssessmentDecision,
  AssessmentDecisionHasContact,
  AssessmentDecisionHasRoom,
  AssessmentDecisionHasUnit
} from "../../../../generated/prisma";
import {z} from "zod";
import {sanitizeHolderMutationTypes, sanitizeMutationTypes, sanitizeSearchString} from "../../../lib/searchStrings";
import {
  alphanumericRegexp,
  fileContentValidator,
  freeFormTextRegexp,
  opLockValidator,
  pathRegexp
} from "../../../lib/lhdValidators";
import {acceptDateString, acceptSubstringInList, fromSanitizer} from "../../../lib/fieldValidatePlugin";
import {
  FileMutationInput,
  HolderMutationType,
  OthersMutationType,
  StringMutationType
} from "../../../lib/mutationTypes";
import {ensurePerson} from "../../../model/persons";
import {success} from "../../../lib/statuses";
import {
  createAssessmentDecision,
  getAssessments,
  setAssessmentDecisionRelations,
  updateAssessmentDecision
} from "../../../model/assessmentDecision";
import AssessmentDecisionStatus = $Enums.AssessmentDecisionStatus;

const AssessmentDecisionRef = builder.prismaObject('AssessmentDecision', {
  name: 'AssessmentDecision',
  fields: (t: any) => ({
    subjectOther: t.exposeString('subjectOther'),
    description: t.exposeString('description'),
    conclusion: t.exposeString('conclusion'),
    status: t.exposeString('status'),
    date: t.expose('date', { type: 'DateTime' }),
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
    idAssessmentAndDecisionSubject: parent.idAssessmentAndDecisionSubject,
    subjectOther: parent.subjectOther,
    description: parent.description,
    conclusion: parent.conclusion,
    status: parent.status,
    date: parent.date,
    createdBy: parent.createdBy,
    createdOn: parent.createdOn,
    modifiedBy: parent.modifiedBy,
    modifiedOn: parent.modifiedOn
  };
}

export async function getAssessmentDecisionOriginalObject (tx: any, opLock: string, name: string) {
  return await OptimisticLock.ensureDBObjectIsTheSame(opLock, 'AssessmentDecision', 'idAssessmentAndDecision', tx, name, getAssessmentDecisionToString);
}

const AssessmentDecisionsListResult = builder.objectRef<{
  totalCount: number;
  assessment: any[];
}>('AssessmentDecisionsListResult').implement({
  fields: (t) => ({
    totalCount: t.exposeInt('totalCount'),
    assessment: t.field({
      type: [AssessmentDecisionRef],
      resolve: (parent) => parent.assessment,
    }),
  }),
});

const searchSpec = {
  Unit: {rename: 'unit', validate: alphanumericRegexp},
  Assessment: {rename: 'assessment', validate: alphanumericRegexp},
  Status: {rename: 'status', validate: (value: string) => acceptSubstringInList(value, Object.values(AssessmentDecisionStatus))},
  Room: {rename: 'room', validate: alphanumericRegexp},
  Contact: {rename: 'contact', validate: alphanumericRegexp},
  Subject: {rename: 'subject', validate: alphanumericRegexp},
  Ticket: {rename: 'ticket', validate: alphanumericRegexp},
  Before: {rename: 'before', validate: acceptDateString},
  After: {rename: 'after', validate: acceptDateString},
};

const searchSchema = z
  .string()
  .superRefine((s, ctx) => {
    try {
      sanitizeSearchString(s, searchSpec);
    } catch (e) {
      ctx.addIssue({
        code: 'custom',
        message: `Invalid search parameters: ${(e as Error).message}`,
      });
    }
  })
  .nullish();

builder.queryType({
  fields: (t) => ({
    assessmentWithPagination: t.field({
      type: AssessmentDecisionsListResult,
      args: {
        search: t.arg.string({defaultValue: '', required: true, validate: searchSchema}),
        skip: t.arg.int({defaultValue: 0, required: true, validate: z.number().int().min(0)}),
        take: t.arg.int({defaultValue: 20, required: true, validate: z.number().int().min(0)}),
      },
      authScopes: {
        needPermission: 'canListAssessments'
      },
      resolve: async (root, args, ctx: any) => {
        const search = sanitizeSearchString(args.search, searchSpec);
        return await getAssessments(ctx.prisma, search, args.take, args.skip);
      },
    })
  }),
});

builder.mutationType({
  fields: (t) => ({
    addAssessmentDecision: t.string({
      authScopes: {
        needPermission: 'canEditAssessments'
      },
      args: {
        subject: t.arg.string({ required: true, validate: z.string().regex(alphanumericRegexp) }),
        subjectOther: t.arg.string({ required: true, validate: z.string().regex(alphanumericRegexp) }),
        description: t.arg.string({ required: true, validate: z.string().regex(freeFormTextRegexp) }),
        conclusion: t.arg.string({ required: true, validate: z.string().regex(freeFormTextRegexp) }),
        status: t.arg.string({ required: true, validate: z.enum(Object.values(AssessmentDecisionStatus)) }),
          date: t.arg.string({ required: true, validate: fromSanitizer(acceptDateString) }),
        rooms: t.arg({
          type: [OthersMutationType],
          validate: fromSanitizer(sanitizeMutationTypes),
        }),
        units: t.arg({
          type: [OthersMutationType],
          validate: fromSanitizer(sanitizeMutationTypes),
        }),
        contacts: t.arg({
          type: [HolderMutationType],
          validate: fromSanitizer(sanitizeHolderMutationTypes),
        }),
        tickets: t.arg({
          type: [StringMutationType],
          validate: fromSanitizer(sanitizeMutationTypes),
        }),
        files: t.arg({
          type: [FileMutationInput],
          required: { list: false, items: false },
          validate: z.array(z.object({
            status: z.enum(['New', 'Default', 'Deleted']),
            base64: fileContentValidator,
            path: z.string().regex(pathRegexp).optional(),
          }),)
        }),
      },
      resolve: async (root, args, ctx: any) => {
        const subject = await ctx.prisma.AssessmentDecisionSubject.findUnique({where: {subject: args.subject}});
        const newcontacts = (args.contacts ?? []).filter(contact => contact.status === 'New');
        await ensurePerson(ctx.prisma, newcontacts);
        await ctx.prisma.$transaction(async (tx: any) => {
          const ass = await createAssessmentDecision(tx, ctx.user, subject.idAssessmentAndDecisionSubject,
            args.description, args.conclusion, args.subjectOther, args.status, acceptDateString(args.date));

          await setAssessmentDecisionRelations(tx, ass.idAssessmentAndDecision, args);
        });
        return success();
      },
    }),
    updateAssessmentDecision: t.string({
      authScopes: {
        needPermission: 'canEditAssessments'
      },
      args: {
        opLock: t.arg.string({required: true, validate: opLockValidator}),
        subject: t.arg.string({ required: true, validate: z.string().regex(alphanumericRegexp) }),
        subjectOther: t.arg.string({ required: true, validate: z.string().regex(alphanumericRegexp) }),
        description: t.arg.string({ required: true, validate: z.string().regex(freeFormTextRegexp) }),
        conclusion: t.arg.string({ required: true, validate: z.string().regex(freeFormTextRegexp) }),
        status: t.arg.string({ required: true, validate: z.enum(Object.values(AssessmentDecisionStatus)) }),
        date: t.arg.string({ required: true, validate: fromSanitizer(acceptDateString) }),
        rooms: t.arg({
          type: [OthersMutationType],
          validate: fromSanitizer(sanitizeMutationTypes),
        }),
        units: t.arg({
          type: [OthersMutationType],
          validate: fromSanitizer(sanitizeMutationTypes),
        }),
        contacts: t.arg({
          type: [HolderMutationType],
          validate: fromSanitizer(sanitizeHolderMutationTypes),
        }),
        tickets: t.arg({
          type: [StringMutationType],
          validate: fromSanitizer(sanitizeMutationTypes),
        }),
        files: t.arg({
          type: [FileMutationInput],
          required: { list: false, items: false },
          validate: z.array(z.object({
            status: z.enum(['New', 'Default', 'Deleted']),
            base64: fileContentValidator,
            path: z.string().regex(pathRegexp).optional(),
          }),)
        }),
      },
      resolve: async (root, args, ctx: any) => {
        const ass = await getAssessmentDecisionOriginalObject(ctx.prisma, args.opLock, 'AssessmentDecision');
        const subject = await ctx.prisma.AssessmentDecisionSubject.findUnique({where: {subject: args.subject}});
        const newcontacts = (args.contacts ?? []).filter(contact => contact.status === 'New');
        await ensurePerson(ctx.prisma, newcontacts);
        await ctx.prisma.$transaction(async (tx: any) => {
          await updateAssessmentDecision(tx, ass.idAssessmentAndDecision, ctx.user, subject.idAssessmentAndDecisionSubject,
            args.description, args.conclusion, args.subjectOther, args.status, acceptDateString(args.date));
          await setAssessmentDecisionRelations(tx, ass.idAssessmentAndDecision, args);
        });
        return success();
      },
    }),
    deleteAssessmentDecision: t.string({
      authScopes: {
        needPermission: 'canEditAssessments'
      },
      args: {
        opLock: t.arg.string({required: true, validate: opLockValidator}),
      },
      resolve: async (root, args, ctx: any) => {
        const ass = await getAssessmentDecisionOriginalObject(ctx.prisma, args.opLock, 'AssessmentDecision');
        await ctx.prisma.$transaction(async (tx: any) => {
          await tx.AssessmentDecisionHasRoom.deleteMany({ where: { idAssessmentAndDecision: ass.idAssessmentAndDecision }});
          await tx.AssessmentDecisionHasContact.deleteMany({ where: { idAssessmentAndDecision: ass.idAssessmentAndDecision }});
          await tx.AssessmentDecisionHasTicket.deleteMany({ where: { idAssessmentAndDecision: ass.idAssessmentAndDecision }});
          await tx.AssessmentDecisionHasUnit.deleteMany({ where: { idAssessmentAndDecision: ass.idAssessmentAndDecision }});
          await tx.AssessmentDecisionHasFile.deleteMany({ where: { idAssessmentAndDecision: ass.idAssessmentAndDecision }});
          await tx.AssessmentDecision.delete({ where: { idAssessmentAndDecision: ass.idAssessmentAndDecision }});
        });
        return success();
      },
    }),
  }),
});
