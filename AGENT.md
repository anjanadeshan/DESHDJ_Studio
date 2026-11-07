# AGENT.MD — DESHDJ STUDIO KNOWLEDGE BASE

> **Project**: DESHDJ Studio (Professional Web-Based DJ Mixing Suite)  
> **Repository Root**: `d:\projects\DJ`  
> **Author & Engine**: Antigravity Pair-Programming Suite  
> **Last Updated**: November 2026  

---

## 1. Project Overview & Identity

**DESHDJ Studio** is a browser-based, pro-grade DJ software suite engineered to emulate the tactile workflow, digital signal processing (DSP), and responsiveness of industry-standard Pioneer CDJ multi-players and DJM mixers (e.g., CDJ-3000 & DJM-900NXS2).

### Key Pillars
- **Zero Cloud Dependency**: Music files are read directly from local PC directories via the File System Access API or drag-and-drop. Audio never leaves the client.
- **True Real-Time Web Audio DSP**: Custom low-latency Web Audio API graph with post-fader Beat FX send/return routing, Pioneer CDJ-style cueing, vinyl scratching, and momentum-based CDJ pitch blending.
- **60 FPS Hardware-Accelerated Waveforms**: Direct Canvas rendering reading the audio hardware clock for stacked, frame-accurate RGB spectral waveforms.
- **Persistent Local Crate**: IndexedDB metadata caching (`idb-keyval`) and fast waveform peak storage.
- **Responsive 2-Deck & 4-Deck Modes**: Default uncluttered 2-deck layout with toggleable 4-deck flip support ($A \leftrightarrow C$ on left, $B \leftrightarrow D$ on right).

---

## 2. Tech Stack & Dependencies

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Framework** | React 19 + TypeScript 5.8 | Component architecture and type-safe state management |
| **Bundler / Dev Server**| Vite 8 (`@vitejs/plugin-react`) | Rapid HMR, production bundling with Rolldown/ESBuild |
| **Styling** | Tailwind CSS v4 (`@tailwindcss/vite`) | Dark-mode console styling, hardware-accurate ergonomics |
| **Audio Engine** | Web Audio API (Native Browser DSP) | Zero-latency synthesis, biquad filters, delay lines, stereo panning |
| **Metadata Parsing** | `music-metadata-browser` | ID3, Vorbis, MP4/AAC tag extraction, APIC embedded album art |
| **Local Storage** | `idb-keyval` (IndexedDB wrapper) | Persistent crate storage and cached waveform peak arrays |
| **Iconography** | `lucide-react` | Transport icons, mixer dials, crate folder triggers |
| **Unit Testing** | Vitest | Audio math, formatters, BPM detection, and phase continuity tests |

---

## 3. Audio Engine Architecture & DSP Signal Flow

### 3.1 Global Audio Graph (`src/audio/AudioEngine.ts`)

```
[Deck A AudioNode] --- masterSend ---> [Crossfader Bus A] ---\
[Deck C AudioNode] --- masterSend ---/                       \
                                                              +--> [Master Gain] ---> [Master Analyser] ---> [ctx.destination]
[Deck B AudioNode] --- masterSend ---> [Crossfader Bus B] ---/          |
[Deck D AudioNode] --- masterSend ---/                                 v
                                                               [Headphone Master Gain]
                                                                        |
[Deck A/B/C/D Cue] --- cueSend -------> [Central Cue Gain] ----------> [Headphone Cue Gain]
                                                                        |
                                                                        v
                                                          [Headphone Output Gain] -> (Headphones)
```

- **Crossfader Curves**:
  - `smooth`: Constant-power crossfade ($gain_A = \cos(x)$, $gain_B = \sin(x)$ where $x = \frac{pos + 1}{4}\pi$).
  - `scratch`: Sharp cut curve (full gain across 90% of range, instant cut at extreme $\pm0.92$).
- **Headphone Monitoring & Split Cue**:
  - Stereo blend ($0\% = 100\%\text{ Cue}$, $100\% = 100\%\text{ Master}$).
  - Split Cue: PFL Cue routed hard-left, Master routed hard-right for 1-ear headphone mixing.

---

### 3.2 Per-Deck Signal Flow (`src/audio/DeckAudioNode.ts`)

