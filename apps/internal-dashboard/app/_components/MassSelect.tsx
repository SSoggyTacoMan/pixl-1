"use client";

// Native checkboxes for the players table's mass action form. RowSelect
// submits as userIds; SelectAllBox ticks every row on the current page.

export function SelectAllBox() {
  return (
    <label className="hc-check">
      <input
        type="checkbox"
        aria-label="Select all on this page"
        onChange={(e) => {
          for (const el of document.querySelectorAll<HTMLInputElement>("input[data-row-select]")) {
            el.checked = e.currentTarget.checked;
          }
        }}
      />
    </label>
  );
}

export function RowSelect({ id, label }: { id: string; label: string }) {
  return (
    <label className="hc-check">
      <input type="checkbox" name="userIds" value={id} aria-label={label} data-row-select />
    </label>
  );
}
