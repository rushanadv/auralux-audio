/**
 * AudioEngine - Web Audio API engine for audio analysis
 * Captures audio from microphone or fallback oscillator and provides
 * frequency/waveform data for visualization.
 */
export class AudioEngine {
  constructor() {
    // Create AudioContext (handles vendor prefixes)
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // Create AnalyserNode with specified settings
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;

    // Create gain node for volume control, inserted between analyser and destination
    this.gainNode = this.audioContext.createGain();
    this.analyser.connect(this.gainNode);
    this.gainNode.connect(this.audioContext.destination);

    // Pre-allocate frequency data buffers
    this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    this.waveformData = new Uint8Array(this.analyser.frequencyBinCount);

    // Level properties (normalized 0-1)
    this.bass = 0;
    this.mid = 0;
    this.treble = 0;

    // Smoothed level properties for smooth animation (lerp factor 0.1)
    this.smoothedBass = 0;
    this.smoothedMid = 0;
    this.smoothedTreble = 0;

    // References to active sources
    this.mediaStreamSource = null;
    this.oscillator = null;
    this.oscillatorGain = null;
    this.source = null; // Active media source (mic or file)
    this.fileSource = null;

    // Flag to check if audio is initialized
    this.initialized = false;
  }

  /**
   * Request microphone access; fall back to oscillator if denied.
   * Also offers file loading as an alternative input.
   * @param {Object} options - Initialization options
   * @param {boolean} options.tryMic - Whether to attempt getUserMedia (default: true)
   */
  async init(options = {}) {
    const { tryMic = true } = options;

    // Resume audio context if suspended (required after user gesture)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    if (tryMic) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.mediaStreamSource = this.audioContext.createMediaStreamSource(stream);
        this.mediaStreamSource.connect(this.analyser);
        this.source = this.mediaStreamSource;
        this.initialized = true;
        console.log('[AudioEngine] Microphone connected successfully.');
        return true;
      } catch (error) {
        console.warn('[AudioEngine] Microphone access denied, falling back to oscillator.', error);
      }
    }

    // Fallback: OscillatorNode demo tone
    this._setupFallbackOscillator();
    this.initialized = true;
    console.log('[AudioEngine] Using fallback oscillator (demo tone).');
    return false;
  }

  /**
   * Load an audio file and play it through the analyser for visualization.
   * Uses FileReader to read the file as ArrayBuffer, decodes it, and
   * creates a looping BufferSourceNode.
   * @param {File} file - The audio file to load
   * @returns {Promise<AudioBufferSourceNode>} Resolves when playback starts
   */
  async loadFile(file) {
    // Stop and disconnect any existing file source
    if (this.fileSource) {
      this.fileSource.stop();
      this.fileSource.disconnect();
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        this.audioContext.decodeAudioData(reader.result)
          .then((audioBuffer) => {
            this.fileSource = this.audioContext.createBufferSource();
            this.fileSource.buffer = audioBuffer;
            this.fileSource.loop = true;
            this.fileSource.connect(this.analyser);
            this.fileSource.start(0);
            resolve(this.fileSource);
          })
          .catch(reject);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Set up a fallback OscillatorNode (sine wave demo tone).
   * @private
   */
  _setupFallbackOscillator() {
    this.oscillator = this.audioContext.createOscillator();
    this.oscillator.type = 'sine';
    this.oscillator.frequency.value = 220; // A3 note

    // Add slight frequency modulation for visual interest
    this.oscillatorGain = this.audioContext.createGain();
    this.oscillatorGain.gain.value = 0.3;

    this.oscillator.connect(this.oscillatorGain);
    this.oscillatorGain.connect(this.analyser);
    this.oscillator.start();
  }

  /**
   * Get frequency data from the analyser.
   * @returns {Uint8Array} Frequency data array
   */
  getFrequencyData() {
    this.analyser.getByteFrequencyData(this.frequencyData);
    return this.frequencyData;
  }

  /**
   * Get waveform (time-domain) data from the analyser.
   * @returns {Uint8Array} Waveform data array
   */
  getWaveformData() {
    this.analyser.getByteTimeDomainData(this.waveformData);
    return this.waveformData;
  }

  /**
   * Update energy levels (bass, mid, treble) and smoothed versions.
   * Should be called each animation frame for real-time updates.
   */
  update() {
    const data = this.getFrequencyData();
    const binCount = data.length; // 1024 for fftSize 2048

    // Bass: average of bins 0-4
    let bassSum = 0;
    const bassEnd = Math.min(4, binCount - 1);
    for (let i = 0; i <= bassEnd; i++) {
      bassSum += data[i];
    }
    this.bass = bassSum / (bassEnd + 1) / 255;

    // Mid: average of bins 5-40
    let midSum = 0;
    let midCount = 0;
    const midEnd = Math.min(40, binCount - 1);
    for (let i = 5; i <= midEnd; i++) {
      midSum += data[i];
      midCount++;
    }
    this.mid = midCount > 0 ? midSum / midCount / 255 : 0;

    // Treble: average of bins 41-128
    let trebleSum = 0;
    let trebleCount = 0;
    const trebleEnd = Math.min(128, binCount - 1);
    for (let i = 41; i <= trebleEnd; i++) {
      trebleSum += data[i];
      trebleCount++;
    }
    this.treble = trebleCount > 0 ? trebleSum / trebleCount / 255 : 0;

    // Smoothed values (lerp factor 0.1)
    const lerpFactor = 0.1;
    this.smoothedBass = this._lerp(this.smoothedBass, this.bass, lerpFactor);
    this.smoothedMid = this._lerp(this.smoothedMid, this.mid, lerpFactor);
    this.smoothedTreble = this._lerp(this.smoothedTreble, this.treble, lerpFactor);
  }

  /**
   * Linear interpolation helper.
   * @private
   */
  _lerp(start, end, t) {
    return start + (end - start) * t;
  }

  /**
   * Get current energy levels.
   * @returns {Object} { bass, mid, treble } normalized 0-1
   */
  getEnergy() {
    return {
      bass: this.bass,
      mid: this.mid,
      treble: this.treble,
    };
  }

  /**
   * Get smoothed energy levels.
   * @returns {Object} { bass, mid, treble } normalized 0-3
   */
  getSmoothedEnergy() {
    return {
      bass: this.smoothedBass,
      mid: this.smoothedMid,
      treble: this.smoothedTreble,
    };
  }

  /**
   * Toggle mute state via the gain node.
   * If currently unmuted (gain > 0), set gain to 0; otherwise restore to 1.
   */
  toggleMute() {
    if (this.gainNode.gain.value > 0) {
      this.gainNode.gain.value = 0;
    } else {
      this.gainNode.gain.value = 1;
    }
  }

  /**
   * Whether audio is currently muted.
   * @returns {boolean}
   */
  get isMuted() {
    return this.gainNode.gain.value === 0;
  }

  /**
   * Disconnect and clean up all audio nodes.
   */
  dispose() {
    if (this.oscillator) {
      this.oscillator.stop();
      this.oscillator.disconnect();
      this.oscillator = null;
    }
    if (this.oscillatorGain) {
      this.oscillatorGain.disconnect();
      this.oscillatorGain = null;
    }
    if (this.mediaStreamSource) {
      this.mediaStreamSource.disconnect();
      this.mediaStreamSource = null;
    }
    if (this.fileSource) {
      this.fileSource.stop();
      this.fileSource.disconnect();
      this.fileSource = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
    this.analyser.disconnect();
    this.audioContext.close();
    this.initialized = false;
  }

  async captureTabAudio() {
    if (this.captureStream) {
      this.captureStream.getTracks().forEach(t => t.stop())
      if (this.captureSource) this.captureSource.disconnect()
    }
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: false, audio: true })
    if (!stream.getAudioTracks().length) throw new Error('No audio track — check Share audio in the picker')
    this.captureSource = this.audioContext.createMediaStreamSource(stream)
    this.captureSource.connect(this.analyser)
    this.captureStream = stream
  }

  stopCapture() {
    if (this.captureStream) this.captureStream.getTracks().forEach(t => t.stop())
    if (this.captureSource) this.captureSource.disconnect()
    this.captureStream = null
    this.captureSource = null
  }
}

