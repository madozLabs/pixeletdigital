"use client";

import { useActionState } from "react";

import {
  Feedback,
  IDLE_ACTION_STATE,
  SubmitButton,
} from "../_components/feedback";
import { ConfirmAction } from "../_components/confirm-action";
import {
  archiveExpenseCategoryAction,
  createExpenseCategoryAction,
  deleteExpenseAction,
  deleteRevenueEntryAction,
  recordExpenseAction,
  recordRevenueEntryAction,
} from "./actions";

type CategoryOption = Readonly<{ id: string; label: string }>;

export function CreateExpenseCategoryForm() {
  const [state, action] = useActionState(
    createExpenseCategoryAction,
    IDLE_ACTION_STATE,
  );
  return (
    <form action={action} className="admin-form-card">
      <label>
        Nouvelle catégorie
        <input name="label" placeholder="Ex. Abonnements logiciels" required />
      </label>
      <SubmitButton>Ajouter</SubmitButton>
      <Feedback state={state} />
    </form>
  );
}

export function ArchiveExpenseCategoryForm({
  categoryId,
  version,
}: Readonly<{ categoryId: string; version: number }>) {
  const [state, action] = useActionState(
    archiveExpenseCategoryAction,
    IDLE_ACTION_STATE,
  );
  return (
    <form action={action} className="billing-inline-form">
      <input type="hidden" name="id" value={categoryId} />
      <input type="hidden" name="expectedVersion" value={version} />
      <ConfirmAction consequence="Cette catégorie ne sera plus proposée pour de nouvelles dépenses.">
        Archiver
      </ConfirmAction>
      <Feedback state={state} />
    </form>
  );
}

export function RecordExpenseForm({
  worldKey,
  categories,
}: Readonly<{ worldKey: string; categories: readonly CategoryOption[] }>) {
  const [state, action] = useActionState(recordExpenseAction, IDLE_ACTION_STATE);
  return (
    <form action={action} className="admin-form-card">
      <input type="hidden" name="worldKey" value={worldKey} />
      <label>
        Libellé
        <input
          name="label"
          placeholder="Ex. Facture électricité juillet"
          required
        />
      </label>
      <label>
        Catégorie
        <select name="categoryId" required>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Montant (XOF)
        <input name="amount" type="number" min={1} step={1} required />
      </label>
      <label>
        Date
        <input
          name="expenseDate"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          max={new Date().toISOString().slice(0, 10)}
          required
        />
      </label>
      <label>
        Notes
        <textarea name="notes" maxLength={1200} />
      </label>
      <SubmitButton>Enregistrer la dépense</SubmitButton>
      <Feedback state={state} />
    </form>
  );
}

export function DeleteExpenseForm({ expenseId }: Readonly<{ expenseId: string }>) {
  const [state, action] = useActionState(deleteExpenseAction, IDLE_ACTION_STATE);
  return (
    <form action={action} className="billing-inline-form">
      <input type="hidden" name="id" value={expenseId} />
      <ConfirmAction consequence="Cette dépense sera définitivement supprimée.">
        Supprimer
      </ConfirmAction>
      <Feedback state={state} />
    </form>
  );
}

export function RecordRevenueEntryForm({
  worldKey,
}: Readonly<{ worldKey: string }>) {
  const [state, action] = useActionState(
    recordRevenueEntryAction,
    IDLE_ACTION_STATE,
  );
  return (
    <form action={action} className="admin-form-card">
      <input type="hidden" name="worldKey" value={worldKey} />
      <label>
        Libellé
        <input
          name="label"
          placeholder="Ex. Vente comptoir - impression flyers"
          required
        />
      </label>
      <label>
        Montant (XOF)
        <input name="amount" type="number" min={1} step={1} required />
      </label>
      <label>
        Date
        <input
          name="revenueDate"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          max={new Date().toISOString().slice(0, 10)}
          required
        />
      </label>
      <label>
        Notes
        <textarea name="notes" maxLength={1200} />
      </label>
      <SubmitButton>Enregistrer la recette</SubmitButton>
      <Feedback state={state} />
    </form>
  );
}

export function DeleteRevenueEntryForm({
  entryId,
}: Readonly<{ entryId: string }>) {
  const [state, action] = useActionState(
    deleteRevenueEntryAction,
    IDLE_ACTION_STATE,
  );
  return (
    <form action={action} className="billing-inline-form">
      <input type="hidden" name="id" value={entryId} />
      <ConfirmAction consequence="Cette recette sera définitivement supprimée.">
        Supprimer
      </ConfirmAction>
      <Feedback state={state} />
    </form>
  );
}
