import { describe, expect, test } from "bun:test";
import { humanizeError } from "@/lib/errors";
import { postError } from "./ideas-lib";

describe("ideas error copy", () => {
  test("an off-CDN idea image says to re-upload", () => {
    expect(postError("invalid_image_url")).toBe("Images must be uploaded through Pixl (re-upload this image).");
  });
  test("the global fallback knows the new server codes too", () => {
    expect(humanizeError("invalid_image_url")).toContain("uploaded through Pixl");
    expect(humanizeError("busy")).toBe("Uploads are busy, try again in a moment.");
    expect(humanizeError("removed")).toBe("You were removed from this project.");
  });
});
