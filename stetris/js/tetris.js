class TetrisEngine {
  constructor() {
    this.COLS = 10;
    this.ROWS = 20;
    this.grid = this.createEmptyGrid();
    
    // Tetromino shapes & colors
    this.SHAPES = {
      'I': {
        matrix: [
          [0, 0, 0, 0],
          [1, 1, 1, 1],
          [0, 0, 0, 0],
          [0, 0, 0, 0]
        ],
        color: '#00f0f0', // Cyan
        accentColor: '#e0ffff'
      },
      'J': {
        matrix: [
          [1, 0, 0],
          [1, 1, 1],
          [0, 0, 0]
        ],
        color: '#0000f0', // Blue
        accentColor: '#adc8ff'
      },
      'L': {
        matrix: [
          [0, 0, 1],
          [1, 1, 1],
          [0, 0, 0]
        ],
        color: '#f0a000', // Orange
        accentColor: '#ffe5ad'
      },
      'O': {
        matrix: [
          [1, 1],
          [1, 1]
        ],
        color: '#f0f000', // Yellow
        accentColor: '#ffffad'
      },
      'S': {
        matrix: [
          [0, 1, 1],
          [1, 1, 0],
          [0, 0, 0]
        ],
        color: '#00f000', // Green
        accentColor: '#adffad'
      },
      'T': {
        matrix: [
          [0, 1, 0],
          [1, 1, 1],
          [0, 0, 0]
        ],
        color: '#a000f0', // Purple
        accentColor: '#ebadff'
      },
      'Z': {
        matrix: [
          [1, 1, 0],
          [0, 1, 1],
          [0, 0, 0]
        ],
        color: '#f00000', // Red
        accentColor: '#ffadad'
      }
    };

    this.reset();
  }

  createEmptyGrid() {
    return Array.from({ length: this.ROWS }, () => new Array(this.COLS).fill(0));
  }

  reset() {
    this.grid = this.createEmptyGrid();
    this.bag = [];
    this.nextQueue = [];
    this.fillNextQueue();
    
    this.activePiece = null;
    this.holdPiece = null;
    this.canHold = true;
    this.isGameOver = false;

    this.score = 0;
    this.lines = 0;
    this.level = 1;
    
    // Spawn the first piece
    this.spawnPiece();
  }

  fillNextQueue() {
    while (this.nextQueue.length < 4) {
      if (this.bag.length === 0) {
        this.generateBag();
      }
      this.nextQueue.push(this.bag.pop());
    }
  }

  generateBag() {
    // 7-Bag Randomizer
    const types = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
    // Shuffle
    for (let i = types.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [types[i], types[j]] = [types[j], types[i]];
    }
    this.bag = types;
  }

  spawnPiece(type = null) {
    const nextType = type || this.nextQueue.shift();
    this.fillNextQueue();

    const shapeData = this.SHAPES[nextType];
    const matrix = JSON.parse(JSON.stringify(shapeData.matrix));

    this.activePiece = {
      type: nextType,
      matrix: matrix,
      color: shapeData.color,
      accentColor: shapeData.accentColor,
      x: Math.floor((this.COLS - matrix.length) / 2),
      // Spawn I/O in different row index sometimes to match standard placement
      y: nextType === 'I' ? -1 : 0,
      lockDelayTimer: null,
      lockResets: 0
    };

    this.canHold = true;

    // Check immediate collision on spawn -> Game Over
    if (this.checkCollision(this.activePiece.x, this.activePiece.y, this.activePiece.matrix)) {
      this.isGameOver = true;
    }
  }

  hold() {
    if (!this.canHold || this.isGameOver) return false;

    const currentType = this.activePiece.type;
    
    if (this.holdPiece === null) {
      this.holdPiece = currentType;
      this.spawnPiece();
    } else {
      const temp = this.holdPiece;
      this.holdPiece = currentType;
      this.spawnPiece(temp);
    }

    this.canHold = false;
    return true;
  }

  checkCollision(x, y, matrix, grid = this.grid) {
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c] !== 0) {
          const boardX = x + c;
          const boardY = y + r;

          // Wall checks
          if (boardX < 0 || boardX >= this.COLS || boardY >= this.ROWS) {
            return true;
          }

          // Grid cell checks (allow above grid spawn y < 0)
          if (boardY >= 0 && grid[boardY][boardX] !== 0) {
            return true;
          }
        }
      }
    }
    return false;
  }

  moveLeft() {
    if (this.isGameOver) return false;
    if (!this.checkCollision(this.activePiece.x - 1, this.activePiece.y, this.activePiece.matrix)) {
      this.activePiece.x--;
      this.resetLockDelay();
      return true;
    }
    return false;
  }

  moveRight() {
    if (this.isGameOver) return false;
    if (!this.checkCollision(this.activePiece.x + 1, this.activePiece.y, this.activePiece.matrix)) {
      this.activePiece.x++;
      this.resetLockDelay();
      return true;
    }
    return false;
  }

  rotateCW() {
    if (this.isGameOver) return false;
    const rotated = this.rotateMatrixCW(this.activePiece.matrix);
    return this.applyRotation(rotated);
  }

  rotateCCW() {
    if (this.isGameOver) return false;
    const rotated = this.rotateMatrixCCW(this.activePiece.matrix);
    return this.applyRotation(rotated);
  }

  rotateMatrixCW(matrix) {
    const N = matrix.length;
    const result = Array.from({ length: N }, () => new Array(N).fill(0));
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        result[c][N - 1 - r] = matrix[r][c];
      }
    }
    return result;
  }

  rotateMatrixCCW(matrix) {
    const N = matrix.length;
    const result = Array.from({ length: N }, () => new Array(N).fill(0));
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        result[N - 1 - c][r] = matrix[r][c];
      }
    }
    return result;
  }

  applyRotation(rotatedMatrix) {
    // Rotation kicks: testing displacements if rotation collides
    const kicks = [
      [0, 0],   // No shift
      [-1, 0],  // Shift left 1
      [1, 0],   // Shift right 1
      [0, -1],  // Shift up 1 (floor kick)
      [-2, 0],  // Shift left 2 (I piece kick)
      [2, 0],   // Shift right 2 (I piece kick)
      [0, 1]    // Shift down 1
    ];

    for (let i = 0; i < kicks.length; i++) {
      const dx = kicks[i][0];
      const dy = kicks[i][1];
      if (!this.checkCollision(this.activePiece.x + dx, this.activePiece.y + dy, rotatedMatrix)) {
        this.activePiece.matrix = rotatedMatrix;
        this.activePiece.x += dx;
        this.activePiece.y += dy;
        this.resetLockDelay();
        return true;
      }
    }
    return false;
  }

  resetLockDelay() {
    if (this.activePiece.lockDelayTimer) {
      if (this.activePiece.lockResets < 15) {
        clearTimeout(this.activePiece.lockDelayTimer);
        this.activePiece.lockDelayTimer = null;
        this.activePiece.lockResets++;
      }
    }
  }

  // Soft drop (moves down 1 step)
  tick() {
    if (this.isGameOver) return false;
    
    // Check if block can go down
    if (!this.checkCollision(this.activePiece.x, this.activePiece.y + 1, this.activePiece.matrix)) {
      this.activePiece.y++;
      this.activePiece.lockResets = 0; // Reset resets if it successfully falls
      return true;
    }
    
    return false; // hit bottom
  }

  getGhostY() {
    let ghostY = this.activePiece.y;
    while (!this.checkCollision(this.activePiece.x, ghostY + 1, this.activePiece.matrix)) {
      ghostY++;
    }
    return ghostY;
  }

  hardDrop() {
    if (this.isGameOver) return 0;
    
    const startY = this.activePiece.y;
    const ghostY = this.getGhostY();
    const dropDistance = ghostY - startY;

    this.activePiece.y = ghostY;
    this.lockPiece();

    // Extra score for hard drop
    this.score += dropDistance * 2;
    return dropDistance;
  }

  lockPiece() {
    const p = this.activePiece;
    
    // Write piece to grid
    for (let r = 0; r < p.matrix.length; r++) {
      for (let c = 0; c < p.matrix[r].length; c++) {
        if (p.matrix[r][c] !== 0) {
          const boardX = p.x + c;
          const boardY = p.y + r;
          
          if (boardY >= 0 && boardY < this.ROWS && boardX >= 0 && boardX < this.COLS) {
            this.grid[boardY][boardX] = {
              color: p.color,
              accentColor: p.accentColor,
              type: p.type
            };
          }
        }
      }
    }

    // Clear lines and record count
    const clearedCount = this.clearLines();
    
    // Update score, levels
    if (clearedCount > 0) {
      this.lines += clearedCount;
      const baseScores = [0, 100, 300, 500, 800];
      this.score += baseScores[clearedCount] * this.level;
      
      // Level Up every 10 lines
      const nextLevel = Math.floor(this.lines / 10) + 1;
      if (nextLevel > this.level) {
        this.level = nextLevel;
      }
    }

    // Spawn new piece
    this.spawnPiece();
    
    return clearedCount;
  }

  clearLines() {
    let cleared = 0;
    
    // Filter out full rows
    for (let r = this.ROWS - 1; r >= 0; r--) {
      const isRowFull = this.grid[r].every(cell => cell !== 0);
      if (isRowFull) {
        cleared++;
        // Delete this row and push an empty row at top
        this.grid.splice(r, 1);
        this.grid.unshift(new Array(this.COLS).fill(0));
        r++; // Adjust index due to removal
      }
    }

    return cleared;
  }
}

// Share globally
window.TetrisEngine = TetrisEngine;
