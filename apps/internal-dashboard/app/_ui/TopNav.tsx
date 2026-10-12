"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import Icon from "@hackclub/icons";
import { isNavActive, type NavGroup, type NavItem, type NavModel } from "./nav";

function NavLink({ item, count }: { item: NavItem; count?: number }) {
  const pathname = usePathname();
  return (
    <Link href={item.href} className="hc-nav-link" data-active={isNavActive(pathname, item.href) ? true : undefined}>
      <Icon glyph={item.glyph} size={20} aria-hidden />
      {item.label}
      {count !== undefined && count > 0 && <span className="hc-nav-count">{count}</span>}
    </Link>
  );
}

function NavMenu({ group, counts }: { group: NavGroup; counts: Record<string, number> }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDetailsElement>(null);
  const active = group.items.some((item) => isNavActive(pathname, item.href));
  const total = group.items.reduce((sum, item) => sum + (counts[item.href] ?? 0), 0);

  // Close on navigation, outside click and Escape.
  useEffect(() => {
    ref.current?.removeAttribute("open");
  }, [pathname]);
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) ref.current.removeAttribute("open");
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") ref.current?.removeAttribute("open");
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <details ref={ref} className="hc-nav-menu" data-active={active ? true : undefined}>
      <summary className="hc-nav-link">
        <Icon glyph={group.glyph} size={20} aria-hidden />
        {group.label}
        {total > 0 && <span className="hc-nav-count">{total}</span>}
        <Icon glyph="down-caret" size={16} aria-hidden />
      </summary>
      <ul className="hc-nav-menu-panel">
        {group.items.map((item) => (
          <li key={item.href}>
            <NavLink item={item} count={counts[item.href]} />
          </li>
        ))}
      </ul>
    </details>
  );
}

export default function TopNav({ nav, counts }: { nav: NavModel; counts: Record<string, number> }) {
  return (
    <nav className="flex flex-wrap items-center gap-1">
      {nav.primary.map((item) => (
        <NavLink key={item.href} item={item} count={counts[item.href]} />
      ))}
      {nav.groups.map((group) => (
        <NavMenu key={group.label} group={group} counts={counts} />
      ))}
    </nav>
  );
}
