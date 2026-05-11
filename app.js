const ui = {
  canvas: requireElement("#visualizer"),
  textOverlay: requireElement("#textOverlay"),
  micButton: requireElement("#micButton"),
  fileInput: requireElement("#fileInput"),
  audio: requireElement("#audio"),
  playPauseButton: requireElement("#playPauseButton"),
  resetButton: requireElement("#resetButton"),
  screenshotButton: requireElement("#screenshotButton"),
  compactButton: requireElement("#compactButton"),
  collapseButton: requireElement("#collapseButton"),
  controlPanel: requireElement("#controlPanel"),
  presetSelect: requireElement("#presetSelect"),
  intensitySelect: requireElement("#intensitySelect"),
  textToggle: requireElement("#textToggle"),
  textInput: requireElement("#textInput"),
  gainSlider: requireElement("#gainSlider"),
  speedSlider: requireElement("#speedSlider"),
  glowSlider: requireElement("#glowSlider"),
  particleSlider: requireElement("#particleSlider"),
  warpSlider: requireElement("#warpSlider"),
  modeLabel: requireElement("#modeLabel"),
  status: requireElement("#status"),
  meters: {
    bass: requireElement("#bassMeter"),
    mid: requireElement("#midMeter"),
    high: requireElement("#highMeter"),
    volume: requireElement("#volumeMeter"),
  },
};

const PRESETS = [
  {
    name: "Space Tunnel",
    accent: "#5df7ff",
    colors: ["#01030d", "#2d6bff", "#8e5dff", "#f6fbff"],
    mode: 0,
    particleStyle: 0.9,
    tunnel: 1.0,
  },
  {
    name: "Dark Arcade",
    accent: "#ff2454",
    colors: ["#020004", "#ff133c", "#172cff", "#27f2ff"],
    mode: 1,
    particleStyle: 1.25,
    tunnel: 1.25,
  },
  {
    name: "Glitch Nebula",
    accent: "#39ffb5",
    colors: ["#070016", "#7e43ff", "#26f7ff", "#bcff4f"],
    mode: 2,
    particleStyle: 1.45,
    tunnel: 0.9,
  },
  {
    name: "Sun Disk",
    accent: "#ffe15a",
    colors: ["#160500", "#fff176", "#ff8c16", "#ff3a24"],
    mode: 3,
    particleStyle: 0.65,
    tunnel: 0.75,
  },
  {
    name: "Murder Land",
    accent: "#e80f32",
    colors: ["#020001", "#9f061d", "#3a0d35", "#ff2a68"],
    mode: 4,
    particleStyle: 1.15,
    tunnel: 1.4,
  },
  {
    name: "Casino Ice",
    accent: "#d4fbff",
    colors: ["#01091f", "#83eeff", "#ffffff", "#1d58a7"],
    mode: 5,
    particleStyle: 0.8,
    tunnel: 1.05,
  },
  {
    name: "TuneZilla Green",
    accent: "#39ff54",
    colors: ["#000900", "#00f06c", "#b8ff19", "#00ff9d"],
    mode: 6,
    particleStyle: 1.55,
    tunnel: 1.2,
  },
  {
    name: "Chromatic Clock",
    accent: "#ffe66d",
    colors: ["#02050c", "#ffd84d", "#26d77b", "#4fc3ff"],
    mode: 7,
    particleStyle: 1.05,
    tunnel: 0.95,
  },
  {
    name: "4TEX777",
    accent: "#9b7cff",
    colors: ["#020313", "#4d78ff", "#8d4dff", "#ffffff"],
    mode: 8,
    particleStyle: 1.75,
    tunnel: 1.35,
  },
];

const INTENSITY_MODES = {
  Chill: { audio: 0.86, speed: 0.72, glow: 0.78, particles: 0.74, warp: 0.62, beat: 0.68, glitch: 0.45 },
  Normal: { audio: 1, speed: 1, glow: 1, particles: 1, warp: 1, beat: 1, glitch: 1 },
  Chaos: { audio: 1.18, speed: 1.32, glow: 1.25, particles: 1.18, warp: 1.36, beat: 1.45, glitch: 1.65 },
  Performance: { audio: 0.95, speed: 0.86, glow: 0.72, particles: 0.52, warp: 0.58, beat: 0.78, glitch: 0.35 },
};

const settings = {
  sensitivity: Number(ui.gainSlider.value),
  starSpeed: Number(ui.speedSlider.value),
  glow: Number(ui.glowSlider.value),
  particleAmount: Number(ui.particleSlider.value),
  warp: Number(ui.warpSlider.value),
  preset: PRESETS[0],
  intensity: "Normal",
};

class AudioEngine {
  constructor(elements) {
    this.elements = elements;
    this.context = null;
    this.analyser = null;
    this.frequencyData = new Uint8Array(512);
    this.timeData = new Uint8Array(512);
    this.currentSource = null;
    this.mediaElementSource = null;
    this.mediaStream = null;
    this.objectUrl = "";
    this.mode = "Idle";
    this.bands = { bass: 0, mid: 0, high: 0, volume: 0, beat: 0, beatHit: false };
    this.beatFloor = 0.14;
    this.beatCooldown = 0;
  }

  async startMicrophone() {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.setStatus("Microphone input is unavailable in this browser. Try Chrome or Edge on localhost.");
      return;
    }

