// === 뿌요 보드 클래스 ===

class PuyoBoard {
  constructor(cols, rows) {
    this.cols = cols || PUYO.COLS;
    this.rows = rows || (PUYO.ROWS + PUYO.HIDDEN_ROWS);
    this.grid = [];
    for (let r = 0; r < this.rows; r++) {
      this.grid[r] = new Array(this.cols).fill(0);
    }
  }

  isValid(row, col) {
    if (row < 0 || row >= this.rows) return false;
    if (col < 0 || col >= this.cols) return false;
    return this.grid[row][col] === 0;
  }

  place(row, col, colorIndex) {
    if (row < 0 || row >= this.rows) return false;
    if (col < 0 || col >= this.cols) return false;
    if (colorIndex < 1 || colorIndex > PUYO.COLORS) return false;
    this.grid[row][col] = colorIndex;
    return true;
  }

  placePair(pair) {
    if (pair.main && pair.sub) {
      if (!this.isValid(pair.main.row, pair.main.col) || !this.isValid(pair.sub.row, pair.sub.col)) return false;
      this.place(pair.main.row, pair.main.col, pair.main.color);
      this.place(pair.sub.row, pair.sub.col, pair.sub.color);
      return true;
    }

    const mainRow = pair.mainRow !== undefined ? pair.mainRow : pair.row;
    const mainCol = pair.mainCol !== undefined ? pair.mainCol : pair.col;
    const rotation = pair.rotation !== undefined ? pair.rotation : 0;
    const mainColor = pair.mainColor !== undefined ? pair.mainColor : (pair.colorA !== undefined ? pair.colorA : 1);
    const subColor = pair.subColor !== undefined ? pair.subColor : (pair.colorB !== undefined ? pair.colorB : 1);

    const [dr, dc] = PUYO.PAIR_OFFSETS[rotation % 4];
    const subRow = mainRow + dr;
    const subCol = mainCol + dc;

    if (!this.isValid(mainRow, mainCol) || !this.isValid(subRow, subCol)) return false;
    this.place(mainRow, mainCol, mainColor);
    this.place(subRow, subCol, subColor);
    return true;
  }

  applyGravity() {
    let moved = false;

    for (let c = 0; c < this.cols; c++) {
      let writePos = this.rows - 1;
      for (let r = this.rows - 1; r >= 0; r--) {
        const value = this.grid[r][c];
        if (value === 0) continue;
        if (r !== writePos) {
          this.grid[writePos][c] = value;
          this.grid[r][c] = 0;
          moved = true;
        }
        writePos--;
      }
    }

    return moved;
  }

  findMatches() {
    const groups = [];
    const visited = [];
    for (let r = 0; r < this.rows; r++) {
      visited[r] = new Array(this.cols).fill(false);
    }

    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const color = this.grid[r][c];
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
            if (nr < 0 || nr >= this.rows || nc < 0 || nc >= this.cols) continue;
            if (visited[nr][nc]) continue;
            if (this.grid[nr][nc] !== color) continue;
            visited[nr][nc] = true;
            queue.push([nr, nc]);
          }
        }

        if (cells.length >= 4) {
          groups.push({ color, cells });
        }
      }
    }

    return groups;
  }

  removeMatches(groups) {
    let removed = 0;
    const colors = new Set();
    const groupSizes = [];

    for (const group of groups) {
      colors.add(group.color);
      groupSizes.push(group.cells.length);
      for (const [r, c] of group.cells) {
        if (this.grid[r][c] !== 0) {
          this.grid[r][c] = 0;
          removed++;
        }
      }
    }

    return { removed, colors: Array.from(colors), groupSizes };
  }

  resolveChains() {
    const chainResults = [];
    let chainIndex = 0;

    while (true) {
      this.applyGravity();
      const groups = this.findMatches();
      if (groups.length === 0) break;

      chainIndex++;
      const score = this.calcChainScore(chainIndex, groups);
      this.removeMatches(groups);
      chainResults.push({ chain: chainIndex, groups, score });
    }

    return chainResults;
  }

  calcChainScore(chainIndex, groups) {
    let totalRemoved = 0;
    let groupBonus = 0;
    const colors = new Set();

    for (const group of groups) {
      const size = group.cells.length;
      totalRemoved += size;
      colors.add(group.color);
      const groupIdx = Math.min(size, PUYO.GROUP_BONUS.length - 1);
      groupBonus += PUYO.GROUP_BONUS[groupIdx] || 0;
    }

    const chainIdx = Math.min(chainIndex, PUYO.CHAIN_POWER.length - 1);
    const chainPower = PUYO.CHAIN_POWER[chainIdx] || 0;

    const colorCount = colors.size;
    const colorIdx = Math.min(colorCount, PUYO.COLOR_BONUS.length - 1);
    const colorBonus = PUYO.COLOR_BONUS[colorIdx] || 0;

    const multiplier = Math.max(1, chainPower + groupBonus + colorBonus);
    return 10 * totalRemoved * multiplier;
  }

  isGameOver() {
    return this.grid[PUYO.DEATH_ROW][PUYO.DEATH_COL] !== 0;
  }

  getColumnHeights() {
    const heights = [];
    for (let c = 0; c < this.cols; c++) {
      let height = 0;
      for (let r = 0; r < this.rows; r++) {
        if (this.grid[r][c] !== 0) {
          height = this.rows - r;
          break;
        }
      }
      heights.push(height);
    }
    return heights;
  }

  clone() {
    const copied = new PuyoBoard(this.cols, this.rows);
    for (let r = 0; r < this.rows; r++) {
      copied.grid[r] = [...this.grid[r]];
    }
    return copied;
  }
}
