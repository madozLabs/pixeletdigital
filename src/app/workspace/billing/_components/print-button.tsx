"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      className="admin-table__action no-print"
      onClick={() => window.print()}
    >
      Imprimer
    </button>
  );
}
