// === 뿌요 AI 클래스 ===

class PuyoAI {
  constructor() {
    this.weights = {
      chainPotential: 5.0,
      height: -0.5,
      flatness: 0.3,
      colorGrouping: 1.0,
      deadZone: -10.0,
    };
  }

  findBestMove(board, pair) {
    let bestScore = -Infinity;
    let bestMove = null;
    let tieCount = 0;
    const colors = this._resolvePairColors(pair);

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

        sim.resolveChains();
        const score = this._evaluate(sim);
        const move = { row, col, rotation, score };

        if (score > bestScore) {
          bestScore = score;
          bestMove = move;
          tieCount = 1;
        } else if (Math.abs(score - bestScore) <= 0.000001) {
          tieCount++;
          if (Math.random() < 1 / tieCount) {
            bestMove = move;
          }
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

    const cw = (targetRot - currRot + 4) % 4;
    const ccw = (currRot - targetRot + 4) % 4;
    if (cw <= ccw) {
      for (let i = 0; i < cw; i++) queue.push('rotateCW');
    } else {
      for (let i = 0; i < ccw; i++) queue.push('rotateCCW');
    }

    const diff = targetCol - currCol;
    if (diff < 0) {
      for (let i = 0; i < -diff; i++) queue.push('left');
    } else {
      for (let i = 0; i < diff; i++) queue.push('right');
    }

    for (let i = 0; i < boardSafeRows(current, target); i++) {
      queue.push('down');
    }
    return queue;
  }

  _evaluate(board) {
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

    return (
      this.weights.chainPotential * chainPotential +
      this.weights.height * totalHeight +
      this.weights.flatness * flatnessScore +
      this.weights.colorGrouping * colorGrouping +
      this.weights.deadZone * deadZoneCount
    );
  }

  _evaluateChainPotential(board) {
    const visited = [];
    for (let r = 0; r < board.rows; r++) {
      visited[r] = new Array(board.cols).fill(false);
    }

    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    let nearGroups = 0;

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

        if (cells.length === 3) nearGroups++;
      }
    }

    const sim = board.clone();
    const chains = sim.resolveChains().length;
    return nearGroups + chains;
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
