"use client";

import { SafeImage } from "@/components/safe-image";
import { field, panelDeep } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import type { FormState, SetForm } from "./editor-state";
import { FileButton } from "./file-button";
import { Disclosure, OpenLink, Row } from "./form-bits";
import { fundingHoursText } from "./funding-hours";
import { hint, smallButton } from "./styles";

/** Hardware-only: funding request (BOM, cart screenshots, amount) and "finished build". */
export function HardwareFields({
  form,
  set,
  projectId,
  locked,
  usdPerHour,
}: {
  form: FormState;
  set: SetForm;
  projectId?: number;
  locked?: boolean;
  usdPerHour?: number;
}) {
  if (form.kind !== "hardware") return null;
  return (
    <>
      <Disclosure
        checked={form.needsFunding}
        onChange={(v) => set({ needsFunding: v })}
        disabled={locked}
        label="I need funding for this build"
        desc="Ask for money toward parts and shipping. Upload your Bill of Materials, your cart screenshot(s) (with shipping included), and how much you need, all required to ship a funded project."
      >
        <Row label="BILL OF MATERIALS (.csv)" extra={form.bomUrl ? <OpenLink url={form.bomUrl} /> : null}>
          {projectId ? (
            <FileButton
              kind="bom"
              projectId={projectId}
              disabled={locked}
              label={form.bomUrl ? "REPLACE BOM CSV" : "UPLOAD BOM CSV"}
              onUploaded={(url) => set({ bomUrl: url })}
            />
          ) : (
            <span className={hint()}>Create the project first, then upload its BOM.</span>
          )}
        </Row>
        <Row label="CART SCREENSHOT(S), WITH SHIPPING">
          <FileButton
            kind="image"
            disabled={locked || form.cartUrls.length >= 20}
            label="ADD SCREENSHOT"
            onUploaded={(url) => set({ cartUrls: [...form.cartUrls, url] })}
          />
          {form.cartUrls.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {form.cartUrls.map((u, i) => (
                <div key={`${u}-${i}`} className={cn(panelDeep, "flex flex-col items-center gap-1 p-1")}>
                  <SafeImage player src={u} className="h-16 w-24 object-cover" />
                  {!locked ? (
                    <button
                      type="button"
                      className={cn(smallButton, "py-0")}
                      onClick={() => set({ cartUrls: form.cartUrls.filter((_, j) => j !== i) })}
                    >
                      REMOVE
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <span className={hint()}>Screenshot your cart(s) at the final step, shipping included. At least one required.</span>
          )}
        </Row>
        <Row label="AMOUNT NEEDED (USD)">
          <input
            className={field}
            type="number"
            min={0}
            max={100000}
            step="0.01"
            value={form.fundingUsd}
            disabled={locked}
            placeholder="0.00"
            onChange={(e) => set({ fundingUsd: e.target.value })}
          />
          {fundingHoursText(Number(form.fundingUsd) || 0, usdPerHour) ? (
            <span className={hint()} aria-live="polite">
              {fundingHoursText(Number(form.fundingUsd) || 0, usdPerHour)}
            </span>
          ) : null}
        </Row>
      </Disclosure>
      {form.projectType !== "cad" ? (
        <Disclosure
          checked={form.finishedBuild}
          onChange={(v) => set({ finishedBuild: v })}
          disabled={locked}
          label="This is a finished, built hardware project"
          desc="Tick this once you've actually built it and can film it working, that's when a video demo is required. Leave it unticked while you're still fundraising or waiting on parts."
        />
      ) : null}
    </>
  );
}