    try {
      this.stopMicrophone();
      this.elements.audio.pause();
      await this.ensureContext();

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      this.connectSource(this.context.createMediaStreamSource(this.mediaStream), false);
      this.setMode("Microphone");
      this.setStatus("Microphone mode active. Tap the canvas for bursts, drag to bend space, long press for super mode.");
    } catch (error) {
      console.error(error);
      this.setMode("Idle");
      this.setStatus(
        error.name === "NotAllowedError" || error.name === "SecurityError"
          ? "Microphone permission was denied. Allow microphone access for localhost in browser settings."
          : "Could not start microphone input. Check your audio device and browser permissions.",
      );
    }
  }

  async loadFile(file) {
    if (!file) {
      return;
    }

    try {
      this.stopMicrophone();
      await this.ensureContext();
      this.elements.audio.pause();

      if (this.objectUrl) {
        URL.revokeObjectURL(this.objectUrl);
      }

      this.objectUrl = URL.createObjectURL(file);
      this.elements.audio.currentTime = 0;
      this.elements.audio.src = this.objectUrl;
      this.elements.audio.loop = true;

      if (!this.mediaElementSource) {
        this.mediaElementSource = this.context.createMediaElementSource(this.elements.audio);
      }

      this.connectSource(this.mediaElementSource, true);
      await this.elements.audio.play();
      this.elements.playPauseButton.disabled = false;
      this.elements.playPauseButton.textContent = "Pause file";
      this.setMode("Uploaded file");
      this.setStatus(`Playing ${file.name}`);
    } catch (error) {
      console.error(error);
      this.elements.playPauseButton.textContent = "Play file";
      this.setStatus("Could not play that audio file. Try a browser-supported MP3, WAV, OGG, or M4A.");
    }
  }

  async toggleFilePlayback() {
    if (!this.elements.audio.src || !this.mediaElementSource) {
      this.setStatus("Upload an audio file before using play / pause.");
      return;
    }

    await this.ensureContext();
    this.stopMicrophone();
    this.connectSource(this.mediaElementSource, true);

    if (this.elements.audio.paused) {
      await this.elements.audio.play();
      this.elements.playPauseButton.textContent = "Pause file";
      this.setMode("Uploaded file");
      this.setStatus("File playback resumed.");
    } else {
      this.elements.audio.pause();
      this.elements.playPauseButton.textContent = "Play file";
      this.setStatus("File playback paused. Idle preview remains active.");
    }
  }

  reset() {
    this.stopMicrophone();
    this.elements.audio.pause();
    this.elements.audio.removeAttribute("src");
    this.elements.audio.load();
    this.elements.fileInput.value = "";
    this.elements.playPauseButton.disabled = true;
    this.elements.playPauseButton.textContent = "Play file";

    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = "";
    }

    if (this.currentSource) {
      this.safeDisconnect(this.currentSource);
      this.currentSource = null;
    }

    if (this.analyser) {
      this.safeDisconnect(this.analyser);
    }

    this.frequencyData.fill(0);
    this.timeData.fill(128);
    this.bands = { bass: 0, mid: 0, high: 0, volume: 0, beat: 0, beatHit: false };
    this.beatFloor = 0.14;
    this.beatCooldown = 0;
    this.setMode("Idle");
    this.setStatus("Visualizer reset. Choose microphone or upload audio to begin again.");
  }

  async ensureContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      throw new Error("Web Audio API is unavailable.");
    }

    if (!this.context) {
      this.context = new AudioContextClass();
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.minDecibels = -94;
      this.analyser.maxDecibels = -14;
      this.analyser.smoothingTimeConstant = 0.72;
      this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
      this.timeData = new Uint8Array(this.analyser.frequencyBinCount);
    }

    if (this.context.state === "suspended") {
      await this.context.resume();
    }
  }

  connectSource(source, connectToSpeakers) {
    if (!source || !this.analyser) {
      return;
    }

    const isNewSource = this.currentSource !== source;

    if (this.currentSource && isNewSource) {
      this.safeDisconnect(this.currentSource);
    }

    this.safeDisconnect(this.analyser);
    this.currentSource = source;

    if (isNewSource) {
      source.connect(this.analyser);
    }

    if (connectToSpeakers) {
      this.analyser.connect(this.context.destination);
    }
  }

  safeDisconnect(node) {
    try {
      node.disconnect();
    } catch (error) {
      if (error.name !== "InvalidAccessError") {
        console.warn("Audio node disconnect skipped:", error);
      }
    }
  }

  stopMicrophone() {
    if (!this.mediaStream) {
      return;
    }

    for (const track of this.mediaStream.getTracks()) {
      track.stop();
    }

    this.mediaStream = null;
  }

  sample(delta, sensitivity) {
    if (this.analyser && (this.mode === "Microphone" || !this.elements.audio.paused)) {
      this.analyser.getByteFrequencyData(this.frequencyData);
      this.analyser.getByteTimeDomainData(this.timeData);
    } else {
      this.writeIdleSignal(performance.now() / 1000);
    }

    const nyquist = this.context ? this.context.sampleRate / 2 : 24000;
    const bassRaw = this.averageHz(24, 160, nyquist) * sensitivity;
    const midRaw = this.averageHz(180, 2400, nyquist) * sensitivity;
    const highRaw = this.averageHz(2600, 14000, nyquist) * sensitivity * 0.92;
    const volumeRaw = this.waveformRms() * sensitivity * 1.35;
    const follow = Math.min(1, delta * 8.5);
    const highFollow = Math.min(1, delta * 6.2);

    this.bands.bass += (Math.min(bassRaw, 1.55) - this.bands.bass) * follow;
    this.bands.mid += (Math.min(midRaw, 1.5) - this.bands.mid) * follow;
    this.bands.high += (Math.min(highRaw, 1.2) - this.bands.high) * highFollow;
    this.bands.volume += (Math.min(volumeRaw, 1.35) - this.bands.volume) * follow;

    this.beatFloor += (this.bands.bass - this.beatFloor) * Math.min(1, delta * 0.7);
    this.beatCooldown = Math.max(0, this.beatCooldown - delta);

    const threshold = this.beatFloor * (1.28 + 0.2 / Math.max(sensitivity, 0.4)) + 0.1;
    const beatHit = this.bands.bass > threshold && this.beatCooldown <= 0;

    if (beatHit) {
      this.bands.beat = 1;
      this.beatCooldown = 0.2;
    } else {
      this.bands.beat *= Math.pow(0.08, delta);
    }

    this.bands.beatHit = beatHit;
    return this.bands;
  }

  writeIdleSignal(time) {
    for (let index = 0; index < this.frequencyData.length; index += 1) {
      const falloff = 1 - index / this.frequencyData.length;
      const wave = Math.sin(time * 1.25 + index * 0.065) * 0.5 + 0.5;
      this.frequencyData[index] = 14 + wave * 42 * falloff;
      this.timeData[index] = 128 + Math.sin(time * 1.8 + index * 0.04) * 7;
    }
  }

  averageHz(lowHz, highHz, nyquist) {
    const start = Math.max(0, Math.floor((lowHz / nyquist) * this.frequencyData.length));
    const end = Math.min(this.frequencyData.length - 1, Math.ceil((highHz / nyquist) * this.frequencyData.length));
    let total = 0;
    let count = 0;

    for (let index = start; index <= end; index += 1) {
      total += this.frequencyData[index] / 255;
      count += 1;
    }

    return count ? total / count : 0;
  }

  waveformRms() {
    let total = 0;

    for (let index = 0; index < this.timeData.length; index += 1) {
      const centered = (this.timeData[index] - 128) / 128;
      total += centered * centered;
    }

    return Math.sqrt(total / this.timeData.length);
  }

  setMode(mode) {
    this.mode = mode;
    this.elements.modeLabel.textContent = mode;
  }

  setStatus(message) {
    this.elements.status.textContent = message;
  }
}

class InteractionController {
  constructor(canvas) {
    this.canvas = canvas;
    this.pointer = { x: 0, y: 0, targetX: 0, targetY: 0, zoom: 1, intensity: 0, super: 0 };
    this.activePointers = new Map();
    this.lastPinchDistance = 0;
    this.longPressTimer = 0;
    this.onBurst = () => {};
    this.boundPointerDown = (event) => this.pointerDown(event);
    this.boundPointerMove = (event) => this.pointerMove(event);
    this.boundPointerUp = (event) => this.pointerUp(event);
    this.boundWheel = (event) => this.wheel(event);
    this.bind();
  }

  bind() {
    window.addEventListener("pointerdown", this.boundPointerDown, { passive: false });
    window.addEventListener("pointermove", this.boundPointerMove, { passive: false });
    window.addEventListener("pointerup", this.boundPointerUp);
    window.addEventListener("pointercancel", this.boundPointerUp);
    window.addEventListener("wheel", this.boundWheel, { passive: false });
  }

