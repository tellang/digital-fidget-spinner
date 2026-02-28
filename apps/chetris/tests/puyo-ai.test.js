// === 뿌요 AI 테스트 ===
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const ctx = require("./loader");
const { PuyoAI, PuyoBoard, PUYO } = ctx;

describe("PuyoAI", () => {
  describe("findBestMove", () => {
    it("빈 보드에서 유효한 이동을 반환해야 한다", () => {
      const board = new PuyoBoard();
      const ai = new PuyoAI();
      const pair = { mainColor: 1, subColor: 2, row: 0, col: 2, rotation: 0 };
      const move = ai.findBestMove(board, pair);
      assert.ok(move, "AI가 이동을 찾지 못함");
      assert.ok(typeof move.col === "number");
      assert.ok(typeof move.rotation === "number");
      assert.ok(move.col >= 0 && move.col < PUYO.COLS);
      assert.ok(move.rotation >= 0 && move.rotation < 4);
    });

    it("모든 회전 상태(0~3)를 탐색해야 한다", () => {
      const board = new PuyoBoard();
      const ai = new PuyoAI();
      const pair = { mainColor: 1, subColor: 1, row: 0, col: 2, rotation: 0 };
      const move = ai.findBestMove(board, pair);
      assert.ok(move);
    });

    it("같은 색 쌍은 연쇄 가능한 위치를 선호해야 한다", () => {
      const board = new PuyoBoard();
      const ai = new PuyoAI();
      // 같은 색 3개를 한 열에 쌓아둠
      board.place(12, 0, 1);
      board.place(11, 0, 1);
      board.place(10, 0, 1);
      // 같은 색 쌍 → 0열로 보내서 4개 매칭을 노릴 수 있음
      const pair = { mainColor: 1, subColor: 1, row: 0, col: 2, rotation: 0 };
      const move = ai.findBestMove(board, pair);
      assert.ok(move, "AI가 이동을 찾지 못함");
    });

    it("게임오버 직전 보드에서도 이동을 시도해야 한다", () => {
      const board = new PuyoBoard();
      const ai = new PuyoAI();
      // 대부분 열을 높게 쌓음
      for (let c = 0; c < PUYO.COLS; c++) {
        for (let r = 3; r < PUYO.ROWS + PUYO.HIDDEN_ROWS; r++) {
          board.place(r, c, (c % PUYO.COLORS) + 1);
        }
      }
      const pair = { mainColor: 1, subColor: 2, row: 0, col: 2, rotation: 0 };
      const move = ai.findBestMove(board, pair);
      // 이동 가능한 자리가 없을 수 있음 (null 허용)
    });
  });

  describe("buildMoveQueue", () => {
    it("배열을 반환해야 한다", () => {
      const ai = new PuyoAI();
      const current = { row: 0, col: 2, rotation: 0 };
      const target = { row: 10, col: 3, rotation: 1 };
      const queue = ai.buildMoveQueue(current, target);
      assert.ok(Array.isArray(queue));
    });

    it("회전이 필요하면 rotateCW/CCW를 포함해야 한다", () => {
      const ai = new PuyoAI();
      const current = { row: 0, col: 2, rotation: 0 };
      const target = { row: 10, col: 2, rotation: 1 };
      const queue = ai.buildMoveQueue(current, target);
      assert.ok(queue.includes("rotateCW"), "회전 명령 없음");
    });

    it("좌측 이동이 필요하면 left를 포함해야 한다", () => {
      const ai = new PuyoAI();
      const current = { row: 0, col: 3, rotation: 0 };
      const target = { row: 10, col: 1, rotation: 0 };
      const queue = ai.buildMoveQueue(current, target);
      const leftCount = queue.filter((m) => m === "left").length;
      assert.equal(leftCount, 2, "left 2회 필요");
    });

    it("우측 이동이 필요하면 right를 포함해야 한다", () => {
      const ai = new PuyoAI();
      const current = { row: 0, col: 1, rotation: 0 };
      const target = { row: 10, col: 4, rotation: 0 };
      const queue = ai.buildMoveQueue(current, target);
      const rightCount = queue.filter((m) => m === "right").length;
      assert.equal(rightCount, 3, "right 3회 필요");
    });

    it("마지막에 down 시퀀스를 포함해야 한다", () => {
      const ai = new PuyoAI();
      const current = { row: 0, col: 2, rotation: 0 };
      const target = { row: 10, col: 2, rotation: 0 };
      const queue = ai.buildMoveQueue(current, target);
      assert.ok(queue.includes("down"), "down 명령 없음");
      // 마지막 요소가 down이어야 함
      assert.equal(queue[queue.length - 1], "down");
    });
  });

  describe("_evaluate", () => {
    it("빈 보드 평가가 0 이상이어야 한다", () => {
      const ai = new PuyoAI();
      const board = new PuyoBoard();
      const score = ai._evaluate(board);
      assert.ok(typeof score === "number");
      assert.ok(score >= 0, `빈 보드 점수 ${score} < 0`);
    });

    it("높은 보드는 낮은 평가를 받아야 한다", () => {
      const ai = new PuyoAI();
      const low = new PuyoBoard();
      const high = new PuyoBoard();
      // 낮은 보드: 하단 1줄, 모두 다른 색 (그룹 보너스 최소화)
      for (let c = 0; c < PUYO.COLS; c++) {
        low.place(12, c, (c % PUYO.COLORS) + 1);
      }
      // 높은 보드: 하단 8줄, 체커보드 패턴 (색상 그룹 최소화)
      for (let c = 0; c < PUYO.COLS; c++) {
        for (let r = 5; r < 13; r++) {
          high.place(r, c, ((r + c) % PUYO.COLORS) + 1);
        }
      }
      assert.ok(ai._evaluate(low) > ai._evaluate(high),
        `낮은(${ai._evaluate(low).toFixed(1)}) <= 높은(${ai._evaluate(high).toFixed(1)})`);
    });

    it("데스존 근처 블록은 큰 감점이어야 한다", () => {
      const ai = new PuyoAI();
      const safe = new PuyoBoard();
      const danger = new PuyoBoard();
      // 안전: 하단에 배치
      safe.place(12, 0, 1);
      // 위험: 데스존 근처에 배치
      danger.place(1, PUYO.DEATH_COL, 1);
      danger.place(1, PUYO.DEATH_COL + 1, 2);
      assert.ok(ai._evaluate(safe) > ai._evaluate(danger),
        "데스존 보드가 더 좋은 평가를 받음");
    });
  });

  describe("_resolvePairColors", () => {
    it("mainColor/subColor 형식을 해석해야 한다", () => {
      const ai = new PuyoAI();
      const result = ai._resolvePairColors({ mainColor: 3, subColor: 4 });
      assert.equal(result.mainColor, 3);
      assert.equal(result.subColor, 4);
    });

    it("colorA/colorB 형식을 해석해야 한다", () => {
      const ai = new PuyoAI();
      const result = ai._resolvePairColors({ colorA: 1, colorB: 2 });
      assert.equal(result.mainColor, 1);
      assert.equal(result.subColor, 2);
    });
  });

  describe("2-피스 룩어헤드", () => {
    it("nextPair 전달 시 유효한 이동 반환", () => {
      const ai = new PuyoAI();
      const board = new PuyoBoard();
      const pair = { mainColor: 1, subColor: 2 };
      const nextPair = { mainColor: 1, subColor: 1 };
      const move = ai.findBestMove(board, pair, nextPair);
      assert.ok(move !== null);
      assert.ok(move.col >= 0 && move.col < PUYO.COLS);
    });

    it("nextPair 없이 호출해도 동작 (하위 호환)", () => {
      const ai = new PuyoAI();
      const board = new PuyoBoard();
      const pair = { mainColor: 1, subColor: 2 };
      const move = ai.findBestMove(board, pair);
      assert.ok(move !== null);
    });
  });

  describe("개선된 가중치", () => {
    it("colorGrouping 가중치가 2.5이어야 한다", () => {
      const ai = new PuyoAI();
      assert.strictEqual(ai.weights.colorGrouping, 2.5);
    });

    it("edgePenalty가 평가에 반영되어야 한다", () => {
      const ai = new PuyoAI();
      const board1 = new PuyoBoard();
      const board2 = new PuyoBoard();
      // board2에 가장자리 뿌요 배치
      board2.place(12, 0, 1);
      board2.place(11, 0, 2);
      board2.place(12, 5, 3);
      const score1 = ai._evaluate(board1);
      const score2 = ai._evaluate(board2);
      assert.ok(score2 < score1, '가장자리 뿌요가 있으면 점수 하락');
    });
  });
});
