import { Fragment } from "react";
import type { Rich } from "./steps";

/** Renders tour copy as React elements (bold runs, line breaks), no HTML strings. */
export function RichText({ value }: { value: Rich }) {
  return (
    <>
      {value.map((part, i) =>
        typeof part === "string" ? (
          <Fragment key={i}>{part}</Fragment>
        ) : "b" in part ? (
          <b key={i}>{part.b}</b>
        ) : (
          <Fragment key={i}>
            <br />
            <br />
          </Fragment>
        ),
      )}
    </>
  );
}
