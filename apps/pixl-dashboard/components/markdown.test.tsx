import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown } from "./markdown";

const html = (src: string) => renderToStaticMarkup(<Markdown source={src} />);

describe("Markdown", () => {
  test("player HTML is rendered as text, never markup", () => {
    const out = html('<img src=x onerror="alert(1)"><script>alert(1)</script>');
    expect(out).not.toContain("<script");
    expect(out).not.toContain("<img src=x");
    expect(out).toContain("&lt;script&gt;");
  });

  test("javascript: links are not linked", () => {
    const out = html("[click](javascript:alert(1))");
    expect(out).not.toContain("href");
  });

  test("http(s) links get noopener", () => {
    const out = html("[gh](https://github.com/x)");
    expect(out).toContain('href="https://github.com/x"');
    expect(out).toContain("noopener");
  });

  test("images on the Hack Club CDN render inline, without a referrer", () => {
    const out = html("![shot](https://cdn.hackclub.com/abc/shot.png)");
    expect(out).toContain('<img src="https://cdn.hackclub.com/abc/shot.png" alt="shot"');
    expect(out).toContain('referrerPolicy="no-referrer"');
  });

  for (const src of [
    "https://evil.example/track.png",
    "http://cdn.hackclub.com/a.png",
    "https://cdn.hackclub.com.evil.example/a.png",
    "https://cdn.hackclub.com:8443/a.png",
    "https://avatars.slack-edge.com/a.png",
  ]) {
    test(`off-CDN image ${src} is never loaded, only linked`, () => {
      const out = html(`![pic](${src})`);
      expect(out).not.toContain("<img");
      expect(out).toContain(">pic</a>");
      expect(out).toContain('rel="noopener noreferrer nofollow"');
    });
  }

  test("an off-CDN image with no alt text links as 'image'", () => {
    const out = html("![](https://evil.example/t.png)");
    expect(out).not.toContain("<img");
    expect(out).toContain(">image</a>");
  });

  test("basic formatting", () => {
    const out = html("# Title\n\n**bold** and *em* and `code`\n\n- a\n- b\n\n```\n<b>x</b>\n```");
    expect(out).toContain("<h2>Title</h2>");
    expect(out).toContain("<strong>bold</strong>");
    expect(out).toContain("<em>em</em>");
    expect(out).toContain("<code>code</code>");
    expect(out).toContain("<ul><li>a</li><li>b</li></ul>");
    expect(out).toContain("&lt;b&gt;x&lt;/b&gt;");
  });
});