```
[AudioBufferSourceNode]
         |
         v
    [inputGain]
         |
         v
   [lowShelf 250Hz] (-26dB to +6dB, Kill: -70dB)
         |
         v
   [midPeak 1200Hz] (-26dB to +6dB, Kill: -70dB)
         |
         v
  [highShelf 3500Hz] (-26dB to +6dB, Kill: -70dB)
         |
         v
   [colorFilter] (Bi-polar: < 0 Lowpass, > 0 Highpass, 0 Allpass)
         |
         v
    [trimGain] (0.0 to 2.0 pre-gain)
         |
         +-----------------------------------\
         | (Dry Path)                         |
         v                                    v
    [dryGain (1.0)]                  (Post-Fader Send Tap)
         |                                    |
         v                                    |
   [volumeGain] (Channel Fader)               |
         |                                    |
         +----------------------------------> [fxSendGain]
         |                                    |
         +----------------> [panner]          v
         |                     ^          [Active FX Insert]
         v                     |          (Echo / Reverb / Flanger / Crush)
    [analyser]                 |              |
    (Channel VU)               |              v
                               +--------- [fxReturnGain] (Direct Return)
                                              |
                                              v
                                         [panner]
                                         /      \
                             [masterSend]        [cueSend]
```

---

### 3.3 Post-Fader Send/Return FX Architecture ("Echo Out")
On professional DJ mixers (DJM-900NXS2, DJM-V10), Beat FX are routed **post-fader**:
1. **Send Tap**: Input into the FX processor is tapped **after** the channel volume fader (`volumeGain.connect(fxSendGain)`).
2. **Wet Return Tap**: Output from the FX returns **directly to the panner / master bus** (`fxReturnGain.connect(panner)`), bypassing the channel fader entirely.
3. **Behavior on Fader Drop**: When the DJ slams the channel fader to zero:
   - Dry music cuts to zero immediately.
   - `fxSendGain` stops receiving audio, preventing new audio from entering the delay line.
   - **Crucially**: Audio already circulating in the delay line continues to loop through `EchoEffect`'s feedback node and outputs directly through `fxReturnGain -> panner -> masterSend`.
   - Result: Authentic dub "echo out" tail that smoothly decays over 5–6 seconds with warm 3200 Hz analog tape damping.

---

### 3.4 Audio Clock & Playback Rate Continuity
A critical discovery in Web Audio DJ programming:
- If a deck's elapsed position is calculated as `(ctx.currentTime - startContextTime) * currentPlaybackRate`, changing `playbackRate` mid-track multiplies the **entire accumulated track duration** by the new rate, causing the playhead to violently jump forward or backward by several seconds.
- **The Solution** implemented in `setPlaybackRate(rate)`:
  ```ts
  if (this.isPlaying && this.source) {
    this.offset = this.getCurrentTime()
    this.startContextTime = this.ctx.currentTime
    this.currentPlaybackRate = clampedRate
    this.source.playbackRate.setTargetAtTime(clampedRate, this.ctx.currentTime, 0.02)
  }
  ```
  Accumulating `this.offset = getCurrentTime()` ensures **100% mathematical phase continuity**: the audio never jumps or clicks, enabling seamless CDJ pitch blending and tempo nudges.

---

## 4. Hardware-Inspired Deck & Jog Wheel Behaviors

### 4.1 CDJ Mode vs. Vinyl Mode (`src/components/deck/JogWheel.tsx`)

| Behavior | Vinyl Mode (`vinylMode = true`) | CDJ Mode (`vinylMode = false`) |
| :--- | :--- | :--- |
| **Platter Touch (Playing)** | Stops playback instantly, grabs virtual slipmat. Direct needle scratch. | **Does NOT stop playback**. Enables smooth momentum pitch blend. |
| **Spinning Platter (Playing)** | Scratches audio backwards/forwards with realistic scrub grain. | **Pitch bends playback rate** ($\pm 2\%$ to $\pm 20\%$) to "catch" and lock the beat with the other deck. |
| **Releasing Platter** | Playback resumes from scratch release position. | Pitch bend exponentially decays back to normal tempo ($k=0.85$ per frame) over ~150ms. Track timing is untouched. |
| **Platter Spin (Paused)** | Scrubs playhead, plays brief transient grains (~60ms), leaves track paused. | Frame-by-frame transient cue search to find the kick drum beat. |
| **Outer Rim Drag** | Pitch bend nudge ($\pm 5\%$). | Pitch bend nudge ($\pm 5\%$). |

