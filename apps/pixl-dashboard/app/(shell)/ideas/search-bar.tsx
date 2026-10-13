"use client";

// Debounced title search: rewrites ?q= so the Server Component refetches.
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Input } from "@/components/ui/primitives";

export function SearchBar({ initial }: { initial: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(initial);
  const [, startTransition] = useTransition();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      const q = value.trim();
      startTransition(() => router.replace(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname));
    }, 350);
    return () => clearTimeout(t);
  }, [value, pathname, router]);

  return (
    <div className="mb-[18px] flex gap-2.5">
      <Input
        className="flex-1"
        type="search"
        placeholder="Find an idea..."
        autoComplete="off"
        aria-label="Search ideas"
        maxLength={120}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </div>
  );
}
