"use client";

import { useRouter } from "next/navigation";
import {
  startTransition,
  useActionState,
  useOptimistic,
  useState,
} from "react";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import { CalendarDays, CornerDownRight, Flag, Link2 } from "lucide-react";

import { Avatar } from "../_components/avatar";
import { CommentThread } from "../_components/comment-thread";
import {
  Feedback,
  IDLE_ACTION_STATE,
  SubmitButton,
} from "../_components/feedback";
import { editTaskDetailsAction, moveTaskAction, updateTaskAction } from "./actions";

export type BoardTask = Readonly<{
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  progress: number;
  version: number;
  dueDate: string | null;
  dueDateIso: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  actualHours: number;
  estimatedHours: number | null;
  parentTaskId: string | null;
  parentTaskTitle: string | null;
  dependencyTaskId: string | null;
  dependencyTaskTitle: string | null;
}>;

const COLUMNS = [
  ["BACKLOG", "Backlog"],
  ["TODO", "À faire"],
  ["IN_PROGRESS", "En cours"],
  ["BLOCKED", "Bloqué"],
  ["REVIEW", "Validation"],
  ["DONE", "Terminé"],
] as const;

const PRIORITY_LABEL: Readonly<Record<string, string>> = {
  LOW: "Faible",
  NORMAL: "Normale",
  HIGH: "Haute",
  URGENT: "Urgente",
};

type UserOption = Readonly<{ id: string; name: string }>;

export function TaskBoard({
  tasks,
  canMutate,
  currentUserId,
  users,
  revalidatePathHint,
}: Readonly<{
  tasks: readonly BoardTask[];
  canMutate: boolean;
  currentUserId?: string;
  users?: readonly UserOption[];
  revalidatePathHint?: string;
}>) {
  const router = useRouter();
  const [dragError, setDragError] = useState<string | null>(null);
  const [optimisticTasks, setOptimisticStatus] = useOptimistic(
    tasks,
    (state, update: Readonly<{ id: string; status: string }>) =>
      state.map((task) =>
        task.id === update.id ? { ...task, status: update.status } : task,
      ),
  );

  function handleDragEnd(result: DropResult) {
    if (!canMutate) return;
    const destinationStatus = result.destination?.droppableId;
    if (!destinationStatus || destinationStatus === result.source.droppableId)
      return;
    const taskId = result.draggableId;
    const draggedTask = tasks.find((task) => task.id === taskId);
    if (!draggedTask) return;

    startTransition(() => {
      setDragError(null);
      setOptimisticStatus({ id: taskId, status: destinationStatus });
      void moveTaskAction(taskId, destinationStatus, draggedTask.version).then(
        (moveResult) => {
          if (!moveResult.ok) setDragError(moveResult.message);
          router.refresh();
        },
      );
    });
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      {dragError ? (
        <p className="admin-feedback admin-feedback--error" role="alert">
          {dragError}
        </p>
      ) : null}
      <section className="task-board">
        {COLUMNS.map(([status, label]) => {
          const columnTasks = optimisticTasks.filter(
            (task) => task.status === status,
          );
          return (
            <Droppable
              droppableId={status}
              key={status}
              isDropDisabled={!canMutate}
            >
              {(dropProvided, dropSnapshot) => (
                <section
                  className={
                    dropSnapshot.isDraggingOver
                      ? "task-column task-column--drop-active"
                      : "task-column"
                  }
                  ref={dropProvided.innerRef}
                  {...dropProvided.droppableProps}
                >
                  <header className="task-column__header">
                    <h2>{label}</h2>
                    <span>{columnTasks.length}</span>
                  </header>
                  <div className="task-column__list">
                    {columnTasks.length === 0 ? (
                      <p className="admin-empty">Aucune tâche.</p>
                    ) : null}
                    {columnTasks.map((task, index) => (
                      <Draggable
                        draggableId={task.id}
                        index={index}
                        key={task.id}
                        isDragDisabled={!canMutate}
                      >
                        {(dragProvided, dragSnapshot) => (
                          <article
                            className={
                              dragSnapshot.isDragging
                                ? "task-card task-card--dragging"
                                : "task-card"
                            }
                            data-priority={task.priority}
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                          >
                            <div
                              className="task-card__handle"
                              {...dragProvided.dragHandleProps}
                            >
                              <div className="task-card__topline">
                                <span
                                  className={`priority-pill priority-pill--${task.priority.toLowerCase()}`}
                                >
                                  <Flag size={11} strokeWidth={2.5} />
                                  {PRIORITY_LABEL[task.priority] ??
                                    task.priority}
                                </span>
                                {task.dueDate ? (
                                  <time className="task-card__due">
                                    <CalendarDays size={12} strokeWidth={2} />
                                    {task.dueDate}
                                  </time>
                                ) : null}
                              </div>
                              <h3>{task.title}</h3>
                              <div className="task-card__assignee">
                                <Avatar name={task.assigneeName} size="xs" />
                                <span>
                                  {task.assigneeName ?? "Non affecté"}
                                </span>
                              </div>
                              {task.parentTaskTitle || task.dependencyTaskTitle ? (
                                <div className="task-card__links">
                                  {task.parentTaskTitle ? (
                                    <span className="task-card__link">
                                      <CornerDownRight size={12} strokeWidth={2} />
                                      Sous-tâche de {task.parentTaskTitle}
                                    </span>
                                  ) : null}
                                  {task.dependencyTaskTitle ? (
                                    <span className="task-card__link">
                                      <Link2 size={12} strokeWidth={2} />
                                      Dépend de {task.dependencyTaskTitle}
                                    </span>
                                  ) : null}
                                </div>
                              ) : null}
                              <div className="project-progress">
                                <span style={{ width: `${task.progress}%` }} />
                              </div>
                            </div>
                            {canMutate ? (
                              <TaskCardControls task={task} />
                            ) : null}
                            {canMutate ? (
                              <EditTaskForm
                                task={task}
                                users={users ?? []}
                                otherTasks={tasks
                                  .filter((other) => other.id !== task.id)
                                  .map((other) => ({
                                    id: other.id,
                                    label: other.title,
                                  }))}
                              />
                            ) : null}
                            {currentUserId && users && revalidatePathHint ? (
                              <CommentThread
                                entityType="TASK"
                                entityId={task.id}
                                currentUserId={currentUserId}
                                users={users}
                                revalidatePathHint={revalidatePathHint}
                              />
                            ) : null}
                          </article>
                        )}
                      </Draggable>
                    ))}
                    {dropProvided.placeholder}
                  </div>
                </section>
              )}
            </Droppable>
          );
        })}
      </section>
    </DragDropContext>
  );
}

