import { describe, expect, test } from "bun:test";
import {
  LOBBY_PASSWORD_LENGTH,
  cleanLobbyName,
  createLobby,
  lobbies,
  renameLobby,
  genLobbyPassword,
  isStrongLobbyPassword,
  lobbyPasswordMatches,
} from "./lobbies.js";

describe("lobby password generation", () => {
  test("is at least 40 bits, no longer a 4-digit code", () => {
    expect(LOBBY_PASSWORD_LENGTH).toBeGreaterThanOrEqual(8);
    expect(32 ** LOBBY_PASSWORD_LENGTH).toBeGreaterThanOrEqual(2 ** 40);
  });

  test("uses only unambiguous uppercase characters", () => {
    for (let i = 0; i < 500; i++) {
      expect(genLobbyPassword()).toMatch(/^[A-HJ-NP-Z2-9]+$/);
    }
  });

  test("has the configured length", () => {
    expect(genLobbyPassword()).toHaveLength(LOBBY_PASSWORD_LENGTH);
  });

  test("does not repeat across a large sample", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5_000; i++) seen.add(genLobbyPassword());
    expect(seen.size).toBe(5_000);
  });

  test("draws from the whole alphabet at every position", () => {
    const perPosition = Array.from({ length: LOBBY_PASSWORD_LENGTH }, () => new Set<string>());
    for (let i = 0; i < 3_000; i++) {
      [...genLobbyPassword()].forEach((ch, pos) => perPosition[pos].add(ch));
    }
    for (const chars of perPosition) expect(chars.size).toBe(32);
  });
});

describe("isStrongLobbyPassword", () => {
  test("rejects the legacy 4-digit codes and empty values", () => {
    expect(isStrongLobbyPassword("1234")).toBe(false);
    expect(isStrongLobbyPassword("9999")).toBe(false);
    expect(isStrongLobbyPassword("")).toBe(false);
  });

  test("accepts a freshly generated password", () => {
    expect(isStrongLobbyPassword(genLobbyPassword())).toBe(true);
  });
});

describe("lobbyPasswordMatches", () => {
  test("matches the exact secret", () => {
    expect(lobbyPasswordMatches("K7M2QX9F", "K7M2QX9F")).toBe(true);
  });

  test("ignores case and surrounding whitespace on both sides", () => {
    expect(lobbyPasswordMatches("  k7m2qx9f\n", "K7M2QX9F")).toBe(true);
    expect(lobbyPasswordMatches("K7M2QX9F", "k7m2qx9f")).toBe(true);
  });

  test("rejects near misses, prefixes, and extensions", () => {
    expect(lobbyPasswordMatches("K7M2QX9G", "K7M2QX9F")).toBe(false);
    expect(lobbyPasswordMatches("K7M2QX9", "K7M2QX9F")).toBe(false);
    expect(lobbyPasswordMatches("K7M2QX9FF", "K7M2QX9F")).toBe(false);
  });

  test("a lobby with no secret never matches, not even an empty guess", () => {
    expect(lobbyPasswordMatches("", "")).toBe(false);
    expect(lobbyPasswordMatches("anything", "")).toBe(false);
  });
});

describe("lobby names", () => {
  test("blocked words are censored like chat", () => {
    const out = cleanLobbyName("fuck this lobby");
    expect(out).not.toMatch(/fuck/i);
    expect(out).toContain("lobby");
  });

  test("a name that's nothing but a blocked word falls back", () => {
    expect(cleanLobbyName("fuck")).toBe("");
    expect(cleanLobbyName("fuuuck")).toBe("");
  });

  test("brackets (rich-text tags) are stripped", () => {
    expect(cleanLobbyName("[color=red]Free Pixels[/color]")).toBe("color=redFree Pixels/color");
    expect(cleanLobbyName("[url=https://x]hi[/url]")).not.toContain("[");
    expect(cleanLobbyName("<b>hi</b>")).not.toMatch(/[<>]/);
  });

  test("control, zero-width and bidi characters are stripped", () => {
    expect(cleanLobbyName("hi\u0000\u0007there")).toBe("hi there");
    expect(cleanLobbyName("a\u200Bb")).toBe("a b");
    expect(cleanLobbyName("\u202Eevil")).toBe("evil");
    expect(cleanLobbyName("line\nbreak")).toBe("line break");
  });

  test("ordinary names pass through, capped", () => {
    expect(cleanLobbyName("  Ada's Village  ")).toBe("Ada's Village");
    expect(cleanLobbyName("x".repeat(80))).toHaveLength(30);
    expect(cleanLobbyName(42)).toBe("");
  });

  test("createLobby and renameLobby use the cleaned name", () => {
    const lobby = createLobby({ isPublic: true, name: "[b]fuck[/b]", ownerId: "u1" });
    expect(lobby).not.toBeNull();
    expect(lobby!.name).not.toMatch(/fuck|[[]]/i);
    const fallback = createLobby({ isPublic: true, name: "fuck", ownerId: "u1" });
    expect(fallback!.name).toBe(`Lobby ${fallback!.id}`);
    lobbies.delete(fallback!.id);
    renameLobby(lobby!, "shit\u200B lobby");
    expect(lobby!.name).not.toMatch(/shit/i);
    renameLobby(lobby!, "fuck");
    expect(lobby!.name).not.toMatch(/fuck/i);
    lobbies.delete(lobby!.id);
  });
});
