"use client";

import { useRouter } from "next/navigation";
import { startTransition, useOptimistic, useState } from "react";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";

import { Avatar } from "../_components/avatar";
import { CommentThread } from "../_components/comment-thread";
import { moveEditorialItemAction } from "./professional-actions";

export type PipelineItem = Readonly<{
  id: string;
  title: string;
  status: string;
  clientName: string;
  contentType: string;
  channel: string;
  scheduledFor: string;
  ownerName: string | null;
}>;

type UserOption = Readonly<{ id: string; name: string }>;

const COLUMNS = [
  ["DRAFT", "Brouillon"],
  ["INTERNAL_REVIEW", "Validation interne"],
  ["CLIENT_REVIEW", "Validation client"],
  ["APPROVED", "Approuvé"],
  ["SCHEDULED", "Programmé"],
  ["PUBLISHED", "Publié"],
] as const;

export function EditorialPipeline({
  items,
  canMutate,
  currentUserId,
  users,
  revalidatePathHint,
}: Readonly<{
  items: readonly PipelineItem[];
  canMutate: boolean;
  currentUserId?: string;
  users?: readonly UserOption[];
  revalidatePathHint?: string;
}>) {
  const router = useRouter();
  const [dragError, setDragError] = useState<string | null>(null);
  const [optimisticItems, setOptimisticStatus] = useOptimistic(
    items,
    (state, update: Readonly<{ id: string; status: string }>) =>
      state.map((item) =>
        item.id === update.id ? { ...item, status: update.status } : item,
      ),
  );

  function handleDragEnd(result: DropResult) {
    if (!canMutate) return;
    const destination = result.destination?.droppableId;
    if (!destination || destination === result.source.droppableId) return;
    const itemId = result.draggableId;

    startTransition(() => {
      setDragError(null);
      setOptimisticStatus({ id: itemId, status: destination });
      void moveEditorialItemAction(itemId, destination).then((moveResult) => {
        if (!moveResult.ok) setDragError(moveResult.message);
        router.refresh();
      });
    });
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      {dragError ? (
        <p className="admin-feedback admin-feedback--error" role="alert">
          {dragError}
        </p>
      ) : null}
      <section className="task-board editorial-pipeline">
        {COLUMNS.map(([status, label]) => {
          const columnItems = optimisticItems.filter(
            (item) => item.status === status,
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
                    <span>{columnItems.length}</span>
                  </header>
                  <div className="task-column__list">
                    {columnItems.length === 0 ? (
                      <p className="admin-empty">Aucun contenu.</p>
                    ) : null}
                    {columnItems.map((item, index) => (
                      <Draggable
                        draggableId={item.id}
                        index={index}
                        key={item.id}
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
                                <span className="priority-pill priority-pill--normal">
                                  {item.contentType}
                                </span>
                                <time>{item.scheduledFor}</time>
                              </div>
                              <h3>{item.title}</h3>
                              <p className="editorial-card__meta">
                                {item.clientName} · {item.channel}
                              </p>
                              <div className="task-card__assignee">
                                <Avatar name={item.ownerName} size="xs" />
                                <span>{item.ownerName ?? "Non affecté"}</span>
                              </div>
                            </div>
                            {currentUserId && users && revalidatePathHint ? (
                              <CommentThread
                                entityType="EDITORIAL_ITEM"
                                entityId={item.id}
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
