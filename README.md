# Tape Reader

Type a message and listen to the two tones carrying its bytes. Introduce noise or erase a short section of the recording, then examine the waveform and the receiver's decisions for each character.

## Run

Open `index.html` directly in a modern browser. No installation, network access, account or microphone is needed. Start with **Damaged tape**, inspect either missing byte, and return **Dropout** to zero. The WAV download contains the current recording.

For a reproducible check with Node.js, run `node test.cjs`.

## Signal path

The recorder accepts printable ASCII text. It renders 24 kHz mono audio at 300 bits per second. A zero uses four cycles of a 1,200 Hz sine wave and a one uses eight cycles at 2,400 Hz. Each byte has a start bit, eight least-significant-first data bits, and two stop bits. The 72-bit leader and 24-bit trailer are short choices for this demonstration. The tone and frame design comes from the provisional cassette data interchange standard published in BYTE, February 1976, printed page 72. [Original article, PDF page 74](https://vintageapple.org/byte/pdf/197602_Byte_Magazine_Vol_00-06_Color_Graphics.pdf#page=74)

The channel mixes deterministic noise with the clean signal. A centered dropout suppresses the carrier over the selected interval. The receiver reads the resulting samples and measures the in-phase and quadrature components at both tone frequencies. It marks a bit unknown when the strongest tone accounts for less than 30% of the window's energy or its lead over the other tone is below 14 percentage points. A missing bit or invalid start/stop sequence makes the whole byte unreadable.

The original text is available to the scoring display only after decoding. Exactly matching bytes count as recovered. An uncertain byte is displayed as □ and a received nonprintable byte as ◇. The hex chips distinguish an unreadable byte (??) from a valid question mark (3F).

The receiver assumes the sample rate, bit clock, leader length and frame boundaries are known. It does not recover timing from arbitrary legacy tapes. The sample rate and carrier frequencies are fixed. Digital noise and a centered dropout model two effects that students can isolate, without claiming to reproduce all analog tape defects.

## Authorship

Created for the November 2026 STEM Innovation Challenge. AI tools assisted with design, implementation, testing and writing. The project generates all signal samples locally. The source includes a second, independently constructed phase-shifted signal generator for testing.
