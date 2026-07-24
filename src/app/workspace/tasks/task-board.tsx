"use client";

import { useRouter } from "next/navigation";
import { startTransition, useOptimistic } from "react";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";

import { Avatar } from "../_components/avatar";
import { moveTaskAction, updateTaskAction } from "./actions";

export type BoardTask = Readonly<{
  id: string;
  title: string;
  status: string;
  priority: string;
  progress: number;
  dueDate: string | null;
  assigneeName: string | null;
  actualHours: number;
  parentTaskTitle: string | null;
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

export function TaskBoard({
  tasks,
  canMutate,
}: Readonly<{ tasks: readonly BoardTask[]; canMutate: boolean }>) {
  const router = useRouter();
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

    startTransition(() => {
      setOptimisticStatus({ id: taskId, status: destinationStatus });
      void moveTaskAction(taskId, destinationStatus).then(() =>
        router.refresh(),
      );
    });
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
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
                                  {PRIORITY_LABEL[task.priority] ??
                                    task.priority}
                                </span>
                                {task.dueDate ? (
                                  <time>{task.dueDate}</time>
                                ) : null}
                              </div>
                              <h3>{task.title}</h3>
                              <div className="task-card__assignee">
                                <Avatar name={task.assigneeName} size="xs" />
                                <span>
                                  {task.assigneeName ?? "Non affecté"}
                                </span>
                              </div>
                              {task.parentTaskTitle ? (
                                <small>
                                  Sous-tâche de {task.parentTaskTitle}
                                </small>
                              ) : null}
                              {task.dependencyTaskTitle ? (
                                <small>
                                  Dépend de {task.dependencyTaskTitle}
                                </small>
                              ) : null}
                              <div className="project-progress">
                                <span style={{ width: `${task.progress}%` }} />
                              </div>
                            </div>
                            {canMutate ? (
                              <form
                                action={updateTaskAction}
                                className="task-card__controls"
                              >
                                <input
                                  type="hidden"
                                  name="taskId"
                                  value={task.id}
                                />
                                <input
                                  type="hidden"
                                  name="status"
                                  value={task.status}
                                />
                                <input
                                  name="progress"
                                  type="number"
                                  min={0}
                                  max={100}
                                  defaultValue={task.progress}
                                  aria-label="Progression"
                                />
                                <input
                                  name="actualHours"
                                  type="number"
                                  min={0}
                                  step="0.25"
                                  defaultValue={task.actualHours}
                                  aria-label="Temps réalisé en heures"
                                />
                                <button
                                  className="admin-table__action"
                                  type="submit"
                                >
                                  Enregistrer
                                </button>
                              </form>
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
