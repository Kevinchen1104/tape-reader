"use strict";
const $ = id => document.getElementById(id);
const monitor = $("scope"), channel = monitor.getContext("2d");
const controls = ["message", "noise", "drop"].map($);
let recording = null, frames = [], selected = 0, source = null, audio = null;
const hex = value => value === null ? "??" : value.toString(16).toUpperCase().padStart(2, "0");
const symbol = value => value === null ? "□" : (value < 32 || value > 126 ? "◇" : String.fromCharCode(value));

function stopAudio() {
  if (source) { source.onended = null; source.stop(); source = null; }
  $("play").textContent = "▶ Play tape";
}

function draw() {
  const w = monitor.clientWidth, h = monitor.clientHeight, ratio = window.devicePixelRatio || 1;
  if (!w || !h) return;
  monitor.width = Math.round(w * ratio); monitor.height = Math.round(h * ratio);
  channel.setTransform(ratio, 0, 0, ratio, 0, 0);
  channel.fillStyle = "#191c19"; channel.fillRect(0, 0, w, h);
  channel.lineWidth = 1; channel.strokeStyle = "#796739"; channel.beginPath();
  for (let i = 0; i <= 11; i++) { const x = i * w / 11; channel.moveTo(x, 0); channel.lineTo(x, h); }
  for (let i = 1; i < 4; i++) { const y = i * h / 4; channel.moveTo(0, y); channel.lineTo(w, y); }
  channel.stroke();
  if (!recording) return;
  const length = Tape.frameBits * Tape.samplesPerBit;
  const offset = (Tape.leaderBits + selected * Tape.frameBits) * Tape.samplesPerBit;
  channel.beginPath();
  for (let i = 0; i < length; i++) {
    const x = i / (length - 1) * w, y = h / 2 - recording[offset + i] * h * .47;
    if (i === 0) channel.moveTo(x, y); else channel.lineTo(x, y);
  }
  channel.strokeStyle = "#ff8235"; channel.lineWidth = w < 500 ? 1.15 : 1.8; channel.stroke();
}

function inspect(index) {
  selected = index;
  $("inspect").value = String(index);
  Array.from($("bytes").children).forEach((chip, n) => chip.setAttribute("aria-pressed", String(n === index)));
  $("bitrow").replaceChildren();
  if (frames[index]) {
    frames[index].bits.forEach((bit, n) => {
      const cell = document.createElement("span");
      const role = n === 0 ? "Start" : n > 8 ? "Stop" : "Bit " + (n - 1);
      cell.textContent = bit === null ? "?" : String(bit);
      cell.title = role + " = " + (bit === null ? "unreadable" : bit);
      cell.setAttribute("aria-label", cell.title);
      $("bitrow").append(cell);
    });
  }
  draw();
}

function update(focusDamage = false) {
  stopAudio();
  const message = $("message").value, noise = Number($("noise").value), drop = Number($("drop").value);
  $("noise-out").value = noise + "%"; $("drop-out").value = drop + " ms";
  $("inspect").replaceChildren(); $("bytes").replaceChildren();
  try {
    recording = Tape.damage(Tape.encode(message), noise, drop);
    frames = Tape.decode(recording);
    $("error").textContent = "";
    $("message").removeAttribute("aria-invalid");
  } catch (error) {
    recording = null; frames = [];
    $("error").textContent = error.message;
    $("message").setAttribute("aria-invalid", "true");
  }
  for (const name of ["save", "play", "inspect"]) $(name).disabled = !recording;
  $("decoded").textContent = frames.map(frame => symbol(frame.value)).join("");
  const recovered = frames.filter((frame, i) => frame.value === message.charCodeAt(i)).length;
  $("summary").textContent = recording ? recovered + " of " + frames.length + " bytes recovered" : "";
  frames.forEach(({value}, i) => {
    const matched = value === message.charCodeAt(i);
    const chip = document.createElement("button");
    chip.textContent = hex(value); chip.className = matched ? "" : "bad";
    chip.title = "Byte " + (i + 1) + " (" + (value === null ? "unreadable" : (matched ? "recovered" : "mismatch")) + ")";
    chip.setAttribute("aria-label", chip.title + ", " + hex(value));
    chip.addEventListener("click", () => inspect(i));
    $("bytes").append(chip);
    $("inspect").add(new Option(String(i + 1).padStart(2, "0") + " [" + hex(value) + "]", i));
  });
  const firstLost = focusDamage ? frames.findIndex((f, i) => f.value !== message.charCodeAt(i)) : -1;
  inspect(firstLost >= 0 ? firstLost : Math.max(0, Math.min(selected, frames.length - 1)));
}

$("play").addEventListener("click", async () => {
  if (source) { stopAudio(); return; }
  const tape = recording;
  if (!tape) return;
  try {
    audio ||= new AudioContext();
    await audio.resume();
    if (recording !== tape || source) return;
    const buffer = audio.createBuffer(1, tape.length, Tape.rate);
    buffer.copyToChannel(tape, 0);
    const player = audio.createBufferSource(), volume = audio.createGain();
    volume.gain.value = .24; player.buffer = buffer; player.connect(volume); volume.connect(audio.destination);
    source = player;
    player.onended = () => { if (source === player) { source = null; $("play").textContent = "▶ Play tape"; } };
    player.start(); $("play").textContent = "■ Stop tape";
  } catch { $("error").textContent = "Playback is unavailable here. Download the WAV to listen."; }
});
$("save").addEventListener("click", () => {
  if (!recording) return;
  const link = document.createElement("a");
  const url = URL.createObjectURL(new Blob([Tape.wave(recording)], {type:"audio/wav"}));
  link.href = url; link.download = "tape-reader.wav"; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$("inspect").addEventListener("change", e => inspect(Number(e.target.value)));
controls.forEach(el => el.addEventListener("input", () => update()));
$("clean").addEventListener("click", () => { $("noise").value = 0; $("drop").value = 0; update(); });
$("damaged").addEventListener("click", () => { $("noise").value = 15; $("drop").value = 52; update(true); });
$("help").addEventListener("click", () => $("guide").showModal());
$("close-help").addEventListener("click", () => $("guide").close());
window.addEventListener("resize", draw);
update();
