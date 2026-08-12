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

## The fixture sentence — added 2026-08-13, Sam's words

**One sentence served two different causes and that was the defect.** The
sentence above assumes the athlete rested. When the club's draw is what took the
room, it blamed them for the fixture. Sam, 2026-08-12: *"yeah thats bad
wording"*, and he wrote the replacement himself.

```
With a game [day], there's only room for [n] [type] session(s) this week
```

**It states what FITS, where the sentence above states what is MISSED.** `[n]` is
worded at one and two (`a`/`an`, `two`) and a digit above; `[day]` is the GAME's
day, not a rested day. `session(s)` moves with `[n]`.

Rendered examples:

```
With a game Saturday, there's only room for two strength sessions this week
With a game Sunday, there's only room for a conditioning session this week
```

**FIXTURE-ONLY. Sam ruled it 2026-08-13** when asked directly whether the new
sentence should replace both causes: only the fixture one. **The sentence above
survives untouched for a day the athlete marked themselves**, because "Resting
Friday means you'll miss a strength session this week" is honest when resting
Friday is what they chose — and its digit at two stays as signed.

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
