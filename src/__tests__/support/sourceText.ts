/**
 * Source-text helpers for gates that assert on CODE — TEST SUPPORT ONLY.
 *
 * Several locks in this repo assert that a retired mechanism is gone by
 * scanning a module's source (`!/function estimateFromNamePattern/`). That is
 * deliberate: a behavioural assertion proves no CURRENT input reaches the dead
 * path, but only deleting the code closes it for inputs that do not exist yet.
 *
 * The trap: a well-written module NAMES what it retired, so the next reader
 * knows why it is gone. A bare `includes` reads that explanation as the
 * offence, and the gate fails on its own documentation. This happened twice in
 * one sitting — in the render-truth lock and again in the single-owner lock —
 * which is what this helper exists to stop happening a third time.
 */

/**
 * Strip line and block comments so a source assertion sees only code.
 *
 * Not a parser. It is deliberately conservative: it removes `//` lines, `/* *\/`
 * blocks and continuation lines starting with `*`, which is the whole of this
 * repo's comment style. It does NOT try to understand strings containing
 * comment markers — if a gate ever needs that, it needs a real parser, and the
 * loud way to find out is here rather than in a silently-passing assertion.
 */
export function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      return !t.startsWith('//') && !t.startsWith('*');
    })
    .map((line) => line.replace(/\s\/\/.*$/, ''))
    .join('\n');
}
