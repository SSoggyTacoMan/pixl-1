import { describe, expect, test } from "bun:test";
import { applyVote, sortByVotes, type SttEntry } from "./stt-lib";

const e = (id: number, voteCount: number, votedByMe = false): SttEntry => ({
  id,
  voteCount,
  votedByMe,
  isOwn: false,
});

describe("show & tell votes", () => {
  test("voting moves a prior vote instead of stacking", () => {
    const next = applyVote([e(1, 3, true), e(2, 1)], 2, true);
    expect(next).toEqual([e(1, 2, false), e(2, 2, true)]);
  });

  test("withdrawing a vote drops only that entry", () => {
    const next = applyVote([e(1, 3, true), e(2, 1)], 1, false);
    expect(next).toEqual([e(1, 2, false), e(2, 1)]);
  });

  test("repeating the same state is a no-op", () => {
    const list = [e(1, 3, true)];
    expect(applyVote(list, 1, true)).toEqual(list);
  });

  test("sorts most voted first without mutating", () => {
    const list = [e(1, 1), e(2, 5)];
    expect(sortByVotes(list).map((x) => x.id)).toEqual([2, 1]);
    expect(list[0].id).toBe(1);
  });
});
