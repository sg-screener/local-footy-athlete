# %MAS: range or binary? — decision sheet for Sam, 2026-08-04

**The Stage B draft's day-one question** (`docs/STAGE_B_PROMPT_DRAFT_2026-07-29.md`
§Scope 6): *"the range-vs-binary %MAS conflict — template rows carry '90–100%
MAS' ranges; masCopy.ts carries a binary ≤30s→110%/'>30s→100%' rule; two
representations of one intensity — present the options, Sam picks the owner."*

**Nothing is decided here.** Options, consequences, and a recommendation, for
your ruling.

---

## 1. The conflict, exactly

**Representation A — the binary rule.** `src/utils/masCopy.ts:27-29`:

```ts
export function masIntensityForWorkSeconds(workSeconds: number): 100 | 110 {
  return workSeconds <= 30 ? 110 : 100;
}
```

Docstring `:8-18` states it as *the* rule, with worked examples (15s → 110%,
4 min → 100%). Consumed by `masIntensityLabel` (`:32-34`) and
`masIntensityBlock` (`:53-62`), which compose athlete-facing description text.

**Representation B — the authored template rows.**
`src/data/conditioningTemplates.ts`, fifteen `intensity` strings. A sample:

| Line | String |
|---|---|
| `:851`, `:868` | `90–100% MAS; HR 90–95% max late` |
| `:885` | `≈100% MAS (>30 s work = 100% MAS per src/utils/masCopy.ts)` |
| `:902` | `110% MAS (15 s work per masIntensityForWorkSeconds, src/utils/masCopy.ts)` |
| `:919` | `100–110% MAS — hard and repeatable` |
| `:953` | `90–100% MAS — even splits` |
| `:1006`–`:1159` | the aerobic band: `65–80% MAS`, `70–80% MAS`, `65–75% MAS`, … |

**Where they actually disagree.** On short work they agree (`:902` says 110%
for 15s work; so does the binary). The disagreement is on **everything longer**,
and it is a disagreement of *kind*, not just value: the binary returns a single
number, the templates prescribe a **band**. For *Classic 4×4* the template says
90–100% MAS; the binary says exactly 100%. The binary sits at the **top** of the
authored band — i.e. it is systematically the hardest reading of every range.

**Two template rows cite the binary by path/symbol** (`:885`, `:902`). Those are
prose citations inside an authored string, not a data dependency.

## 2. Why nothing is broken yet — and what changes that

`deriveMas` (`src/data/twoKmTimeTrial.ts:156-170`, the one MAS owner, multiplier
ruled 1.00 at `:104`) currently has **zero consumers in the generation path**.
A grep outside tests hits only a comment (`screens/onboarding/reviewRows.ts:194`).

So today both representations are **display strings**. `masCopy.ts:97-101` says
this against itself: *"Nothing breaks while both are only rendered as text; the
moment MAS is a real number they are two representations of one intensity."*

**The moment Stage B renders per-athlete paces** — which the draft requires
(§Scope 6: paces on BOTH fresh generation and stored-program rendering) — the
app must turn a %MAS into a number. That is when it must pick one, and picking
badly means **the number the app computes contradicts the words the athlete
reads on the same card.**

## 3. The provenance asymmetry (measured this session)

This is the single most decision-relevant fact, and it was not in the draft:

- **The template intensity strings are EQUALITY-GATED to your signed xlsx.**
  `src/__tests__/conditioningTemplateEqualityTests.ts` maps the sheet's
  `Intensity` column to the code's `intensity` field (`:172`) and includes it in
  the compared set (`:233`). Changing one without the other fails the build.
- **The binary rule has no anchor.** No `bible_anchor` or `ruling_anchor`
  reference in `masCopy.ts`, and no MAS entry in
  `src/data/bibleThresholdAnchors.ts`. The 30-second threshold and the 110/100
  values are **code, not authored data**, under the standing law *"No invented
  numbers… every athlete-affecting number arrives authored or not at all."*

That does not automatically make the binary wrong — you may have ruled it
verbally and it simply never got an anchor. **That is the first thing to
confirm, because it changes the weight of everything below.**

## 4. The options

### Option A — the authored range is the owner; the binary retires

