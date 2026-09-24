export interface UserInfo {
  groups: string[];
  name: string;
  sciper?: string;
  username: string;
  userEmail: string;
  isAdmin?: boolean;
  isCosec?: boolean;
  isManager?: boolean;
  canEditHazards?: boolean;
  canEditRooms?: boolean;
  canListUnits?: boolean;
  canListHazards?: boolean;
  canListRooms?: boolean;
  canListReportFiles?: boolean;
  canEditUnits ?: boolean;
  canListOrganisms?: boolean;
  canEditOrganisms?: boolean;
  canListChemicals?: boolean;
  canEditChemicals?: boolean;
  canListAuthorizations?: boolean;
  canEditAuthorizations?: boolean;
  canListDispensations?: boolean;
  canEditDispensations?: boolean;
  canListAssessments?: boolean;
  canEditAssessments?: boolean;
  canListPersons?: boolean;
  canListForms?: boolean;
}

export function getUserString (user: UserInfo) {
  return `${user.name}${user.sciper ? ` (${user.sciper})` : ''}`;
}
