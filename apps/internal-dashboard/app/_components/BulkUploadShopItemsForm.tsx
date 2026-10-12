"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  checkShopItemsConflicts,
  commitShopItemsCsv,
  type ShopCsvRow,
} from "@/app/actions";
import { SHOP_REGIONS, type ShopRegion } from "@/lib/shopRegions";

// Minimal RFC4180-ish CSV parser: handles quoted fields, "" escapes, and
// commas/newlines inside quotes. No multiline-within-quote support needed
// for a flat items sheet.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function toRows(csv: string[][], defaultRegion: ShopRegion): ShopCsvRow[] {
  if (csv.length === 0) return [];
  const header = csv[0].map((h) => h.trim().toLowerCase());
  const idx = (...names: string[]) => names.map((n) => header.indexOf(n)).find((i) => i >= 0) ?? -1;
  const nameIdx = idx("name");
  const priceIdx = idx("price");
  const regionIdx = idx("region");
  const descIdx = idx("description", "desc");
  const optionsIdx = idx("options");
  const imageIdx = idx("image_url", "image", "imageurl");
  const unlockIdx = idx("unlock_xp", "unlockxp");
  if (nameIdx < 0) return [];
  return csv.slice(1).map((cells, i) => {
    const region = (cells[regionIdx] ?? "").trim().toUpperCase();
    return {
      key: `row-${i}`,
      name: (cells[nameIdx] ?? "").trim(),
      price: Number(cells[priceIdx] ?? 0) || 0,
      region: (SHOP_REGIONS as readonly string[]).includes(region) ? (region as ShopRegion) : defaultRegion,
      description: (cells[descIdx] ?? "").trim(),
      options: (cells[optionsIdx] ?? "").trim(),
      imageUrl: (cells[imageIdx] ?? "").trim(),
      unlockXp: Number(cells[unlockIdx] ?? 0) || 0,
    };
  }).filter((r) => r.name);
}

type ConflictMap = Record<string, { id: number; price: number; description: string }>;

export function BulkUploadShopItemsForm({ region }: { region: ShopRegion }) {
  const [rows, setRows] = useState<ShopCsvRow[]>([]);
  const [conflicts, setConflicts] = useState<ConflictMap>({});
  const [resolutions, setResolutions] = useState<Record<string, "replace" | "skip">>({});
  const [result, setResult] = useState<{ added: number; replaced: number; skipped: number; errors: string[] } | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function reset() {
    setRows([]);
    setConflicts({});
    setResolutions({});
    setResult(null);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    setError("");
    const text = await file.text();
    const parsed = toRows(parseCsv(text), region);
    if (parsed.length === 0) {
      setError('Couldn\'t find any rows with a "name" column. Check the header row.');
      setRows([]);
      return;
    }
    setRows(parsed);
    startTransition(async () => {
      try {
        const hits = await checkShopItemsConflicts(parsed);
        setConflicts(hits);
        const defaults: Record<string, "replace" | "skip"> = {};
        for (const key of Object.keys(hits)) defaults[key] = "skip";
        setResolutions(defaults);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to check for existing items.");
      }
    });
  }

  function onImport() {
    startTransition(async () => {
      try {
        const conflictIds = Object.fromEntries(
          Object.entries(conflicts).map(([k, v]) => [k, v.id]),
        );
        const summary = await commitShopItemsCsv(rows, conflictIds, resolutions);
        setResult(summary);
        setRows([]);
        setConflicts({});
        setResolutions({});
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Import failed.");
      }
    });
  }

  const conflictCount = Object.keys(conflicts).length;

  return (
    <div className="space-y-4">
      <div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={onFile}
          disabled={pending}
          className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-secondary/80"
        />
        <p className="text-xs text-muted-foreground mt-1.5">
          Columns: name (required), price, region, description, options, image_url, unlock_xp. Extra
          columns are ignored.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {result && (
        <div className="text-sm rounded-md border border-border bg-muted/40 p-3">
          Added {result.added}, replaced {result.replaced}, skipped {result.skipped}.
          {result.errors.length > 0 && (
            <ul className="list-disc list-inside mt-1.5 text-destructive">
              {result.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {rows.length > 0 && (
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            {rows.length} row{rows.length === 1 ? "" : "s"} parsed
            {conflictCount > 0 && (
              <>
                {" "}
                · <span className="text-foreground font-medium">{conflictCount}</span> already
                exist{conflictCount === 1 ? "s" : ""} , choose replace or skip below
              </>
            )}
          </div>
          <div className="rounded-md border border-border divide-y divide-border overflow-hidden">
            {rows.map((r) => {
              const hit = conflicts[r.key];
              return (
                <div key={r.key} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{r.name}</span>{" "}
                    <span className="text-muted-foreground">{r.price} px · {r.region}</span>
                  </div>
                  {hit ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary">exists · {hit.price} px</Badge>
                      <div className="flex rounded-md border border-border overflow-hidden text-xs">
                        <button
                          type="button"
                          onClick={() => setResolutions((r0) => ({ ...r0, [r.key]: "replace" }))}
                          className={`px-2 py-1 ${resolutions[r.key] === "replace" ? "bg-brand text-white" : "bg-background hover:bg-muted"}`}
                        >
                          Replace
                        </button>
                        <button
                          type="button"
                          onClick={() => setResolutions((r0) => ({ ...r0, [r.key]: "skip" }))}
                          className={`px-2 py-1 border-l border-border ${resolutions[r.key] !== "replace" ? "bg-brand text-white" : "bg-background hover:bg-muted"}`}
                        >
                          Skip
                        </button>
                      </div>
                    </div>
                  ) : (
                    <Badge variant="success" className="shrink-0">new</Badge>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              disabled={pending}
              onClick={onImport}
              className="bg-brand text-white border-transparent"
            >
              {pending ? "Importing…" : `Import ${rows.length} item${rows.length === 1 ? "" : "s"}`}
            </Button>
            <Button type="button" variant="outline" disabled={pending} onClick={reset}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
