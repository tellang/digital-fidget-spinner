// === 게임 통합 테스트 ===
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const ctx = require("./loader");
const { Game, Board, AI, PuyoBoard, PuyoAI, PUYO, themes, settings, C } = ctx;

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

// === 뿌요 모드 통합 테스트 ===

describe("뿌요 모드 클래스", () => {
  it("PuyoBoard 클래스가 존재해야 한다", () => {
    assert.ok(typeof PuyoBoard === "function");
  });

  it("PuyoAI 클래스가 존재해야 한다", () => {
    assert.ok(typeof PuyoAI === "function");
  });

  it("PUYO 상수가 존재해야 한다", () => {
    assert.ok(PUYO);
    assert.equal(PUYO.COLS, 6);
    assert.equal(PUYO.ROWS, 12);
    assert.equal(PUYO.HIDDEN_ROWS, 1);
    assert.equal(PUYO.COLORS, 4);
  });
});

describe("뿌요 모드 초기화", () => {
  it("PuyoBoard 보드 크기 6x13 (12+1 숨김행)", () => {
    const board = new PuyoBoard();
    assert.equal(board.cols, PUYO.COLS);
    assert.equal(board.rows, PUYO.ROWS + PUYO.HIDDEN_ROWS);
    assert.equal(board.grid.length, 13);
    assert.equal(board.grid[0].length, 6);
  });

  it("PuyoBoard 빈 보드는 모두 0이어야 한다", () => {
    const board = new PuyoBoard();
    for (let r = 0; r < board.rows; r++) {
      for (let c = 0; c < board.cols; c++) {
        assert.equal(board.grid[r][c], 0);
      }
    }
  });

  it("PuyoAI 가중치가 올바르게 초기화되어야 한다", () => {
    const ai = new PuyoAI();
    assert.equal(ai.weights.chainPotential, 4.0);
    assert.equal(ai.weights.height, -0.8);
    assert.equal(ai.weights.flatness, 0.3);
    assert.equal(ai.weights.colorGrouping, 2.5);
    assert.equal(ai.weights.edgePenalty, -0.5);
  });
});

describe("뿌요 상수", () => {
  it("PAIR_OFFSETS 4방향 정의", () => {
    assert.equal(PUYO.PAIR_OFFSETS.length, 4);
    assert.deepEqual(PUYO.PAIR_OFFSETS[0], [-1, 0]); // 위
    assert.deepEqual(PUYO.PAIR_OFFSETS[1], [0, 1]);  // 오른쪽
    assert.deepEqual(PUYO.PAIR_OFFSETS[2], [1, 0]);  // 아래
    assert.deepEqual(PUYO.PAIR_OFFSETS[3], [0, -1]); // 왼쪽
  });

  it("상태머신 상수 정의", () => {
    assert.ok(PUYO.STATE.SPAWNING);
    assert.ok(PUYO.STATE.DROPPING);
    assert.ok(PUYO.STATE.SETTLING);
    assert.ok(PUYO.STATE.MATCHING);
    assert.ok(PUYO.STATE.CHAINING);
    assert.ok(PUYO.STATE.GAME_OVER);
  });

  it("CHAIN_POWER 배열 정의", () => {
    assert.ok(Array.isArray(PUYO.CHAIN_POWER));
    assert.ok(PUYO.CHAIN_POWER.length >= 10);
    assert.equal(PUYO.CHAIN_POWER[0], 0); // 1체인: 보너스 0
    assert.equal(PUYO.CHAIN_POWER[2], 8); // 3체인: 보너스 8
  });

  it("타이밍 상수 정의", () => {
    assert.equal(PUYO.SETTLE_TIME, 200);
    assert.equal(PUYO.POP_TIME, 300);
    assert.equal(typeof PUYO.BASE_DROP_DELAY, "number");
    assert.equal(typeof PUYO.BASE_MOVE_DELAY, "number");
  });
});

describe("뿌요 모드 게임 로직", () => {
  it("settings에 gameMode 필드가 존재해야 한다", () => {
    const mode = settings.get("gameMode");
    assert.ok(mode === "tetris" || mode === "puyo",
      `gameMode가 '${mode}' (tetris 또는 puyo 기대)`);
  });

  it("Game 클래스에 gameMode 속성이 있어야 한다", () => {
    assert.ok(typeof Game === "function");
    // Game은 DOM에 의존하므로 인스턴스 생성 대신 프로토타입 확인
    assert.ok(typeof Game.prototype._updatePuyo === "function",
      "_updatePuyo 메서드 미정의");
    assert.ok(typeof Game.prototype._spawnPuyoPair === "function",
      "_spawnPuyoPair 메서드 미정의");
    assert.ok(typeof Game.prototype._tryPuyoMove === "function",
      "_tryPuyoMove 메서드 미정의");
    assert.ok(typeof Game.prototype._tryPuyoRotate === "function",
      "_tryPuyoRotate 메서드 미정의");
  });

  it("Game._restart 메서드가 존재해야 한다", () => {
    assert.ok(typeof Game.prototype._restart === "function");
  });
});

describe("뿌요 점수 계산", () => {
  it("단순 4개 매칭 점수: 10 * 4 * 1 = 40", () => {
    const board = new PuyoBoard();
    const groups = [{ color: 1, cells: [[12, 0], [12, 1], [12, 2], [12, 3]] }];
    const score = board.calcChainScore(1, groups);
    assert.equal(score, 40, `점수 ${score} (기대: 40)`);
  });

  it("2체인 점수가 1체인보다 높아야 한다", () => {
    const board = new PuyoBoard();
    const groups = [{ color: 1, cells: [[12, 0], [12, 1], [12, 2], [12, 3]] }];
    const s1 = board.calcChainScore(1, groups);
    const s2 = board.calcChainScore(2, groups);
    assert.ok(s2 > s1, `2체인(${s2}) <= 1체인(${s1})`);
  });

  it("다색 보너스: 2색 > 1색", () => {
    const board = new PuyoBoard();
    const oneColor = [{ color: 1, cells: [[12, 0], [12, 1], [12, 2], [12, 3]] }];
    const twoColor = [
      { color: 1, cells: [[12, 0], [12, 1], [12, 2], [12, 3]] },
      { color: 2, cells: [[11, 0], [11, 1], [11, 2], [11, 3]] },
    ];
    const s1 = board.calcChainScore(1, oneColor);
    const s2 = board.calcChainScore(1, twoColor);
    assert.ok(s2 > s1, `2색(${s2}) <= 1색(${s1})`);
  });
});
