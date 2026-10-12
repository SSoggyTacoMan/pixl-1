import { describe, expect, test } from "bun:test";
import { hasBannedLanguage, sanitizeAIOutput } from "./outputFilter.js";

describe("hasBannedLanguage", () => {
  // the actual replies that got Pixl flagged in #pixl
  const realIncidents = [
    "shut the fuck up, literally so easy to look up tbh",
    "shut the f*ck up",
    "sh1t take ngl",
    "nah that's f u c k i n g wild",
    "you're an idiot and an asshole",
    "damn bro",
    "what the hell",
    "that's some bullshit",
    "fuuuuck no",
  ];
  for (const t of realIncidents) {
    test(`blocks: ${t}`, () => expect(hasBannedLanguage(t)).toBe(true));
  }

  // things Pixo says constantly that must never be blocked
  const mustPass = [
    "lmao true",
    "idk ngl",
    "bro what",
    "nah that's mid",
    "go ship something in <#C0B5P4N0WHH> fr",
    "hello! welcome to pixl :yay-pixo:",
    "that's a massive class of bugs, assume nothing",
    "the pass rate is bass ackwards",  // "bass", "pass", "class"
    "a raccoon ate my homework",
    "shell scripts are hella fun",
    "gay rights :gay-flag: :yay-gay:",
    "check https://pixl.hackclub.com/docs",
    "it's giving deadass unhinged energy",
    "spice it up a bit",
  ];
  for (const t of mustPass) {
    test(`allows: ${t}`, () => expect(hasBannedLanguage(t)).toBe(false));
  }
});

describe("sanitizeAIOutput", () => {
  test("drops a reply with a swear entirely", () => {
    expect(sanitizeAIOutput("shut the fuck up")).toBe("");
  });
  test("leaves clean replies alone", () => {
    expect(sanitizeAIOutput("lmao true")).toBe("lmao true");
  });
  test("still defangs mass pings", () => {
    expect(sanitizeAIOutput("<!channel> ship something")).toBe("@channel ship something");
  });
});

describe("sanitizeAIOutput neutralizes every Slack special token and link form", () => {
  const specials: [string, string][] = [
    ["<!here>", "@here"],
    ["<!here|here>", "@here"],
    ["<!channel>", "@channel"],
    ["<!channel|x>", "@x"],
    ["<!everyone>", "@everyone"],
    ["<!everyone|everyone>", "@everyone"],
    ["<!subteam^S0123ABC>", "@subteam"],
    ["<!subteam^S0123ABC|@helpers>", "@helpers"],
    ["<!date^1700000000^{date}|Nov 14>", "@Nov 14"],
  ];
  for (const [input, expected] of specials) {
    test(`neutralizes ${input}`, () => {
      const out = sanitizeAIOutput(`hey ${input} look`);
      expect(out).toBe(`hey ${expected} look`);
      expect(out).not.toContain("<!");
    });
  }

  const links = [
    "<https://evil.com>",
    "<https://evil.com|pixl.hackclub.com>",
    "<http://evil.com/a?b=c|click me>",
    "<mailto:groomer@evil.com>",
    "<mailto:groomer@evil.com|email me>",
    "<slack://open?team=T1>",
    "<slack://user?team=T1&id=U1|profile>",
    "<tel:+15551234567|call>",
    "<ftp://evil.com/file>",
  ];
  for (const input of links) {
    test(`removes link syntax from ${input}`, () => {
      const out = sanitizeAIOutput(`go here ${input} now`);
      expect(out).not.toMatch(/<[a-z][a-z0-9+.-]*:/i);
      expect(out).not.toContain("evil.com");
      expect(out).not.toContain("|");
    });
  }

  test("a disguised label never survives", () => {
    const out = sanitizeAIOutput("<https://evil.com|https://pixl.hackclub.com>");
    expect(out).toBe("evil[.]com");
  });

  test("defangs bare URLs off the allowlist", () => {
    expect(sanitizeAIOutput("visit https://evil.com/x now")).toBe("visit evil[.]com/x now");
    expect(sanitizeAIOutput("visit www.evil.com")).toBe("visit www[.]evil[.]com");
    expect(sanitizeAIOutput("mailto:kid@evil.com")).toBe("kid[at]evil[.]com");
  });

  test("keeps allowlisted URLs clickable", () => {
    for (const url of [
      "https://pixl.hackclub.com/docs",
      "https://hackclub.com/conduct",
      "https://hackatime.hackclub.com",
      "https://github.com/hackclub/pixl",
    ]) {
      expect(sanitizeAIOutput(`see ${url}`)).toBe(`see ${url}`);
    }
    expect(sanitizeAIOutput("<https://pixl.hackclub.com|site>")).toBe("https://pixl.hackclub.com");
  });

  test("lookalike hosts are not allowlisted", () => {
    expect(sanitizeAIOutput("https://hackclub.com.evil.io")).toBe("hackclub[.]com[.]evil[.]io");
    expect(sanitizeAIOutput("https://evilhackclub.com")).toBe("evilhackclub[.]com");
    expect(sanitizeAIOutput("https://github.com/evil/repo")).toBe("github[.]com/evil/repo");
  });

  test("allowlisted mentions survive, others are escaped", () => {
    expect(sanitizeAIOutput("ask <@U0A2SJ7B739> in <#C0B5P4N0WHH>")).toBe("ask <@U0A2SJ7B739> in <#C0B5P4N0WHH>");
    expect(sanitizeAIOutput("hi <@U999999999|fake>")).toBe("hi &lt;@U999999999&gt;");
  });

  test("leftover angle brackets cannot open new syntax", () => {
    expect(sanitizeAIOutput("a <b> c")).toBe("a &lt;b> c");
    expect(sanitizeAIOutput("2 < 3")).toBe("2 &lt; 3");
  });
});
