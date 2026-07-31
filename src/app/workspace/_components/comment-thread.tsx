"use client";

import { useEffect, useRef, useState } from "react";

import type { CommentableEntityType } from "@/modules/collaboration/domain/comment";

import {
  deleteCommentOnEntity,
  listComments,
  postCommentOnEntity,
  type CommentDto,
} from "./comment-thread-actions";

type UserOption = Readonly<{ id: string; name: string }>;

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Mentions are tracked as an explicit id list alongside the visible text,
// not parsed back out of "@Display Name" after the fact -- display names
// can collide or contain spaces, so the only unambiguous source of truth
// is "which suggestion did the user actually click".
export function CommentThread({
  entityType,
  entityId,
  currentUserId,
  users,
  revalidatePathHint,
}: Readonly<{
  entityType: CommentableEntityType;
  entityId: string;
  currentUserId: string;
  users: readonly UserOption[];
  revalidatePathHint: string;
}>) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<readonly CommentDto[] | null>(null);
  const [body, setBody] = useState("");
  const [mentionedIds, setMentionedIds] = useState<readonly string[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function refresh() {
    const next = await listComments(entityType, entityId);
    setComments(next);
  }

  useEffect(() => {
    if (!open || comments !== null) return;
    let active = true;
    void listComments(entityType, entityId).then((next) => {
      if (active) setComments(next);
    });
    return () => {
      active = false;
    };
  }, [open, comments, entityType, entityId]);

  function handleBodyChange(value: string) {
    setBody(value);
    const cursor = textareaRef.current?.selectionStart ?? value.length;
    const upToCursor = value.slice(0, cursor);
    const match = /(?:^|\s)@([^\s@]*)$/.exec(upToCursor);
    setMentionQuery(match ? match[1] : null);
  }

  function insertMention(user: UserOption) {
    const value = body;
    const cursor = textareaRef.current?.selectionStart ?? value.length;
    const upToCursor = value.slice(0, cursor);
    const match = /(?:^|\s)@([^\s@]*)$/.exec(upToCursor);
    if (!match) return;
    const startOfMention = cursor - match[0].length + (match[0].startsWith(" ") ? 1 : 0);
    const next = `${value.slice(0, startOfMention)}@${user.name} ${value.slice(cursor)}`;
    setBody(next);
    setMentionedIds((prev) => (prev.includes(user.id) ? prev : [...prev, user.id]));
    setMentionQuery(null);
    textareaRef.current?.focus();
  }

  const mentionSuggestions =
    mentionQuery !== null
      ? users
          .filter((user) =>
            user.name.toLowerCase().includes(mentionQuery.toLowerCase()),
          )
          .slice(0, 6)
      : [];

  async function handleSubmit() {
    if (!body.trim()) return;
    setPending(true);
    setError(null);
    const result = await postCommentOnEntity(
      entityType,
      entityId,
      body,
      mentionedIds,
      revalidatePathHint,
    );
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setBody("");
    setMentionedIds([]);
    await refresh();
  }

  async function handleDelete(commentId: string) {
    await deleteCommentOnEntity(commentId, revalidatePathHint);
    await refresh();
  }

  return (
    <details
      className="billing-card__actions"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Commentaires</summary>
      <div className="comment-thread">
        {comments === null ? (
          <p className="admin-empty">Chargement…</p>
        ) : comments.length === 0 ? (
          <p className="admin-empty">Aucun commentaire.</p>
        ) : (
          <ul className="comment-thread__list">
            {comments.map((comment) => (
              <li key={comment.id} className="comment-thread__item">
                <div className="comment-thread__meta">
                  <strong>{comment.authorName}</strong>
                  <span>{formatWhen(comment.createdAt)}</span>
                </div>
                <p>{comment.body}</p>
                {comment.authorId === currentUserId ? (
                  <button
                    type="button"
                    className="admin-table__action"
                    onClick={() => void handleDelete(comment.id)}
                  >
                    Supprimer
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <div className="comment-thread__composer">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(event) => handleBodyChange(event.target.value)}
            placeholder="Écrire un commentaire… @ pour mentionner quelqu'un"
            maxLength={2000}
          />
          {mentionSuggestions.length > 0 ? (
            <ul className="comment-thread__mentions" role="listbox">
              {mentionSuggestions.map((user) => (
                <li key={user.id}>
                  <button type="button" onClick={() => insertMention(user)}>
                    @{user.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <button
            type="button"
            className="admin-table__action"
            disabled={pending || !body.trim()}
            onClick={() => void handleSubmit()}
          >
            {pending ? "Envoi…" : "Commenter"}
          </button>
          {error ? <p role="alert">{error}</p> : null}
        </div>
      </div>
    </details>
  );
}
