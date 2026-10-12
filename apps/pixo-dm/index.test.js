// Run with `node --test` (or `bun test`). CommonJS on purpose, like index.js.
const test = require("node:test");
const assert = require("node:assert/strict");

process.env.EXTERNAL_API_KEY = "test-key-123";
process.env.SLACK_BOT_TOKEN = "xoxb-test";
const { app, validateDmRequest } = require("./index.js");

test("accepts a user id and plain text", () => {
  assert.deepEqual(validateDmRequest({ userId: " U0ABC12345 ", message: " hi there " }), {
    target: "U0ABC12345",
    text: "hi there",
  });
  assert.equal(validateDmRequest({ userId: "W0ABC12345", message: "hi" }).target, "W0ABC12345");
  assert.equal(validateDmRequest({ userId: "U0ABC12345", message: "see https://pixl.hackclub.com" }).error, undefined);
});

test("rejects channel ids and malformed user ids", () => {
  for (const userId of ["C0ABC12345", "G0ABC12345", "D0ABC12345", "U123", "u0abc12345", "<@U0ABC12345>", 42, null]) {
    assert.ok(validateDmRequest({ userId, message: "hi" }).error, String(userId));
  }
});

test("rejects Slack control syntax in the message", () => {
  for (const message of [
    "<!channel> hi",
    "<!here|here>",
    "<!everyone>",
    "<!subteam^S123|@team>",
    "click <https://evil.com|pixl.hackclub.com>",
    "<http://evil.com>",
    "<mailto:a@b.co|support>",
    "< https://evil.com>",
    "<slack://open>",
  ]) {
    assert.equal(validateDmRequest({ userId: "U0ABC12345", message }).status, 400, message);
  }
});

test("rejects missing, non-string and oversized messages", () => {
  assert.equal(validateDmRequest(null).status, 400);
  assert.equal(validateDmRequest({ userId: "U0ABC12345", message: { toString: () => "x" } }).status, 400);
  assert.equal(validateDmRequest({ userId: "U0ABC12345", message: "a".repeat(3001) }).status, 400);
});

test("HTTP: wrong key is 401, bad body is 400, before any Slack call", async () => {
  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}/api/external/dm`;
  const realFetch = global.fetch;
  let slackCalls = 0;
  try {
    const post = (headers, body) =>
      realFetch(base, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
    global.fetch = async (url, init) => {
      if (String(url).startsWith("https://slack.com")) {
        slackCalls++;
        return { json: async () => ({ ok: true }) };
      }
      return realFetch(url, init);
    };
    assert.equal((await post({ "x-api-key": "wrong-key-12" }, { userId: "U0ABC12345", message: "hi" })).status, 401);
    assert.equal((await post({}, { userId: "U0ABC12345", message: "hi" })).status, 401);
    assert.equal((await post({ "x-api-key": "test-key-123" }, { userId: "C0ABC12345", message: "hi" })).status, 400);
    assert.equal((await post({ "x-api-key": "test-key-123" }, { userId: "U0ABC12345", message: "<!channel>" })).status, 400);
    assert.equal(slackCalls, 0);
    assert.equal((await post({ "x-api-key": "test-key-123" }, { userId: "U0ABC12345", message: "hi" })).status, 200);
    assert.equal(slackCalls, 1);
  } finally {
    global.fetch = realFetch;
    server.close();
  }
});
