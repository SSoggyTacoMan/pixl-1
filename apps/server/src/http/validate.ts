import type { NextFunction, Request, RequestHandler, Response } from "express";
import { z, type ZodType } from "zod";

export interface RequestSchemas {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

// Runs before a write handler: each part of the request that has a schema is
// parsed with it and replaced by the parsed value (unknown object keys are
// stripped, so a handler only ever sees fields the schema names). Anything
// that doesn't parse is a 400 before the handler runs. The error lists which
// fields failed, never the values that were sent.
export function validate(schemas: RequestSchemas): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const issues: { part: string; path: string; message: string }[] = [];
    const parsed: Partial<Record<keyof RequestSchemas, unknown>> = {};
    for (const part of ["params", "query", "body"] as const) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part]);
      if (result.success) parsed[part] = result.data;
      else
        for (const issue of result.error.issues)
          issues.push({ part, path: issue.path.map(String).join("."), message: issue.message });
    }
    if (issues.length > 0) {
      res.status(400).json({ ok: false, error: "invalid_request", issues: issues.slice(0, 20) });
      return;
    }
    if ("body" in parsed) req.body = parsed.body;
    if ("params" in parsed) req.params = parsed.params as Request["params"];
    // req.query is a getter in newer Express; define it on the request.
    if ("query" in parsed)
      Object.defineProperty(req, "query", { value: parsed.query, writable: true, configurable: true, enumerable: true });
    next();
  };
}

// Shared building blocks for route schemas.
export const v = {
  // A positive integer id in the path, as Express hands it over (a string).
  id: z.string().regex(/^[1-9][0-9]{0,15}$/, "must be a positive integer"),
  uuid: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "must be a uuid"),
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/i, "invalid slug"),
  // A JSON number, or a numeric string the old clients sent.
  num: z.union([z.number().finite(), z.string().max(32)]),
  text: (max: number) => z.string().max(max),
  // A JSON body with no fields. Unknown keys are stripped.
  empty: z.object({}).optional().default({}),
  // A query string with no parameters. Unknown keys are stripped.
  noQuery: z.object({}),
};

export function params<T extends Record<string, ZodType>>(shape: T) {
  return z.object(shape);
}

// Optional body fields. Handlers still apply their own trimming, clamping
// and friendly error codes (e.g. name_required); these bound the type and
// size of what can reach them at all.
export const optStr = (max: number) => z.string().max(max).nullable().optional();
export const optBool = z.boolean().nullable().optional();
export const optNum = v.num.nullable().optional();