function TaskCardControls({ task }: Readonly<{ task: BoardTask }>) {
  const [state, action] = useActionState(updateTaskAction, IDLE_ACTION_STATE);
  return (
    <form action={action} className="task-card__controls">
      <input type="hidden" name="taskId" value={task.id} />
      <input type="hidden" name="status" value={task.status} />
      <input type="hidden" name="expectedVersion" value={task.version} />
      <label className="task-card__controls-field">
        <span>Progression %</span>
        <input
          name="progress"
          type="number"
          min={0}
          max={100}
          defaultValue={task.progress}
        />
      </label>
      <label className="task-card__controls-field">
        <span>Heures réalisées</span>
        <input
          name="actualHours"
          type="number"
          min={0}
          step="0.25"
          defaultValue={task.actualHours}
        />
      </label>
      <SubmitButton>Enregistrer</SubmitButton>
      <Feedback state={state} />
    </form>
  );
}

const EDIT_DEPENDENCY_DATALIST_PREFIX = "edit-task-dependency-options-";

function EditTaskForm({
  task,
  users,
  otherTasks,
}: Readonly<{
  task: BoardTask;
  users: readonly UserOption[];
  otherTasks: readonly Readonly<{ id: string; label: string }>[];
}>) {
  const [state, action] = useActionState(
    editTaskDetailsAction,
    IDLE_ACTION_STATE,
  );
  const [dependencyQuery, setDependencyQuery] = useState(
    otherTasks.find((other) => other.id === task.dependencyTaskId)?.label ??
      "",
  );
  const matchedDependency = otherTasks.find(
    (other) => other.label === dependencyQuery,
  );
  const datalistId = `${EDIT_DEPENDENCY_DATALIST_PREFIX}${task.id}`;

  return (
    <details className="billing-card__actions">
      <summary>Modifier la tâche</summary>
      <form action={action} className="admin-form-grid">
        <input type="hidden" name="taskId" value={task.id} />
        <input type="hidden" name="expectedVersion" value={task.version} />
        <label>
          Titre
          <input name="title" required maxLength={160} defaultValue={task.title} />
        </label>
        <label>
          Responsable
          <select name="assigneeId" defaultValue={task.assigneeId ?? ""}>
            <option value="">Non affecté</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Priorité
          <select name="priority" defaultValue={task.priority}>
            <option value="LOW">Faible</option>
            <option value="NORMAL">Normale</option>
            <option value="HIGH">Haute</option>
            <option value="URGENT">Urgente</option>
          </select>
        </label>
        <label>
          Échéance
          <input
            name="dueDate"
            type="date"
            defaultValue={task.dueDateIso ?? ""}
          />
        </label>
        <label>
          Temps estimé (heures)
          <input
            name="estimatedHours"
            type="number"
            min={0}
            step="0.25"
            defaultValue={task.estimatedHours ?? ""}
          />
        </label>
        <label>
          Sous-tâche de
          <select name="parentTaskId" defaultValue={task.parentTaskId ?? ""}>
            <option value="">Aucune</option>
            {otherTasks.map((other) => (
              <option key={other.id} value={other.id}>
                {other.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Dépend de
          <input
            list={datalistId}
            value={dependencyQuery}
            onChange={(event) => setDependencyQuery(event.target.value)}
            placeholder="Rechercher une tâche…"
            autoComplete="off"
          />
          <datalist id={datalistId}>
            {otherTasks.map((other) => (
              <option key={other.id} value={other.label} />
            ))}
          </datalist>
          <input
            type="hidden"
            name="dependencyTaskId"
            value={matchedDependency?.id ?? ""}
          />
        </label>
        <label>
          Description
          <textarea
            name="description"
            maxLength={1000}
            defaultValue={task.description ?? ""}
          />
        </label>
        <SubmitButton>Enregistrer les modifications</SubmitButton>
        <Feedback state={state} />
      </form>
    </details>
  );
}
