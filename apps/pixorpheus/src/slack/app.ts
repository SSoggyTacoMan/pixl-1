import { App, ExpressReceiver } from "@slack/bolt";
import { requireSlackEnv } from "./requiredEnv.js";

const { signingSecret, token } = requireSlackEnv();

export const receiver = new ExpressReceiver({ signingSecret });

export const app = new App({ token, receiver });
