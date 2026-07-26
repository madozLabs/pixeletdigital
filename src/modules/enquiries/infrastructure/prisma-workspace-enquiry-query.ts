import type { PrismaClient } from "@/generated/prisma/client";
import type { WorkspaceEnquiryReader } from "../application/workspace-enquiry-query";

export class PrismaWorkspaceEnquiryReader implements WorkspaceEnquiryReader {
  constructor(private readonly database: PrismaClient) {}

  countByWorld(worldKey: string) {
    return this.database.enquiry.count({ where: { worldKey } });
  }
}
