'use strict';
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');

/** Preserve the complete JSON tree without constructing one annual-size string. */
function writeJsonEvidence(file, value) {
  const temporary = `${file}.writing-${randomUUID()}`;
  const fd = fs.openSync(temporary, 'wx');
  const ancestors = new Set();
  let chunks = [], characters = 0, closed = false;
  function flush() {
    if (!characters) return;
    const bytes = Buffer.from(chunks.join(''));
    let offset = 0;
    while (offset < bytes.length) {
      const written = fs.writeSync(fd, bytes, offset, bytes.length - offset);
      if (!written) throw new Error('Unable to write JSON evidence');
      offset += written;
    }
    chunks = []; characters = 0;
  }
  function emit(text) {
    chunks.push(text); characters += text.length;
    if (characters >= 65536) flush();
  }
  const omitted = v => v === undefined || typeof v === 'function' || typeof v === 'symbol';
  const prepare = (v, key) => v && typeof v.toJSON === 'function' ? v.toJSON(key) : v;
  function visit(v) {
    if (v === null || typeof v !== 'object') { emit(JSON.stringify(v)); return; }
    if (ancestors.has(v)) throw new TypeError('Circular JSON evidence');
    ancestors.add(v);
    if (Array.isArray(v)) {
      emit('[');
      for (let i = 0; i < v.length; i++) {
        if (i) emit(',');
        const item = prepare(v[i], String(i));
        visit(omitted(item) ? null : item);
      }
      emit(']');
    } else {
      emit('{'); let first = true;
      for (const key of Object.keys(v)) {
        const item = prepare(v[key], key);
        if (omitted(item)) continue;
        if (!first) emit(',');
        first = false; emit(JSON.stringify(key)); emit(':'); visit(item);
      }
      emit('}');
    }
    ancestors.delete(v);
  }
  try {
    const root = prepare(value, '');
    if (omitted(root)) throw new TypeError('Evidence must have a JSON value');
    visit(root); flush(); fs.closeSync(fd); closed = true;
    fs.renameSync(temporary, file);
  } catch (error) {
    if (!closed) fs.closeSync(fd);
    fs.rmSync(temporary, { force: true });
    throw error;
  }
}
module.exports = { writeJsonEvidence };
