# WebGL Audio Visualizer

A dependency-free Rawtunez / Raw WebGL visual synth for audio-reactive album-art style visuals. It reacts to microphone input or uploaded audio files with deep-space star travel, shader tunnels, nebula motion, glitch shimmer, beat pulses, animated title art, presets, touch interaction, and PNG export.

## Quick Start

```sh
python -m http.server 8080
```

Then open `http://localhost:8080`, click **Start microphone** or **Upload audio**, and switch presets/intensity while sound is playing.

## Run Locally

Serve this folder with a simple static server:

```sh
python -m http.server 8080
```

Open `http://localhost:8080` in a modern browser.

Do not open the page with a `file://` URL. Browser audio and microphone APIs are more restricted from direct disk files.

Microphone access requires `localhost`, HTTPS, or another secure context.

## Microphone Mode

1. Click **Start microphone**.
2. Allow microphone permission in the browser prompt.
3. Play sound near the microphone, speak, or route audio into your input device.

Modern browsers treat `localhost` as a secure context, so microphone access works from `http://localhost:8080`.

## Uploaded Audio Mode

1. Click **Upload audio**.
2. Choose a local browser-supported audio file such as MP3, WAV, OGG, or M4A.
3. Use **Play file** / **Pause file** to control playback.
4. Uploading a replacement file revokes the old object URL to avoid leaking memory.

The audio file stays local in your browser.

## Presets

The preset selector changes palette, mood, tunnel behavior, and particle feel:

- **Space Tunnel:** black, blue, violet, white.
- **Dark Arcade:** black, red, magenta, electric blue.
- **Glitch Nebula:** purple, cyan, green, white.
- **Sun Disk:** lemon, orange, blood orange, gold.
- **Murder Land:** haunted casino/carnival reds, purples, black, dirty neon.
- **Casino Ice:** ice blue, white, diamond, deep navy.
- **TuneZilla Green:** emerald, lime, black, toxic green.
- **Chromatic Clock:** rotating color-wheel energy inspired by sun, grass, water, citrus, and stones.
- **4TEX777:** vertex points, grids, nodes, planes, violet-blue geometry, and neon electric lines.

## Intensity Modes

- **Chill:** smoother, slower, less flashing.
- **Normal:** balanced response.
- **Chaos:** stronger beat hits, more warp, more glow, more particle energy.
- **Performance:** reduced particles and effects for phones or slower GPUs.

## Controls

- **Start microphone:** starts live microphone analysis.
- **Upload audio:** loads and plays a local audio file.
- **Play file / Pause file:** controls uploaded audio playback.
- **Reset visualizer:** clears the current audio input and reseeds the visuals.
- **Save PNG:** exports the current frame, including the text overlay when visible.
- **Preset:** switches the color palette and shader mood.
- **Intensity:** switches between Chill, Normal, Chaos, and Performance behavior.
- **Show text layer:** toggles the logo/text overlay.
- **Custom text:** type your own text or use values like `RAWTUNEZ`, `RAW WEBGL`, `4TEX777`, `MURDER LAND`, `DARKADE`, `TUNEZILLA`, or `CHROMATIC CLOCK`.
- **Sensitivity:** controls audio response and beat detection strength.
- **Star speed:** controls space-travel speed.
- **Glow intensity:** controls global glow and brightness.
- **Particle amount:** controls star and particle density.
- **Warp intensity:** controls tunnel bend, nebula distortion, and drag response.

## Audio Reactivity

- **Bass** drives tunnel pulse, speed boosts, glow size, camera-like shake, beat bursts, and portal expansion.
- **Mids** drive nebula distortion, wave movement, tunnel bend, and color blending.
- **Highs** drive star twinkle, laser energy, glitch shimmer, scanlines, and sparks.
- **Overall volume** drives global brightness and particle intensity.
- **Beat detection** watches strong bass changes and triggers brief pulse bursts.
- **Text layer** pulses on bass, glows with the active preset, and adds subtle high-frequency glitch/scanline motion.

## Touch And Mouse

- Tap or click outside the control panel to create a particle burst.
- Drag outside the control panel to bend/rotate the field.
- Pinch on touch screens or use the mouse wheel to adjust zoom/intensity.
- Long press outside the panel to trigger temporary super mode with extra speed and glow.

## Browser Permission Notes

- Microphone access requires a secure context. `localhost` and HTTPS work; direct `file://` does not.
- If microphone permission is denied, reset site permissions in the browser and try again.
- Some browsers require a user gesture before audio playback. The app starts audio only from user actions.
- Browser codec support varies, so one audio format may work while another does not.

## Browser Compatibility

- Best tested target: current Chrome, Edge, Safari, and Firefox versions with WebGL and Web Audio enabled.
- iPhone/iPad Safari should work through `localhost` or HTTPS, but performance depends on device age and battery mode.
- If WebGL is blocked or unavailable, the app falls back to a simpler 2D canvas renderer with the same audio controls.
- Hardware acceleration should be enabled for the full WebGL renderer.

## Troubleshooting

- **No microphone prompt appears:** Open `http://localhost:8080`, not the file directly from disk.
- **Microphone denied:** Check browser site permissions and OS privacy settings.
- **Uploaded audio will not play:** Try a different audio format or file.
- **Visuals are slow on a phone:** Lower **Particle amount**, **Glow intensity**, and **Warp intensity**.
- **WebGL unavailable:** The app switches to a simpler 2D canvas fallback and shows a friendly message. Enabling browser hardware acceleration may restore the full renderer.
- **Screenshot looks different from the live screen:** The PNG captures the canvas and redraws the text overlay, but browser font rendering can vary slightly.
- **Screenshot filenames:** Export names include `rawwebgl`, preset name, custom text, and date/time, such as `rawwebgl-sun-disk-rawtunez-2026-05-10-23-45.png`.

## Known Issues

- Browser shader compilers can vary, so the exact glow and color balance may differ slightly between Chrome, Safari, Edge, and Firefox.
- Uploaded audio format support depends on the browser codec list.
- Screenshot export captures a still PNG, not animation or audio.
- Microphone mode analyzes the selected input device, not system audio, unless your OS routes system audio into an input.

## Next Upgrades

- Drag-and-drop audio loading.
- Preset save/load slots.
- More advanced beat and BPM estimation.
- MIDI or keyboard performance controls.
- Video recording/export.
- More shader modes for waveform terrain, oscilloscope rings, and lyric overlays.
