// === AI 자동 플레이어 (4-Feature 휴리스틱 + 동점 랜덤화) ===

class AI {
  constructor() {
    this.w = {
      height: -0.51,
      lines: 3.6,
      holes: -0.36,
      bumpiness: -0.18,
    };
  }

  findBestMove(board, piece) {
    let bestScore = -Infinity;
    let bestMoves = [];
    const maxRot = piece.type === "O" ? 1 : (piece.type === "I" || piece.type === "S" || piece.type === "Z") ? 2 : 4;

    for (let rot = 0; rot < maxRot; rot++) {
      const shape = C.SHAPES[piece.type][rot];
      const { minC, maxC } = this._bounds(shape);

      for (let x = -minC; x < C.COLS - maxC; x++) {
        const startCells = shape.map(([r, c]) => [r, c + x]);
        if (!board.isValid(startCells)) continue;

        let dropY = 0;
        while (true) {
          const test = shape.map(([r, c]) => [r + dropY + 1, c + x]);
          if (!board.isValid(test)) break;
          dropY++;
        }

        const finalCells = shape.map(([r, c]) => [r + dropY, c + x]);
        if (!board.isValid(finalCells)) continue;

        const sim = board.clone();
        sim.place(finalCells, C.COLORS[piece.type]);
        const cleared = sim.clearLines();

        const agg = this._aggregateHeight(sim);
        const maxH = this._maxHeight(sim);
        const lines = cleared.count;
        const holes = sim.getHoles();
        const bump = this._smartBumpiness(sim);

        let score = agg * this.w.height
                  + lines * this.w.lines
                  + holes * this.w.holes
                  + bump * this.w.bumpiness
                  + maxH * -0.1;

        // T-스핀 보너스
        if (piece.type === "T" && lines > 0) {
          const fakePiece = { type: "T", rotation: rot, x, y: dropY };
          if (board.checkTSpin(fakePiece)) {
            score += 2.0 * lines;
          }
        }

        // 동점 처리: reservoir sampling
        if (score > bestScore + 0.0001) {
          bestScore = score;
          bestMoves = [{ rotation: rot, x, dropY }];
        } else if (Math.abs(score - bestScore) <= 0.0001) {
          bestMoves.push({ rotation: rot, x, dropY });
        }
      }
    }

    if (bestMoves.length === 0) return null;
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }

  buildMoveQueue(current, target) {
    const queue = [];
    let rotDiff = (target.rotation - current.rotation + 4) % 4;
    if (rotDiff === 3) {
      queue.push("rotateCCW");
    } else {
      for (let i = 0; i < rotDiff; i++) queue.push("rotateCW");
    }
    const dx = target.x - current.x;
    if (dx < 0) {
      for (let i = 0; i < -dx; i++) queue.push("left");
    } else if (dx > 0) {
      for (let i = 0; i < dx; i++) queue.push("right");
    }
    // 하드드롭 대신 한 칸씩 내려오기 (자연스러운 중력)
    for (let i = 0; i < C.ROWS; i++) {
      queue.push("down");
    }
    return queue;
  }

  _bounds(shape) {
    let minC = Infinity, maxC = -Infinity;
    for (const [, c] of shape) {
      minC = Math.min(minC, c);
      maxC = Math.max(maxC, c);
    }
    return { minC, maxC };
  }

  _aggregateHeight(board) {
    let total = 0;
    for (let c = 0; c < C.COLS; c++) {
      for (let r = 0; r < C.ROWS; r++) {
        if (board.grid[r][c]) { total += C.ROWS - r; break; }
      }
    }
    return total;
  }

  _maxHeight(board) {
    let max = 0;
    for (let c = 0; c < C.COLS; c++) {
      for (let r = 0; r < C.ROWS; r++) {
        if (board.grid[r][c]) { max = Math.max(max, C.ROWS - r); break; }
      }
    }
    return max;
  }

  // 양쪽 빈 영역에 대한 엣지 바이어스를 줄인 범프니스
  _smartBumpiness(board) {
    const heights = [];
    for (let c = 0; c < C.COLS; c++) {
      let h = 0;
      for (let r = 0; r < C.ROWS; r++) {
        if (board.grid[r][c]) { h = C.ROWS - r; break; }
      }
      heights.push(h);
    }
    let bump = 0;
    for (let i = 0; i < heights.length - 1; i++) {
      const diff = Math.abs(heights[i] - heights[i + 1]);
      // 둘 다 0인 인접 열은 범프니스에 포함하지 않음
      if (heights[i] === 0 && heights[i + 1] === 0) continue;
      bump += diff;
    }
    return bump;
  }
}
