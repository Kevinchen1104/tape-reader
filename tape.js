(function () {
  "use strict";
  const rate = 24000, baud = 300, samplesPerBit = rate / baud;
  const leaderBits = 72, tailBits = 24, frameBits = 11;
  const zeroHz = 1200, oneHz = 2400;
  const bases = [zeroHz, oneHz].map(hz => Array.from({length: samplesPerBit}, (_, i) => {
    const angle = 2 * Math.PI * hz * i / rate;
    return [Math.cos(angle), Math.sin(angle)];
  }));

  function encode(message) {
    if (!/^[ -~]{1,32}$/.test(message)) throw new Error("Use 1–32 printable ASCII characters.");
    const bits = Array(leaderBits).fill(1);
    for (const letter of message) {
      bits.push(0);
      for (let i = 0; i < 8; i++) bits.push((letter.charCodeAt(0) >> i) & 1);
      bits.push(1, 1);
    }
    bits.push(...Array(tailBits).fill(1));
    const pcm = new Float32Array(bits.length * samplesPerBit);
    bits.forEach((bit, index) => {
      for (let i = 0; i < samplesPerBit; i++) pcm[index * samplesPerBit + i] = 0.48 * bases[bit][i][1];
    });
    return pcm;
  }

  function damage(source, noisePercent, dropoutMs) {
    let state = 914879;
    function uniform() {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    }
    const pcm = new Float32Array(source.length);
    const dataSamples = source.length - (leaderBits + tailBits) * samplesPerBit;
    const middle = leaderBits * samplesPerBit + Math.floor(dataSamples / 2);
    const width = Math.round(rate * dropoutMs / 1000);
    const start = middle - Math.floor(width / 2);
    const mix = noisePercent / 100;
    for (let i = 0; i < source.length; i++) {
      const signal = i >= start && i < start + width ? 0 : source[i];
      pcm[i] = (1 - mix) * signal + mix * (uniform() * 2 - 1);
    }
    return pcm;
  }

  function readBit(pcm, offset) {
    let power = 0;
    const real = [0, 0], imag = [0, 0];
    for (let i = 0; i < samplesPerBit; i++) {
      const sample = pcm[offset + i];
      power += sample * sample;
      for (let tone = 0; tone < 2; tone++) {
        real[tone] += sample * bases[tone][i][0];
        imag[tone] += sample * bases[tone][i][1];
      }
    }
    if (power < 1e-7) return null;
    const energy = real.map((x, i) => 2 * (x*x + imag[i]*imag[i]) / (samplesPerBit * power));
    const winner = energy[1] > energy[0] ? 1 : 0;
    return energy[winner] >= 0.30 && energy[winner] - energy[1-winner] >= 0.14 ? winner : null;
  }

  function decode(pcm) {
    const payloadBits = pcm.length / samplesPerBit - leaderBits - tailBits;
    if (payloadBits < frameBits || payloadBits % frameBits !== 0) throw new Error("Unexpected tape length.");
    const frames = [];
    for (let base = 0; base < payloadBits; base += frameBits) {
      const bits = Array.from({length: frameBits}, (_, i) =>
        readBit(pcm, (leaderBits + base + i) * samplesPerBit));
      const valid = bits[0] === 0 && bits[9] === 1 && bits[10] === 1 && !bits.includes(null);
      const value = valid ? bits.slice(1, 9).reduce((num, bit, i) => num | (bit << i), 0) : null;
      frames.push({bits, value});
    }
    return frames;
  }

  function wave(pcm) {
    const buffer = new ArrayBuffer(44 + pcm.length * 2);
    const view = new DataView(buffer);
    function tag(at, text) {
      for (let i = 0; i < text.length; i++) view.setUint8(at + i, text.charCodeAt(i));
    }
    tag(0, "RIFF"); view.setUint32(4, buffer.byteLength - 8, true);
    tag(8, "WAVE"); tag(12, "fmt "); view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, rate, true);
    view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    tag(36, "data"); view.setUint32(40, pcm.length * 2, true);
    for (let i = 0; i < pcm.length; i++) {
      view.setInt16(44 + i*2, Math.round(Math.max(-1, Math.min(1, pcm[i])) * 32767), true);
    }
    return buffer;
  }
  const api = {rate, samplesPerBit, leaderBits, frameBits, encode, damage, decode, wave};
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else window.Tape = api;
})();
