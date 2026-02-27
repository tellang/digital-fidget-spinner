// === AI 내부 평가 함수 테스트 ===
const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const ctx = require("./loader");
const { AI, Board, C } = ctx;

describe("AI 내부 평가 함수", () => {
  let ai;

  beforeEach(() => {
    ai = new AI();
  });

  describe("_bounds", () => {
    it("I 피스 rot0 경계: minC=0, maxC=3", () => {
      const shape = C.SHAPES.I[0]; // [[1,0],[1,1],[1,2],[1,3]]
      const { minC, maxC } = ai._bounds(shape);
      assert.equal(minC, 0);
      assert.equal(maxC, 3);
    });

    it("O 피스 경계: minC=0, maxC=1", () => {
      const { minC, maxC } = ai._bounds(C.SHAPES.O[0]);
      assert.equal(minC, 0);
      assert.equal(maxC, 1);
    });

    it("T 피스 rot0 경계: minC=0, maxC=2", () => {
      // T rot0: [[0,1],[1,0],[1,1],[1,2]]
      const { minC, maxC } = ai._bounds(C.SHAPES.T[0]);
      assert.equal(minC, 0);
      assert.equal(maxC, 2);
    });
  });

  describe("_getColumnHeights", () => {
    it("빈 보드에서 모든 컬럼 높이 0", () => {
      const board = new Board();
      const heights = ai._getColumnHeights(board);
      assert.equal(heights.length, C.COLS);
      assert.ok(heights.every(h => h === 0), "빈 보드에 0이 아닌 높이 존재");
    });

    it("바닥(row=19)에 블록 놓으면 해당 컬럼 높이 1", () => {
      const board = new Board();
      board.grid[19][3] = "#ff0000";
      const heights = ai._getColumnHeights(board);
      assert.equal(heights[3], 1);
      assert.equal(heights[4], 0);
    });

    it("중간(row=10)에 블록 놓으면 해당 컬럼 높이 = ROWS - 10 = 10", () => {
      const board = new Board();
      board.grid[10][5] = "#ff0000";
      const heights = ai._getColumnHeights(board);
      assert.equal(heights[5], C.ROWS - 10);
    });

    it("여러 블록 중 최상단 기준으로 높이 계산", () => {
      const board = new Board();
      board.grid[18][2] = "#ff0000"; // 높이 2
      board.grid[19][2] = "#ff0000"; // 높이 1 (하지만 18이 더 위)
      const heights = ai._getColumnHeights(board);
      assert.equal(heights[2], C.ROWS - 18);
    });
  });

  describe("_sumHeights", () => {
    it("높이 배열 합산 정확성", () => {
      assert.equal(ai._sumHeights([1, 2, 3, 0, 0, 0, 0, 0, 0, 0]), 6);
    });

    it("모두 0이면 0 반환", () => {
      assert.equal(ai._sumHeights(new Array(10).fill(0)), 0);
    });

    it("모두 같은 값이면 값*길이", () => {
      assert.equal(ai._sumHeights(new Array(10).fill(5)), 50);
    });
  });

  describe("_maxFromHeights", () => {
    it("최대 높이 반환", () => {
      assert.equal(ai._maxFromHeights([1, 5, 3, 2, 0, 0, 0, 0, 0, 0]), 5);
    });

    it("모두 0이면 0 반환", () => {
      assert.equal(ai._maxFromHeights(new Array(10).fill(0)), 0);
    });

    it("첫 번째 요소가 최대인 경우", () => {
      assert.equal(ai._maxFromHeights([10, 1, 2, 3, 0, 0, 0, 0, 0, 0]), 10);
    });

    it("마지막 요소가 최대인 경우", () => {
      assert.equal(ai._maxFromHeights([0, 0, 0, 0, 0, 0, 0, 0, 0, 7]), 7);
    });
  });

  describe("_countHoles", () => {
    it("구멍 없는 보드에서 0", () => {
      const board = new Board();
      const heights = ai._getColumnHeights(board);
      assert.equal(ai._countHoles(board, heights), 0);
    });

    it("블록 아래 빈 셀 = 구멍 1개", () => {
      const board = new Board();
      board.grid[18][5] = "#ff0000"; // 18행에 블록, 19행은 비어있음
      const heights = ai._getColumnHeights(board);
      assert.equal(ai._countHoles(board, heights), 1);
    });

    it("블록 아래 빈 셀 2개 = 구멍 2개", () => {
      const board = new Board();
      board.grid[17][5] = "#ff0000"; // 17행 블록
      // 18, 19행 비어있음 → 구멍 2개
      const heights = ai._getColumnHeights(board);
      assert.equal(ai._countHoles(board, heights), 2);
    });

    it("높이 0인 컬럼은 구멍 체크 스킵", () => {
      const board = new Board();
      // 아무 블록도 없는 열은 구멍 없음
      const heights = new Array(C.COLS).fill(0);
      assert.equal(ai._countHoles(board, heights), 0);
    });
  });

  describe("_calcBumpiness", () => {
    it("같은 높이면 범프니스 0", () => {
      const heights = new Array(10).fill(3);
      assert.equal(ai._calcBumpiness(heights), 0);
    });

    it("모두 0이면 범프니스 0 (양쪽 0 인접은 무시)", () => {
      const heights = new Array(10).fill(0);
      assert.equal(ai._calcBumpiness(heights), 0);
    });

    it("높이 [0,2,0,...] 시 |0-2|+|2-0| = 4", () => {
      const heights = [0, 2, 0, 0, 0, 0, 0, 0, 0, 0];
      assert.equal(ai._calcBumpiness(heights), 4);
    });

    it("연속 증가 [1,2,3,4,...] 시 각 차이 합", () => {
      const heights = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      // |1-2|+|2-3|+...+|9-10| = 9
      assert.equal(ai._calcBumpiness(heights), 9);
    });
  });

  describe("findBestMove 고급 케이스", () => {
    it("모든 피스 타입에 대해 빈 보드에서 이동 찾기", () => {
      const board = new Board();
      for (const type of ["I", "O", "T", "S", "Z", "J", "L"]) {
        const piece = { type, rotation: 0, x: C.SPAWN_X[type], y: 0 };
        const move = ai.findBestMove(board, piece);
        assert.ok(move !== null, `${type} 피스 이동 찾기 실패`);
        assert.ok(typeof move.rotation === "number");
        assert.ok(typeof move.x === "number");
        assert.ok(typeof move.dropY === "number");
      }
    });

    it("찾은 이동의 rotation은 0-3 범위", () => {
      const board = new Board();
      const piece = { type: "T", rotation: 0, x: 3, y: 0 };
      const move = ai.findBestMove(board, piece);
      assert.ok(move.rotation >= 0 && move.rotation <= 3);
    });

    it("찾은 이동의 x는 보드 범위 내", () => {
      const board = new Board();
      const piece = { type: "T", rotation: 0, x: 3, y: 0 };
      const move = ai.findBestMove(board, piece);
      assert.ok(move.x >= 0 && move.x < C.COLS);
    });

    it("보드가 거의 꽉 찼을 때도 null이거나 유효한 이동 반환", () => {
      const board = new Board();
      // 상위 19행을 채움 (0행만 비움)
      for (let r = 1; r < C.ROWS; r++) {
        for (let c = 0; c < C.COLS; c++) board.grid[r][c] = "#ff0000";
      }
      const piece = { type: "O", rotation: 0, x: 4, y: 0 };
      const result = ai.findBestMove(board, piece);
      // null이거나 유효한 이동이어야 함
      assert.ok(result === null || typeof result.x === "number");
    });
  });

  describe("buildMoveQueue 상세", () => {
    it("회전 없이 우로 이동 2칸", () => {
      const current = { rotation: 0, x: 3, y: 0 };
      const target = { rotation: 0, x: 5, dropY: 10 };
      const queue = ai.buildMoveQueue(current, target);
      const rights = queue.filter(m => m === "right");
      assert.equal(rights.length, 2);
      assert.ok(!queue.includes("left"), "불필요한 left 포함");
    });

    it("회전 없이 좌로 이동 3칸", () => {
      const current = { rotation: 0, x: 6, y: 0 };
      const target = { rotation: 0, x: 3, dropY: 10 };
      const queue = ai.buildMoveQueue(current, target);
      const lefts = queue.filter(m => m === "left");
      assert.equal(lefts.length, 3);
    });

    it("rotDiff=3 → CCW 1회 최적화 (CW 3회 대신)", () => {
      const current = { rotation: 0, x: 3, y: 0 };
      const target = { rotation: 3, x: 3, dropY: 10 };
      const queue = ai.buildMoveQueue(current, target);
      assert.ok(queue.includes("rotateCCW"), "CCW 최적화 미적용");
      assert.ok(!queue.includes("rotateCW"), "CW가 포함되면 안 됨");
    });

    it("rotDiff=1 → CW 1회", () => {
      const current = { rotation: 0, x: 3, y: 0 };
      const target = { rotation: 1, x: 3, dropY: 10 };
      const queue = ai.buildMoveQueue(current, target);
      const cws = queue.filter(m => m === "rotateCW");
      assert.equal(cws.length, 1);
    });

    it("rotDiff=2 → CW 2회", () => {
      const current = { rotation: 0, x: 3, y: 0 };
      const target = { rotation: 2, x: 3, dropY: 10 };
      const queue = ai.buildMoveQueue(current, target);
      const cws = queue.filter(m => m === "rotateCW");
      assert.equal(cws.length, 2);
    });

    it("큐의 마지막은 항상 down 시퀀스", () => {
      const current = { rotation: 0, x: 3, y: 0 };
      const target = { rotation: 0, x: 3, dropY: 5 };
      const queue = ai.buildMoveQueue(current, target);
      // down이 포함되어야 함
      assert.ok(queue.includes("down"), "down 이동 없음");
      // 마지막 요소들이 down이어야 함
      assert.equal(queue[queue.length - 1], "down");
    });

    it("이동 없이 같은 위치 target → 회전/이동 없음", () => {
      const current = { rotation: 0, x: 3, y: 0 };
      const target = { rotation: 0, x: 3, dropY: 10 };
      const queue = ai.buildMoveQueue(current, target);
      assert.ok(!queue.includes("left") && !queue.includes("right"));
      assert.ok(!queue.includes("rotateCW") && !queue.includes("rotateCCW"));
    });
  });
});
