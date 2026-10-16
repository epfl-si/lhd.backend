import {builder} from "../../builder";
import {OptimisticLock} from "../../../lib/optimisticLock";
import {
  $Enums,
  Dispensation,
  DispensationHasHolder,
  DispensationHasRoom,
  DispensationHasUnit
} from "../../../../generated/prisma";
import {z} from "zod";
import {
  alphanumericRegexp,
  fileContentValidator,
  freeFormTextRegexp,
  opLockValidator,
  pathRegexp
} from "../../../lib/lhdValidators";
import {acceptDateString, acceptSubstringInList, fromSanitizer} from "../../../lib/fieldValidatePlugin";
import {sanitizeHolderMutationTypes, sanitizeMutationTypes, sanitizeSearchString} from "../../../lib/searchStrings";
import {
  createDispensation,
  getDispensation,
  getDispensations,
  setDispensationRelations,
  updateDispensation
} from "../../../model/dispensation";
import {
  FileMutationInput,
  HolderMutationType,
  OthersMutationType,
  StringMutationType
} from "../../../lib/mutationTypes";
import {ensurePerson} from "../../../model/persons";
import {sendEmailForDispensation} from "../../../lib/email/mailer";
import {success} from "../../../lib/statuses";
import DispensationStatus = $Enums.DispensationStatus;

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
    idDispensationSubject: parent.idDispensationSubject,
    subjectOther: parent.subjectOther,
    dateExpiryNotified: parent.dateExpiryNotified,
    description: parent.description,
    comment: parent.comment,
    status: parent.status,
    dateStart: parent.dateStart,
    dateEnd: parent.dateEnd,
    createdBy: parent.createdBy,
    createdOn: parent.createdOn,
    modifiedBy: parent.modifiedBy,
    modifiedOn: parent.modifiedOn
  };
}

export async function getDispensationOriginalObject (tx: any, opLock: string, name: string) {
  return await OptimisticLock.ensureDBObjectIsTheSame(opLock, 'Dispensation', 'idDispensation', tx, name, getDispensationToString);
}

