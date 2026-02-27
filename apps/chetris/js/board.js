// === 보드 클래스 ===
class Board {
  constructor() {
    this.grid = [];
    for (let r = 0; r < C.ROWS; r++) {
      this.grid[r] = new Array(C.COLS).fill(0);
    }
    this.version = 0; // 렌더 캐시 무효화용
  }

  isValid(cells) {
    for (const [r, c] of cells) {
      if (c < 0 || c >= C.COLS || r >= C.ROWS) return false;
      if (r < 0) continue; // 보드 위는 허용
      if (this.grid[r][c]) return false;
    }
    return true;
  }

  place(cells, color) {
    for (const [r, c] of cells) {
      if (r >= 0 && r < C.ROWS && c >= 0 && c < C.COLS) {
        this.grid[r][c] = color;
      }
    }
    this.version++;
  }

  clearLines() {
    const rows = [];
    for (let r = C.ROWS - 1; r >= 0; r--) {
      if (this.grid[r].every((cell) => cell !== 0)) {
        rows.push(r);
      }
    }
    if (rows.length === 0) return { count: 0, rows: [] };

    // filter + padding: splice/unshift 대신 한 번에 재구성
    const rowSet = new Set(rows);
    const kept = this.grid.filter((_, r) => !rowSet.has(r));
    const padding = Array.from({ length: rows.length }, () => new Array(C.COLS).fill(0));
    this.grid = [...padding, ...kept];
    this.version++;
    return { count: rows.length, rows };
  }

  clone() {
    const b = new Board();
    for (let r = 0; r < C.ROWS; r++) {
      b.grid[r] = [...this.grid[r]];
    }
    return b;
  }

  getHeight() {
    let h = 0;
    for (let c = 0; c < C.COLS; c++) {
      for (let r = 0; r < C.ROWS; r++) {
        if (this.grid[r][c]) {
          h += C.ROWS - r;
          break;
        }
      }
    }
    return h;
  }

  getHoles() {
    let holes = 0;
    for (let c = 0; c < C.COLS; c++) {
      let found = false;
      for (let r = 0; r < C.ROWS; r++) {
        if (this.grid[r][c]) found = true;
        else if (found) holes++;
      }
    }
    return holes;
  }

  getBumpiness() {
    const heights = [];
    for (let c = 0; c < C.COLS; c++) {
      let h = 0;
      for (let r = 0; r < C.ROWS; r++) {
        if (this.grid[r][c]) {
          h = C.ROWS - r;
          break;
        }
      }
      heights.push(h);
    }
    let bump = 0;
    for (let i = 0; i < heights.length - 1; i++) {
      bump += Math.abs(heights[i] - heights[i + 1]);
    }
    return bump;
  }

  // T-스핀 검출: 중심 셀의 4코너 중 3개 이상 채워져 있으면 T-스핀
  checkTSpin(piece) {
    if (piece.type !== "T") return false;
    const cr = piece.y + 1;
    const cc = piece.x + 1;
    let corners = 0;
    for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
      const nr = cr + dr;
      const nc = cc + dc;
      if (nr < 0 || nr >= C.ROWS || nc < 0 || nc >= C.COLS || this.grid[nr][nc]) {
        corners++;
      }
    }
    return corners >= 3;
  }
}