  destroy() {
    window.removeEventListener("pointerdown", this.boundPointerDown);
    window.removeEventListener("pointermove", this.boundPointerMove);
    window.removeEventListener("pointerup", this.boundPointerUp);
    window.removeEventListener("pointercancel", this.boundPointerUp);
    window.removeEventListener("wheel", this.boundWheel);
    window.clearTimeout(this.longPressTimer);
  }

  pointerDown(event) {
    if (event.target.closest?.(".panel")) {
      return;
    }

    event.preventDefault();
    this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.updateTarget(event.clientX, event.clientY);
    this.onBurst(this.toClipSpace(event.clientX, event.clientY), 1);

    window.clearTimeout(this.longPressTimer);
    this.longPressTimer = window.setTimeout(() => {
      if (this.activePointers.has(event.pointerId)) {
        this.pointer.super = 1;
        this.onBurst(this.toClipSpace(event.clientX, event.clientY), 2.4);
      }
    }, 520);
  }

  pointerMove(event) {
    if (!this.activePointers.has(event.pointerId)) {
      return;
    }

    event.preventDefault();
    this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.activePointers.size >= 2) {
      const points = [...this.activePointers.values()];
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);

      if (this.lastPinchDistance && Math.abs(distance - this.lastPinchDistance) > 2) {
        this.pointer.zoom = clamp(this.pointer.zoom + (distance - this.lastPinchDistance) * 0.002, 0.82, 1.42);
      }

      this.lastPinchDistance = distance;
    } else {
      this.updateTarget(event.clientX, event.clientY);
    }
  }

  pointerUp(event) {
    this.activePointers.delete(event.pointerId);
    this.lastPinchDistance = 0;
    this.pointer.super = 0;
    window.clearTimeout(this.longPressTimer);
  }

  wheel(event) {
    if (event.target.closest?.(".panel")) {
      return;
    }

    event.preventDefault();
    this.pointer.zoom = clamp(this.pointer.zoom - event.deltaY * 0.0009, 0.82, 1.42);
  }

  update(delta) {
    this.pointer.x += (this.pointer.targetX - this.pointer.x) * Math.min(1, delta * 7);
    this.pointer.y += (this.pointer.targetY - this.pointer.y) * Math.min(1, delta * 7);
    this.pointer.intensity += ((this.activePointers.size ? 1 : 0) - this.pointer.intensity) * Math.min(1, delta * 5);
    this.pointer.zoom += (1 - this.pointer.zoom) * Math.min(1, delta * 0.45);
    return this.pointer;
  }

  updateTarget(clientX, clientY) {
    this.pointer.targetX = (clientX / window.innerWidth - 0.5) * 2;
    this.pointer.targetY = (0.5 - clientY / window.innerHeight) * 2;
  }

  toClipSpace(clientX, clientY) {
    return {
      x: (clientX / window.innerWidth - 0.5) * 2,
      y: (0.5 - clientY / window.innerHeight) * 2,
    };
  }
}

class SpaceRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });

    if (!this.gl) {
      throw new Error("WebGL is unavailable.");
    }

    this.time = 0;
    this.beatKick = 0;
    this.pixelRatio = 1;
    this.maxStars = window.innerWidth < 720 ? 760 : 1650;
    this.maxBursts = window.innerWidth < 720 ? 280 : 680;
    this.ringSegments = window.innerWidth < 720 ? 96 : 168;
    this.ringCount = 8;
    this.ringVertexCount = this.ringSegments * 6 * this.ringCount;
    this.ringData = new Float32Array(this.ringVertexCount * 5);
    this.bursts = [];
    this.burstData = new Float32Array(this.maxBursts * 4);
    this.burstDrawCount = 0;

    this.createPrograms();
    this.createBuffers();
    this.resize();
  }

  createPrograms() {
    this.backgroundProgram = createProgram(
      this.gl,
      `
        attribute vec2 a_position;
        varying vec2 v_uv;

        void main() {
          v_uv = a_position * 0.5 + 0.5;
          gl_Position = vec4(a_position, 0.0, 1.0);
        }
      `,
      `
        precision highp float;

        uniform vec2 u_resolution;
        uniform vec3 u_color0;
        uniform vec3 u_color1;
        uniform vec3 u_color2;
        uniform vec3 u_color3;
        uniform float u_time;
        uniform float u_bass;
        uniform float u_mid;
        uniform float u_high;
        uniform float u_volume;
        uniform float u_beat;
        uniform float u_glow;
        uniform float u_warp;
        uniform float u_presetMode;
        uniform float u_tunnel;
        uniform vec2 u_pointer;
        uniform float u_zoom;
        uniform float u_super;

        varying vec2 v_uv;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }

        float fbm(vec2 p) {
          float value = 0.0;
          float amplitude = 0.5;
          for (int i = 0; i < 5; i++) {
            value += noise(p) * amplitude;
            p = p * 2.03 + vec2(8.3, 4.1);
            amplitude *= 0.5;
          }
          return value;
        }

        void main() {
          vec2 centered = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
          centered = (centered - u_pointer * 0.06 * u_warp) / max(u_zoom, 0.2);
          float radius = length(centered);
          float angle = atan(centered.y, centered.x);
          float mode = u_presetMode;

          float warp = u_warp * (0.45 + u_mid * 0.9 + u_super * 0.45);
          float swirl = sin(angle * (3.0 + mode) + u_time * (0.7 + u_mid) + radius * 8.0) * 0.045 * warp;
          vec2 warped = centered + vec2(cos(angle + 1.57), sin(angle + 1.57)) * swirl;

          float nebula = fbm(warped * (2.4 + mode * 0.18) + vec2(u_time * 0.04, -u_time * 0.026));
          float nebulaFine = fbm(warped * 7.0 - vec2(u_time * 0.09, u_time * 0.03));
          float tunnel = sin((radius + swirl) * (34.0 + u_tunnel * 12.0 + u_bass * 6.5) - u_time * (2.2 + u_bass * 3.6 + u_super * 3.0));
          float portal = smoothstep(0.5, 1.0, tunnel * 0.5 + 0.5) * smoothstep(1.05, 0.08, radius);
          float portalCore = smoothstep(0.32 + u_bass * 0.055 + u_beat * 0.035, 0.11, radius);
          float portalRim = smoothstep(0.034, 0.0, abs(radius - (0.31 + u_bass * 0.045 + u_beat * 0.035)));
          float portalHalo = smoothstep(0.58 + u_bass * 0.045, 0.18, radius) * (0.4 + 0.6 * sin(angle * 9.0 + u_time * (0.85 + u_mid * 1.2)));
          float outerSpark = smoothstep(0.024, 0.0, abs(radius - 0.72)) * smoothstep(0.72, 1.0, hash(floor(vec2(angle * 42.0, u_time * 18.0)))) * (0.2 + u_high);
          float scan = sin(gl_FragCoord.y * (1.25 + u_high * 1.1) + u_time * 18.0) * 0.014 * (0.35 + u_high);
          float laser = pow(abs(sin(angle * (8.0 + mode) + u_time * 1.45)), 26.0) * smoothstep(1.0, 0.04, radius) * (0.08 + u_high * 0.72);
          float stars = smoothstep(0.992 - u_high * 0.002, 1.0, hash(floor(v_uv * u_resolution.xy / 3.0 + u_time * 0.35)));
          float sunMask = step(2.5, mode) * step(mode, 3.5);
          float sun = smoothstep(0.42 + u_bass * 0.05, 0.12, radius) * sunMask;
          float sunRays = pow(abs(sin(angle * 22.0 + u_time * (0.35 + u_mid * 0.4))), 16.0) * smoothstep(0.76, 0.16, radius) * sunMask;
          float arcade = step(0.5, mode) * step(mode, 1.5);
          float murder = step(3.5, mode) * step(mode, 4.5);
          float ice = step(4.5, mode) * step(mode, 5.5);
          float toxic = step(5.5, mode) * step(mode, 6.5);
          float chroma = step(6.5, mode) * step(mode, 7.5);
          float vertex = step(7.5, mode) * step(mode, 8.5);
          float carnival = (sin(angle * 28.0 + u_time * 7.0) * 0.5 + 0.5) * (sin(radius * 52.0 - u_time * 5.0) * 0.5 + 0.5) * murder;
          float arcadeGrid = (1.0 - smoothstep(0.0, 0.018, min(abs(fract(warped.x * 7.0 + 0.5) - 0.5), abs(fract(warped.y * 7.0 + 0.5) - 0.5)))) * arcade;
          float clockWheel = fract(angle / 6.2831853 + 0.5 + u_time * (0.045 + u_mid * 0.07));
          float clockRing = smoothstep(0.035, 0.0, abs(radius - (0.34 + u_bass * 0.06))) * chroma;
          float clockOuter = smoothstep(0.03, 0.0, abs(radius - 0.68)) * chroma;
          float clockTick = pow(abs(sin(angle * 24.0 + u_time * (1.4 + u_mid))), 30.0) * smoothstep(0.78, 0.24, radius) * chroma;
          float vertexGrid = (1.0 - smoothstep(0.0, 0.012, min(abs(fract(warped.x * (8.0 + u_mid * 3.0)) - 0.5), abs(fract(warped.y * (8.0 + u_mid * 3.0)) - 0.5)))) * vertex;
          float vertexNodes = smoothstep(0.984 - u_high * 0.006, 1.0, hash(floor(warped * 18.0 + u_time))) * vertex;
          float glitch = step(0.99 - u_high * 0.004, hash(vec2(floor(gl_FragCoord.y / 10.0), floor(u_time * 22.0)))) * step(1.5, mode) * step(mode, 2.5);
          float vignette = smoothstep(1.18, 0.12, radius);

          vec3 wheelColor = mix(mix(u_color1, u_color2, smoothstep(0.0, 0.5, clockWheel)), u_color3, smoothstep(0.45, 1.0, clockWheel));
          vec3 color = mix(u_color0, u_color1, nebula * 0.55 + u_mid * 0.2);
          color += u_color2 * nebulaFine * (0.17 + u_mid * 0.18) * u_glow;
          color += u_color1 * portal * (0.13 + u_bass * 0.48 + u_beat * 0.35) * u_glow;
          color += mix(u_color1, u_color3, 0.35) * portalCore * (0.12 + u_bass * 0.32 + u_beat * 0.42) * u_glow;
          color += mix(u_color2, u_color3, 0.45) * portalRim * (0.55 + u_bass * 0.8 + u_beat * 0.55) * u_glow;
          color += u_color2 * portalHalo * (0.06 + u_mid * 0.16) * u_glow;
          color += u_color3 * outerSpark * (0.22 + u_high * 0.8) * u_glow;
          color += u_color2 * laser * (0.8 + u_high) * u_glow;
          color += mix(u_color2, u_color3, stars) * stars * (0.35 + u_high * 1.2);
          color += mix(u_color1, u_color2, 0.45) * sun * (0.9 + u_volume);
          color += u_color1 * sunRays * (0.08 + u_mid * 0.18);
          color += u_color3 * arcadeGrid * (0.08 + u_beat * 0.18);
          color *= 1.0 - murder * (0.22 + radius * 0.22);
          color += mix(u_color1, u_color3, carnival) * carnival * (0.12 + u_bass * 0.28 + u_beat * 0.3);
          color += u_color3 * ice * pow(max(0.0, 1.0 - abs(tunnel)), 7.0) * 0.08;
          color += u_color2 * toxic * nebulaFine * (0.18 + u_mid * 0.2);
          color = mix(color, wheelColor * (0.25 + nebula * 0.35), chroma * 0.35);
          color += wheelColor * (clockRing * (0.65 + u_bass) + clockOuter * (0.25 + u_high) + clockTick * (0.12 + u_high * 0.45)) * u_glow;
          color += u_color2 * vertexGrid * (0.1 + u_mid * 0.28 + u_bass * 0.16);
          color += u_color3 * vertexNodes * (0.35 + u_high * 0.75);
          color += u_color3 * glitch * 0.4;
          color += scan;
          color *= vignette * (0.78 + u_volume * 0.6 + u_super * 0.35);
          color += u_color0 * smoothstep(0.72, 1.14, radius) * 0.22;

          gl_FragColor = vec4(color, 1.0);
        }
      `,
    );

    this.starProgram = createProgram(
      this.gl,
      `
        attribute vec4 a_seed;

        uniform vec2 u_resolution;
        uniform vec3 u_color1;
        uniform vec3 u_color2;
        uniform vec3 u_color3;
        uniform float u_time;
        uniform float u_speed;
        uniform float u_bass;
        uniform float u_high;
        uniform float u_volume;
        uniform float u_beat;
        uniform float u_presetMode;
        uniform float u_particleAmount;
        uniform float u_particleStyle;
        uniform float u_warp;
        uniform vec2 u_pointer;
        uniform float u_zoom;
        uniform float u_super;

        varying float v_depth;
        varying float v_mix;
        varying float v_twinkle;

        void main() {
          float vertex = step(7.5, u_presetMode) * step(u_presetMode, 8.5);
          float chroma = step(6.5, u_presetMode) * step(u_presetMode, 7.5);
          float speed = 0.04 + u_speed * 0.06 + u_bass * 0.035 + u_beat * 0.055 + u_super * 0.075;
          float depth = fract(a_seed.z - u_time * speed * (0.55 + a_seed.w));
          depth = max(depth, 0.025);

          float spin = u_time * (0.035 + u_warp * 0.025) + a_seed.w * 6.2831853 + u_pointer.x * 0.35;
          mat2 rotate = mat2(cos(spin), -sin(spin), sin(spin), cos(spin));
          vec2 pos = rotate * a_seed.xy;
          pos += u_pointer * 0.08 * u_warp;
          pos *= 1.0 - vertex * u_bass * 0.08;
          pos = pos / depth / max(u_zoom, 0.2);

          float aspect = u_resolution.x / u_resolution.y;
          gl_Position = vec4(pos.x / aspect, pos.y, 0.0, 1.0);
          v_depth = 1.0 - depth;
          v_mix = fract(a_seed.w * u_particleStyle + u_volume);
          v_twinkle = 0.76 + 0.24 * sin(u_time * (6.0 + u_high * 14.0 + chroma * 5.0) + a_seed.w * 80.0);
          gl_PointSize = (0.85 + a_seed.w * 2.45 + u_high * (3.0 + vertex * 2.0) + u_beat * 3.2) * (1.0 / depth) * u_particleAmount;
        }
      `,
      `
        precision highp float;

        uniform vec3 u_color1;
        uniform vec3 u_color2;
        uniform vec3 u_color3;
        uniform float u_glow;

        varying float v_depth;
        varying float v_mix;
        varying float v_twinkle;

        void main() {
          vec2 p = gl_PointCoord - 0.5;
          float d = length(p);
          float core = smoothstep(0.5, 0.0, d);
          float ring = smoothstep(0.5, 0.16, d) * smoothstep(0.02, 0.24, d);
          vec3 color = mix(u_color1, u_color2, v_mix);
          color = mix(color, u_color3, smoothstep(0.7, 1.0, v_depth));
          float alpha = (core + ring * 0.24) * (0.18 + v_depth) * v_twinkle * u_glow;

          gl_FragColor = vec4(color * alpha, alpha);
        }
      `,
    );

    this.ringProgram = createProgram(
      this.gl,
      `
        attribute vec2 a_position;
        attribute float a_level;
        attribute float a_band;
        attribute float a_phase;

        uniform float u_time;
        uniform float u_glow;
        uniform float u_beat;
        uniform vec2 u_pointer;

        varying float v_level;
        varying float v_band;
        varying float v_phase;

        void main() {
          vec2 bend = u_pointer * 0.02 * a_band;
          float shimmer = 1.0 + sin(u_time * 5.0 + a_phase * 31.0) * 0.012 * u_glow + u_beat * 0.035;
          gl_Position = vec4((a_position + bend) * shimmer, 0.0, 1.0);
          v_level = a_level;
          v_band = a_band;
          v_phase = a_phase;
        }
      `,
      `
        precision highp float;

        uniform vec3 u_color1;
        uniform vec3 u_color2;
        uniform vec3 u_color3;
        uniform float u_time;
        uniform float u_glow;

        varying float v_level;
        varying float v_band;
        varying float v_phase;

        void main() {
          vec3 color = mix(u_color1, u_color2, smoothstep(0.0, 0.65, v_band));
          color = mix(color, u_color3, smoothstep(0.62, 1.0, v_band));
          float flicker = 0.72 + 0.28 * sin(u_time * 10.0 + v_phase * 55.0);
          float alpha = (0.1 + v_level * 0.72) * flicker * u_glow;
          gl_FragColor = vec4(color * alpha, alpha);
        }
      `,
    );

    this.burstProgram = createProgram(
      this.gl,
      `
        attribute vec2 a_position;
        attribute float a_age;
        attribute float a_seed;

        uniform vec2 u_resolution;
        uniform vec3 u_color1;
        uniform vec3 u_color2;
        uniform float u_high;
        uniform float u_glow;

        varying float v_age;
        varying float v_seed;

        void main() {
          float aspect = u_resolution.x / u_resolution.y;
          gl_Position = vec4(a_position.x / aspect, a_position.y, 0.0, 1.0);
          gl_PointSize = (2.0 + a_seed * 4.5 + u_high * 5.0) * (1.0 - a_age * 0.35) * u_glow;
          v_age = a_age;
          v_seed = a_seed;
        }
      `,
      `
        precision highp float;

        uniform vec3 u_color1;
        uniform vec3 u_color2;

        varying float v_age;
        varying float v_seed;

        void main() {
          vec2 p = gl_PointCoord - 0.5;
          float d = length(p);
          float alpha = smoothstep(0.5, 0.0, d) * (1.0 - v_age);
          vec3 color = mix(u_color1, u_color2, v_seed);
          gl_FragColor = vec4(color * alpha, alpha);
        }
      `,
    );
  }

  createBuffers() {
    const gl = this.gl;

    this.fullscreenBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.fullscreenBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

    this.starBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.starBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.createStarData(), gl.STATIC_DRAW);

    this.ringBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.ringBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.ringData.byteLength, gl.DYNAMIC_DRAW);

    this.burstBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.burstBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.burstData.byteLength, gl.DYNAMIC_DRAW);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  }

  createStarData() {
    const data = new Float32Array(this.maxStars * 4);

    for (let index = 0; index < this.maxStars; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.pow(Math.random(), 0.58) * 1.9 + 0.03;
      data[index * 4] = Math.cos(angle) * radius;
      data[index * 4 + 1] = Math.sin(angle) * radius;
      data[index * 4 + 2] = Math.random();
      data[index * 4 + 3] = Math.random();
    }

    return data;
  }

  addBurst(origin, strength = 1) {
    const count = Math.floor(34 * strength);

    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.2 + Math.random() * 0.58 * strength;
      this.bursts.push({
        x: origin.x,
        y: origin.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        age: 0,
        life: 0.45 + Math.random() * 0.45,
        seed: Math.random(),
      });
    }

    if (this.bursts.length > this.maxBursts) {
      this.bursts.splice(0, this.bursts.length - this.maxBursts);
    }
  }

  render(delta, audio, options, pointer) {
    this.time += delta;
    this.beatKick += ((audio.beat || 0) - this.beatKick) * Math.min(1, delta * 12);
    this.resize();
    this.updateBursts(delta, audio);
    this.drawBackground(audio, options, pointer);
    this.drawStars(audio, options, pointer);
    this.drawRings(audio, options, pointer);
    this.drawBursts(audio, options);
  }

  drawBackground(audio, options, pointer) {
    const gl = this.gl;
    gl.disable(gl.BLEND);
    gl.useProgram(this.backgroundProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.fullscreenBuffer);
    bindAttribute(gl, this.backgroundProgram, "a_position", 2, 2, 0);
    setCommonUniforms(gl, this.backgroundProgram, this.canvas, audio, options, pointer, this.time, this.beatKick);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.enable(gl.BLEND);
  }

  drawStars(audio, options, pointer) {
    const gl = this.gl;
    const count = Math.max(130, Math.floor(this.maxStars * options.particleAmount));
    gl.useProgram(this.starProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.starBuffer);
    bindAttribute(gl, this.starProgram, "a_seed", 4, 4, 0);
    setCommonUniforms(gl, this.starProgram, this.canvas, audio, options, pointer, this.time, this.beatKick);
    setUniform1(gl, this.starProgram, "u_speed", options.starSpeed);
    setUniform1(gl, this.starProgram, "u_particleAmount", options.particleAmount);
    setUniform1(gl, this.starProgram, "u_particleStyle", options.preset.particleStyle);
    gl.drawArrays(gl.POINTS, 0, count);
  }

  drawRings(audio, options, pointer) {
    const gl = this.gl;
    this.buildRingGeometry(audio, options, pointer);
    gl.useProgram(this.ringProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.ringBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.ringData, gl.DYNAMIC_DRAW);
    bindAttribute(gl, this.ringProgram, "a_position", 2, 5, 0);
    bindAttribute(gl, this.ringProgram, "a_level", 1, 5, 2);
    bindAttribute(gl, this.ringProgram, "a_band", 1, 5, 3);
    bindAttribute(gl, this.ringProgram, "a_phase", 1, 5, 4);
    setCommonUniforms(gl, this.ringProgram, this.canvas, audio, options, pointer, this.time, this.beatKick);
    gl.drawArrays(gl.TRIANGLES, 0, this.ringVertexCount);
  }

  drawBursts(audio, options) {
    if (!this.burstDrawCount) {
      return;
    }

    const gl = this.gl;
    gl.useProgram(this.burstProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.burstBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.burstData.subarray(0, this.burstDrawCount * 4), gl.DYNAMIC_DRAW);
    bindAttribute(gl, this.burstProgram, "a_position", 2, 4, 0);
    bindAttribute(gl, this.burstProgram, "a_age", 1, 4, 2);
    bindAttribute(gl, this.burstProgram, "a_seed", 1, 4, 3);
    setCommonUniforms(gl, this.burstProgram, this.canvas, audio, options, { x: 0, y: 0, zoom: 1, super: 0 }, this.time, this.beatKick);
    gl.drawArrays(gl.POINTS, 0, this.burstDrawCount);
  }

  buildRingGeometry(audio, options, pointer) {
    const aspect = this.canvas.width / this.canvas.height;
    const chroma = options.preset.name === "Chromatic Clock";
    const vertex = options.preset.name === "4TEX777";
    const bands = [audio.bass, audio.mid, audio.high, audio.volume, this.beatKick, audio.mid, audio.high, audio.bass + audio.high * 0.35];
    let offset = 0;

    for (let ring = 0; ring < this.ringCount; ring += 1) {
      const level = bands[ring] || 0;
      const bandType = ring / (this.ringCount - 1);
      const drift = this.time * (0.13 + ring * 0.028 + options.starSpeed * 0.02 + (chroma ? audio.mid * 0.06 : 0));
      const spacing = chroma ? 0.068 : vertex ? 0.064 : 0.072;
      const centerBias = ring === 0 ? 0.035 + audio.bass * 0.026 + this.beatKick * 0.035 : 0;
      const baseRadius = 0.1 + ring * spacing + centerBias + audio.bass * (chroma ? 0.03 : 0.02) + this.beatKick * (chroma ? 0.04 : 0.028);
      const thickness = 0.005 + level * (0.014 + ring * 0.0012) + options.glow * 0.0025 + (vertex ? 0.002 : 0);
      const presetWarp = options.preset.tunnel * options.warp;

      for (let segment = 0; segment < this.ringSegments; segment += 1) {
        const a0 = (segment / this.ringSegments) * Math.PI * 2 + drift;
        const a1 = ((segment + 1) / this.ringSegments) * Math.PI * 2 + drift;
        const wave0 = Math.sin(a0 * (4.5 + ring + (vertex ? 2.0 : 0)) + this.time * (2.2 + audio.mid * 2.6)) * 0.01 * presetWarp;
        const wave1 = Math.sin(a1 * (4.5 + ring + (vertex ? 2.0 : 0)) + this.time * (2.2 + audio.mid * 2.6)) * 0.01 * presetWarp;
        const bend = 0.02 * pointer.intensity;
        const inner0 = baseRadius + wave0 + level * 0.058 + bend;
        const inner1 = baseRadius + wave1 + level * 0.058 + bend;
        const outer0 = inner0 + thickness;
        const outer1 = inner1 + thickness;
        const p0 = polar(a0, inner0, aspect);
        const p1 = polar(a1, inner1, aspect);
        const p2 = polar(a0, outer0, aspect);
        const p3 = polar(a1, outer1, aspect);
        const phase = segment / this.ringSegments;

        offset = writeRingVertex(this.ringData, offset, p0, level, bandType, phase);
        offset = writeRingVertex(this.ringData, offset, p1, level, bandType, phase);
        offset = writeRingVertex(this.ringData, offset, p2, level, bandType, phase);
        offset = writeRingVertex(this.ringData, offset, p2, level, bandType, phase);
        offset = writeRingVertex(this.ringData, offset, p1, level, bandType, phase);
        offset = writeRingVertex(this.ringData, offset, p3, level, bandType, phase);
      }
    }
  }

  updateBursts(delta, audio) {
    let offset = 0;

    this.bursts = this.bursts.filter((burst) => {
      burst.age += delta;
      burst.x += burst.vx * delta * (1 + audio.beat * 1.8);
      burst.y += burst.vy * delta * (1 + audio.beat * 1.8);

      if (burst.age >= burst.life || offset >= this.maxBursts * 4) {
        return false;
      }

      this.burstData[offset] = burst.x;
      this.burstData[offset + 1] = burst.y;
      this.burstData[offset + 2] = burst.age / burst.life;
      this.burstData[offset + 3] = burst.seed;
      offset += 4;
      return true;
    });

    this.burstDrawCount = offset / 4;
  }

  reset() {
    this.time = 0;
    this.beatKick = 0;
    this.bursts = [];
    this.burstDrawCount = 0;
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.starBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.createStarData(), this.gl.STATIC_DRAW);
  }

  resize() {
    const cap = window.innerWidth < 720 ? 1.35 : 2;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, cap);
    const width = Math.max(1, Math.floor(this.canvas.clientWidth * pixelRatio));
    const height = Math.max(1, Math.floor(this.canvas.clientHeight * pixelRatio));

    if (this.canvas.width !== width || this.canvas.height !== height || this.pixelRatio !== pixelRatio) {
      this.pixelRatio = pixelRatio;
      this.canvas.width = width;
      this.canvas.height = height;
      this.gl.viewport(0, 0, width, height);
    }
  }

  screenshot(presetName) {
    const link = document.createElement("a");
    link.download = `webgl-visualizer-${slugify(presetName)}.png`;
    link.href = this.canvas.toDataURL("image/png");
    link.click();
  }
}

class FallbackRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.time = 0;
    this.bursts = [];
  }

  addBurst(origin, strength = 1) {
    this.bursts.push({ ...origin, age: 0, strength });
  }

  render(delta, audio, options, pointer) {
    this.time += delta;
    this.resize();

    const ctx = this.context;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const cx = width / 2 + pointer.x * width * 0.04;
    const cy = height / 2 - pointer.y * height * 0.04;
    const colors = options.preset.colors;

    ctx.fillStyle = colors[0];
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = "lighter";

    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.75);
    gradient.addColorStop(0, hexToRgba(colors[1], 0.18 + audio.volume * 0.12));
    gradient.addColorStop(0.45, hexToRgba(colors[2], 0.1 + audio.mid * 0.09));
    gradient.addColorStop(1, hexToRgba(colors[0], 1));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const starCount = Math.floor(170 * options.particleAmount);
    for (let index = 0; index < starCount; index += 1) {
      const angle = index * 2.399 + this.time * 0.25 + pointer.x * 0.4;
      const travel = ((this.time * options.starSpeed * (82 + audio.bass * 120) + index * 41) % Math.max(width, height)) / Math.max(width, height);
      const radius = travel * Math.max(width, height) * 0.7;
      const size = 0.8 + travel * 3.2 + audio.high * 4;
      ctx.globalAlpha = 0.25 + travel * 0.62;
      ctx.fillStyle = index % 3 === 0 ? colors[2] : colors[1];
      ctx.beginPath();
      ctx.arc(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, size, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let ring = 0; ring < 7; ring += 1) {
      const level = [audio.bass, audio.mid, audio.high, audio.volume, audio.beat, audio.mid, audio.high][ring];
      ctx.strokeStyle = colors[(ring % 3) + 1];
      ctx.globalAlpha = 0.14 + level * 0.55;
      ctx.lineWidth = 1 + level * 8;
      ctx.beginPath();
      ctx.arc(cx, cy, 42 + ring * 34 + level * 70, 0, Math.PI * 2);
      ctx.stroke();
    }

    this.bursts = this.bursts.filter((burst) => {
      burst.age += delta;
      const alpha = 1 - burst.age / 0.55;
      if (alpha <= 0) {
        return false;
      }
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = colors[3];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx + burst.x * width * 0.5, cy - burst.y * height * 0.5, burst.age * 340 * burst.strength, 0, Math.PI * 2);
      ctx.stroke();
      return true;
    });

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  reset() {
    this.time = 0;
    this.bursts = [];
  }

  resize() {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = Math.max(1, Math.floor(this.canvas.clientWidth * pixelRatio));
    const height = Math.max(1, Math.floor(this.canvas.clientHeight * pixelRatio));

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  screenshot(presetName) {
    const link = document.createElement("a");
    link.download = `webgl-visualizer-${slugify(presetName)}.png`;
    link.href = this.canvas.toDataURL("image/png");
    link.click();
  }
}

