import { describe, expect, test } from "bun:test";
import { isIdentityFact, safeFacts } from "./identityFilter.js";

describe("isIdentityFact", () => {
  const identity = [
    // names
    "real name is Alex Johnson",
    "full name Alex Johnson",
    "name is Alex",
    "goes by AJ at home",
    // age / birthday / grade
    "is 13 years old",
    "13yo",
    "age 14",
    "is 13",
    "just turned 15",
    "birthday is March 3rd",
    "born in 2011",
    "in 8th grade",
    "freshman this year",
    // location / nationality
    "lives in Toronto",
    "is from Brazil",
    "originally from Lagos",
    "moved to Berlin last year",
    "hometown is a small village",
    "timezone is IST",
    "indian",
    "french nationality",
    "based in california",
    "street address on Elm",
    // school
    "goes to Lincoln High School",
    "studies at a university",
    "homeschooled",
    "class of 2029",
    // pronouns / gender / orientation
    "pronouns are she/her",
    "uses they/them",
    "is trans",
    "nonbinary",
    "is gay",
    "is a girl",
    // contact
    "email is kid@example.com",
    "phone +1 555 123 4567",
    "discord is coolkid#1234",
    "instagram @coolkid",
    "has a tiktok",
    "site https://example.com",
    // family / relationships
    "has two younger brothers",
    "mom is a nurse",
    "parents are strict",
    "has a girlfriend",
    // religion / health
    "is muslim",
    "has adhd",
    // job
    "works at a grocery store",
    // phrasings the first version missed
    "i'm 14",
    "im 14",
    "I am 13",
    "turns 14 next month",
    "13 y.o.",
    "is a middle schooler",
    "highschooler",
    "in eighth grade",
    "Eighth Grade",
    "from ohio",
    "grew up in a small town in kerala",
    "speaks hindi",
    "speaks Tagalog at home",
    "tengo 14 años",
    "tiene 13 anos",
    "vive en Madrid",
    "vivo en bogota",
    "soy de mexico",
    "habite à Lyon",
    "j'habite a lyon",
    "j'ai 14 ans",
    "14 ans",
    "mora em São Paulo",
  ];
  for (const f of identity) {
    test(`drops: ${f}`, () => expect(isIdentityFact(f)).toBe(true));
  }

  const harmless = [
    "loves rust",
    "hates javascript semicolons",
    "plays minecraft a lot",
    "building a pixel art editor",
    "shipped a discordless chat app",
    "favorite game is celeste",
    "listens to lofi while coding",
    "thinks tabs beat spaces",
    "uses neovim",
    "into speedrunning",
    "sarcastic and dry",
    "hypes people up",
    "very short replies",
  ];
  for (const f of harmless) {
    test(`keeps: ${f}`, () => expect(isIdentityFact(f)).toBe(false));
  }
});

describe("safeFacts", () => {
  test("filters a legacy row read back from the DB", () => {
    const legacy = ["name is Alex", "lives in Ohio", "loves rust", "is 13", "13 years old", "plays celeste"];
    expect(safeFacts(legacy)).toEqual(["loves rust", "plays celeste"]);
  });

  test("ignores non-string junk", () => {
    expect(safeFacts([1, null, "loves rust"] as unknown as string[])).toEqual(["loves rust"]);
  });
});