---

### 4.2 Pioneer CDJ Cue System
- **When Playing**: Pressing `CUE` pauses playback immediately and jumps the playhead back to the stored cue point.
- **When Paused (Moved Away from Cue)**: If the playhead has been scrubbed to a new position using the jog wheel or waveform seek, pressing `CUE` sets this new location as the active cue point.
- **When Paused (At Cue Position)**:
  - Holding down `CUE` triggers CDJ stutter preview (plays from cue point while button is held).
  - Releasing `CUE` jumps back to the cue point and stops.
  - Pressing `PLAY` while holding `CUE` continues playback smoothly without resetting.

---

### 4.3 Intelligent Beat Sync Engine
- **Multi-Ratio BPM Matching**: Automatically evaluates $1:1$, $0.5\times$ (half-time), and $2.0\times$ (double-time) ratios to find the minimum pitch shift. For example, a 174 BPM Drum & Bass track syncs to an 87 BPM track at $1.0\times$ rather than $+100\%$.
- **Shortest-Distance Phase Alignment**: Computes minimal modulo beat phase difference bounded strictly within $[-\frac{\text{beat}}{2}, +\frac{\text{beat}}{2}]$. Snaps to the nearest kick drum without ever leaping full beats backward or forward.
- **Active Master Tempo Tracking**: When Deck A is Master and Deck B has `sync: true`, adjusting Deck A's pitch slider dynamically updates Deck B in real time. Moving Deck B's slider manually disengages sync to return to manual control.
- **Quantized Play on Synced Deck**: Hitting `PLAY` on a paused synced deck starts playback aligned to the exact millisecond beat phase of the playing master deck.
- **Toggleable**: Pressing `SYNC` toggles sync ON and OFF.

---

### 4.4 Smart Loop & Pioneer CDJ Out / Exit System
- **Dual-Action `OUT / EXIT` Button**:
  - **When Loop is Inactive**: Clicking `OUT` calculates the duration from `start` to `pos`, snaps to the nearest integer beat grid (smart beat quantization), and starts looping immediately. If `IN` was not set, it catches the last 4 beats automatically.
  - **When Loop is Active**: The button transforms into an active amber **`EXIT`** button (`animate-pulse`). Clicking it **exits the loop immediately** and lets the song play forward without stopping.
- **Interactive `IN` (Loop Cue)**: When loop is active, clicking `IN` acts as a Pioneer CDJ Loop Cue, jumping immediately back to the loop start.
- **`RELOOP` Button**: Displays `${beats}B ACTIVE` during loop; displays `RELOOP` when inactive, allowing the DJ to jump back into the stored loop with one click.
- **Beat Division**: `½` and `2×` buttons halve and double loop length in real time.

---

### 4.5 Performance Pads & Loops
- **8 Hot Cues**: Click pad to jump instantly; `Shift + Click` or right-click to clear cue.
- **Auto Beat Loops**: Instant quantized loops of 1/4, 1/2, 1, 2, 4, 8, 16, 32 beats based on detected track BPM.

---

## 5. Library, Local Storage & Crate System

### 5.1 Local PC Directory Mounting (`src/library/FileSystemManager.ts`)
- Utilizes `window.showDirectoryPicker({ mode: 'read' })` to recursively traverse local PC folders.
- Filters standard audio MIME types (`.mp3`, `.wav`, `.aac`, `.m4a`, `.flac`, `.ogg`, `.aiff`).
- Fallback file drag-and-drop ingestion onto any part of the console workspace.

### 5.2 Metadata & Tag Parsing (`src/library/MetadataReader.ts`)
- Uses `music-metadata-browser` to parse ID3v1, ID3v2, MP4/AAC tags.
- Extracts Title, Artist, Album, Duration, Key, and embedded album artwork (`picture[0]`).
- Converts album artwork into lightweight `URL.createObjectURL(blob)` handles.