class VisualizerApp {
  constructor(elements) {
    this.elements = elements;
    this.audio = new AudioEngine(elements);
    this.interaction = new InteractionController(elements.canvas);
    this.usingFallback = false;
    this.renderer = this.createRenderer(elements.canvas);
    this.lastTime = performance.now();
    this.animationFrame = 0;
    this.started = false;
    this.interaction.onBurst = (origin, strength) => this.renderer.addBurst(origin, strength);
    this.bindEvents();
    this.applyPreset(PRESETS[0]);
    this.frame = this.frame.bind(this);
  }

  start() {
    if (this.started) {
      return;
    }

    this.started = true;
    this.audio.setStatus(
      this.usingFallback
        ? "WebGL is unavailable, so a simpler canvas fallback is running. Audio controls still work."
        : "Choose microphone or upload audio. Tap to burst, drag to warp, long press for super mode.",
    );
    this.animationFrame = requestAnimationFrame(this.frame);
  }

  stop() {
    this.started = false;
    cancelAnimationFrame(this.animationFrame);
    this.interaction.destroy();
    this.audio.reset();
  }

  createRenderer(canvas) {
    try {
      return new SpaceRenderer(canvas);
    } catch (error) {
      console.warn(error);
      this.usingFallback = true;
      this.elements.status.textContent = "WebGL is unavailable, so a simpler canvas fallback is running.";
      return new FallbackRenderer(canvas);
    }
  }

