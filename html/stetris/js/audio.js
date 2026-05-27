class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterVolume = null;
    this.musicVolume = null;
    this.sfxVolume = null;
    
    // Settings
    this.musicEnabled = localStorage.getItem('musicEnabled') !== 'false';
    this.sfxEnabled = localStorage.getItem('sfxEnabled') !== 'false';
    this.musicVolValue = parseFloat(localStorage.getItem('musicVolume') || '0.5');
    this.sfxVolValue = parseFloat(localStorage.getItem('sfxVolume') || '0.6');
    this.masterVolValue = parseFloat(localStorage.getItem('masterVolume') || '0.8');

    // Music loop states
    this.isPlaying = false;
    this.tempo = 115; // BPM
    this.stepTime = 60 / this.tempo / 4; // 16th notes
    this.currentStep = 0;
    this.timerId = null;
    this.nextNoteTime = 0.0;
    
    // Chord progression in A minor
    this.progression = [
      ['A2', 'A3', 'C4', 'E4'], // Am
      ['F2', 'F3', 'A3', 'C4'], // F
      ['C2', 'C3', 'E3', 'G3'], // C
      ['G2', 'G3', 'B3', 'D4']  // G
    ];
    this.chordIndex = 0;
    this.barCount = 0;
    
    // Scale frequencies
    this.notes = {
      'A2': 110.00, 'B2': 123.47, 'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00, 'A3': 220.00,
      'B3': 246.94, 'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
      'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99, 'A5': 880.00
    };
  }

  init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContextClass();
    
    // Setup routing nodes
    this.masterVolume = this.ctx.createGain();
    this.masterVolume.gain.value = this.masterVolValue;
    this.masterVolume.connect(this.ctx.destination);

    this.musicVolume = this.ctx.createGain();
    this.musicVolume.gain.value = this.musicEnabled ? this.musicVolValue : 0;
    this.musicVolume.connect(this.masterVolume);

    this.sfxVolume = this.ctx.createGain();
    this.sfxVolume.gain.value = this.sfxEnabled ? this.sfxVolValue : 0;
    this.sfxVolume.connect(this.masterVolume);
  }

  // Resume context (necessary after user interaction)
  async resume() {
    this.init();
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  setMusicEnabled(enabled) {
    this.musicEnabled = enabled;
    localStorage.setItem('musicEnabled', enabled);
    if (this.musicVolume) {
      this.musicVolume.gain.setValueAtTime(enabled ? this.musicVolValue : 0, this.ctx.currentTime);
    }
    if (enabled && !this.isPlaying) {
      this.startMusic();
    } else if (!enabled && this.isPlaying) {
      this.stopMusic();
    }
  }

  setSfxEnabled(enabled) {
    this.sfxEnabled = enabled;
    localStorage.setItem('sfxEnabled', enabled);
    if (this.sfxVolume) {
      this.sfxVolume.gain.setValueAtTime(enabled ? this.sfxVolValue : 0, this.ctx.currentTime);
    }
  }

  setMusicVolume(val) {
    this.musicVolValue = val;
    localStorage.setItem('musicVolume', val);
    if (this.musicVolume && this.musicEnabled) {
      this.musicVolume.gain.setValueAtTime(val, this.ctx.currentTime);
    }
  }

  setSfxVolume(val) {
    this.sfxVolValue = val;
    localStorage.setItem('sfxVolume', val);
    if (this.sfxVolume && this.sfxEnabled) {
      this.sfxVolume.gain.setValueAtTime(val, this.ctx.currentTime);
    }
  }

  setMasterVolume(val) {
    this.masterVolValue = val;
    localStorage.setItem('masterVolume', val);
    if (this.masterVolume) {
      this.masterVolume.gain.setValueAtTime(val, this.ctx.currentTime);
    }
  }

  setTempo(tempo) {
    this.tempo = tempo;
    this.stepTime = 60 / this.tempo / 4;
  }

  // --- PROCEDURAL MUSIC SYNTHESIS LOOP ---
  
  startMusic() {
    this.resume().then(() => {
      if (this.isPlaying || !this.musicEnabled) return;
      this.isPlaying = true;
      this.currentStep = 0;
      this.nextNoteTime = this.ctx.currentTime;
      this.scheduler();
    });
  }

  stopMusic() {
    this.isPlaying = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  scheduler() {
    if (!this.isPlaying) return;
    while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
      this.schedulePlay(this.currentStep, this.nextNoteTime);
      this.nextNoteTime += this.stepTime;
      this.nextStep();
    }
    this.timerId = setTimeout(() => this.scheduler(), 25);
  }

  nextStep() {
    this.currentStep = (this.currentStep + 1) % 16;
    if (this.currentStep === 0) {
      this.barCount++;
      if (this.barCount % 2 === 0) {
        this.chordIndex = (this.chordIndex + 1) % this.progression.length;
      }
    }
  }

  schedulePlay(step, time) {
    // 1. Kick Drum (Steps 0, 4, 8, 12)
    if (step % 4 === 0) {
      this.synthesizeKick(time);
    }

    // 2. Snare Drum (Steps 4, 12)
    if (step === 4 || step === 12) {
      this.synthesizeSnare(time);
    }

    // 3. Hi-Hat (Steps 2, 6, 10, 14, and some off-beats)
    if (step % 2 === 2 || (step % 4 === 2) || (step % 8 === 6)) {
      this.synthesizeHihat(time, step % 4 === 2 ? 0.08 : 0.04);
    }

    // 4. Bassline (Sawtooth, 8th notes on step % 2 === 0)
    if (step % 2 === 0) {
      const chord = this.progression[this.chordIndex];
      let noteName = chord[0]; // Bass note
      // Arpeggiate the bass note
      if (step === 2 || step === 10) noteName = chord[1]; // octave/third octave
      if (step === 6 || step === 14) noteName = chord[0];
      
      const freq = this.notes[noteName] || 55.0;
      this.synthesizeBass(freq, time, this.stepTime * 1.8);
    }

    // 5. Synth Pad Chords (Once per bar, slow fade)
    if (step === 0) {
      const chord = this.progression[this.chordIndex];
      chord.slice(1).forEach((noteName, idx) => {
        const freq = this.notes[noteName];
        this.synthesizePad(freq, time, this.stepTime * 15, 0.03 + idx * 0.005);
      });
    }

    // 6. Lead melody (Plays sometimes to keep the beat interesting)
    if (this.barCount >= 4 && (this.barCount % 8 < 6)) {
      // Step sequencer for melody (A minor pentatonic)
      const melodyPattern = [
        'A4', '', 'C5', 'E5', '', 'G5', '', 'E5',
        'D5', '', 'C5', 'A4', '', 'G4', 'A4', ''
      ];
      const noteName = melodyPattern[step];
      if (noteName) {
        const freq = this.notes[noteName];
        this.synthesizeLead(freq, time, this.stepTime * 1.2);
      }
    }
  }

  // --- PROCEDURAL DRUMS SYNTHESIS ---

  synthesizeKick(time) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.musicVolume);

    osc.frequency.setValueAtTime(120, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.15);

    gain.gain.setValueAtTime(0.6, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

    osc.start(time);
    osc.stop(time + 0.16);
  }

  synthesizeSnare(time) {
    // White Noise Buffer
    const bufferSize = this.ctx.sampleRate * 0.2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 1000;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.25, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.musicVolume);

    // Snare tone (body)
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, time);
    oscGain.gain.setValueAtTime(0.3, time);
    oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

    osc.connect(oscGain);
    oscGain.connect(this.musicVolume);

    noise.start(time);
    noise.stop(time + 0.2);
    osc.start(time);
    osc.stop(time + 0.2);
  }

  synthesizeHihat(time, duration) {
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 8000;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.06, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicVolume);

    noise.start(time);
    noise.stop(time + duration);
  }

  // --- PROCEDURAL SYNTH INSTRUMENTS ---

  synthesizeBass(frequency, time, duration) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.value = frequency;

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, time);
    filter.frequency.exponentialRampToValueAtTime(800, time + 0.05);
    filter.frequency.exponentialRampToValueAtTime(150, time + duration);
    filter.Q.value = 1.5;

    gain.gain.setValueAtTime(0.18, time);
    gain.gain.linearRampToValueAtTime(0.15, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicVolume);

    osc.start(time);
    osc.stop(time + duration);
  }

  synthesizePad(frequency, time, duration, volume = 0.03) {
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    // Detuned sawtooths for a lush pad sound
    osc1.type = 'sawtooth';
    osc1.frequency.value = frequency - 1;
    osc2.type = 'sawtooth';
    osc2.frequency.value = frequency + 1;

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, time);
    filter.frequency.linearRampToValueAtTime(600, time + duration / 2);
    filter.frequency.linearRampToValueAtTime(300, time + duration);
    filter.Q.value = 1.0;

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.5); // Slow attack
    gain.gain.linearRampToValueAtTime(volume * 0.8, time + duration - 0.5);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicVolume);

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + duration);
    osc2.stop(time + duration);
  }

  synthesizeLead(frequency, time, duration) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'square';
    osc.frequency.value = frequency;

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1500, time);
    filter.frequency.exponentialRampToValueAtTime(400, time + duration);

    gain.gain.setValueAtTime(0.06, time);
    gain.gain.linearRampToValueAtTime(0.05, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicVolume);

    osc.start(time);
    osc.stop(time + duration);
  }

  // --- GAMEPLAY SOUND EFFECTS (SFX) ---

  playMove() {
    this.resume().then(() => {
      if (!this.sfxEnabled) return;
      const time = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, time);
      osc.frequency.exponentialRampToValueAtTime(80, time + 0.05);

      gain.gain.setValueAtTime(0.15, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

      osc.connect(gain);
      gain.connect(this.sfxVolume);
      osc.start(time);
      osc.stop(time + 0.06);
    });
  }

  playRotate() {
    this.resume().then(() => {
      if (!this.sfxEnabled) return;
      const time = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(250, time);
      osc.frequency.exponentialRampToValueAtTime(450, time + 0.08);

      gain.gain.setValueAtTime(0.12, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

      osc.connect(gain);
      gain.connect(this.sfxVolume);
      osc.start(time);
      osc.stop(time + 0.09);
    });
  }

  playDrop() {
    this.resume().then(() => {
      if (!this.sfxEnabled) return;
      const time = this.ctx.currentTime;
      
      // Heavy Bass Thud
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(90, time);
      osc.frequency.exponentialRampToValueAtTime(30, time + 0.15);
      gain.gain.setValueAtTime(0.4, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
      osc.connect(gain);
      gain.connect(this.sfxVolume);

      // Noise impact splash
      const bufferSize = this.ctx.sampleRate * 0.08;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 300;
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.1, time);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
      
      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.sfxVolume);

      osc.start(time);
      osc.stop(time + 0.16);
      noise.start(time);
      noise.stop(time + 0.09);
    });
  }

  playLineClear(lines) {
    this.resume().then(() => {
      if (!this.sfxEnabled) return;
      const time = this.ctx.currentTime;
      
      // We play a beautiful arpeggiated major chord for rewards
      const chord = [261.63, 329.63, 392.00, 523.25]; // C major chord (C4, E4, G4, C5)
      const duration = 0.12;
      
      chord.forEach((freq, idx) => {
        const noteTime = time + idx * 0.06;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        
        osc.type = 'sine';
        osc.frequency.value = freq;
        
        filter.type = 'lowpass';
        filter.frequency.value = 2000;
        
        // Multiplier based on lines cleared
        const volumeFactor = 0.08 + (lines * 0.02);
        
        gain.gain.setValueAtTime(volumeFactor, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + duration * 2);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxVolume);
        
        osc.start(noteTime);
        osc.stop(noteTime + duration * 2 + 0.05);
      });

      // Ambient sweep on top
      const oscSweep = this.ctx.createOscillator();
      const gainSweep = this.ctx.createGain();
      oscSweep.type = 'triangle';
      oscSweep.frequency.setValueAtTime(600, time);
      oscSweep.frequency.exponentialRampToValueAtTime(1500, time + 0.3);
      gainSweep.gain.setValueAtTime(0.05 * lines, time);
      gainSweep.gain.exponentialRampToValueAtTime(0.001, time + 0.35);
      oscSweep.connect(gainSweep);
      gainSweep.connect(this.sfxVolume);
      oscSweep.start(time);
      oscSweep.stop(time + 0.36);
    });
  }

  playLevelUp() {
    this.resume().then(() => {
      if (!this.sfxEnabled) return;
      const time = this.ctx.currentTime;
      const notes = [440.00, 554.37, 659.25, 880.00]; // A major (A4, C#5, E5, A5)
      
      notes.forEach((freq, idx) => {
        const noteTime = time + idx * 0.08;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.12, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.25);
        
        osc.connect(gain);
        gain.connect(this.sfxVolume);
        osc.start(noteTime);
        osc.stop(noteTime + 0.3);
      });
    });
  }

  playStageClear() {
    this.resume().then(() => {
      if (!this.sfxEnabled) return;
      const time = this.ctx.currentTime;
      // Epic triumphant synth brass swell and riser
      const frequencies = [220.00, 277.18, 329.63, 440.00, 554.37]; // A major thick chord
      
      frequencies.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, time);
        // Add subtle detuning
        osc.frequency.linearRampToValueAtTime(freq + (idx % 2 === 0 ? 3 : -3), time + 1.2);
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(100, time);
        filter.frequency.exponentialRampToValueAtTime(2000, time + 0.5);
        filter.frequency.exponentialRampToValueAtTime(500, time + 1.2);
        
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.06, time + 0.2); // swell
        gain.gain.linearRampToValueAtTime(0.05, time + 0.8);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 1.25);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxVolume);
        
        osc.start(time);
        osc.stop(time + 1.3);
      });
      
      // Whoosh effect
      const oscWhoosh = this.ctx.createOscillator();
      const gainWhoosh = this.ctx.createGain();
      oscWhoosh.type = 'sine';
      oscWhoosh.frequency.setValueAtTime(150, time);
      oscWhoosh.frequency.exponentialRampToValueAtTime(800, time + 0.8);
      gainWhoosh.gain.setValueAtTime(0.12, time);
      gainWhoosh.gain.exponentialRampToValueAtTime(0.001, time + 0.85);
      
      oscWhoosh.connect(gainWhoosh);
      gainWhoosh.connect(this.sfxVolume);
      oscWhoosh.start(time);
      oscWhoosh.stop(time + 0.9);
    });
  }

  playGameOver() {
    this.resume().then(() => {
      if (!this.sfxEnabled) return;
      const time = this.ctx.currentTime;
      // Sad descending arpeggio
      const notes = [392.00, 349.23, 311.13, 261.63, 196.00];
      
      notes.forEach((freq, idx) => {
        const noteTime = time + idx * 0.15;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.15, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.35);
        
        osc.connect(gain);
        gain.connect(this.sfxVolume);
        osc.start(noteTime);
        osc.stop(noteTime + 0.4);
      });
    });
  }
}

// Share globally
window.audioManager = new AudioManager();
