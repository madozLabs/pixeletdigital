import type { AuditEvent } from "@/modules/audit/application/audit-event";

import type {
  AuthAccount,
  Result,
  RoleAssignment,
  User,
} from "../domain/access";

export interface AccessAdministrationReader {
  findUserById(userId: string): Promise<User | null>;
  findAssignmentsByUserId(userId: string): Promise<readonly RoleAssignment[]>;
  findAssignmentById(assignmentId: string): Promise<RoleAssignment | null>;
}

export type AccessAdministrationMutation =
  | Readonly<{ type: "SET_USER_STATUS"; user: User }>
  | Readonly<{ type: "SAVE_ASSIGNMENT"; assignment: RoleAssignment }>
  | Readonly<{
      type: "CREATE_EMPLOYEE";
      user: User;
      authAccount: AuthAccount;
      assignment: RoleAssignment;
    }>;

export type AccessAdministrationPrecondition =
  | Readonly<{
      type: "EMPLOYEE_IDENTIFIERS_AVAILABLE";
      userId: string;
      normalizedEmail: string;
      authAccountId: string;
      provider: string;
      providerAccountId: string;
      assignmentId: string;
    }>
  | Readonly<{
      type: "USER_STATUS_IS";
      userId: string;
      status: User["status"];
    }>
  | Readonly<{
      type: "NO_OVERLAPPING_ASSIGNMENT";
      assignment: RoleAssignment;
    }>
  | Readonly<{
      type: "ASSIGNMENT_ACTIVE_AT";
      assignmentId: string;
      at: Date;
    }>;

export type AccessAdministrationCommitError =
  | Readonly<{ code: "CONFLICT"; message: string }>
  | Readonly<{ code: "DEPENDENCY_UNAVAILABLE"; message: string }>;

export interface AccessAdministrationTransaction {
  commit(
    input: Readonly<{
      preconditions: readonly AccessAdministrationPrecondition[];
      mutation: AccessAdministrationMutation;
      auditEvent: AuditEvent;
    }>,
  ): Promise<Result<void, AccessAdministrationCommitError>>;
}
