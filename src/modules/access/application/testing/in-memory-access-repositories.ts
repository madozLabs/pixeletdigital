import type { RoleAssignment, User } from "../../domain/access";
import type {
  RoleAssignmentRepository,
  UserRepository,
} from "../access-repositories";

export class InMemoryUserRepository implements UserRepository {
  readonly foundIds: string[] = [];
  private readonly users = new Map<string, User>();

  constructor(users: readonly User[] = []) {
    for (const user of users) this.users.set(user.id, user);
  }

  async findById(userId: string): Promise<User | null> {
    this.foundIds.push(userId);
    return this.users.get(userId) ?? null;
  }
}

export class InMemoryRoleAssignmentRepository implements RoleAssignmentRepository {
  readonly foundUserIds: string[] = [];
  private readonly assignments: readonly RoleAssignment[];

  constructor(assignments: readonly RoleAssignment[] = []) {
    this.assignments = assignments;
  }

  async findByUserId(userId: string): Promise<readonly RoleAssignment[]> {
    this.foundUserIds.push(userId);
    return this.assignments.filter(
      (assignment) => assignment.userId === userId,
    );
  }
}
