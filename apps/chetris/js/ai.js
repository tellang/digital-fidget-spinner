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

        // 컬럼 높이 1회 계산, 평가 함수 공유 (C1 최적화)
        const heights = this._getColumnHeights(sim);
        const agg = this._sumHeights(heights);
        const maxH = this._maxFromHeights(heights);
        const lines = cleared.count;
        const holes = this._countHoles(sim, heights);
        const bump = this._calcBumpiness(heights);

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

  // 컬럼 높이 배열 1회 계산 (평가 함수 공유)
  _getColumnHeights(board) {
    const heights = new Array(C.COLS);
    for (let c = 0; c < C.COLS; c++) {
      heights[c] = 0;
      for (let r = 0; r < C.ROWS; r++) {
        if (board.grid[r][c]) { heights[c] = C.ROWS - r; break; }
      }
    }
    return heights;
  }

  _sumHeights(heights) {
    let total = 0;
    for (let i = 0; i < heights.length; i++) total += heights[i];
    return total;
  }

  _maxFromHeights(heights) {
    let max = 0;
    for (let i = 0; i < heights.length; i++) {
      if (heights[i] > max) max = heights[i];
    }
    return max;
  }

  // 높이 배열 활용: 각 컬럼에서 최상단 블록 아래 빈 셀만 체크
  _countHoles(board, heights) {
    let holes = 0;
    for (let c = 0; c < C.COLS; c++) {
      if (heights[c] === 0) continue;
      const startRow = C.ROWS - heights[c];
      for (let r = startRow + 1; r < C.ROWS; r++) {
        if (!board.grid[r][c]) holes++;
      }
    }
    return holes;
  }

  // 범프니스: 인접 컬럼 높이 차이 합 (양쪽 빈 영역 제외)
  _calcBumpiness(heights) {
    let bump = 0;
    for (let i = 0; i < heights.length - 1; i++) {
      if (heights[i] === 0 && heights[i + 1] === 0) continue;
      bump += Math.abs(heights[i] - heights[i + 1]);
    }
    return bump;
  }
}
