import {builder} from "./builder";
import {UserInfo} from "../lib/userType";

const UserRef = builder.objectRef<UserInfo>('User');
UserRef.implement({
  description: 'Connected user info',
  fields: (t) => ({
    groups: t.exposeStringList('groups'),
    userName: t.exposeString('userName'),
    isAdmin: t.exposeBoolean('isAdmin'),
    isCosec: t.exposeBoolean('isCosec'),
    isManager: t.exposeBoolean('isManager'),
    canEditHazards: t.exposeBoolean('canEditHazards'),
    canEditRooms: t.exposeBoolean('canEditRooms'),
    canListUnits: t.exposeBoolean('canListUnits'),
    canListHazards: t.exposeBoolean('canListHazards'),
    canListRooms: t.exposeBoolean('canListRooms'),
    canListReportFiles: t.exposeBoolean('canListReportFiles'),
    canEditUnits : t.exposeBoolean('canEditUnits'),
    canListOrganisms: t.exposeBoolean('canListOrganisms'),
    canEditOrganisms: t.exposeBoolean('canEditOrganisms'),
    canListChemicals: t.exposeBoolean('canListChemicals'),
    canEditChemicals: t.exposeBoolean('canEditChemicals'),
    canListAuthorizations: t.exposeBoolean('canListAuthorizations'),
    canEditAuthorizations: t.exposeBoolean('canEditAuthorizations'),
    canListDispensations: t.exposeBoolean('canListDispensations'),
    canEditDispensations: t.exposeBoolean('canEditDispensations'),
    canListAssessments: t.exposeBoolean('canListAssessments'),
    canEditAssessments: t.exposeBoolean('canEditAssessments'),
    canListPeople: t.exposeBoolean('canListPeople'),
    canListForms: t.exposeBoolean('canListForms'),
  }),
});

builder.queryType({
  fields: (t) => {
    return ({
      connectedUserInfo: t.field({
        type: UserRef,
        resolve: async (root, args, ctx: any, info) => {
          return ctx.user;
        },
      }),
    });
  },
});

import './types/people';
import './types/bioOrg';

export const schema = builder.toSchema();
