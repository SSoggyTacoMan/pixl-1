import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SafeImage } from "./safe-image";

const html = (el: React.ReactElement) => renderToStaticMarkup(el);

describe("SafeImage", () => {
  test("player images only load from the Hack Club CDN", () => {
    expect(html(<SafeImage player src="https://cdn.hackclub.com/a.png" />)).toContain('src="https://cdn.hackclub.com/a.png"');
    expect(html(<SafeImage player src="https://evil.example/t.png" fallback="NO IMAGE" />)).toBe("NO IMAGE");
    expect(html(<SafeImage player src="/img/x.png" fallback="F" />)).toBe("F");
  });
  test("admin-set images keep the broader https / same-origin rule", () => {
    expect(html(<SafeImage src="https://images.example/shop.png" />)).toContain('src="https://images.example/shop.png"');
    expect(html(<SafeImage src="/shop/item.png" />)).toContain('src="/shop/item.png"');
    expect(html(<SafeImage src="javascript:x" fallback="F" />)).toBe("F");
  });
});
