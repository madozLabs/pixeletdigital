import { prisma } from "@/infrastructure/shared/prisma-client";
import {
  addDays,
  addMonths,
  firstOfMonth,
  formatISODate,
  mondayOf,
} from "../../../editorial/_lib/week";

export const SCHEDULE_RANGES = ["day", "week", "month"] as const;
export type ScheduleRange = (typeof SCHEDULE_RANGES)[number];

export function isScheduleRange(value: string): value is ScheduleRange {
  return (SCHEDULE_RANGES as readonly string[]).includes(value);
}

function dayStart(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function scheduleRangeBounds(
  range: ScheduleRange,
  anchor: Date,
): Readonly<{ start: Date; end: Date; label: string }> {
  const start = dayStart(anchor);
  if (range === "day") {
    return {
      start,
      end: addDays(start, 1),
      label: start.toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }),
    };
  }
  if (range === "week") {
    const monday = mondayOf(start);
    const sunday = addDays(monday, 6);
    return {
      start: monday,
      end: addDays(monday, 7),
      label: `Semaine du ${monday.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", timeZone: "UTC" })} au ${sunday.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" })}`,
    };
  }
  const monthStart = firstOfMonth(start);
  return {
    start: monthStart,
    end: addMonths(monthStart, 1),
    label: monthStart.toLocaleDateString("fr-FR", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
  };
}

export type ScheduleScope = "all" | "mine" | "users";

export type ScheduleTask = Readonly<{
  id: string;
  title: string;
  priority: string;
  status: string;
  dueDate: Date;
  projectName: string;
  assigneeId: string | null;
  assigneeName: string;
}>;

export type ScheduleDay = Readonly<{
  dateIso: string;
  label: string;
  byAssignee: readonly Readonly<{
    assigneeName: string;
    tasks: readonly ScheduleTask[];
  }>[];
}>;

export type ScheduleSearchParams = Readonly<{
  world?: string;
  range?: string;
  date?: string;
  scope?: string;
  users?: string | readonly string[];
  excludeAdmin?: string;
}>;

export type ParsedScheduleParams = Readonly<{
  worldKey: string;
  range: ScheduleRange;
  anchor: Date;
  dateParam: string;
  scope: ScheduleScope;
  selectedUserIds: readonly string[];
  excludeAdmins: boolean;
}>;

function isScheduleScope(value: string): value is ScheduleScope {
  return value === "all" || value === "mine" || value === "users";
}

export function parseScheduleParams(
  searchParams: ScheduleSearchParams,
): ParsedScheduleParams {
  const worldKey = searchParams.world ?? "pixel-digital";
  const range = searchParams.range && isScheduleRange(searchParams.range)
    ? searchParams.range
    : "week";
  const dateParam = searchParams.date ?? formatISODate(new Date());
  const anchor = new Date(`${dateParam}T00:00:00.000Z`);
  const scope =
    searchParams.scope && isScheduleScope(searchParams.scope)
      ? searchParams.scope
      : "all";
  const selectedUserIds = Array.isArray(searchParams.users)
    ? searchParams.users.filter(Boolean)
    : typeof searchParams.users === "string" && searchParams.users
      ? searchParams.users.split(",").filter(Boolean)
      : [];
  const excludeAdmins = searchParams.excludeAdmin === "1";
  return { worldKey, range, anchor, dateParam, scope, selectedUserIds, excludeAdmins };
}

export function scheduleQueryString(
  params: ParsedScheduleParams,
): string {
  const query = new URLSearchParams({
    world: params.worldKey,
    range: params.range,
    date: params.dateParam,
    scope: params.scope,
  });
  if (params.selectedUserIds.length > 0) {
    query.set("users", params.selectedUserIds.join(","));
  }
  if (params.excludeAdmins) query.set("excludeAdmin", "1");
  return query.toString();
}

export type BuildScheduleInput = Readonly<{
  worldKey: string;
  range: ScheduleRange;
  anchor: Date;
  scope: ScheduleScope;
  currentUserId: string | null;
  selectedUserIds: readonly string[];
  excludeAdmins: boolean;
}>;

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;

export async function buildSchedule(input: BuildScheduleInput): Promise<{
  bounds: ReturnType<typeof scheduleRangeBounds>;
  days: readonly ScheduleDay[];
}> {
  const bounds = scheduleRangeBounds(input.range, input.anchor);

  const assigneeFilter =
    input.scope === "mine" && input.currentUserId
      ? { assigneeId: input.currentUserId }
      : input.scope === "users" && input.selectedUserIds.length > 0
        ? { assigneeId: { in: [...input.selectedUserIds] } }
        : {};

  const tasks = await prisma.task.findMany({
    where: {
      project: { worldKey: input.worldKey },
      status: { not: "CANCELLED" },
      dueDate: { gte: bounds.start, lt: bounds.end },
      ...assigneeFilter,
    },
    include: { assignee: true, project: { select: { name: true } } },
    orderBy: [{ dueDate: "asc" }, { assigneeId: "asc" }],
  });

  let filtered = tasks;
  if (input.scope === "all" && input.excludeAdmins) {
    const now = new Date();
    const adminAssignments = await prisma.roleAssignment.findMany({
      where: {
        role: { in: [...ADMIN_ROLES] },
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gt: now } }],
      },
      select: { userId: true },
    });
    const adminIds = new Set(adminAssignments.map((a) => a.userId));
    filtered = tasks.filter(
      (task) => !task.assigneeId || !adminIds.has(task.assigneeId),
    );
  }

  const byDate = new Map<string, ScheduleTask[]>();
  for (const task of filtered) {
    if (!task.dueDate) continue;
    const key = formatISODate(task.dueDate);
    const list = byDate.get(key) ?? [];
    list.push({
      id: task.id,
      title: task.title,
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate,
      projectName: task.project.name,
      assigneeId: task.assigneeId,
      assigneeName:
        task.assignee?.displayName ?? task.assignee?.normalizedEmail ?? "Non affecté",
    });
    byDate.set(key, list);
  }

  const days: ScheduleDay[] = [];
  let cursor = bounds.start;
  while (cursor.getTime() < bounds.end.getTime()) {
    const key = formatISODate(cursor);
    const dayTasks = byDate.get(key) ?? [];
    const byAssigneeMap = new Map<string, ScheduleTask[]>();
    for (const task of dayTasks) {
      const list = byAssigneeMap.get(task.assigneeName) ?? [];
      list.push(task);
      byAssigneeMap.set(task.assigneeName, list);
    }
    days.push({
      dateIso: key,
      label: cursor.toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        timeZone: "UTC",
      }),
      byAssignee: Array.from(byAssigneeMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([assigneeName, dayTaskList]) => ({
          assigneeName,
          tasks: dayTaskList,
        })),
    });
    cursor = addDays(cursor, 1);
  }

  return { bounds, days };
}
