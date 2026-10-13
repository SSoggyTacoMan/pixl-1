// Styles for the HTML string packages/docs-engine renders (plain h1-h3/p/ul/
// ol/li/a/hr/pre/code, plus .lead, .fact-grid, .callout(.warn) > .k and
// highlight.js token spans). We don't render those elements ourselves, so
// they're reached through arbitrary descendant variants on the wrapper div.

// Plain joins, not cn(): tailwind-merge would treat some of these arbitrary
// variants as conflicts (text size vs colour) and drop one.
const join = (...parts: string[]): string => parts.join(" ");

const headings = join(
  "[&_h1]:font-pixel [&_h1]:text-[46px] [&_h1]:font-bold [&_h1]:leading-[1.1] [&_h1]:tracking-[.2px] [&_h1]:text-ink",
  "[&_h2]:mt-[44px] [&_h2]:mb-[6px] [&_h2]:scroll-mt-[24px] [&_h2]:font-pixel [&_h2]:text-[30px] [&_h2]:font-semibold",
  "[&_h2]:leading-[1.2] [&_h2]:tracking-[.2px] [&_h2]:text-ink",
  "[&_h3]:mt-[30px] [&_h3]:mb-[8px] [&_h3]:font-pixel [&_h3]:text-[14px] [&_h3]:font-semibold [&_h3]:uppercase",
  "[&_h3]:tracking-[1px] [&_h3]:text-faint",
  // Long headings wrap instead of overflowing a squeezed column.
  "[&_:is(h1,h2,h3)]:wrap-break-word",
  // A few h2s wrap a filename in backticks: scale those off the heading.
  "[&_:is(h1,h2,h3)_code]:px-[5px] [&_:is(h1,h2,h3)_code]:py-0 [&_:is(h1,h2,h3)_code]:text-[.78em]",
);

const text = join(
  "[&_p]:my-[16px] [&_p]:text-[16px] [&_p]:leading-[1.75] [&_p]:text-dim",
  "[&_.lead]:text-[19px] [&_.lead]:leading-[1.6] [&_.lead]:text-ink",
  "[&_:is(b,strong)]:font-semibold [&_:is(b,strong)]:text-ink",
  "[&_a]:text-ink [&_a]:underline [&_a]:decoration-accent [&_a]:decoration-2 [&_a]:underline-offset-[3px]",
  "[&_a:hover]:bg-accent [&_a:hover]:text-panel-deep",
  "[&_hr]:my-[32px] [&_hr]:border-x-0 [&_hr]:border-b-0 [&_hr]:border-t-2 [&_hr]:border-stroke",
);

const lists = join(
  "[&_:is(ul,ol)]:my-[15px] [&_:is(ul,ol)]:p-0 [&_:is(ul,ol)]:list-none [&_ol]:[counter-reset:doc-ol]",
  "[&_li]:relative [&_li]:py-[6px] [&_li]:pr-0 [&_li]:pl-[22px] [&_li]:text-[15.5px] [&_li]:leading-[1.65] [&_li]:text-dim",
  "[&_ul>li]:before:absolute [&_ul>li]:before:top-[13px] [&_ul>li]:before:left-[3px] [&_ul>li]:before:size-[7px]",
  "[&_ul>li]:before:border [&_ul>li]:before:border-stroke [&_ul>li]:before:bg-accent [&_ul>li]:before:content-['']",
  "[&_ol>li]:pl-[26px] [&_ol>li]:[counter-increment:doc-ol]",
  "[&_ol>li]:before:absolute [&_ol>li]:before:top-[6px] [&_ol>li]:before:left-0 [&_ol>li]:before:font-pixel",
  "[&_ol>li]:before:text-[13px] [&_ol>li]:before:text-accent [&_ol>li]:before:content-[counter(doc-ol)'.']",
);