  bindEvents() {
    this.elements.micButton.addEventListener("click", () => this.audio.startMicrophone());
    this.elements.fileInput.addEventListener("change", () => this.audio.loadFile(this.elements.fileInput.files[0]));
    this.elements.playPauseButton.addEventListener("click", () => this.audio.toggleFilePlayback());
    this.elements.resetButton.addEventListener("click", () => {
      this.audio.reset();
      this.renderer.reset();
    });
    this.elements.screenshotButton.addEventListener("click", () => this.saveScreenshot());
    this.elements.compactButton.addEventListener("click", () => this.toggleCompactUi());
    this.elements.collapseButton.addEventListener("click", () => this.toggleControls());
    this.elements.presetSelect.addEventListener("change", () => {
      const preset = PRESETS.find((item) => item.name === this.elements.presetSelect.value) || PRESETS[0];
      this.applyPreset(preset);
    });
    this.elements.intensitySelect.addEventListener("change", () => {
      settings.intensity = this.elements.intensitySelect.value;
      this.elements.status.textContent = `${settings.intensity} intensity active.`;
    });
    this.elements.textToggle.addEventListener("change", () => this.updateTextLayer());
    this.elements.textInput.addEventListener("input", () => this.updateTextLayer());

    this.elements.gainSlider.addEventListener("input", () => {
      settings.sensitivity = Number(this.elements.gainSlider.value);
    });
    this.elements.speedSlider.addEventListener("input", () => {
      settings.starSpeed = Number(this.elements.speedSlider.value);
    });
    this.elements.glowSlider.addEventListener("input", () => {
      settings.glow = Number(this.elements.glowSlider.value);
    });
    this.elements.particleSlider.addEventListener("input", () => {
      settings.particleAmount = Number(this.elements.particleSlider.value);
    });
    this.elements.warpSlider.addEventListener("input", () => {
      settings.warp = Number(this.elements.warpSlider.value);
    });
  }

  toggleControls() {
    const isCollapsed = this.elements.controlPanel.classList.toggle("is-collapsed");
    this.elements.collapseButton.textContent = isCollapsed ? "Show controls" : "Minimize controls";
    this.elements.collapseButton.setAttribute("aria-expanded", String(!isCollapsed));
  }

  toggleCompactUi() {
    const isCompact = document.body.classList.toggle("compact-ui");
    this.elements.compactButton.textContent = isCompact ? "Show UI" : "Compact UI";
    this.elements.compactButton.setAttribute("aria-pressed", String(isCompact));
  }

  applyPreset(preset) {
    settings.preset = preset;
    document.documentElement.style.setProperty("--accent", preset.accent);
    document.documentElement.style.setProperty("--accent-2", preset.colors[2]);
    document.documentElement.style.setProperty("--accent-3", preset.colors[3]);
    if (!this.usingFallback) {
      this.elements.status.textContent = `${preset.name} preset loaded.`;
    }
    this.updateTextLayer();
  }

  updateTextLayer() {
    const text = this.elements.textInput.value.trim() || "RAW WEBGL";
    this.elements.textOverlay.textContent = text;
    this.elements.textOverlay.dataset.text = text;
    this.elements.textOverlay.classList.toggle("is-hidden", !this.elements.textToggle.checked);
  }

