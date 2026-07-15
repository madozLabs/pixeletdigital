import type { RoleAssignment, User } from "../domain/access";

export interface UserRepository {
  findById(userId: string): Promise<User | null>;
}

export interface RoleAssignmentRepository {
  findByUserId(userId: string): Promise<readonly RoleAssignment[]>;
}