The template `intensity` string becomes the single source; `masIntensityForWorkSeconds`
is deleted (or demoted to a pure copy helper with no prescriptive role). A %MAS
row carries a typed band parsed once at Stage B's single dose ingress.

- **For:** the owner becomes the artefact you signed and the gate already
  guards. The ranges survive, and they carry real programming nuance a binary
  cannot (90–100% across a 4×4 is a prescription, not an approximation). Kills
  the second representation outright — the north star's shape.
- **Against:** needs a typed parse of a field that is free text today, and your
  Stage A law is *one* typed dose-string parse at a single ingress — so this
  must join that parser, not add a second. The two rows citing masCopy (`:885`,
  `:902`) need re-authoring so they stop pointing at a retired owner.

### Option B — the binary is the owner; ranges become display prose

`masIntensityForWorkSeconds` computes the prescription; the template's range
string stays as words the athlete reads.

- **For:** zero parsing work, already written, deterministic, ships fastest.
- **Against:** it **keeps both representations forever**, one of which is
  athlete-visible and can contradict the computed number on the same card —
  precisely the "projections disagreeing with outputs" defect class the north
  star lists. It also promotes an unanchored code constant above a signed,
  gated sheet, and it silently hardens every band to its top value.

### Option C — the range is the owner AND the app never needs a point value

Option A, plus the observation that **a %MAS band renders naturally as a pace
band**: "run this at 3:45–4:10/km". If what the athlete sees is a range, nothing
in the app ever has to collapse the band, and the binary is not *overruled* so
much as *unnecessary*.

- **For:** removes the conflict by removing the need to arbitrate it. Keeps
  your authored nuance end to end. Honest about a prescription that genuinely
  is a band.
- **Against:** every consumer must handle two numbers (rendering, and any future
  target/compliance maths). If anything downstream truly needs one scalar, this
  defers rather than answers — and the rule for collapsing would then need
  authoring anyway. Slightly more UI surface than a single figure.

## 5. Recommendation

**Option C, falling back to Option A if a scalar turns out to be needed.**

The reasoning:

1. **Provenance decides it on the current evidence.** One representation is
   yours, signed, and equality-gated; the other is unanchored code. The standing
   law says the authored artefact wins unless you rule otherwise.
2. **The cost of choosing now is zero and falling.** The conflict is latent —
   `deriveMas` has no generation consumers yet — so the owner can be fixed
   *before* anything computes a number. Deciding after the pace layer exists
   means converting live athlete-facing output instead of choosing a source.
3. **A band is what you actually authored.** Eleven of the fifteen rows are
   ranges. Collapsing them to a point value is a programming decision the code
   would be making on your behalf, and always in the same direction — hardest
   end of the band.
4. **The binary is not lost.** If a scalar is ever required, "top of the
   authored band" reproduces today's binary exactly for every row where they
   agree — so Option A remains reachable from Option C without re-authoring
   anything.

**The one thing that would change this recommendation:** if you ruled the
≤30s/110% rule as programming law and it merely never got an anchor, then it is
authored too, and the question becomes which authored source is more specific
rather than authored-vs-invented. In that case Option B's cost drops sharply —
though it still leaves two representations, so it would want the template
strings re-authored to match rather than left contradicting.

## 6. What we need from you

1. **Did you author the ≤30s → 110% / >30s → 100% rule as programming law?**
   (This is the load-bearing question — everything else follows from it.)
2. **Which owner** — A, B, or C?
3. If a band must ever collapse to one number, **what is the rule** — top,
   midpoint, or something session-dependent? Nothing collapses a band until you
   say how.

## 7. Not covered

- The 23 PENDING conditioning cues and the Easy Swim cue are a **separate**
  open question from the same draft §Scope 8 — not folded in here.
- `MAS_FALLBACK_NOTE` copy (`masCopy.ts:41-42`, *"Don't know MAS? Send your 2km
  or 3km time trial."*) is flagged in the draft for your sign-off as
  athlete-facing copy. Unchanged and unproposed here.
- No measurement of how many *sessions* (as opposed to template rows) each
  representation would affect in a real week — that needs the pace layer to
  exist.
