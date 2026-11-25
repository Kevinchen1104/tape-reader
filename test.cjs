const assert = require('node:assert/strict');
const tape = require('./tape.js');
const values = pcm => tape.decode(pcm).map(x => x.value);
const chars = s => Array.from(s, c => c.charCodeAt(0));
let cases = 0;
function equal(a, b) { assert.deepEqual(a, b); cases++; }
for (let code = 32; code < 127; code++) {
  const sound = tape.encode(String.fromCharCode(code));
  equal(values(sound), [code]);
  equal(values(tape.damage(sound, 20, 0)), [code]);
}
for (const input of ['', 'a'.repeat(33), 'é', 'Hi\nthere']) {
  assert.throws(() => tape.encode(input)); cases++;
}
const sample = 'HELLO TAPE', clean = tape.encode(sample);
equal(values(tape.damage(clean, 15, 52)), [72,69,76,76,null,null,84,65,80,69]);
equal(values(tape.damage(clean, 100, 0)), Array(10).fill(null));
equal(values(tape.encode('A'.repeat(32))), Array(32).fill(65));
// Independently construct a quadrature-phase source at a different amplitude.
// No calls to encode(), and the payload is unknown to the receiver.
for (let value = 0; value <= 255; value++) {
  const cells = Array(72).fill(1).concat([0], Array.from({length:8}, (_, i) => (value >>> i) & 1), [1,1], Array(24).fill(1));
  const pcm = Float32Array.from({length:cells.length*80}, (_, i) => .19 * Math.cos(2*Math.PI*(cells[Math.floor(i/80)] ? 2400 : 1200)*i/24000 + .37));
  equal(values(pcm), [value]);
}
const brokenFrame = tape.encode('X');
brokenFrame.fill(0, (72 + 9) * 80, (72 + 10) * 80);
equal(values(brokenFrame), [null]);
// Swap an entire, readable tone into a framing cell of the opposite value.
for (const [target, donor] of [[0, 9], [9, 0]]) {
  const pcm = tape.encode('X');
  const start = (tape.leaderBits + donor) * tape.samplesPerBit;
  const end = start + tape.samplesPerBit;
  pcm.copyWithin((tape.leaderBits + target) * tape.samplesPerBit, start, end);
  equal(values(pcm), [null]);
}
// A valid alternative byte must be reported as received, regardless of the original.
const changed = tape.encode('A'), other = tape.encode('B');
changed.set(other.subarray(72*80,(72+11)*80),72*80);
equal(values(changed), chars('B'));
const wav = Buffer.from(tape.wave(clean));
equal(wav.toString('ascii', 0, 4), 'RIFF');
equal(wav.readUInt32LE(24), 24000);
equal(wav.readUInt32LE(40), clean.length*2);
const restored = Float32Array.from({length:clean.length},(_,i) => wav.readInt16LE(44+2*i)/32767);
equal(values(restored), chars(sample));
console.log(cases + ' checks passed.');
