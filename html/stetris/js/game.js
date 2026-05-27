// --- STRIP TETRIS MAIN CONTROLLER ---

class GameController {
  constructor() {
    this.engine = new TetrisEngine();
    this.activeCharacter = null;
    this.currentStage = 0;
    
    // Canvas contexts
    this.boardCanvas = document.getElementById('tetris-canvas');
    this.boardCtx = this.boardCanvas.getContext('2d');
    
    this.holdCanvas = document.getElementById('hold-canvas');
    this.holdCtx = this.holdCanvas.getContext('2d');
    
    this.nextCanvas = document.getElementById('next-canvas');
    this.nextCtx = this.nextCanvas.getContext('2d');

    // Mini canvases for mobile HUD
    this.holdCanvasMini = document.getElementById('hold-canvas-mini');
    this.holdCtxMini = this.holdCanvasMini ? this.holdCanvasMini.getContext('2d') : null;
    
    this.nextCanvasMini = document.getElementById('next-canvas-mini');
    this.nextCtxMini = this.nextCanvasMini ? this.nextCanvasMini.getContext('2d') : null;
    
    // Game loop timers
    this.lastTime = 0;
    this.dropCounter = 0;
    this.animationFrameId = null;
    this.isPaused = false;
    
    // Particles lists
    this.particles = [];
    
    // Settings state
    this.isCensored = localStorage.getItem('censorEnabled') !== 'false';
    
    // Unlock database mapping: e.g. { akira: [0, 1], elara: [0], carmilla: [0] }
    this.unlocks = JSON.parse(localStorage.getItem('unlockedStages') || '{"akira":[0],"elara":[0],"carmilla":[0]}');

    // Controls state for DAS (Delayed Auto Shift)
    this.keys = {};
    this.dasTimers = { left: 0, right: 0, down: 0 };
    this.dasDelay = 180; // ms before repeating
    this.dasInterval = 45; // ms between repeats

    // Initialize Telegram WebApp SDK
    this.tg = window.Telegram ? window.Telegram.WebApp : null;
    if (this.tg) {
      this.tg.ready();
      this.tg.expand();
      try {
        this.tg.setHeaderColor('#06020c');
        this.tg.setBackgroundColor('#030006');
        if (this.tg.enableClosingConfirmation) {
          this.tg.enableClosingConfirmation();
        }
      } catch (e) {
        console.log("Telegram set header/bg colors error:", e);
      }
      
      // Configure BackButton
      this.tg.BackButton.onClick(() => {
        this.stop();
        document.getElementById('pause-overlay').classList.add('hidden');
        document.getElementById('gameover-overlay').classList.add('hidden');
        document.getElementById('transition-overlay').classList.add('hidden');
        this.switchSection('section-character-select');
      });
    }

    this.initEvents();
    this.updateGalleryUI();
  }

  // --- INTERACTION & EVENT ROUTERS ---