const searchSpec = {
  Unit:         {rename: 'unit', validate: alphanumericRegexp},
  Dispensation: {rename: 'dispensation', validate: alphanumericRegexp},
  Status:       {rename: 'status', validate: (value: string) => acceptSubstringInList(value, Object.values(DispensationStatus))},
  Room:         {rename: 'room', validate: alphanumericRegexp},
  Holder:       {rename: 'holder', validate: alphanumericRegexp},
  Subject:      {rename: 'subject', validate: alphanumericRegexp},
  Ticket:       {rename: 'ticket', validate: alphanumericRegexp},
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

const DispensationListResult = builder.objectRef<{
  totalCount: number;
  dispensations: any[];
}>('DispensationListResult').implement({
  fields: (t) => ({
    totalCount: t.exposeInt('totalCount'),
    dispensations: t.field({
      type: [DispensationRef],
      resolve: (parent) => parent.dispensations,
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    dispensationsWithPagination: t.field({
      type: DispensationListResult,
      args: {
        search: t.arg.string({defaultValue: '', validate: searchSchema}),
        skip: t.arg.int({defaultValue: 0, validate: z.number().int().min(0).nullish()}),
        take: t.arg.int({defaultValue: 20, validate: z.number().int().min(0).nullish()}),
      },
      authScopes: {
        needPermission: 'canListDispensations'
      },
      resolve: async (root, args, ctx: any) => {
        const search = sanitizeSearchString(args.search ?? '', searchSpec);
        return await getDispensations(ctx.prisma, search, args.take ?? 20, args.skip ?? 0);
      },
    })
  }),
});

builder.mutationType({
  fields: (t) => ({
    addDispensation: t.string({
      authScopes: {
        needPermission: 'canEditDispensations'
      },
      args: {
        subject: t.arg.string({ required: true, validate: z.string().regex(alphanumericRegexp) }),
        subjectOther: t.arg.string({ required: true, validate: z.string().regex(alphanumericRegexp) }),
        description: t.arg.string({ required: true, validate: z.string().regex(freeFormTextRegexp) }),
        comment: t.arg.string({ required: true, validate: z.string().regex(freeFormTextRegexp) }),
        status: t.arg.string({ required: true, validate: z.enum(Object.values(DispensationStatus)) }),
        dateStart: t.arg.string({ required: true, validate: fromSanitizer(acceptDateString) }),
        dateEnd: t.arg.string({ required: true, validate: fromSanitizer(acceptDateString) }),
        rooms: t.arg({
          type: [OthersMutationType],
          validate: fromSanitizer(sanitizeMutationTypes),
        }),
        units: t.arg({
          type: [OthersMutationType],
          validate: fromSanitizer(sanitizeMutationTypes),
        }),
        holders: t.arg({
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
        const subject = await ctx.prisma.DispensationSubject.findUnique({where: {subject: args.subject}});
        const newHolders = (args.holders ?? []).filter(holder => holder.status === 'New');
        await ensurePerson(ctx.prisma, newHolders);
        const dispensation = await ctx.prisma.$transaction(async (tx: any) => {
          const disp = await createDispensation(tx, ctx.user, subject.idDispensationSubject,
            args.description, args.comment, args.subjectOther, args.status, acceptDateString(args.dateStart), acceptDateString(args.dateEnd));

          await setDispensationRelations(tx, disp.idDispensation, args);
          return disp;
        });
        const dispCreated = await getDispensation(ctx.prisma, dispensation.idDispensation);
        if (dispCreated.status === 'Active') {
          await sendEmailForDispensation(ctx.user.userFullName, ctx.user.userEmail, dispCreated, 'newDispensation');
        }
        return success();
      },
    }),
    updateDispensation: t.string({
      authScopes: {
        needPermission: 'canEditDispensations'
      },
      args: {
        opLock: t.arg.string({required: true, validate: opLockValidator}),
        subject: t.arg.string({ required: true, validate: z.string().regex(alphanumericRegexp) }),
        subjectOther: t.arg.string({ required: true, validate: z.string().regex(alphanumericRegexp) }),
        description: t.arg.string({ required: true, validate: z.string().regex(freeFormTextRegexp) }),
        comment: t.arg.string({ required: true, validate: z.string().regex(freeFormTextRegexp) }),
        status: t.arg.string({ required: true, validate: z.enum(Object.values(DispensationStatus)) }),
        dateEnd: t.arg.string({ required: true, validate: fromSanitizer(acceptDateString) }),
        rooms: t.arg({
          type: [OthersMutationType],
          validate: fromSanitizer(sanitizeMutationTypes),
        }),
        units: t.arg({
          type: [OthersMutationType],
          validate: fromSanitizer(sanitizeMutationTypes),
        }),
        holders: t.arg({
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
        const disp = await getDispensationOriginalObject(ctx.prisma, args.opLock,'Dispensation');
        const subject = await ctx.prisma.DispensationSubject.findUnique({where: {subject: args.subject}});
        const newHolders = (args.holders ?? []).filter(holder => holder.status === 'New');
        await ensurePerson(ctx.prisma, newHolders);
        await ctx.prisma.$transaction(async (tx: any) => {
          const dispensation = await updateDispensation(tx, ctx.user, disp.idDispensation, subject.idDispensationSubject,
            args.description, args.comment, args.subjectOther, args.status, acceptDateString(args.dateEnd), disp.dateEnd,
            disp.renewals, disp.dateExpiryNotified);
          await setDispensationRelations(tx, dispensation.idDispensation, args);
        });
        const dispUpdated = await getDispensation(ctx.prisma, disp.idDispensation);
        if (disp.renewals < dispUpdated.renewals && dispUpdated.status === 'Active') {
          await sendEmailForDispensation(ctx.user.userFullName, ctx.user.userEmail, dispUpdated, 'renewDispensation');
        } else if (disp.status === 'Draft' && dispUpdated.status === 'Active') {
          await sendEmailForDispensation(ctx.user.userFullName, ctx.user.userEmail, dispUpdated, 'newDispensation');
        } else if (dispUpdated.status === 'Active') {
          await sendEmailForDispensation(ctx.user.userFullName, ctx.user.userEmail, dispUpdated, 'modifiedDispensation');
        } else if (dispUpdated.status === 'Expired' && disp.status !== 'Expired') {
          await sendEmailForDispensation(ctx.user.userFullName, ctx.user.userEmail, dispUpdated, 'expiredDispensation');
        } else if (dispUpdated.status === 'Cancelled' && disp.status !== 'Cancelled') {
          await sendEmailForDispensation(ctx.user.userFullName, ctx.user.userEmail, dispUpdated, 'cancelledDispensation');
        }
        return success();
      },
    }),
    deleteDispensation: t.string({
      authScopes: {
        needPermission: 'canEditDispensations'
      },
      args: {
        opLock: t.arg.string({required: true, validate: opLockValidator}),
      },
      resolve: async (root, args, ctx: any) => {
        const disp = await getDispensationOriginalObject(ctx.prisma, args.opLock,'Dispensation');
        await ctx.prisma.$transaction(async (tx: any) => {
          await tx.DispensationHasRoom.deleteMany({ where: { idDispensation: disp.idDispensation }});
          await tx.DispensationHasHolder.deleteMany({ where: { idDispensation: disp.idDispensation }});
          await tx.DispensationHasTicket.deleteMany({ where: { idDispensation: disp.idDispensation }});
          await tx.DispensationHasUnit.deleteMany({ where: { idDispensation: disp.idDispensation }});
          await tx.DispensationHasFile.deleteMany({ where: { idDispensation: disp.idDispensation }});
          await tx.Dispensation.delete({ where: { idDispensation: disp.idDispensation }});
        });
        return success();
      },
    }),
  }),
});
