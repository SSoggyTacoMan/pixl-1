// Privacy contract: the internal dashboard deanonymizes serial reporters to
// reviewers at its repeat threshold, so the form must never promise
// unconditional anonymity. copy.test.ts pins this wording in place.
export const ANON_LABEL =
  "Report anonymously, the review team won't be shown who you are. Filing repeated reports reveals your name to reviewers so report spam can be caught. Uncheck to reveal your name to them.";

/** Anonymous is the default. */
export const ANON_DEFAULT = true;
