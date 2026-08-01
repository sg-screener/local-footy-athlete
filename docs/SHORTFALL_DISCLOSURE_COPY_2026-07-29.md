# Shortfall disclosure — signed copy and the vocabulary rule

Sam signed these on 2026-07-29, with the accept-and-reduce ruling. They are
equality-bound in both directions by `section18ShortfallCopyTests`: the string
here and the string in `rules/section18ShortfallDisclosure.ts` must agree, and
neither may drift without the other. Same regime as the G-1 warning copy.

## The sentence

```
Resting [day] means you'll miss [a/n] [type] session(s) this week
```

`[a/n]` is the count: `a` (or `an`) when it is one session, the number
otherwise. `session(s)` moves with it. `[day]` is the weekday name. `[type]` is
the athlete's word for the training the week is now short of.

Rendered examples:

```
Resting Tuesday means you'll miss a strength session this week
Resting Friday means you'll miss 2 conditioning sessions this week
```

## The vocabulary ruling

**The word "exposure" never reaches an athlete.** It is the contract layer's
noun for a required dose and it means nothing to the person reading it.
Athlete-facing copy says "session" or "sessions".

This is bound as a RULE, not as a property of this one string:
`ATHLETE_FORBIDDEN_VOCABULARY` in `rules/section18ShortfallDisclosure.ts` is the
enforceable list, and the gate reads that list rather than this document. A
contract domain with no athlete word is DROPPED from the disclosure rather than
rendered by its internal name — a sentence containing `anchor_credit` is a raw
code reaching the athlete, which the honest-outcome law already forbids.
