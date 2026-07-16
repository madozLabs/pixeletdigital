import type { AuditEvent } from "@/modules/audit/application/audit-event";

import {
  type AuthAccount,
  isAssignmentActiveAt,
  type RoleAssignment,
  type User,
} from "../../domain/access";
import type {
  AccessAdministrationMutation,
  AccessAdministrationPrecondition,
  AccessAdministrationReader,
  AccessAdministrationTransaction,
} from "../access-administration-ports";

export class InMemoryAccessAdministrationStore
  implements AccessAdministrationReader, AccessAdministrationTransaction
{
  readonly users = new Map<string, User>();
  readonly assignments = new Map<string, RoleAssignment>();
  readonly authAccounts = new Map<string, AuthAccount>();
  readonly auditEvents: AuditEvent[] = [];
  readonly reads: string[] = [];
  commitAttempts = 0;
  failAuditAppend = false;
  failTransaction = false;
  beforeCommit: (() => void) | null = null;

  constructor(
    users: readonly User[] = [],
    assignments: readonly RoleAssignment[] = [],
  ) {
    for (const user of users) this.users.set(user.id, user);
    for (const assignment of assignments)
      this.assignments.set(assignment.id, assignment);
  }

  async findUserById(userId: string): Promise<User | null> {
    this.reads.push(`user:${userId}`);
    return this.users.get(userId) ?? null;
  }

  async findAssignmentsByUserId(
    userId: string,
  ): Promise<readonly RoleAssignment[]> {
    this.reads.push(`assignments:${userId}`);
    return [...this.assignments.values()].filter(
      (item) => item.userId === userId,
    );
  }

  async findAssignmentById(
    assignmentId: string,
  ): Promise<RoleAssignment | null> {
    this.reads.push(`assignment:${assignmentId}`);
    return this.assignments.get(assignmentId) ?? null;
  }

  async commit(
    input: Readonly<{
      preconditions: readonly AccessAdministrationPrecondition[];
      mutation: AccessAdministrationMutation;
      auditEvent: AuditEvent;
    }>,
  ) {
    this.commitAttempts += 1;
    this.beforeCommit?.();
    if (
      !preconditionsHold(
        this.users,
        this.authAccounts,
        this.assignments,
        input.preconditions,
      )
    ) {
      return conflictFailure();
    }
    const users = new Map(this.users);
    const assignments = new Map(this.assignments);
    const authAccounts = new Map(this.authAccounts);
    const events = [...this.auditEvents];
    applyMutation(users, authAccounts, assignments, input.mutation);
    if (this.failAuditAppend) return dependencyFailure();
    events.push(input.auditEvent);
    if (this.failTransaction) return dependencyFailure();
    replace(this.users, users);
    replace(this.authAccounts, authAccounts);
    replace(this.assignments, assignments);
    this.auditEvents.splice(0, this.auditEvents.length, ...events);
    return { ok: true, value: undefined } as const;
  }
}

function preconditionsHold(
  users: ReadonlyMap<string, User>,
  authAccounts: ReadonlyMap<string, AuthAccount>,
  assignments: ReadonlyMap<string, RoleAssignment>,
  preconditions: readonly AccessAdministrationPrecondition[],
): boolean {
  return preconditions.every((precondition) => {
    if (precondition.type === "EMPLOYEE_IDENTIFIERS_AVAILABLE") {
      return (
        !users.has(precondition.userId) &&
        ![...users.values()].some(
          (user) => user.normalizedEmail === precondition.normalizedEmail,
        ) &&
        !authAccounts.has(precondition.authAccountId) &&
        ![...authAccounts.values()].some(
          (account) =>
            account.provider === precondition.provider &&
            account.providerAccountId === precondition.providerAccountId,
        ) &&
        !assignments.has(precondition.assignmentId)
      );
    }
    if (precondition.type === "USER_STATUS_IS") {
      return users.get(precondition.userId)?.status === precondition.status;
    }
    if (precondition.type === "ASSIGNMENT_ACTIVE_AT") {
      const assignment = assignments.get(precondition.assignmentId);
      return assignment
        ? isAssignmentActiveAt(assignment, precondition.at)
        : false;
    }
    return ![...assignments.values()].some(
      (assignment) =>
        assignment.role === precondition.assignment.role &&
        sameScope(assignment, precondition.assignment) &&
        intervalsOverlap(assignment, precondition.assignment),
    );
  });
}

function sameScope(left: RoleAssignment, right: RoleAssignment): boolean {
  return (
    left.scope.type === right.scope.type &&
    (left.scope.type === "GLOBAL" ||
      (right.scope.type === "WORLD" &&
        left.scope.worldKey === right.scope.worldKey))
  );
}

function intervalsOverlap(
  left: RoleAssignment,
  right: RoleAssignment,
): boolean {
  const leftEnd = left.validUntil?.getTime() ?? Number.POSITIVE_INFINITY;
  const rightEnd = right.validUntil?.getTime() ?? Number.POSITIVE_INFINITY;
  return (
    left.validFrom.getTime() < rightEnd && right.validFrom.getTime() < leftEnd
  );
}

function applyMutation(
  users: Map<string, User>,
  authAccounts: Map<string, AuthAccount>,
  assignments: Map<string, RoleAssignment>,
  mutation: AccessAdministrationMutation,
): void {
  if (mutation.type === "SET_USER_STATUS")
    users.set(mutation.user.id, mutation.user);
  else if (mutation.type === "SAVE_ASSIGNMENT")
    assignments.set(mutation.assignment.id, mutation.assignment);
  else {
    users.set(mutation.user.id, mutation.user);
    authAccounts.set(mutation.authAccount.id, mutation.authAccount);
    assignments.set(mutation.assignment.id, mutation.assignment);
  }
}

function replace<T>(target: Map<string, T>, source: Map<string, T>): void {
  target.clear();
  for (const [key, value] of source) target.set(key, value);
}

function conflictFailure() {
  return {
    ok: false,
    error: {
      code: "CONFLICT",
      message: "An Access administration precondition changed before commit.",
    },
  } as const;
}

function dependencyFailure() {
  return {
    ok: false,
    error: {
      code: "DEPENDENCY_UNAVAILABLE",
      message: "Atomic Access/audit commit failed.",
    },
  } as const;
}