### 5.3 Crate Persistence (`src/library/TrackDatabase.ts`)
- Uses IndexedDB (`idb-keyval`) to persist the track library, tags, and pre-extracted waveform peak arrays.
- On startup, the app loads saved crate metadata from IndexedDB **without automatically opening the browser popup**, preserving a clean workspace.

### 5.4 Library Modal Ergonomics (`src/components/library/LibraryModal.tsx`)
- **Zero Horizontal Overflow**: Built with `table-fixed w-full` and responsive truncation.
- **Targeted Deck Source Buttons**:
  - Clicking **`SOURCE`** on **Deck A** opens the modal displaying **only** the cyan `LOAD DECK A` button for each track.
  - Clicking **`SOURCE`** on **Deck B** displays **only** the pink `LOAD DECK B` button.
  - Opening the library from the Top Bar ("BROWSE LIBRARY") displays all available decks (`DECK A`, `DECK B`, plus `C`/`D` in 4-deck mode).
- **Last Selected Track Prioritization**:
  - The most recently loaded track is sorted to the **#1 position at the top of the table**, highlighted with a `LAST LOADED` badge.

---

## 6. Waveform Engine & BPM Analysis

### 6.1 High-Resolution 60 FPS Canvas Stacked Waveforms (`src/components/waveform/StackedWaveforms.tsx`)
- Direct HTML5 Canvas 2D rendering tied to `requestAnimationFrame` loop.
- Reads `AudioContext.currentTime` directly rather than React state to avoid frame lag.
- Vertical playhead aligned at 35% width, stacked vertically so DJs can visually align kick drum transients between Deck A and Deck B.
- Digital 3-band color coding:
  - **Cyan / White**: High frequencies (hi-hats, snares, transients).
  - **Green / Amber**: Mid frequencies (vocals, synths, melodies).
  - **Red / Orange**: Low frequencies (sub bass, kick drums).

### 6.2 BPM Detection (`src/audio/BpmDetector.ts`)
1. **Low-Pass Kick Isolation**: Second-order digital IIR low-pass filter with cutoff at 180 Hz ($Q=1.2$).
2. **Onset Envelope Follower**: Half-wave rectification and 300 Hz smoothing window.
3. **Autocorrelation**: Computes lagged cross-correlation across 60–180 BPM tempo search space.
4. **Parabolic Peak Interpolation**: Refines detected BPM peak to fractional decimal precision (e.g., 124.0 or 128.5 BPM).

---

## 7. Keyboard Hotkeys Reference

| Key | Deck A Control | Key | Deck B Control |
| :---: | :--- | :---: | :--- |
| **`W`** | Play / Pause | **`U`** | Play / Pause |
| **`Q`** | CDJ Cue (Hold to preview) | **`Y`** | CDJ Cue (Hold to preview) |
| **`E`** | Beat Sync | **`I`** | Beat Sync |
| **`A`** | Pitch Bend Down (Nudge -) | **`H`** | Pitch Bend Down (Nudge -) |
| **`S`** | Pitch Bend Up (Nudge +) | **`J`** | Pitch Bend Up (Nudge +) |
| **`D`** | Key Lock (Master Tempo) | **`K`** | Key Lock (Master Tempo) |
| **`1` - `4`**| Hot Cues 1 to 4 | **`7` - `0`**| Hot Cues 1 to 4 |
| **`X`** | Crossfader Center | **`Z`** / **`C`** | Crossfader Full Left / Right |
| **`B`** / **`Tab`**| Toggle Track Library | **`Space`** | Emergency Mute / Stop All |

---

## 8. Verified Bug Fixes & Solutions

1. **Jog Wheel Auto-Playing When Paused**:
   - *Problem*: In vinyl mode, scrubbing while paused called `play(newTime)`, which left `isPlaying = true`.
   - *Fix*: Created `playScratchGrain(time, velocity)` that plays brief transient grains (~60ms) and keeps `isPlaying = false`, leaving the playhead at the scrubbed spot for clean cue placement.
2. **Post-Fader Echo Ring Out**:
   - *Problem*: FX was routed as an insert before the channel fader; pulling the volume fader down instantly muted the echo.
   - *Fix*: Re-routed as post-fader send (`volumeGain -> fxSendGain`) and direct return (`fxReturnGain -> panner -> masterSend`). Pulling down the fader cuts dry music while delay repeats ring out for 5–6 seconds.