  frame(now) {
    const delta = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    const activeSettings = getActiveSettings();
    const audioBands = this.audio.sample(delta, settings.sensitivity * activeSettings.intensityProfile.audio);
    const pointer = this.interaction.update(delta);

    if (audioBands.beatHit) {
      this.renderer.addBurst({ x: 0, y: 0 }, (1.1 + audioBands.bass * 0.65) * activeSettings.intensityProfile.beat);
    }

    this.updateMeters(audioBands);
    this.updateLogo(audioBands, activeSettings);
    this.renderer.render(delta, audioBands, activeSettings, pointer);
    this.animationFrame = requestAnimationFrame(this.frame);
  }

  updateMeters(audio) {
    this.elements.meters.bass.style.width = `${Math.min(audio.bass, 1) * 100}%`;
    this.elements.meters.mid.style.width = `${Math.min(audio.mid, 1) * 100}%`;
    this.elements.meters.high.style.width = `${Math.min(audio.high, 1) * 100}%`;
    this.elements.meters.volume.style.width = `${Math.min(audio.volume, 1) * 100}%`;
  }

  updateLogo(audio, activeSettings) {
    const glitch = (audio.high * 8 + audio.beat * 5) * activeSettings.intensityProfile.glitch;
    this.elements.textOverlay.style.setProperty("--text-scale", String(1 + audio.bass * 0.045 + audio.beat * 0.08));
    this.elements.textOverlay.style.setProperty("--glitch-x", `${(Math.random() - 0.5) * glitch}px`);
    this.elements.textOverlay.style.setProperty("--glitch-y", `${(Math.random() - 0.5) * glitch * 0.45}px`);
    this.elements.textOverlay.style.opacity = String(this.elements.textToggle.checked ? 0.52 + audio.volume * 0.32 : 0);
    this.elements.textOverlay.dataset.text = this.elements.textOverlay.textContent;
  }

  saveScreenshot() {
    const image = new Image();
    const canvasUrl = this.elements.canvas.toDataURL("image/png");

    image.onload = () => {
      const exportCanvas = document.createElement("canvas");
      const ctx = exportCanvas.getContext("2d");
      exportCanvas.width = this.elements.canvas.width;
      exportCanvas.height = this.elements.canvas.height;
      ctx.drawImage(image, 0, 0);

      if (this.elements.textToggle.checked) {
        const text = this.elements.textInput.value.trim() || "RAW WEBGL";
        const fontSize = Math.max(44, exportCanvas.width * 0.13);
        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `950 ${fontSize}px Inter, Arial, sans-serif`;
        ctx.shadowColor = settings.preset.colors[1];
        ctx.shadowBlur = fontSize * 0.16;
        ctx.fillStyle = settings.preset.colors[3];
        ctx.globalAlpha = 0.82;
        ctx.fillText(text.toUpperCase(), exportCanvas.width / 2, exportCanvas.height / 2, exportCanvas.width * 0.92);
        ctx.restore();
      }

      const link = document.createElement("a");
      link.download = buildScreenshotName(settings.preset.name, this.elements.textInput.value);
      link.href = exportCanvas.toDataURL("image/png");
      link.click();
    };

    image.src = canvasUrl;
  }
}

function createProgram(gl, vertexSource, fragmentSource) {
  const program = gl.createProgram();
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Could not link WebGL program: ${message}`);
  }

  return program;
}

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Could not compile WebGL shader: ${message}`);
  }

  return shader;
}

function bindAttribute(gl, program, name, size, stride, offset) {
  const location = gl.getAttribLocation(program, name);

  if (location < 0) {
    return;
  }

  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(
    location,
    size,
    gl.FLOAT,
    false,
    stride * Float32Array.BYTES_PER_ELEMENT,
    offset * Float32Array.BYTES_PER_ELEMENT,
  );
}

function setCommonUniforms(gl, program, canvas, audio, options, pointer, time, beatKick) {
  const colors = options.preset.colors.map(hexToVec3);
  setUniform2(gl, program, "u_resolution", canvas.width, canvas.height);
  setUniform3(gl, program, "u_color0", colors[0]);
  setUniform3(gl, program, "u_color1", colors[1]);
  setUniform3(gl, program, "u_color2", colors[2]);
  setUniform3(gl, program, "u_color3", colors[3]);
  setUniform1(gl, program, "u_time", time);
  setUniform1(gl, program, "u_bass", audio.bass);
  setUniform1(gl, program, "u_mid", audio.mid);
  setUniform1(gl, program, "u_high", audio.high);
  setUniform1(gl, program, "u_volume", audio.volume);
  setUniform1(gl, program, "u_beat", beatKick);
  setUniform1(gl, program, "u_glow", options.glow);
  setUniform1(gl, program, "u_warp", options.warp);
  setUniform1(gl, program, "u_presetMode", options.preset.mode);
  setUniform1(gl, program, "u_tunnel", options.preset.tunnel);
  setUniform2(gl, program, "u_pointer", pointer.x || 0, pointer.y || 0);
  setUniform1(gl, program, "u_zoom", pointer.zoom || 1);
  setUniform1(gl, program, "u_super", pointer.super || 0);
}

function setUniform1(gl, program, name, value) {
  const location = gl.getUniformLocation(program, name);

  if (location !== null) {
    gl.uniform1f(location, value);
  }
}

function setUniform2(gl, program, name, x, y) {
  const location = gl.getUniformLocation(program, name);

  if (location !== null) {
    gl.uniform2f(location, x, y);
  }
}

function setUniform3(gl, program, name, value) {
  const location = gl.getUniformLocation(program, name);

  if (location !== null) {
    gl.uniform3f(location, value[0], value[1], value[2]);
  }
}

function polar(angle, radius, aspect) {
  return [Math.cos(angle) * radius / aspect, Math.sin(angle) * radius];
}

function writeRingVertex(data, offset, point, level, band, phase) {
  data[offset] = point[0];
  data[offset + 1] = point[1];
  data[offset + 2] = level;
  data[offset + 3] = band;
  data[offset + 4] = phase;
  return offset + 5;
}

function hexToVec3(hex) {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized, 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

function hexToRgba(hex, alpha) {
  const [r, g, b] = hexToVec3(hex).map((channel) => Math.round(channel * 255));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function buildScreenshotName(presetName, textValue) {
  const date = new Date();
  const dateStamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
  const timeStamp = [
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
  ].join("-");
  const textSlug = slugify(textValue.trim() || "raw-webgl");

  return `rawwebgl-${slugify(presetName)}-${textSlug}-${dateStamp}-${timeStamp}.png`;
}

function getActiveSettings() {
  const profile = INTENSITY_MODES[settings.intensity] || INTENSITY_MODES.Normal;

  return {
    ...settings,
    starSpeed: settings.starSpeed * profile.speed,
    glow: settings.glow * profile.glow,
    particleAmount: clamp(settings.particleAmount * profile.particles, 0.18, 1.25),
    warp: settings.warp * profile.warp,
    intensityProfile: profile,
  };
}

function requireElement(selector) {
  const element = document.querySelector(selector);

  if (!element) {
    throw new Error(`Visualizer UI is missing required element: ${selector}`);
  }

  return element;
}

if (!window.__rawWebglVisualizer) {
  window.__rawWebglVisualizer = new VisualizerApp(ui);
  window.__rawWebglVisualizer.start();
}
