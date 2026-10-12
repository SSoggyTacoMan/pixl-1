import { loginUrl } from "@/lib/urls";

/** Signed-out gate for every shell page. The only action is Log In. */
export function Gate({ next, error }: { next: string; error?: string | null }) {
  return (
    <div className="gate">
      <div className="gate-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="gate-splash" src="/img/boot-splash.png" alt="Pixl" />
        {error ? (
          <p role="alert">That login didn&apos;t go through ({error.replace(/_/g, " ")}). Try again.</p>
        ) : (
          <p>Log in with Hack Club to see your projects, shop and orders.</p>
        )}
        <div className="gate-actions">
          <a className="btn-enter" href={loginUrl(next)}>
            Log In
          </a>
        </div>
      </div>
    </div>
  );
}
