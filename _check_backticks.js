const fs = require('fs');
const src = fs.readFileSync('supabase/functions/coach-chat/index.ts', 'utf8');
const lines = src.split('\n');
// Extract from line 77 to first standalone `;` after line 800
let start = -1;
for (let i = 0; i < lines.length; i++) {
  if (/^const SYSTEM_PROMPT = `/.test(lines[i])) { start = i; break; }
}
let end = -1;
for (let i = start + 1; i < lines.length; i++) {
  if (lines[i].endsWith('`;')) { end = i; break; }
}
console.log('SYSTEM_PROMPT lines', start + 1, '-', end + 1);
const block = lines.slice(start, end + 1).join('\n');
try {
  // Wrap in a function so we can parse it as JS
  new Function(block);
  console.log('PARSED OK');
} catch (e) {
  console.log('PARSE FAILED:', e.message);
}
