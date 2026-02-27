// === 게임 통합 테스트 ===
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const ctx = require("./loader");
const { Game, Board, AI, themes, settings, C } = ctx;

describe("Game 초기화", () => {
  it("Game 클래스가 존재해야 한다", () => {
    assert.ok(typeof Game === "function");
  });

  it("Board 초기 상태 검증", () => {
    const board = new Board();
    assert.equal(board.grid.length, C.ROWS);
    assert.equal(board.grid[0].length, C.COLS);
  });

  it("AI가 유효한 이동을 찾아야 한다", () => {
    const board = new Board();
    const ai = new AI();
    const piece = { type: "T", rotation: 0, x: 3, y: 0 };
    const best = ai.findBestMove(board, piece);
    assert.ok(best, "AI가 이동을 찾지 못함");
    assert.ok(typeof best.x === "number");
    assert.ok(typeof best.rotation === "number");
  });

  it("AI buildMoveQueue가 배열 반환", () => {
    const board = new Board();
    const ai = new AI();
    const piece = { type: "T", rotation: 0, x: 3, y: 0 };
    const best = ai.findBestMove(board, piece);
    const queue = ai.buildMoveQueue(piece, best);
    assert.ok(Array.isArray(queue));
    assert.ok(queue.length > 0, "이동 큐가 비어있음");
    // 마지막은 항상 down 시퀀스
    assert.ok(queue.includes("down"), "이동 큐에 down 없음");
  });
});

describe("게임 상수", () => {
  it("보드 크기 10x20", () => {
    assert.equal(C.COLS, 10);
    assert.equal(C.ROWS, 20);
  });

  it("캔버스 크기 164x252", () => {
    assert.equal(C.CANVAS_W, 164);
    assert.equal(C.CANVAS_H, 252);
  });

  it("셀 크기 10px", () => {
    assert.equal(C.CELL, 10);
  });

  it("7개 피스 모양 정의", () => {
    const pieces = ["I", "O", "T", "S", "Z", "J", "L"];
    for (const p of pieces) {
      assert.ok(C.SHAPES[p], `${p} 피스 미정의`);
      assert.equal(C.SHAPES[p].length, 4, `${p} 회전 상태 4개 필요`);
    }
  });

  it("각 피스 4개 셀", () => {
    for (const [name, rotations] of Object.entries(C.SHAPES)) {
      for (let r = 0; r < 4; r++) {
        assert.equal(rotations[r].length, 4,
          `${name} rot${r}: 셀 ${rotations[r].length}개 (기대: 4)`);
      }
    }
  });

  it("스폰 위치 정의", () => {
    assert.ok(C.SPAWN_X);
    assert.equal(typeof C.SPAWN_X.I, "number");
    assert.equal(typeof C.SPAWN_X.O, "number");
  });

  it("점수 테이블 정의", () => {
    assert.ok(Array.isArray(C.LINE_SCORES));
    assert.ok(Array.isArray(C.TSPIN_SCORES));
    assert.equal(typeof C.COMBO_BONUS, "number");
  });

  it("SRS 킥 테이블 정의", () => {
    assert.ok(C.KICKS.normal);
    assert.ok(C.KICKS.I);
    // 8개 회전 조합
    const expected = ["0>1", "1>0", "1>2", "2>1", "2>3", "3>2", "3>0", "0>3"];
    for (const k of expected) {
      assert.ok(C.KICKS.normal[k], `킥 ${k} 미정의`);
      assert.ok(C.KICKS.I[k], `I-킥 ${k} 미정의`);
    }
  });
});

describe("자동 테마 통합", () => {
  it("autoTheme 설정 시 시간대 기반 테마 적용", () => {
    settings.set("autoTheme", true);
    const expected = settings.getTimeBasedTheme();
    themes.apply(expected);
    assert.equal(themes.active.id, expected);
    settings.set("autoTheme", false); // 복원
  });
});

describe("점수 계산 로직", () => {
  it("1줄 클리어 = 100점", () => {
    assert.equal(C.LINE_SCORES[1], 100);
  });

  it("2줄 클리어 = 300점", () => {
    assert.equal(C.LINE_SCORES[2], 300);
  });

  it("3줄 클리어 = 500점", () => {
    assert.equal(C.LINE_SCORES[3], 500);
  });

  it("4줄(테트리스) 클리어 = 800점", () => {
    assert.equal(C.LINE_SCORES[4], 800);
  });

  it("T-스핀 1줄 = 800점", () => {
    assert.equal(C.TSPIN_SCORES[1], 800);
  });

  it("콤보 보너스 = 50점", () => {
    assert.equal(C.COMBO_BONUS, 50);
  });
});