/**
 * AudioFileLoader - Lets users load an audio file as an alternative to microphone.
 * Creates a hidden file input and decodes selected audio files for playback.
 */
export class AudioFileLoader {
  constructor(audioEngine) {
    this.audioEngine = audioEngine;
    this.input = null;
    this.audioBuffer = null;
    this.bufferSource = null;
  }

  /**
   * Create a hidden file input element.
   * @returns {HTMLInputElement} The hidden file input
   */
  createInput() {
    this.input = document.createElement('input');
    this.input.type = 'file';
    this.input.accept = 'audio/*';
    this.input.style.display = 'none';
    document.body.appendChild(this.input);
    return this.input;
  }

  /**
   * Load and play an audio file from a File object.
   * @param {File} file - The audio file to load
   * @returns {Promise<AudioBufferSourceNode>} Resolves when audio starts playing
   */
  async loadFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    this.audioBuffer = await this.audioEngine.audioContext.decodeAudioData(arrayBuffer);

    // Create buffer source, connect to analyzer, and start playing
    this.bufferSource = this.audioEngine.audioContext.createBufferSource();
    this.bufferSource.buffer = this.audioBuffer;
    this.bufferSource.loop = true;
    this.bufferSource.connect(this.audioEngine.analyser);
    this.bufferSource.start();

    // Store as active source
    this.audioEngine.source = this.bufferSource;

    return this.bufferSource;
  }

  /**
   * Prompt user to select a file and load it.
   * @returns {Promise<AudioBufferSourceNode>} Resolves when audio starts playing
   */
  async selectAndLoad() {
    if (!this.input) {
      this.createInput();
    }

    return new Promise((resolve, reject) => {
      this.input.onchange = async (event) => {
        const file = event.target.files[0];
        if (!file) {
          reject(new Error('No file selected'));
          return;
        }
        try {
          const source = await this.loadFile(file);
          console.log('[AudioFileLoader] File loaded and playing:', file.name);
          resolve(source);
        } catch (error) {
          console.error('[AudioFileLoader] Error loading file:', error);
          reject(error);
        }
      };
      this.input.click();
    });
  }
}