// Three-column fact tables (tier rates, level bands): a flat list of divs,
// label | description | rate.
const factGrid = join(
  "[&_.fact-grid]:my-[22px] [&_.fact-grid]:grid [&_.fact-grid]:grid-cols-[auto_minmax(0,1fr)_auto] [&_.fact-grid]:overflow-hidden",
  "[&_.fact-grid]:border-2 [&_.fact-grid]:border-stroke [&_.fact-grid]:bg-panel [&_.fact-grid]:shadow-drop",
  "[&_.fact-grid>div]:border-b-2 [&_.fact-grid>div]:border-stroke [&_.fact-grid>div]:px-[16px] [&_.fact-grid>div]:py-[11px]",
  "[&_.fact-grid>div]:text-[15px] [&_.fact-grid>div]:leading-[1.5] [&_.fact-grid>div]:text-dim [&_.fact-grid>div]:wrap-break-word",
  "[&_.fact-grid>div:nth-child(3n+1)]:font-pixel [&_.fact-grid>div:nth-child(3n+1)]:font-semibold",
  "[&_.fact-grid>div:nth-child(3n+1)]:whitespace-nowrap [&_.fact-grid>div:nth-child(3n+1)]:text-ink",
  "[&_.fact-grid>div:nth-child(3n)]:text-right [&_.fact-grid>div:nth-child(3n)]:font-semibold",
  "[&_.fact-grid>div:nth-child(3n)]:whitespace-nowrap [&_.fact-grid>div:nth-child(3n)]:text-ink",
  "[&_.fact-grid>div:nth-last-child(-n+3)]:border-b-0",
  // Phones: the description spans both columns under its label/rate. Dense
  // packing, because sparse (the default) won't backfill the hole the
  // spanning div leaves and every later row lands under the wrong label.
  "max-[620px]:[&_.fact-grid]:grid-cols-[1fr_auto] max-[620px]:[&_.fact-grid]:grid-flow-row-dense",
  "max-[620px]:[&_.fact-grid>div:nth-child(3n+2)]:col-span-full max-[620px]:[&_.fact-grid>div:nth-child(3n+2)]:border-b-0",
  "max-[620px]:[&_.fact-grid>div:nth-child(3n+2)]:pt-0 max-[620px]:[&_.fact-grid>div:nth-child(3n+2)]:text-[14px]",
  "max-[620px]:[&_.fact-grid>div:nth-child(3n+1)]:border-b-0",
);

const callout = join(
  "[&_.callout]:my-[22px] [&_.callout]:border-2 [&_.callout]:border-l-8 [&_.callout]:border-stroke [&_.callout]:border-l-gold",
  "[&_.callout]:bg-panel [&_.callout]:px-[18px] [&_.callout]:py-[14px] [&_.callout]:shadow-drop",
  "[&_.callout.warn]:border-l-accent",
  "[&_.callout_.k]:mb-[5px] [&_.callout_.k]:block [&_.callout_.k]:font-pixel [&_.callout_.k]:text-[11px]",
  "[&_.callout_.k]:font-semibold [&_.callout_.k]:uppercase [&_.callout_.k]:tracking-[1px] [&_.callout_.k]:text-ink",
  "[&_.callout_p]:m-0 [&_.callout_p]:text-ink",
);

// Inline code, then code blocks. Blocks stay dark in both page themes (a
// terminal reads better that way), tinted off the landing's ink and orange.
const code = join(
  "[&_code]:border [&_code]:border-stroke [&_code]:bg-panel-2 [&_code]:px-[6px] [&_code]:py-px",
  "[&_code]:font-mono [&_code]:text-[14.5px] [&_code]:text-ink",
  "[&_pre]:relative [&_pre]:my-[18px] [&_pre]:overflow-hidden [&_pre]:border-2 [&_pre]:border-stroke",
  "[&_pre]:bg-[#16161e] [&_pre]:shadow-drop",
  "[&_pre_code]:block [&_pre_code]:overflow-x-auto [&_pre_code]:border-0 [&_pre_code]:bg-transparent",
  "[&_pre_code]:p-[16px_44px_16px_18px] [&_pre_code]:leading-[1.7] [&_pre_code]:text-[#f5eed2]",
);

// highlight.js token colours (the CDN script ships no theme). Class names
// with underscores (language_, built_in) are matched by prefix so Tailwind
// doesn't read the underscore as a space.
const hljs = join(
  "[&_:is(.hljs-doctag,.hljs-keyword,.hljs-template-tag,.hljs-template-variable,.hljs-type,.hljs-variable[class*=language])]:text-[#ff8c37]",
  "[&_.hljs-title]:text-[#ffa45c]",
  "[&_:is(.hljs-attr,.hljs-attribute,.hljs-literal,.hljs-meta,.hljs-number,.hljs-operator,.hljs-variable,.hljs-selector-attr,.hljs-selector-class,.hljs-selector-id)]:text-[#ded6c0]",
  "[&_:is(.hljs-regexp,.hljs-string)]:text-[#e8c9a0]",
  "[&_:is([class*=hljs-built],.hljs-symbol)]:text-[#ff8c37]",
  "[&_:is(.hljs-comment,.hljs-code,.hljs-formula)]:text-[#928d7e]",
  "[&_:is(.hljs-name,.hljs-quote,.hljs-selector-tag,.hljs-selector-pseudo)]:text-[#ffc08a]",
  "[&_.hljs-subst]:text-[#f5eed2]",
  "[&_.hljs-section]:font-semibold [&_.hljs-section]:text-[#ff8c37]",
  "[&_.hljs-bullet]:text-[#ec3750]",
  "[&_.hljs-emphasis]:italic [&_.hljs-strong]:font-bold",
  "[&_.hljs-addition]:bg-[#253116] [&_.hljs-addition]:text-[#a8d98c]",
  "[&_.hljs-deletion]:bg-[#3a1e1a] [&_.hljs-deletion]:text-[#f0a8a0]",
);

export const docProse = join(headings, text, lists, factGrid, callout, code, hljs);
