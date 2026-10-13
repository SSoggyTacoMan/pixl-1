// Safe Markdown subset for player-written text (journals, descriptions),
// ported from pixl.js's markdown()/mdInline() but rendered straight to React
// elements: there is no HTML string anywhere, so nothing a player types can
// become markup. Links only render for http(s) URLs; images only load from
// the Hack Club CDN (lib/cdn-hosts.ts) - any other host would hand every
// viewer's IP to whoever wrote the entry, so those render as a plain link.
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { playerImageSrc, safeHttpUrl } from "@/lib/safe-url";

type Tok = { re: RegExp; render: (m: RegExpExecArray, key: string) => ReactNode };

const INLINE: Tok[] = [
  { re: /`([^`]+)`/, render: (m, k) => <code key={k}>{m[1]}</code> },
  {
    re: /!\[([^[\]]*)\]\((https?:\/\/[^)\s[\]]+)\)/,
    render: (m, k) => {
      const src = playerImageSrc(m[2]);
      // eslint-disable-next-line @next/next/no-img-element
      if (src) return <img key={k} src={src} alt={m[1]} loading="lazy" referrerPolicy="no-referrer" />;
      const href = safeHttpUrl(m[2]);
      const label = m[1].trim() || "image";
      return href ? (
        <a key={k} href={href} target="_blank" rel="noopener noreferrer nofollow">
          {label}
        </a>
      ) : (
        label
      );
    },
  },
  {
    re: /\[([^[\]]+)\]\((https?:\/\/[^)\s[\]]+)\)/,
    render: (m, k) => {
      const href = safeHttpUrl(m[2]);
      return href ? (
        <a key={k} href={href} target="_blank" rel="noopener noreferrer nofollow">
          {inline(m[1], k)}
        </a>
      ) : (
        m[1]
      );
    },
  },
  { re: /\*\*([^*]+)\*\*/, render: (m, k) => <strong key={k}>{inline(m[1], k)}</strong> },
  { re: /__([^_]+)__/, render: (m, k) => <strong key={k}>{inline(m[1], k)}</strong> },
  { re: /~~([^~]+)~~/, render: (m, k) => <s key={k}>{inline(m[1], k)}</s> },
  { re: /\*([^*\s][^*]*?)\*/, render: (m, k) => <em key={k}>{inline(m[1], k)}</em> },
];

/** Inline markdown -> React nodes. Earliest match wins; text between is plain. */
export function inline(src: string, keyBase = "i"): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = src;
  let n = 0;
  while (rest.length) {
    let best: { idx: number; m: RegExpExecArray; tok: Tok } | null = null;
    for (const tok of INLINE) {
      const m = tok.re.exec(rest);
      if (m && (best === null || m.index < best.idx)) best = { idx: m.index, m, tok };
    }
    if (!best) {
      out.push(rest);
      break;
    }
    if (best.idx > 0) out.push(rest.slice(0, best.idx));
    out.push(best.tok.render(best.m, `${keyBase}.${n++}`));
    rest = rest.slice(best.idx + best.m[0].length);
  }
  return out;
}

const BLOCK_START = /^(#{1,6}\s|```|>\s?|\s*[-*+]\s+|\s*\d+\.\s+)/;
const HR = /^\s*([-*_])\1\1+\s*$/;

export function renderMarkdown(src: string): ReactNode[] {
  const lines = String(src ?? "").split(/\r?\n/);
  const out: ReactNode[] = [];
  let i = 0;
  let k = 0;
  const key = () => `b${k++}`;
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(
        <pre key={key()}>
          <code>{buf.join("\n")}</code>
        </pre>,
      );
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const Tag = `h${Math.min(h[1].length + 1, 6)}` as "h2";
      const kk = key();
      out.push(<Tag key={kk}>{inline(h[2], kk)}</Tag>);
      i++;
      continue;
    }
    if (HR.test(line)) {
      out.push(<hr key={key()} />);
      i++;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const q: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ""));
      const kk = key();
      out.push(<blockquote key={kk}>{inline(q.join(" "), kk)}</blockquote>);
      continue;
    }
    const ul = /^\s*[-*+]\s+/;
    const ol = /^\s*\d+\.\s+/;
    if (ul.test(line) || ol.test(line)) {
      const ordered = ol.test(line);
      const re = ordered ? ol : ul;
      const items: ReactNode[] = [];
      while (i < lines.length && re.test(lines[i])) {
        const kk = key();
        items.push(<li key={kk}>{inline(lines[i++].replace(re, ""), kk)}</li>);
      }
      out.push(ordered ? <ol key={key()}>{items}</ol> : <ul key={key()}>{items}</ul>);
      continue;
    }
    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }
    const para = [line];
    i++;
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !BLOCK_START.test(lines[i]) && !HR.test(lines[i])) {
      para.push(lines[i++]);
    }
    const kk = key();
    out.push(
      <p key={kk}>
        {para.flatMap((l, j) => (j === 0 ? inline(l, `${kk}.${j}`) : [<br key={`${kk}br${j}`} />, ...inline(l, `${kk}.${j}`)]))}
      </p>,
    );
  }
  return out;
}

// Styles the rendered elements from the root, so renderMarkdown's output stays
// plain tags. A caller's className can override any of these through cn().
const mdClass = cn(
  "leading-[1.65] [word-break:break-word]",
  "[&_:is(h1,h2,h3,h4,h5,h6)]:mt-[14px] [&_:is(h1,h2,h3,h4,h5,h6)]:mb-[6px] [&_:is(h1,h2,h3,h4,h5,h6)]:font-pixel",
  "[&_p]:my-[8px]",
  "[&_:is(ul,ol)]:my-[8px] [&_:is(ul,ol)]:ml-[22px] [&_ul]:list-[square] [&_ol]:list-decimal",
  "[&_blockquote]:my-[8px] [&_blockquote]:border-l-4 [&_blockquote]:border-stroke [&_blockquote]:pl-[10px]",
  "[&_blockquote]:text-dim",
  "[&_pre]:my-[8px] [&_pre]:overflow-x-auto [&_pre]:border-2 [&_pre]:border-stroke [&_pre]:bg-panel-deep",
  "[&_pre]:p-[10px] [&_pre]:font-mono [&_pre]:text-[13px]",
  "[&_code]:bg-panel-2 [&_code]:px-[3px] [&_code]:font-mono [&_code]:text-[.92em]",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_img]:my-[8px] [&_img]:max-w-full [&_img]:border-2 [&_img]:border-stroke",
  "[&_hr]:my-[14px] [&_hr]:h-[2px] [&_hr]:border-0 [&_hr]:bg-stroke",
  "[&_a]:underline",
);

export function Markdown({ source, className }: { source: string; className?: string }) {
  return <div className={cn(mdClass, className)}>{renderMarkdown(source)}</div>;
}

/** Strips Godot BBCode tags to plain text (quests/news copy authored for the game). */
export function bbstrip(src: unknown): string {
  return String(src ?? "")
    .replace(/\[\/?(?!lb\]|rb\])[a-zA-Z][^\]]*\]/g, "")
    .replace(/\[lb\]/g, "[")
    .replace(/\[rb\]/g, "]");
}
