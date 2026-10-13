import Link from "next/link";
import { buttonVariants, wrap } from "@/components/ui/primitives";
import { loginUrl } from "@/lib/urls";

/**
 * Frame for the shell pages a signed-out visitor can browse (isPublicShellPath
 * in lib/public-pages.ts): a top bar with Log In instead of the sidebar, which
 * is all wallet and player links.
 */
export function PublicShell({ next, children }: { next: string; children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-40 flex h-[54px] items-center justify-between gap-[10px] border-b-4 border-stroke bg-panel-deep px-[20px]">
        <Link href="/" className="font-pixel text-[26px] font-semibold tracking-[1.5px] text-ink hover:text-ink">
          PIXL
        </Link>
        <a className={buttonVariants({ size: "sm" })} href={loginUrl(next)}>
          LOG IN
        </a>
      </header>
      <main className={wrap}>{children}</main>
    </>
  );
}