  initEvents() {
    // Splash screen click -> active audio context & show character select
    document.getElementById('btn-enter-game').addEventListener('click', () => {
      window.audioManager.resume();
      document.getElementById('splash-screen').classList.add('hidden');
      document.getElementById('app-container').classList.remove('hidden');
      this.switchSection('section-character-select');
    });

    // Logo Click -> Character select
    document.getElementById('logo-click').addEventListener('click', () => {
      this.stop();
      this.switchSection('section-character-select');
    });

    // Navigation Buttons
    document.getElementById('nav-btn-game').addEventListener('click', () => {
      if (this.activeCharacter) {
        this.switchSection('section-gameplay');
        this.start();
      } else {
        this.switchSection('section-character-select');
      }
    });

    document.getElementById('nav-btn-gallery').addEventListener('click', () => {
      this.stop();
      this.switchSection('section-gallery');
      this.renderGallery();
    });

    document.getElementById('nav-btn-settings').addEventListener('click', () => {
      this.openSettings();
    });

    // Character Selector Cards
    document.querySelectorAll('.char-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const charId = card.getAttribute('data-char-id');
        this.selectCharacter(charId);
      });
    });

    // Settings elements
    document.getElementById('btn-close-settings').addEventListener('click', () => this.closeSettings());
    
    const censorToggle = document.getElementById('setting-censor');
    censorToggle.checked = this.isCensored;
    censorToggle.addEventListener('change', (e) => {
      this.isCensored = e.target.checked;
      localStorage.setItem('censorEnabled', this.isCensored);
      this.applyCensorFilter();
    });

    const masterSlider = document.getElementById('slider-master');
    masterSlider.value = window.audioManager.masterVolValue;
    document.getElementById('val-master-gain').innerText = Math.round(window.audioManager.masterVolValue * 100) + '%';
    masterSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      window.audioManager.setMasterVolume(val);
      document.getElementById('val-master-gain').innerText = Math.round(val * 100) + '%';
    });

    const musicToggle = document.getElementById('setting-music');
    musicToggle.checked = window.audioManager.musicEnabled;
    musicToggle.addEventListener('change', (e) => window.audioManager.setMusicEnabled(e.target.checked));

    const musicSlider = document.getElementById('slider-music');
    musicSlider.value = window.audioManager.musicVolValue;
    musicSlider.addEventListener('input', (e) => window.audioManager.setMusicVolume(parseFloat(e.target.value)));

    const sfxToggle = document.getElementById('setting-sfx');
    sfxToggle.checked = window.audioManager.sfxEnabled;
    sfxToggle.addEventListener('change', (e) => window.audioManager.setSfxEnabled(e.target.checked));

    const sfxSlider = document.getElementById('slider-sfx');
    sfxSlider.value = window.audioManager.sfxVolValue;
    sfxSlider.addEventListener('input', (e) => window.audioManager.setSfxVolume(parseFloat(e.target.value)));

    // Gameplay Controls buttons
    document.getElementById('btn-game-pause').addEventListener('click', () => this.togglePause());
    document.getElementById('btn-game-pause-mini').addEventListener('click', () => this.togglePause());
    document.getElementById('btn-resume-overlay').addEventListener('click', () => this.togglePause());
    document.getElementById('btn-game-select').addEventListener('click', () => {
      this.stop();
      this.switchSection('section-character-select');
    });
    document.getElementById('btn-game-select-mini').addEventListener('click', () => {
      this.stop();
      this.switchSection('section-character-select');
    });

    // Transition Continue
    document.getElementById('btn-transition-continue').addEventListener('click', () => {
      document.getElementById('transition-overlay').classList.add('hidden');
      this.isPaused = false;
      window.audioManager.startMusic();
      this.lastTime = performance.now();
      this.animationFrameId = requestAnimationFrame((t) => this.gameLoop(t));
    });

    // Game Over actions
    document.getElementById('btn-restart').addEventListener('click', () => {
      document.getElementById('gameover-overlay').classList.add('hidden');
      this.engine.reset();
      this.currentStage = 0;
      this.updateHUD();
      this.updatePortrait();
      this.isPaused = false;
      this.start();
    });
    
    document.querySelectorAll('.exit').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('gameover-overlay').classList.add('hidden');
        this.stop();
        this.switchSection('section-character-select');
      });
    });

    // Keyboard bindings
    window.addEventListener('keydown', (e) => {
      if (document.getElementById('section-gameplay').classList.contains('hidden') || this.isPaused || this.engine.isGameOver) return;
      
      const key = e.code;
      this.keys[key] = true;

      // Single triggers
      if (key === 'ArrowUp') {
        if (this.engine.rotateCW()) window.audioManager.playRotate();
        e.preventDefault();
      } else if (key === 'KeyZ') {
        if (this.engine.rotateCCW()) window.audioManager.playRotate();
        e.preventDefault();
      } else if (key === 'Space') {
        const dropDist = this.engine.hardDrop();
        if (dropDist > 0) {
          window.audioManager.playDrop();
          this.triggerScreenShake();
          this.checkLocksAndClears();
        }
        e.preventDefault();
      } else if (key === 'KeyC' || key === 'ShiftLeft' || key === 'ShiftRight') {
        if (this.engine.hold()) window.audioManager.playRotate();
        e.preventDefault();
      } else if (key === 'KeyP') {
        this.togglePause();
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // Mobile Overlay button bindings
    this.setupMobileControls();

    // Gallery navigation tabs
    document.querySelectorAll('.gallery-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.gallery-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.renderGallery(tab.getAttribute('data-char-id'));
      });
    });

    // Lightbox image clicks
    document.querySelectorAll('.gallery-stage-card').forEach(card => {
      card.addEventListener('click', () => {
        if (card.classList.contains('locked')) return;
        const img = card.querySelector('img').src;
        const lightbox = document.getElementById('lightbox');
        const lbImg = document.getElementById('lightbox-img');
        lbImg.src = img;
        lightbox.classList.remove('hidden');
      });
    });

    document.getElementById('lightbox').addEventListener('click', () => {
      document.getElementById('lightbox').classList.add('hidden');
    });
  }

  setupMobileControls() {
    const bindTouch = (id, action) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        action();
      });
    };

    bindTouch('touch-hold', () => {
      if (this.engine.hold()) window.audioManager.playRotate();
    });

    bindTouch('touch-rotate-ccw', () => {
      if (this.engine.rotateCCW()) window.audioManager.playRotate();
    });

    bindTouch('touch-rotate-cw', () => {
      if (this.engine.rotateCW()) window.audioManager.playRotate();
    });

    bindTouch('touch-left', () => {
      if (this.engine.moveLeft()) window.audioManager.playMove();
    });

    bindTouch('touch-right', () => {
      if (this.engine.moveRight()) window.audioManager.playMove();
    });

    bindTouch('touch-soft', () => {
      if (this.engine.tick()) {
        window.audioManager.playMove();
        this.engine.score++; // soft drop points
        this.updateHUD();
      }
    });

    bindTouch('touch-hard', () => {
      const dropDist = this.engine.hardDrop();
      if (dropDist > 0) {
        window.audioManager.playDrop();
        this.triggerScreenShake();
        this.checkLocksAndClears();
      }
    });
  }

  // --- GENERAL STATE ENGINE ROUTERS ---

  switchSection(sectionId) {
    document.querySelectorAll('.content-section').forEach(sec => sec.classList.add('hidden'));
    document.getElementById(sectionId).classList.remove('hidden');

    // Manage links styling in header
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    if (sectionId === 'section-gameplay') {
      document.getElementById('nav-btn-game').classList.add('active');
      if (this.tg) this.tg.BackButton.show();
    } else if (sectionId === 'section-gallery') {
      document.getElementById('nav-btn-gallery').classList.add('active');
      if (this.tg) this.tg.BackButton.show();
    } else {
      if (this.tg) this.tg.BackButton.hide();
    }
  }

  selectCharacter(charId) {
    this.activeCharacter = window.CHARACTERS.find(c => c.id === charId);
    
    // Configure HUD colors matching character glows
    document.documentElement.style.setProperty('--neon-cyan', this.activeCharacter.accentColor);
    document.documentElement.style.setProperty('--card-glow', `0 0 15px ${this.activeCharacter.glowColor}`);

    // Update gameplay UI placeholders
    document.getElementById('game-char-name').innerText = this.activeCharacter.name;
    document.getElementById('game-char-title').innerText = this.activeCharacter.title;
    document.getElementById('game-char-avatar').style.backgroundImage = `url(${this.activeCharacter.stages[0]})`;
    
    // Set game canvas border color
    document.getElementById('board-frame-glow').style.borderColor = this.activeCharacter.accentColor;

    this.engine.reset();
    this.currentStage = 0;
    this.updateHUD();
    this.updatePortrait();

    this.switchSection('section-gameplay');
    this.start();
  }

  start() {
    this.isPaused = false;
    this.lastTime = performance.now();
    this.dropCounter = 0;
    
    window.audioManager.startMusic();
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.animationFrameId = requestAnimationFrame((t) => this.gameLoop(t));
  }

  stop() {
    this.isPaused = true;
    window.audioManager.stopMusic();
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  togglePause() {
    if (this.engine.isGameOver) return;
    
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      window.audioManager.stopMusic();
      document.getElementById('pause-overlay').classList.remove('hidden');
    } else {
      window.audioManager.startMusic();
      document.getElementById('pause-overlay').classList.add('hidden');
      this.lastTime = performance.now();
      this.animationFrameId = requestAnimationFrame((t) => this.gameLoop(t));
    }
  }

  // Settings modals
  openSettings() {
    document.getElementById('settings-modal').classList.remove('hidden');
  }

  closeSettings() {
    document.getElementById('settings-modal').classList.add('hidden');
  }

  // --- GAME Ticking, Input Loops & Clears ---

  gameLoop(time) {
    if (this.isPaused) return;

    const deltaTime = time - this.lastTime;
    this.lastTime = time;

    // 1. Process keys with DAS repeating
    this.handleKeyboardDAS(deltaTime);

    // 2. Gravitational ticking
    this.dropCounter += deltaTime;
    // Calculate speed based on Tetris level
    const dropSpeed = Math.max(50, 1000 - (this.engine.level - 1) * 90);
    // Sync dynamic synth tempo
    const targetTempo = 115 + (this.engine.level - 1) * 3;
    window.audioManager.setTempo(targetTempo);

    if (this.dropCounter > dropSpeed) {
      this.tickGravity();
      this.dropCounter = 0;
    }

    // 3. Draw frames
    this.updateParticles(deltaTime);
    this.drawBoard();
    this.drawHold();
    this.drawNext();

    // 4. Queue next frame
    if (!this.engine.isGameOver) {
      this.animationFrameId = requestAnimationFrame((t) => this.gameLoop(t));
    } else {
      this.handleGameOver();
    }
  }

  tickGravity() {
    if (!this.engine.tick()) {
      // Piece hit floor. Handle lock delay or immediate lock
      if (!this.engine.activePiece.lockDelayTimer) {
        this.engine.activePiece.lockDelayTimer = setTimeout(() => {
          // Re-check collision before locking (if they moved in delay window)
          if (this.engine.checkCollision(this.engine.activePiece.x, this.engine.activePiece.y + 1, this.engine.activePiece.matrix)) {
            window.audioManager.playDrop();
            this.checkLocksAndClears();
          } else {
            // Player successfully slipped underneath, reset timer
            this.engine.activePiece.lockDelayTimer = null;
          }
        }, 500);
      }
    }
  }

  handleKeyboardDAS(dt) {
    // Arrow Left repetition
    if (this.keys['ArrowLeft']) {
      this.dasTimers.left += dt;
      if (this.dasTimers.left > this.dasDelay) {
        this.dasTimers.left -= this.dasInterval;
        if (this.engine.moveLeft()) window.audioManager.playMove();
      }
    } else {
      this.dasTimers.left = 0;
    }

    // Arrow Right repetition
    if (this.keys['ArrowRight']) {
      this.dasTimers.right += dt;
      if (this.dasTimers.right > this.dasDelay) {
        this.dasTimers.right -= this.dasInterval;
        if (this.engine.moveRight()) window.audioManager.playMove();
      }
    } else {
      this.dasTimers.right = 0;
    }

    // Arrow Down (Soft Drop) repetition
    if (this.keys['ArrowDown']) {
      this.dasTimers.down += dt;
      if (this.dasTimers.down > 45) { // very fast tick for soft drops
        this.dasTimers.down = 0;
        if (this.engine.tick()) {
          window.audioManager.playMove();
          this.engine.score++; // soft drop points
          this.updateHUD();
        }
      }
    } else {
      this.dasTimers.down = 0;
    }

    // Single trigger events (reset in keydown listeners, but ensure we trigger once on click)
    if (this.keys['ArrowLeft'] && this.dasTimers.left === dt) {
      if (this.engine.moveLeft()) window.audioManager.playMove();
    }
    if (this.keys['ArrowRight'] && this.dasTimers.right === dt) {
      if (this.engine.moveRight()) window.audioManager.playMove();
    }
    if (this.keys['ArrowDown'] && this.dasTimers.down === dt) {
      if (this.engine.tick()) {
        window.audioManager.playMove();
        this.engine.score++;
        this.updateHUD();
      }
    }
  }

  checkLocksAndClears() {
    // Clear timeouts
    if (this.engine.activePiece && this.engine.activePiece.lockDelayTimer) {
      clearTimeout(this.engine.activePiece.lockDelayTimer);
      this.engine.activePiece.lockDelayTimer = null;
    }

    const linesBefore = this.engine.lines;
    const cleared = this.engine.lockPiece();
    
    if (cleared > 0) {
      window.audioManager.playLineClear(cleared);
      this.spawnLineClearParticles(cleared);
      this.updateHUD();
      this.checkStageUnlock(linesBefore, this.engine.lines);
    } else {
      this.updateHUD();
    }
  }

  spawnLineClearParticles(clearedLines) {
    const colorList = ['#ff0055', '#00ffcc', '#9d00ff', '#39ff14', '#ffff00'];
    
    // Find cleared lines in grid
    // For simplicity, we just spray particles from the center/lower half of the board
    const yCenter = this.boardCanvas.height * 0.75;
    
    for (let i = 0; i < clearedLines * 12; i++) {
      const p = {
        x: Math.random() * this.boardCanvas.width,
        y: yCenter + (Math.random() * 60 - 30),
        dx: (Math.random() - 0.5) * 8,
        dy: (Math.random() - 0.75) * 8 - 2, // burst upwards
        size: Math.random() * 4 + 2,
        color: colorList[Math.floor(Math.random() * colorList.length)],
        life: 1.0,
        decay: Math.random() * 0.03 + 0.02
      };
      this.particles.push(p);
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.dx;
      p.y += p.dy;
      p.dy += 0.08; // gravity drop
      p.life -= p.decay;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  triggerScreenShake() {
    this.boardCanvas.classList.add('shake-anim');
    setTimeout(() => {
      this.boardCanvas.classList.remove('shake-anim');
    }, 180);
  }

  // --- STAGE UNLOCK & PORTRAIT DRAW CONTROLLERS ---

  checkStageUnlock(linesBefore, linesAfter) {
    const previousStage = this.currentStage;
    
    // Thresholds: Stage 0 (0 lines), Stage 1 (10 lines), Stage 2 (20 lines), Stage 3 (30 lines)
    if (linesAfter >= 30) this.currentStage = 3;
    else if (linesAfter >= 20) this.currentStage = 2;
    else if (linesAfter >= 10) this.currentStage = 1;
    else this.currentStage = 0;

    if (this.currentStage > previousStage) {
      this.unlockStageInDatabase(this.activeCharacter.id, this.currentStage);
      this.triggerStageTransitionOverlay();
    }
    
    this.updatePortrait();
  }

  unlockStageInDatabase(charId, stage) {
    if (!this.unlocks[charId]) this.unlocks[charId] = [0];
    if (!this.unlocks[charId].includes(stage)) {
      this.unlocks[charId].push(stage);
      localStorage.setItem('unlockedStages', JSON.stringify(this.unlocks));
      this.updateGalleryUI();
    }
  }

  triggerStageTransitionOverlay() {
    this.stop();
    this.isPaused = true;
    
    window.audioManager.playStageClear();
    
    // Set descriptive label in overlay
    const transTitle = document.getElementById('trans-title');
    const transSubtitle = document.getElementById('trans-subtitle');
    
    transTitle.innerText = "STAGE CLEAR!";
    transTitle.style.textShadow = `0 0 15px ${this.activeCharacter.accentColor}`;
    transTitle.style.color = this.activeCharacter.accentColor;
    
    const outfits = ["fully clothed.", "removed her outer jacket.", "stripped to her fine lingerie.", "fully revealed her sensuous beauty!"];
    transSubtitle.innerHTML = `Decrypting network node...<br><strong>${this.activeCharacter.name}</strong> has ${outfits[this.currentStage]}`;
    
    document.getElementById('transition-overlay').classList.remove('hidden');
  }

  updatePortrait() {
    const portrait = document.getElementById('strip-portrait-img');
    const portraitPath = this.activeCharacter.stages[this.currentStage];
    portrait.src = portraitPath;

    // Set background of board frame (specifically for mobile faded portrait overlay)
    const boardFrame = document.getElementById('board-frame-glow');
    if (boardFrame) {
      boardFrame.style.backgroundImage = `url(${portraitPath})`;
    }

    // Update indicators
    const stageBadge = document.getElementById('strip-stage-badge');
    const stageName = document.getElementById('strip-stage-name');
    
    stageBadge.innerText = `STAGE ${this.currentStage}`;
    stageBadge.style.backgroundColor = this.activeCharacter.accentColor;
    
    const stageTitles = ["Clothed", "Light Clothing", "Lingerie", "Tasty Art"];
    stageName.innerText = stageTitles[this.currentStage];

    // Update Progress Bar
    const progressLines = document.getElementById('strip-progress-lines');
    const progressBar = document.getElementById('strip-progress-bar');
    const progressBarMini = document.getElementById('strip-progress-bar-mini');
    
    let percent = 0;
    if (this.currentStage < 3) {
      const linesInCurrentStage = this.engine.lines % 10;
      progressLines.innerText = `${linesInCurrentStage}/10 lines`;
      percent = (linesInCurrentStage / 10) * 100;
    } else {
      progressLines.innerText = `DATABASE COMPLETELY SYNCED`;
      percent = 100;
    }

    progressBar.style.width = `${percent}%`;
    progressBar.style.background = `linear-gradient(90deg, var(--neon-purple), ${this.activeCharacter.accentColor})`;
    progressBar.style.boxShadow = `0 0 8px ${this.activeCharacter.accentColor}`;

    if (progressBarMini) {
      progressBarMini.style.width = `${percent}%`;
      progressBarMini.style.background = `linear-gradient(90deg, var(--neon-purple), ${this.activeCharacter.accentColor})`;
      progressBarMini.style.boxShadow = `0 0 8px ${this.activeCharacter.accentColor}`;
    }

    this.applyCensorFilter();
  }

  applyCensorFilter() {
    const overlay = document.getElementById('censor-overlay');
    // We only apply sensor overlap on the final Stage 3 (Sensual Art) if censorship is toggled ON
    if (this.currentStage === 3 && this.isCensored) {
      overlay.classList.remove('hidden');
    } else {
      overlay.classList.add('hidden');
    }
  }

  updateHUD() {
    document.getElementById('hud-score').innerText = this.engine.score;
    document.getElementById('hud-lines').innerText = this.engine.lines;
    document.getElementById('hud-level').innerText = this.engine.level;

    // Mobile mini HUD sync
    const scoreMini = document.getElementById('hud-score-mini');
    if (scoreMini) scoreMini.innerText = this.engine.score;
    const linesMini = document.getElementById('hud-lines-mini');
    if (linesMini) linesMini.innerText = this.engine.lines;
    const levelMini = document.getElementById('hud-level-mini');
    if (levelMini) levelMini.innerText = this.engine.level;
  }

  handleGameOver() {
    this.stop();
    window.audioManager.playGameOver();
    
    document.getElementById('go-score').innerText = this.engine.score;
    document.getElementById('go-lines').innerText = this.engine.lines;
    document.getElementById('go-stage').innerText = this.currentStage;
    
    document.getElementById('gameover-overlay').classList.remove('hidden');
  }

  // --- DRAWING CANVAS ENGINES ---

  drawBlock(ctx, x, y, color, size, isGhost = false) {
    if (isGhost) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x * size + 2, y * size + 2, size - 4, size - 4);
      return;
    }

    // Draw solid gradient blocks
    const grad = ctx.createLinearGradient(x * size, y * size, (x + 1) * size, (y + 1) * size);
    grad.addColorStop(0, '#ffffff'); // glare highlight
    grad.addColorStop(0.2, color);
    grad.addColorStop(1, '#050209'); // shadow bevel

    ctx.fillStyle = grad;
    ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);

    // Subtle inner glowing borders
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x * size + 2, y * size + 2, size - 4, size - 4);
  }

  drawBoard() {
    const size = 30; // Block scale size
    this.boardCtx.clearRect(0, 0, this.boardCanvas.width, this.boardCanvas.height);

    // Draw board grid lines for retro cyber feel
    this.boardCtx.strokeStyle = 'rgba(157, 0, 255, 0.08)';
    this.boardCtx.lineWidth = 0.5;
    for (let c = 0; c <= this.engine.COLS; c++) {
      this.boardCtx.beginPath();
      this.boardCtx.moveTo(c * size, 0);
      this.boardCtx.lineTo(c * size, this.boardCanvas.height);
      this.boardCtx.stroke();
    }
    for (let r = 0; r <= this.engine.ROWS; r++) {
      this.boardCtx.beginPath();
      this.boardCtx.moveTo(0, r * size);
      this.boardCtx.lineTo(this.boardCanvas.width, r * size);
      this.boardCtx.stroke();
    }

    // Draw locked cells
    for (let r = 0; r < this.engine.ROWS; r++) {
      for (let c = 0; c < this.engine.COLS; c++) {
        const cell = this.engine.grid[r][c];
        if (cell !== 0) {
          this.drawBlock(this.boardCtx, c, r, cell.color, size);
        }
      }
    }

    // Draw active piece & its ghost projection
    if (this.engine.activePiece && !this.engine.isGameOver) {
      const p = this.engine.activePiece;
      
      // Calculate ghost coordinate
      const ghostY = this.engine.getGhostY();

      // Render pieces
      for (let r = 0; r < p.matrix.length; r++) {
        for (let c = 0; c < p.matrix[r].length; c++) {
          if (p.matrix[r][c] !== 0) {
            // Draw ghost outline first (so blocks sit on top of ghost shadows)
            this.drawBlock(this.boardCtx, p.x + c, ghostY + r, p.color, size, true);
            
            // Draw active blocks
            this.drawBlock(this.boardCtx, p.x + c, p.y + r, p.color, size);
          }
        }
      }
    }

    // Draw burst particles on top
    this.particles.forEach(p => {
      this.boardCtx.fillStyle = p.color;
      this.boardCtx.globalAlpha = p.life;
      this.boardCtx.beginPath();
      this.boardCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.boardCtx.fill();
    });
    this.boardCtx.globalAlpha = 1.0; // Reset
  }

  drawHold() {
    this.holdCtx.clearRect(0, 0, this.holdCanvas.width, this.holdCanvas.height);
    if (this.holdCtxMini) {
      this.holdCtxMini.clearRect(0, 0, this.holdCanvasMini.width, this.holdCanvasMini.height);
    }
    
    if (this.engine.holdPiece) {
      const type = this.engine.holdPiece;
      const shape = this.engine.SHAPES[type];
      const matrix = shape.matrix;
      
      // Draw desktop hold (size 18)
      this.drawPiecePreview(this.holdCtx, this.holdCanvas, matrix, shape.color, 18);
      
      // Draw mobile hold (size 9)
      if (this.holdCtxMini) {
        this.drawPiecePreview(this.holdCtxMini, this.holdCanvasMini, matrix, shape.color, 9);
      }
    }
  }

  drawPiecePreview(ctx, canvas, matrix, color, size) {
    const boxW = canvas.width;
    const boxH = canvas.height;
    const pW = matrix.length * size;
    const pH = matrix.length * size;
    
    const offsetX = (boxW - pW) / 2 / size;
    const offsetY = (boxH - pH) / 2 / size;

    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c] !== 0) {
          const grad = ctx.createLinearGradient(
            (offsetX + c) * size, (offsetY + r) * size, 
            (offsetX + c + 1) * size, (offsetY + r + 1) * size
          );
          grad.addColorStop(0, '#ffffff');
          grad.addColorStop(0.2, color);
          grad.addColorStop(1, '#050209');
          ctx.fillStyle = grad;
          ctx.fillRect((offsetX + c) * size + 1, (offsetY + r) * size + 1, size - 2, size - 2);
        }
      }
    }
  }

  drawNext() {
    this.nextCtx.clearRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);
    if (this.nextCtxMini) {
      this.nextCtxMini.clearRect(0, 0, this.nextCanvasMini.width, this.nextCanvasMini.height);
    }
    
    const size = 16;
    const boxW = this.nextCanvas.width;
    const spacing = 75; // vertical offset between blocks

    // Desktop: draw next 3 pieces
    for (let i = 0; i < 3; i++) {
      const type = this.engine.nextQueue[i];
      if (!type) continue;
      
      const shape = this.engine.SHAPES[type];
      const matrix = shape.matrix;
      
      const pW = matrix.length * size;
      const pH = matrix.length * size;
      
      const offsetX = (boxW - pW) / 2 / size;
      const offsetY = (spacing * i + 35 - pH / 2) / size;

      for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
          if (matrix[r][c] !== 0) {
            const grad = this.nextCtx.createLinearGradient(
              (offsetX + c) * size, (offsetY + r) * size, 
              (offsetX + c + 1) * size, (offsetY + r + 1) * size
            );
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.2, shape.color);
            grad.addColorStop(1, '#050209');
            this.nextCtx.fillStyle = grad;
            this.nextCtx.fillRect((offsetX + c) * size + 1, (offsetY + r) * size + 1, size - 2, size - 2);
          }
        }
      }
    }

    // Mobile: draw only the 1st next piece (size 9)
    if (this.nextCtxMini && this.engine.nextQueue[0]) {
      const type = this.engine.nextQueue[0];
      const shape = this.engine.SHAPES[type];
      this.drawPiecePreview(this.nextCtxMini, this.nextCanvasMini, shape.matrix, shape.color, 9);
    }
  }

  // --- GALLERY RENDERING & UI SYNCING ---

  updateGalleryUI() {
    // Proactively updates the selections or lock badges inside galleries
  }

  renderGallery(charId = 'akira') {
    const character = window.CHARACTERS.find(c => c.id === charId);
    if (!character) return;

    // Update details in left description panel
    document.getElementById('gallery-char-name').innerText = character.name;
    document.getElementById('gallery-char-title').innerText = character.title;
    document.getElementById('gallery-char-bio').innerText = character.bio;
    document.getElementById('gallery-char-diff').innerText = character.difficulty;
    document.getElementById('gallery-char-style').innerText = character.style;

    const unlockedList = this.unlocks[charId] || [0];

    // Render cards
    for (let i = 0; i < 4; i++) {
      const card = document.getElementById(`gal-stage-${i}`);
      const img = card.querySelector('img');
      img.src = character.stages[i];

      if (unlockedList.includes(i)) {
        card.classList.remove('locked');
        card.classList.add('unlocked');
      } else {
        card.classList.remove('unlocked');
        card.classList.add('locked');
      }
    }
  }
}

// Instantiate on startup
window.addEventListener('DOMContentLoaded', () => {
  window.gameController = new GameController();
});
