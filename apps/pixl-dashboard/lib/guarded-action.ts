import "server-only";
import { revalidatePath } from "next/cache";
import { createGuardedAction } from "./guarded-action-core";
import { getAuth } from "./session";

export { json } from "./guarded-action-core";
export type { ActionDetails, ActionResult } from "./guarded-action-core";

// This app has no database of its own; apps/server audits every write it
// receives. This line is the dashboard-side record of who asked for what.
export const guardedAction = createGuardedAction({
  getAuth,
  log: (line) => console.log(JSON.stringify(line)),
  revalidate: (path) => revalidatePath(path),
});
