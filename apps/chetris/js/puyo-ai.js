// === 뿌요 AI 클래스 ===

class PuyoAI {
  constructor() {
    // meatfighter + Ikeda et al. 기반 가중치 (색상 그루핑 강화)
    this.weights = {
      chainPotential: 4.0,
      height: -0.8,
      flatness: 0.3,
      colorGrouping: 2.5,
      deadZone: -12.0,
      edgePenalty: -0.5,
    };
  }

  findBestMove(board, pair, nextPair) {
    const colors = this._resolvePairColors(pair);

    // Phase 1: 모든 배치를 1-피스 평가 (빠름, ~2ms)
    const candidates = [];

    for (let rotation = 0; rotation < 4; rotation++) {
      const [dr, dc] = PUYO.PAIR_OFFSETS[rotation];
      const minCol = Math.max(0, -dc);
      const maxCol = Math.min(board.cols - 1, board.cols - 1 - dc);

      for (let col = minCol; col <= maxCol; col++) {
        const startRow = Math.max(0, -Math.min(0, dr));
        let row = startRow;

        if (!this._canPlacePair(board, row, col, rotation)) continue;
        while (this._canPlacePair(board, row + 1, col, rotation)) {
          row++;
        }

        const sim = board.clone();
        const testPair = {
          row,
          col,
          rotation,
          mainColor: colors.mainColor,
          subColor: colors.subColor,
        };
        if (!sim.placePair(testPair)) continue;

        const chainResults = sim.resolveChains();
        const score1 = this._evaluate(sim, chainResults);
        candidates.push({ row, col, rotation, score1, sim });
      }
    }

    if (candidates.length === 0) return null;

    // Phase 2: Top-K 선별적 룩어헤드 (보드 높이에 따라 K 적응)
    if (nextPair) {
      const heights = board.getColumnHeights();
      const maxH = Math.max(...heights);
      // 낮은 보드: 전체, 중간: 상위 5개, 높은 보드: 상위 3개
      const K = maxH < 5 ? candidates.length : maxH < 8 ? 5 : 3;

      candidates.sort((a, b) => b.score1 - a.score1);
      const nextColors = this._resolvePairColors(nextPair);
      const limit = Math.min(K, candidates.length);

      for (let i = 0; i < limit; i++) {
        const c = candidates[i];
        let bestNextScore = -Infinity;

        for (let rot2 = 0; rot2 < 4; rot2++) {
          const [dr2, dc2] = PUYO.PAIR_OFFSETS[rot2];
          const minCol2 = Math.max(0, -dc2);
          const maxCol2 = Math.min(c.sim.cols - 1, c.sim.cols - 1 - dc2);

          for (let col2 = minCol2; col2 <= maxCol2; col2++) {
            let row2 = Math.max(0, -Math.min(0, dr2));
            if (!this._canPlacePair(c.sim, row2, col2, rot2)) continue;
            while (this._canPlacePair(c.sim, row2 + 1, col2, rot2)) row2++;

            const sim2 = c.sim.clone();
            const testPair2 = {
              row: row2, col: col2, rotation: rot2,
              mainColor: nextColors.mainColor,
              subColor: nextColors.subColor,
            };
            if (!sim2.placePair(testPair2)) continue;

            const chains2 = sim2.resolveChains();
            const s2 = this._evaluate(sim2, chains2);
            if (s2 > bestNextScore) bestNextScore = s2;
          }
        }

        c.score = bestNextScore > -Infinity
          ? 0.4 * c.score1 + 0.6 * bestNextScore
          : c.score1;
      }

      // 룩어헤드 미적용 후보는 1-피스 점수 사용
      for (let i = limit; i < candidates.length; i++) {
        candidates[i].score = candidates[i].score1;
      }
    } else {
      for (const c of candidates) c.score = c.score1;
    }

    // Phase 3: 최고 점수 선택 (타이브레이킹 포함)
    let bestScore = -Infinity;
    let bestMove = null;
    let tieCount = 0;

    for (const c of candidates) {
      if (c.score > bestScore) {
        bestScore = c.score;
        bestMove = { row: c.row, col: c.col, rotation: c.rotation, score: c.score };
        tieCount = 1;
      } else if (Math.abs(c.score - bestScore) <= 0.000001) {
        tieCount++;
        if (Math.random() < 1 / tieCount) {
          bestMove = { row: c.row, col: c.col, rotation: c.rotation, score: c.score };
        }
      }
    }

    return bestMove;
  }

  buildMoveQueue(current, target) {
    const queue = [];
    const currRot = current.rotation || 0;
    const targetRot = target.rotation || 0;
    const currCol = current.col !== undefined ? current.col : current.x;
    const targetCol = target.col !== undefined ? target.col : target.x;
    const totalDowns = boardSafeRows(current, target);
    let downsUsed = 0;

    // 1) 회전 — 상단에서 빠르게 (공간 넉넉)
    const cw = (targetRot - currRot + 4) % 4;
    const ccw = (currRot - targetRot + 4) % 4;
    if (cw <= ccw) {
      for (let i = 0; i < cw; i++) queue.push('rotateCW');
    } else {
      for (let i = 0; i < ccw; i++) queue.push('rotateCCW');
    }

    // 2) 수평 이동 — 빠르게 한 번에 (보드 6칸이라 즉시 도달)
    const diff = targetCol - currCol;
    if (diff < 0) {
      for (let i = 0; i < -diff; i++) queue.push('left');
    } else if (diff > 0) {
      for (let i = 0; i < diff; i++) queue.push('right');
    }

    // 4) 나머지 낙하
    while (downsUsed < totalDowns) {
      queue.push('down');
      downsUsed++;
    }
    return queue;
  }

