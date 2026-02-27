// === 보드 로직 테스트 ===
const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const ctx = require("./loader");
const { Board, C, getCells, getGhostY } = ctx;

describe("Board", () => {
  let board;

  beforeEach(() => {
    board = new Board();
  });

  describe("초기 상태", () => {
    it("20x10 빈 보드", () => {
      assert.equal(board.grid.length, 20);
      assert.equal(board.grid[0].length, 10);
    });

    it("모든 셀이 비어있음 (falsy)", () => {
      for (let r = 0; r < 20; r++) {
        for (let c = 0; c < 10; c++) {
          assert.ok(!board.grid[r][c], `grid[${r}][${c}] = ${board.grid[r][c]}`);
        }
      }
    });
  });

  describe("isValid", () => {
    it("보드 안의 빈 셀 = valid", () => {
      assert.ok(board.isValid([[5, 5], [5, 6], [6, 5], [6, 6]]));
    });

    it("보드 왼쪽 밖 = invalid", () => {
      assert.ok(!board.isValid([[5, -1]]));
    });

    it("보드 오른쪽 밖 = invalid", () => {
      assert.ok(!board.isValid([[5, 10]]));
    });

    it("보드 아래쪽 밖 = invalid", () => {
      assert.ok(!board.isValid([[20, 5]]));
    });

    it("위쪽(음수 row)은 valid (스폰 영역)", () => {
      assert.ok(board.isValid([[-1, 5]]));
    });

    it("채워진 셀과 겹치면 invalid", () => {
      board.grid[10][5] = "#ff0000";
      assert.ok(!board.isValid([[10, 5]]));
    });
  });

  describe("place", () => {
    it("셀에 색상 배치", () => {
      board.place([[5, 3], [5, 4], [6, 3], [6, 4]], "#00fff2");
      assert.equal(board.grid[5][3], "#00fff2");
      assert.equal(board.grid[5][4], "#00fff2");
      assert.equal(board.grid[6][3], "#00fff2");
      assert.equal(board.grid[6][4], "#00fff2");
    });
  });

  describe("clearLines", () => {
    it("완성된 행 클리어", () => {
      // 19번 행(바닥) 채우기
      for (let c = 0; c < 10; c++) {
        board.grid[19][c] = "#ff0000";
      }
      const result = board.clearLines();
      assert.equal(result.count, 1);
      assert.deepEqual(result.rows, [19]);
      // 클리어 후 19번 행은 비어야 함
      for (let c = 0; c < 10; c++) {
        assert.ok(!board.grid[19][c], `grid[19][${c}] = ${board.grid[19][c]}`);
      }
    });

    it("여러 행 동시 클리어", () => {
      for (let c = 0; c < 10; c++) {
        board.grid[18][c] = "#ff0000";
        board.grid[19][c] = "#00ff00";
      }
      const result = board.clearLines();
      assert.equal(result.count, 2);
    });

    it("불완전한 행은 클리어 안 됨", () => {
      for (let c = 0; c < 9; c++) {
        board.grid[19][c] = "#ff0000";
      }
      // 10번째 셀 비워둠
      const result = board.clearLines();
      assert.equal(result.count, 0);
    });

    it("클리어 후 위 행이 아래로 떨어져야 한다", () => {
      // 18행에 블록 하나
      board.grid[18][5] = "#0000ff";
      // 19행(바닥) 완전히 채우기
      for (let c = 0; c < 10; c++) {
        board.grid[19][c] = "#ff0000";
      }
      board.clearLines();
      // 18행의 블록이 19행으로 떨어져야 함
      assert.equal(board.grid[19][5], "#0000ff");
      assert.ok(!board.grid[18][5], "18행이 비어있지 않음");
    });
  });

  describe("clone", () => {
    it("독립적인 복사본 생성", () => {
      board.grid[10][5] = "#ff0000";
      const clone = board.clone();
      assert.equal(clone.grid[10][5], "#ff0000");
      // 원본 변경이 복사본에 영향 없어야 함
      board.grid[10][5] = "#00ff00";
      assert.equal(clone.grid[10][5], "#ff0000");
    });
  });
});

describe("getCells", () => {
  it("피스의 절대 좌표 계산", () => {
    const piece = { type: "O", rotation: 0, x: 4, y: 0 };
    const cells = getCells(piece);
    assert.equal(cells.length, 4);
    // O 피스 형태: [[0,0],[0,1],[1,0],[1,1]] + offset (y=0, x=4)
    assert.deepEqual(cells[0], [0, 4]);
    assert.deepEqual(cells[1], [0, 5]);
  });
});

describe("getGhostY", () => {
  it("빈 보드에서 바닥까지 드롭", () => {
    const board = new Board();
    const piece = { type: "O", rotation: 0, x: 4, y: 0 };
    const ghostY = getGhostY(board, piece);
    // O 피스: 2칸 높이, 보드 20칸 → ghostY = 18
    assert.equal(ghostY, 18);
  });

  it("블록 위에서 멈춤", () => {
    const board = new Board();
    // 15행에 장애물
    board.grid[15][4] = "#ff0000";
    const piece = { type: "O", rotation: 0, x: 4, y: 0 };
    const ghostY = getGhostY(board, piece);
    // O 피스 하단이 14행에 와야 함 → ghostY = 13
    assert.equal(ghostY, 13);
  });
});
