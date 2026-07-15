import type {
  AuthAccount,
  AuthenticatedIdentity,
  RoleAssignment,
  User,
} from "../domain/access";

export interface AuthAccountRepository {
  findByIdentity(identity: AuthenticatedIdentity): Promise<AuthAccount | null>;
}

export interface UserRepository {
  findById(userId: string): Promise<User | null>;
}

export interface RoleAssignmentRepository {
  findByUserId(userId: string): Promise<readonly RoleAssignment[]>;
}
