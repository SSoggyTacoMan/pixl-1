// Shell pages a signed-out visitor may browse, read-only. The shell layout
// renders these in a slim public frame instead of the login gate, and their
// data comes from public server routes (apps/server/src/http/publicRoutes.ts).
// Everything else under the shell still needs a session.
export function isPublicShellPath(path: string): boolean {
  const p = path.split(/[?#]/)[0];
  return p === "/shop" || /^\/shop\/\d+$/.test(p);
}