3. **Pitch Bend Time Discontinuity in Audio Clock**:
   - *Problem*: `getCurrentTime()` multiplied the total song duration by the new rate, causing several seconds of playhead jumping when nudging.
   - *Fix*: In `setPlaybackRate`, accumulated `this.offset = this.getCurrentTime()` and reset `this.startContextTime = this.ctx.currentTime`. The audio now advances smoothly with zero phase skips.
4. **Library Horizontal Overflow**:
   - *Problem*: The track library had horizontal scrollbars that disrupted crate browsing.
   - *Fix*: Re-engineered modal with `table-fixed w-full`, explicit percentage column widths, and CSS `truncate`.
5. **Rotary Knob 0 dB Detent**:
   - *Problem*: 0 dB on bipolar EQs was calibrated at ~81% rotation instead of 12 o'clock.
   - *Fix*: Implemented piecewise angle mapping: value 0 maps strictly to $0^\circ$ (12 o'clock) with a center detent tick.
6. **Deck C/D Flipped State**:
   - *Problem*: Switching to Deck C or D in 4-deck mode hid the button to flip back.
   - *Fix*: Passed dynamic `altDeckId` so clicking flips infinitely between $A \leftrightarrow C$ and $B \leftrightarrow D$.

---

## 9. Development Commands & Workflow

```bash
# Start Vite development server (host 127.0.0.1, port 5173)
npm run dev -- --host 127.0.0.1 --port 5173

# Execute TypeScript type check and production bundle
npm run build

# Package deployment zip for aaPanel
Compress-Archive -Path "dist\*" -DestinationPath "deshdj_studio_build.zip" -Force

# Run Vitest unit test suite
npm test -- --run

# Preview production build
npm run preview
```

---

## 10. Production Deployment to aaPanel

- **Target aaPanel Site Type**: `Pure static` website.
- **Archive to Upload**: `deshdj_studio_build.zip` (extract directly into `/www/wwwroot/yourdomain.com`).
- **Base Configuration**: Set to `base: './'` in `vite.config.ts` for relative, path-agnostic asset loading.
- **SSL / HTTPS Requirement**: Must enable Let's Encrypt SSL in aaPanel. The File System Access API (`showDirectoryPicker`) requires a Secure Context (`https://`) to allow users to mount local music folders on a live public domain.

---

## 11. Mobile Responsiveness & Multi-Device Ergonomics

- **Desktop Experience ($\ge 1280$px / `xl:`)**:
  - 100% untouched, pixel-perfect 3-column side-by-side console (Left Deck, 3/5-channel central DJ mixer, Right Deck).
  - Stacked 60 FPS waveforms at the top, full header controls (`BROWSE LIBRARY`, `2 DECKS`, `SETTINGS`, Keyboard Shortcuts, Fullscreen).
  - All desktop keyboard hotkeys active.
- **Mobile Experience ($< 1280$px / Smartphones & Tablets)**:
  - **Segmented View Switcher**: Ergonomic top tabs (`[ DECK A ]` `[ MIXER ]` `[ DECK B ]` `[ ALL ]`) allow fast single-tap switching between deck platters and the mixer.
  - **Quick Crossfader Strip**: Docked at the bottom when in single deck view (`mobileActiveTab === 'A' || mobileActiveTab === 'B'`), enabling DJs to perform smooth crossfades between Deck A and Deck B without navigating away from the platter!
  - **Touch-Optimized Jog Wheel**: Responsive sizing (`w-38 h-38 xs:w-44 xs:h-44 sm:w-52 sm:h-52`) with zero right-side clipping, pointer-capture scratching, and smooth momentum CDJ pitch blending.
  - **Pioneer Transport Controls**: Responsive CUE & PLAY buttons (`w-12 h-12 xs:w-14 xs:h-14 sm:w-18 sm:h-18`) with large touch targets.
  - **Mobile Library Modal**: Responsive layout with percentage column sizing, hiding non-essential metadata (Artist, Duration) on small phone screens so track titles and load buttons fit comfortably without horizontal scrolling.



