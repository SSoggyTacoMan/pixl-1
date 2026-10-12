import { redirect } from "next/navigation";
import { Gate } from "@/app/(shell)/gate";
import { safeNext } from "@/lib/auth-flow";
import { getSession } from "@/lib/session";

export const metadata = { title: "Log in" };

const KNOWN_ERRORS = new Set(["state_mismatch", "missing_code", "exchange_failed"]);

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  if (!error && (await getSession())) redirect(safeNext(next));
  return <Gate next={safeNext(next)} error={error && KNOWN_ERRORS.has(error) ? error : null} />;
}