  _evaluate(board, chainResults = []) {
    const heights = board.getColumnHeights();
    const totalHeight = heights.reduce((sum, h) => sum + h, 0);

    let bumpiness = 0;
    for (let i = 0; i < heights.length - 1; i++) {
      bumpiness += Math.abs(heights[i] - heights[i + 1]);
    }
    const flatnessScore = -bumpiness;

    let deadZoneCount = 0;
    const topLimit = Math.min(board.rows - 1, PUYO.DEATH_ROW + 1);
    const minDeathCol = Math.max(0, PUYO.DEATH_COL - 1);
    const maxDeathCol = Math.min(board.cols - 1, PUYO.DEATH_COL + 1);
    for (let r = 0; r <= topLimit; r++) {
      for (let c = minDeathCol; c <= maxDeathCol; c++) {
        if (board.grid[r][c] !== 0) deadZoneCount++;
      }
    }

    const chainPotential = this._evaluateChainPotential(board);
    const colorGrouping = this._colorGrouping(board);

    // 실제 연쇄 보너스 — 긴 연쇄를 비선형으로 선호
    const chainCount = chainResults.length;
    const chainScore = chainResults.reduce((sum, r) => sum + r.score, 0);
    const chainBonus = chainCount * chainCount * 2.0 + chainScore * 0.01;

    // 가장자리 열 패널티 — 연쇄 연결 차단 위험
    let edgeCount = 0;
    for (let r = 0; r < board.rows; r++) {
      if (board.grid[r][0] !== 0) edgeCount++;
      if (board.grid[r][board.cols - 1] !== 0) edgeCount++;
    }

    return (
      this.weights.chainPotential * chainPotential +
      this.weights.height * totalHeight +
      this.weights.flatness * flatnessScore +
      this.weights.colorGrouping * colorGrouping +
      this.weights.deadZone * deadZoneCount +
      this.weights.edgePenalty * edgeCount +
      chainBonus
    );
  }

  _evaluateChainPotential(board) {
    // resolveChains 후의 보드이므로, 잔여 연쇄 잠재력만 평가
    const visited = [];
    for (let r = 0; r < board.rows; r++) {
      visited[r] = new Array(board.cols).fill(false);
    }

    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    let potential = 0;

    for (let r = 0; r < board.rows; r++) {
      for (let c = 0; c < board.cols; c++) {
        const color = board.grid[r][c];
        if (color === 0 || visited[r][c]) continue;

        const queue = [[r, c]];
        const cells = [];
        visited[r][c] = true;

        for (let i = 0; i < queue.length; i++) {
          const [cr, cc] = queue[i];
          cells.push([cr, cc]);

          for (const [dr, dc] of dirs) {
            const nr = cr + dr;
            const nc = cc + dc;
            if (nr < 0 || nr >= board.rows || nc < 0 || nc >= board.cols) continue;
            if (visited[nr][nc]) continue;
            if (board.grid[nr][nc] !== color) continue;
            visited[nr][nc] = true;
            queue.push([nr, nc]);
          }
        }

        // 2-cell: 연쇄 후보 (1개 추가로 3-cell 가능)
        if (cells.length === 2) potential += 0.5;
        // 3-cell: 즉시 연쇄 가능 (1개만 추가하면 터짐)
        if (cells.length === 3) potential += 1.0;
      }
    }

    // 불필요한 clone+resolveChains 제거 — 이미 해소된 보드에서 재실행은 항상 0
    return potential;
  }

  _colorGrouping(board) {
    let count = 0;

    for (let r = 0; r < board.rows; r++) {
      for (let c = 0; c < board.cols; c++) {
        const color = board.grid[r][c];
        if (color === 0) continue;
        if (r + 1 < board.rows && board.grid[r + 1][c] === color) count++;
        if (c + 1 < board.cols && board.grid[r][c + 1] === color) count++;
      }
    }

    return count;
  }

  _canPlacePair(board, row, col, rotation) {
    const [dr, dc] = PUYO.PAIR_OFFSETS[rotation];
    const subRow = row + dr;
    const subCol = col + dc;
    return board.isValid(row, col) && board.isValid(subRow, subCol);
  }

  _resolvePairColors(pair) {
    const mainColor = pair.mainColor !== undefined
      ? pair.mainColor
      : (pair.colorA !== undefined
        ? pair.colorA
        : (pair.main && pair.main.color !== undefined ? pair.main.color : 1));

    const subColor = pair.subColor !== undefined
      ? pair.subColor
      : (pair.colorB !== undefined
        ? pair.colorB
        : (pair.sub && pair.sub.color !== undefined ? pair.sub.color : 1));

    return { mainColor, subColor };
  }
}

function boardSafeRows(current, target) {
  if (target.row !== undefined && current.row !== undefined) {
    return Math.max(1, target.row - current.row + 1);
  }
  if (target.row !== undefined) {
    return Math.max(1, target.row + 1);
  }
  return PUYO.ROWS + PUYO.HIDDEN_ROWS;
}
