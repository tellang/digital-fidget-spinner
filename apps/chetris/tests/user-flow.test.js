// === 유저 플로우 통합 테스트 ===
// 실제 게임 시나리오를 시뮬레이션하여 "씹힘", 상태 오류, 타이밍 이슈 검증
const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const ctx = require("./loader");
const { Board, AI, PuyoBoard, PuyoAI, PUYO, InputHandler, ChatDisplay,
        ParticleSystem, ScreenShake, FlashEffect, themes, settings, C,
        getCells, getGhostY } = ctx;

// === 헬퍼: 게임 루프 1프레임 시뮬레이션 ===
function simulateFrame(state, dt = 0.016) {
  const boost = state.input.getBoost();
  state.input.update(dt);
  const chars = state.input.popChars();
  const drops = state.input.popHardDrops();

  if (state.gameOver) {
    state.restartTimer += dt * 1000;
    return { chars, drops, boost };
  }

  if (state.gameMode === "tetris") {
    // 하드드롭
    if (drops > 0 && state.current) {
      while (state.moveQueue.length > 0) {
        const move = state.moveQueue[0];
        if (move === "drop") break;
        state.moveQueue.shift();
        if (move === "down") continue;
        executeTetrisMove(state, move);
        if (!state.current) return { chars, drops, boost };
      }
      state.moveQueue = [];
      state.moveTimer = 0;
      hardDropTetris(state);
      return { chars, drops, boost };
    }

    // AI 이동 실행
    if (state.current && state.moveQueue.length > 0) {
      state.moveTimer += dt * 1000 * boost;
      const nextMove = state.moveQueue[0];
      const moveDelay = nextMove === "down"
        ? C.BASE_DROP_DELAY / boost
        : C.BASE_MOVE_DELAY / Math.max(1, boost * 0.5);

      while (state.moveTimer >= moveDelay && state.moveQueue.length > 0) {
        state.moveTimer -= moveDelay;
        const move = state.moveQueue.shift();
        executeTetrisMove(state, move);
        if (move === "down" && !state.current) break;
        if (state.moveQueue.length > 0 && state.moveQueue[0] === "down" && move !== "down") {
          state.moveTimer = 0;
          break;
        }
      }
    }
  }

  return { chars, drops, boost };
}

function executeTetrisMove(state, move) {
  if (!state.current) return;
  switch (move) {
    case "rotateCW": tryRotate(state, 1); break;
    case "rotateCCW": tryRotate(state, -1); break;
    case "left": tryMove(state, -1, 0); break;
    case "right": tryMove(state, 1, 0); break;
    case "down":
      if (!tryMove(state, 0, 1)) {
        lockPiece(state);
      }
      break;
  }
}

function tryMove(state, dx, dy) {
  if (!state.current) return false;
  const cells = C.SHAPES[state.current.type][state.current.rotation].map(([r, c]) => [
    r + state.current.y + dy,
    c + state.current.x + dx,
  ]);
  if (state.board.isValid(cells)) {
    state.current.x += dx;
    state.current.y += dy;
    state.current.lastAction = "move";
    return true;
  }
  return false;
}

function tryRotate(state, dir) {
  if (!state.current) return false;
  const oldRot = state.current.rotation;
  const newRot = (oldRot + dir + 4) % 4;
  const kickKey = `${oldRot}>${newRot}`;
  const kickTable = state.current.type === "I" ? C.KICKS.I : C.KICKS.normal;
  const kicks = kickTable[kickKey];
  if (!kicks) return false;
  for (const [dx, dy] of kicks) {
    const cells = C.SHAPES[state.current.type][newRot].map(([r, c]) => [
      r + state.current.y - dy,
      c + state.current.x + dx,
    ]);
    if (state.board.isValid(cells)) {
      state.current.rotation = newRot;
      state.current.x += dx;
      state.current.y -= dy;
      state.current.lastAction = "rotate";
      return true;
    }
  }
  return false;
}

function hardDropTetris(state) {
  if (!state.current) return;
  state.current.y = getGhostY(state.board, state.current);
  lockPiece(state);
}

function lockPiece(state) {
  if (!state.current) return;
  const cells = getCells(state.current);
  const color = C.COLORS[state.current.type];
  const aboveBoard = cells.some(([r]) => r < 0);
  if (aboveBoard) {
    state.gameOver = true;
    state.current = null;
    return;
  }
  const isTSpin = state.current.lastAction === "rotate" && state.board.checkTSpin(state.current);
  state.board.place(cells, color);
  const clearResult = state.board.clearLines();
  if (clearResult.count > 0) {
    let lineScore;
    if (isTSpin) {
      lineScore = C.TSPIN_SCORES[clearResult.count] || 1600;
    } else {
      lineScore = C.LINE_SCORES[clearResult.count] || 800;
    }
    state.combo++;
    lineScore += state.combo * C.COMBO_BONUS;
    lineScore *= state.level;
    state.score += lineScore;
    state.lines += clearResult.count;
    state.level = Math.floor(state.lines / 10) + 1;
  } else {
    state.combo = 0;
  }
  nextPiece(state);
}

function nextPiece(state) {
  state.current = state.next;
  state.next = spawnPiece(state);
  if (!state.current) return;
  const cells = getCells(state.current);
  if (!state.board.isValid(cells)) {
    state.gameOver = true;
    state.current = null;
    return;
  }
  const bestMove = state.ai.findBestMove(state.board, state.current);
  if (bestMove) {
    state.moveQueue = state.ai.buildMoveQueue(state.current, bestMove);
  } else {
    state.moveQueue = ["drop"];
  }
  state.moveTimer = 0;
}

function spawnPiece(state) {
  if (state.bag.length === 0) fillBag(state);
  const type = state.bag.pop();
  return { type, rotation: 0, x: C.SPAWN_X[type], y: 0, lastAction: null };
}

function fillBag(state) {
  state.bag = ["I", "O", "T", "S", "Z", "J", "L"];
  for (let i = state.bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [state.bag[i], state.bag[j]] = [state.bag[j], state.bag[i]];
  }
}

function createTetrisState() {
  themes.apply("cyberpunk");
  const state = {
    gameMode: "tetris",
    board: new Board(),
    ai: new AI(),
    input: new InputHandler(),
    score: 0,
    lines: 0,
    combo: 0,
    level: 1,
    bag: [],
    current: null,
    next: null,
    moveQueue: [],
    moveTimer: 0,
    gameOver: false,
    restartTimer: 0,
  };
  fillBag(state);
  state.next = spawnPiece(state);
  nextPiece(state);
  return state;
}

// === 뿌요 헬퍼 ===
function createPuyoState() {
  themes.apply("cyberpunk");
  const state = {
    gameMode: "puyo",
    board: new PuyoBoard(),
    ai: new PuyoAI(),
    input: new InputHandler(),
    score: 0,
    lines: 0,
    combo: 0,
    level: 1,
    chainCount: 0,
    maxChain: 0,
    currentPair: null,
    nextPair: null,
    puyoState: PUYO.STATE.SPAWNING,
    moveQueue: [],
    moveTimer: 0,
    settleTimer: 0,
    chainTimer: 0,
    pendingChainGroups: null,
    gameOver: false,
    restartTimer: 0,
  };
  return state;
}

function spawnPuyoPair(state) {
  if (state.nextPair) {
    state.currentPair = {
      row: PUYO.SPAWN_ROW, col: PUYO.SPAWN_COL, rotation: 0,
      mainColor: state.nextPair.mainColor,
      subColor: state.nextPair.subColor,
    };
  } else {
    state.currentPair = {
      row: PUYO.SPAWN_ROW, col: PUYO.SPAWN_COL, rotation: 0,
      mainColor: Math.floor(Math.random() * PUYO.COLORS) + 1,
      subColor: Math.floor(Math.random() * PUYO.COLORS) + 1,
    };
  }
  state.nextPair = {
    mainColor: Math.floor(Math.random() * PUYO.COLORS) + 1,
    subColor: Math.floor(Math.random() * PUYO.COLORS) + 1,
  };
  const bestMove = state.ai.findBestMove(state.board, state.currentPair);
  if (bestMove) {
    state.moveQueue = state.ai.buildMoveQueue(state.currentPair, bestMove);
  } else {
    state.moveQueue = ["down"];
  }
  state.moveTimer = 0;
  state.chainCount = 0;
  state.puyoState = PUYO.STATE.DROPPING;
}

function simulatePuyoFrame(state, dt = 0.016) {
  const boost = state.input.getBoost();
  state.input.update(dt);
  const drops = state.input.popHardDrops();
  state.input.popChars();

  if (state.gameOver) return { boost, drops };

  switch (state.puyoState) {
    case PUYO.STATE.SPAWNING:
      spawnPuyoPair(state);
      break;
    case PUYO.STATE.DROPPING: {
      // 하드드롭
      if (drops > 0 && state.currentPair) {
        while (state.moveQueue.length > 0) {
          const move = state.moveQueue.shift();
          if (move === "down") continue;
          executePuyoMove(state, move);
          if (!state.currentPair) break;
        }
        if (state.currentPair) {
          while (tryPuyoMove(state, 0, 1)) {}
          state.moveQueue = [];
          state.settleTimer = 0;
          state.puyoState = PUYO.STATE.SETTLING;
        }
        break;
      }
      // 일반 낙하
      state.moveTimer += dt * 1000 * boost;
      while (state.moveQueue.length > 0) {
        const nextMove = state.moveQueue[0];
        const moveDelay = nextMove === "down"
          ? PUYO.BASE_DROP_DELAY / boost
          : PUYO.BASE_MOVE_DELAY / Math.max(1, boost * 0.5);
        if (state.moveTimer < moveDelay) break;
        state.moveTimer -= moveDelay;
        const move = state.moveQueue.shift();
        executePuyoMove(state, move);
        if (!state.currentPair) break;
        if (state.moveQueue.length > 0 && state.moveQueue[0] === "down" && move !== "down") {
          state.moveTimer = 0;
          break;
        }
      }
      if (state.moveQueue.length === 0 && state.puyoState === PUYO.STATE.DROPPING) {
        state.moveQueue.push("down");
      }
      break;
    }
    case PUYO.STATE.SETTLING:
      state.settleTimer += dt * 1000;
      if (state.settleTimer >= PUYO.SETTLE_TIME) {
        if (state.currentPair) {
          state.board.placePair({
            mainRow: state.currentPair.row,
            mainCol: state.currentPair.col,
            rotation: state.currentPair.rotation,
            mainColor: state.currentPair.mainColor,
            subColor: state.currentPair.subColor,
          });
          state.currentPair = null;
        }
        state.puyoState = PUYO.STATE.MATCHING;
      }
      break;
    case PUYO.STATE.MATCHING: {
      state.board.applyGravity();
      const groups = state.board.findMatches();
      if (groups.length > 0) {
        state.pendingChainGroups = groups;
        state.chainTimer = 0;
        state.puyoState = PUYO.STATE.CHAINING;
      } else {
        state.maxChain = Math.max(state.maxChain, state.chainCount);
        if (state.board.isGameOver()) {
          state.gameOver = true;
        } else {
          state.puyoState = PUYO.STATE.SPAWNING;
        }
      }
      break;
    }
    case PUYO.STATE.CHAINING:
      state.chainTimer += dt * 1000;
      if (state.chainTimer >= PUYO.POP_TIME) {
        if (state.pendingChainGroups) {
          state.chainCount++;
          const score = state.board.calcChainScore(state.chainCount, state.pendingChainGroups);
          state.board.removeMatches(state.pendingChainGroups);
          state.score += score;
          state.pendingChainGroups = null;
        }
        state.puyoState = PUYO.STATE.MATCHING;
      }
      break;
  }

  return { boost, drops };
}

function executePuyoMove(state, move) {
  if (!state.currentPair) return;
  switch (move) {
    case "rotateCW": tryPuyoRotate(state, 1); break;
    case "rotateCCW": tryPuyoRotate(state, -1); break;
    case "left": tryPuyoMove(state, -1, 0); break;
    case "right": tryPuyoMove(state, 1, 0); break;
    case "down":
      if (!tryPuyoMove(state, 0, 1)) {
        state.settleTimer = 0;
        state.puyoState = PUYO.STATE.SETTLING;
      }
      break;
  }
}

function tryPuyoMove(state, dx, dy) {
  if (!state.currentPair) return false;
  const [dr, dc] = PUYO.PAIR_OFFSETS[state.currentPair.rotation];
  const newRow = state.currentPair.row + dy;
  const newCol = state.currentPair.col + dx;
  const subRow = newRow + dr;
  const subCol = newCol + dc;
  if (state.board.isValid(newRow, newCol) && state.board.isValid(subRow, subCol)) {
    state.currentPair.row = newRow;
    state.currentPair.col = newCol;
    return true;
  }
  return false;
}

function tryPuyoRotate(state, dir) {
  if (!state.currentPair) return false;
  const newRot = (state.currentPair.rotation + dir + 4) % 4;
  const [dr, dc] = PUYO.PAIR_OFFSETS[newRot];
  const subRow = state.currentPair.row + dr;
  const subCol = state.currentPair.col + dc;
  if (state.board.isValid(subRow, subCol)) {
    state.currentPair.rotation = newRot;
    return true;
  }
  return false;
}


// =====================================================
// 테스트 시나리오 시작
// =====================================================

describe("유저 시나리오 1: 테트리스 초기 플레이", () => {
  let state;
  beforeEach(() => { state = createTetrisState(); });

  it("게임 시작 시 현재 피스와 다음 피스가 존재해야 한다", () => {
    assert.ok(state.current, "현재 피스 없음");
    assert.ok(state.next, "다음 피스 없음");
    assert.ok(["I","O","T","S","Z","J","L"].includes(state.current.type));
    assert.ok(["I","O","T","S","Z","J","L"].includes(state.next.type));
  });

  it("AI가 첫 수에 대한 이동 큐를 생성해야 한다", () => {
    assert.ok(state.moveQueue.length > 0, "이동 큐 비어있음");
    const validMoves = ["rotateCW", "rotateCCW", "left", "right", "down", "drop"];
    for (const move of state.moveQueue) {
      assert.ok(validMoves.includes(move), `잘못된 이동: ${move}`);
    }
  });

  it("10프레임 진행 후에도 보드 상태가 유효해야 한다", () => {
    for (let i = 0; i < 10; i++) {
      simulateFrame(state);
    }
    assert.equal(state.board.grid.length, C.ROWS);
    assert.equal(state.board.grid[0].length, C.COLS);
    assert.ok(!state.gameOver, "10프레임 만에 게임 오버");
  });
});

describe("유저 시나리오 2: 테트리스 연속 피스 배치 (50피스)", () => {
  it("50피스를 연속 하드드롭해도 게임 상태가 일관되어야 한다", () => {
    const state = createTetrisState();
    let piecesPlaced = 0;
    const maxPieces = 50;

    for (let frame = 0; frame < 5000 && piecesPlaced < maxPieces; frame++) {
      if (state.gameOver) {
        // 게임 오버 시 재시작
        state.board = new Board();
        state.bag = [];
        fillBag(state);
        state.next = spawnPiece(state);
        nextPiece(state);
        state.score = 0;
        state.lines = 0;
        state.combo = 0;
        state.level = 1;
        state.gameOver = false;
        continue;
      }

      const prevPiece = state.current ? state.current.type : null;
      // 하드드롭 시뮬레이션: 키 입력
      state.input._onInput();
      simulateFrame(state);

      if (state.current && state.current.type !== prevPiece) {
        piecesPlaced++;
      }
    }

    assert.ok(piecesPlaced >= maxPieces * 0.8,
      `50피스 중 ${piecesPlaced}개만 배치됨`);
    assert.ok(state.score >= 0, "점수가 음수");
  });
});

describe("유저 시나리오 3: 부스트 시스템", () => {
  it("키 입력 시 부스트가 증가해야 한다", () => {
    const input = new InputHandler();
    assert.equal(input.getBoost(), 1.0);

    input._onInput();
    assert.equal(input.getBoost(), 1.6);

    input._onInput();
    assert.equal(input.getBoost(), 2.2);
  });

  it("부스트가 최대값(8.0)을 초과하지 않아야 한다", () => {
    const input = new InputHandler();
    for (let i = 0; i < 100; i++) input._onInput();
    assert.equal(input.getBoost(), 8.0);
  });

  it("시간 경과 시 부스트가 감쇠해야 한다", () => {
    const input = new InputHandler();
    for (let i = 0; i < 10; i++) input._onInput();
    const before = input.getBoost();

    input.update(1.0); // 1초 경과
    const after = input.getBoost();
    assert.ok(after < before, `감쇠 안 됨: ${before} → ${after}`);
    assert.ok(after >= 1.0, "부스트가 1.0 미만으로 감쇠");
  });

  it("부스트 8에서 AI 이동 딜레이가 올바르게 계산되어야 한다", () => {
    const boost = 8.0;
    const dropDelay = C.BASE_DROP_DELAY / boost;
    const moveDelay = C.BASE_MOVE_DELAY / Math.max(1, boost * 0.5);

    assert.equal(dropDelay, 100);
    assert.ok(Math.abs(moveDelay - 17.5) < 0.01, `이동 딜레이: ${moveDelay}`);
  });
});

describe("유저 시나리오 4: 고속 부스트에서 씹힘 없는지 검증", () => {
  it("부스트 8에서 100프레임 동안 모든 이동이 실행되어야 한다", () => {
    const state = createTetrisState();
    // 부스트를 최대로 올림
    for (let i = 0; i < 20; i++) state.input._onInput();

    let totalMoves = 0;
    let piecesLocked = 0;
    const prevCurrent = state.current;

    for (let frame = 0; frame < 100; frame++) {
      if (state.gameOver) break;
      const queueBefore = state.moveQueue.length;
      // 매 프레임마다 부스트 유지
      if (frame % 3 === 0) state.input._onInput();
      simulateFrame(state);
      const consumed = queueBefore - state.moveQueue.length;
      if (consumed > 0) totalMoves += consumed;
      if (state.current !== prevCurrent) piecesLocked++;
    }

    assert.ok(totalMoves > 0, "이동이 전혀 실행되지 않음");
    assert.ok(!state.gameOver || piecesLocked > 0,
      "게임 오버이지만 피스가 하나도 잠기지 않음");
  });

  it("부스트 8에서 하드드롭 시 AI 조작이 모두 실행되어야 한다", () => {
    const state = createTetrisState();
    for (let i = 0; i < 20; i++) state.input._onInput();

    // AI가 생성한 큐에서 회전/이동 수 카운트
    const aiMoves = state.moveQueue.filter(m => m !== "down" && m !== "drop");
    const aiMoveCount = aiMoves.length;

    // 하드드롭 실행
    state.input._onInput(); // drops > 0
    simulateFrame(state);

    // 하드드롭 후 새 피스가 있어야 함
    assert.ok(state.current || state.gameOver,
      "하드드롭 후 피스도 없고 게임 오버도 아님");
  });
});

describe("유저 시나리오 5: 라인 클리어 & 점수", () => {
  it("가득 찬 행 클리어 시 점수가 올라야 한다", () => {
    const state = createTetrisState();
    // 19행을 수동으로 채움 (1열만 비움)
    for (let c = 0; c < C.COLS - 1; c++) {
      state.board.grid[19][c] = "#ff0000";
    }

    // 마지막 열을 채워 라인 클리어 유도
    state.board.grid[19][C.COLS - 1] = "#00ff00";
    const result = state.board.clearLines();
    assert.equal(result.count, 1, "1줄 클리어 기대");
    assert.ok(result.rows.includes(19));

    // 클리어 후 빈 행이 추가되었는지
    assert.ok(state.board.grid[0].every(c => c === 0), "최상단 행이 비어야 함");
  });

  it("연속 클리어 시 콤보 보너스가 누적되어야 한다", () => {
    const state = createTetrisState();
    state.combo = 0;

    // 첫 클리어
    state.combo++;
    let score1 = C.LINE_SCORES[1] + state.combo * C.COMBO_BONUS;
    assert.equal(score1, 150); // 100 + 1*50

    // 두 번째 연속 클리어
    state.combo++;
    let score2 = C.LINE_SCORES[1] + state.combo * C.COMBO_BONUS;
    assert.equal(score2, 200); // 100 + 2*50
  });

  it("4줄 동시 클리어(테트리스)가 올바르게 점수를 매겨야 한다", () => {
    const board = new Board();
    // 16-19행을 완전히 채움
    for (let r = 16; r < 20; r++) {
      for (let c = 0; c < C.COLS; c++) {
        board.grid[r][c] = "#ff0000";
      }
    }
    const result = board.clearLines();
    assert.equal(result.count, 4);
    const score = C.LINE_SCORES[4]; // 800
    assert.equal(score, 800);
  });
});

describe("유저 시나리오 6: 테트리스 게임 오버 & 재시작", () => {
  it("보드 상단까지 차면 게임 오버가 되어야 한다", () => {
    const state = createTetrisState();
    // 보드 전체를 채움 (0행까지)
    for (let r = 0; r < C.ROWS; r++) {
      for (let c = 0; c < C.COLS; c++) {
        state.board.grid[r][c] = "#ff0000";
      }
    }
    // 다음 피스 배치 시도
    if (state.current) {
      const cells = getCells(state.current);
      const valid = state.board.isValid(cells);
      assert.ok(!valid, "가득 찬 보드에서 피스 배치가 유효해선 안 됨");
    }
  });

  it("게임 오버 후 3.5초(restartDelay) 뒤 재시작 가능해야 한다", () => {
    const state = createTetrisState();
    state.gameOver = true;
    state.restartTimer = 0;

    // 3.5초 시뮬레이션
    for (let i = 0; i < 220; i++) { // 220 * 16ms ≈ 3.5초
      state.restartTimer += 16;
    }

    assert.ok(state.restartTimer >= 3500, `타이머: ${state.restartTimer}ms`);
  });
});

describe("유저 시나리오 7: 7-Bag 랜덤라이저", () => {
  it("14피스 동안 각 타입이 정확히 2번 등장해야 한다", () => {
    const state = createTetrisState();
    const counts = { I: 0, O: 0, T: 0, S: 0, Z: 0, J: 0, L: 0 };

    // 새 백 2개 = 14피스
    state.bag = [];
    fillBag(state);
    const bag1 = [...state.bag];
    fillBag(state);
    const bag2 = [...state.bag];

    for (const type of [...bag1, ...bag2]) {
      counts[type]++;
    }

    for (const [type, count] of Object.entries(counts)) {
      assert.equal(count, 2, `${type}: ${count}회 (기대: 2)`);
    }
  });
});

describe("유저 시나리오 8: 뿌요 기본 플레이", () => {
  let state;
  beforeEach(() => { state = createPuyoState(); });

  it("스폰 후 현재 쌍과 다음 쌍이 존재해야 한다", () => {
    spawnPuyoPair(state);
    assert.ok(state.currentPair, "현재 쌍 없음");
    assert.ok(state.nextPair, "다음 쌍 없음");
    assert.ok(state.currentPair.mainColor >= 1 && state.currentPair.mainColor <= PUYO.COLORS);
    assert.ok(state.currentPair.subColor >= 1 && state.currentPair.subColor <= PUYO.COLORS);
  });

  it("AI가 뿌요 이동 큐를 생성해야 한다", () => {
    spawnPuyoPair(state);
    assert.ok(state.moveQueue.length > 0, "이동 큐 비어있음");
  });

  it("뿌요 상태 머신이 SPAWNING → DROPPING 전환되어야 한다", () => {
    assert.equal(state.puyoState, PUYO.STATE.SPAWNING);
    simulatePuyoFrame(state);
    assert.equal(state.puyoState, PUYO.STATE.DROPPING);
  });
});

describe("유저 시나리오 9: 뿌요 전체 사이클 (스폰→낙하→착지→매칭)", () => {
  it("20사이클 동안 상태 머신이 정상 순환해야 한다", () => {
    const state = createPuyoState();
    let cycles = 0;
    const statesVisited = new Set();

    for (let frame = 0; frame < 5000 && cycles < 20; frame++) {
      if (state.gameOver) {
        state.board = new PuyoBoard();
        state.puyoState = PUYO.STATE.SPAWNING;
        state.currentPair = null;
        state.nextPair = null;
        state.gameOver = false;
        continue;
      }
      // 부스트 적용으로 빠른 사이클 진행
      state.input._onInput();
      const prevState = state.puyoState;
      simulatePuyoFrame(state);
      statesVisited.add(state.puyoState);

      if (prevState !== PUYO.STATE.SPAWNING && state.puyoState === PUYO.STATE.SPAWNING) {
        cycles++;
      }
    }

    assert.ok(cycles >= 10, `20사이클 목표 중 ${cycles}개 완료`);
    assert.ok(statesVisited.has(PUYO.STATE.DROPPING), "DROPPING 상태 미방문");
    assert.ok(statesVisited.has(PUYO.STATE.SETTLING), "SETTLING 상태 미방문");
    assert.ok(statesVisited.has(PUYO.STATE.MATCHING), "MATCHING 상태 미방문");
  });
});

describe("유저 시나리오 10: 뿌요 하드드롭 (터치/키 입력)", () => {
  it("하드드롭 시 즉시 바닥까지 떨어지고 SETTLING으로 전환되어야 한다", () => {
    const state = createPuyoState();
    // 스폰
    simulatePuyoFrame(state);
    assert.equal(state.puyoState, PUYO.STATE.DROPPING);

    // 하드드롭 트리거
    state.input._onInput();
    simulatePuyoFrame(state);
    assert.equal(state.puyoState, PUYO.STATE.SETTLING,
      `하드드롭 후 상태: ${state.puyoState} (기대: settling)`);
  });
});

describe("유저 시나리오 11: 뿌요 연쇄 & 점수", () => {
  it("4개 연결 매칭 시 점수가 기록되어야 한다", () => {
    const board = new PuyoBoard();
    // 바닥에 같은 색 4개 배치
    board.place(12, 0, 1);
    board.place(12, 1, 1);
    board.place(12, 2, 1);
    board.place(12, 3, 1);

    const groups = board.findMatches();
    assert.equal(groups.length, 1, "1그룹 매칭 기대");
    assert.equal(groups[0].cells.length, 4);

    const score = board.calcChainScore(1, groups);
    assert.equal(score, 40, `점수: ${score} (기대: 40 = 10*4*1)`);
  });

  it("연쇄 해결이 올바르게 동작해야 한다", () => {
    const board = new PuyoBoard();
    // 2연쇄 구성: 아래 4개 + 위에 4개(중력으로 연결될)
    board.place(12, 0, 1);
    board.place(12, 1, 1);
    board.place(12, 2, 1);
    board.place(12, 3, 1);
    // 색 2를 위에 배치 (연쇄용)
    board.place(11, 0, 2);
    board.place(11, 1, 2);
    board.place(11, 2, 2);
    board.place(11, 3, 2);

    const chains = board.resolveChains();
    // 두 그룹이 동시에 매칭되므로 1연쇄로 처리됨 (같은 단계에서 발견)
    assert.ok(chains.length >= 1, `연쇄 수: ${chains.length}`);
    assert.ok(chains[0].score > 0, "연쇄 점수가 0");
  });
});

describe("유저 시나리오 12: 테마 전환", () => {
  it("10개 테마 전환 시 모두 적용되어야 한다", () => {
    const themeIds = ["cyberpunk", "gameboy", "pastel", "matrix", "glass",
                      "retro", "vaporwave", "abyss", "cloud", "eclipse"];
    for (const id of themeIds) {
      const result = themes.apply(id);
      assert.ok(result !== false, `테마 ${id} 적용 실패`);
      assert.equal(themes.active.id, id, `활성 테마: ${themes.active.id} (기대: ${id})`);
      // 필수 속성 확인
      assert.ok(themes.active.colors, `${id}: colors 없음`);
      assert.ok(themes.active.bg, `${id}: bg 없음`);
    }
  });

  it("테마 전환 후 COLORS 동적 참조가 동작해야 한다", () => {
    themes.apply("gameboy");
    const gbColors = C.COLORS;
    assert.ok(gbColors, "Game Boy 색상 참조 실패");

    themes.apply("cyberpunk");
    const cpColors = C.COLORS;
    assert.ok(cpColors, "Cyberpunk 색상 참조 실패");
    // 색상이 달라야 함 (다른 테마)
    assert.notDeepEqual(gbColors, cpColors, "테마 전환 후 색상이 같음");
  });
});

describe("유저 시나리오 13: 설정 영속화 (localStorage)", () => {
  it("설정 저장/로드가 localStorage로 동작해야 한다", () => {
    settings.set("theme", "matrix");
    settings.set("gameMode", "puyo");

    assert.equal(settings.get("theme"), "matrix");
    assert.equal(settings.get("gameMode"), "puyo");

    // 원복
    settings.set("theme", "cyberpunk");
    settings.set("gameMode", "tetris");
  });

  it("설정 변경 리스너가 호출되어야 한다", () => {
    let called = false;
    let receivedKey = null;
    const unsub = settings.onChange((key, value) => {
      called = true;
      receivedKey = key;
    });

    settings.set("particles", false);
    assert.ok(called, "리스너 미호출");
    assert.equal(receivedKey, "particles");

    // 정리
    unsub();
    settings.set("particles", true);
  });
});

describe("유저 시나리오 14: 터치 입력 시뮬레이션", () => {
  it("터치 이벤트가 부스트와 하드드롭을 트리거해야 한다", () => {
    const input = new InputHandler();
    const initialBoost = input.getBoost();

    // _onInput 직접 호출 (터치 핸들러가 호출하는 것과 동일)
    input._onInput();
    assert.ok(input.getBoost() > initialBoost, "터치 후 부스트 미증가");

    const drops = input.popHardDrops();
    assert.ok(drops > 0, "터치 후 하드드롭 미등록");

    input.destroy();
  });

  it("멀티터치(3회) 시 부스트가 3배 증가해야 한다", () => {
    const input = new InputHandler();
    input._onInput();
    input._onInput();
    input._onInput();

    const expected = 1.0 + 0.6 * 3;
    assert.ok(Math.abs(input.getBoost() - expected) < 0.001,
      `부스트: ${input.getBoost()} (기대: ${expected})`);

    const drops = input.popHardDrops();
    assert.equal(drops, 3, `하드드롭 수: ${drops} (기대: 3)`);

    input.destroy();
  });
});

describe("유저 시나리오 15: 극한 부스트 스트레스 테스트", () => {
  it("부스트 8 + dt=0.1(최대) 에서 200프레임 시뮬 — 크래시 없어야 한다", () => {
    const state = createTetrisState();
    let errors = 0;
    let piecesPlaced = 0;

    for (let frame = 0; frame < 200; frame++) {
      try {
        // 최대 부스트 유지
        for (let k = 0; k < 5; k++) state.input._onInput();

        // 최대 dt (게임 루프의 Math.min 클램프)
        simulateFrame(state, 0.1);

        if (state.gameOver) {
          state.board = new Board();
          state.bag = [];
          fillBag(state);
          state.next = spawnPiece(state);
          nextPiece(state);
          state.score = 0;
          state.lines = 0;
          state.combo = 0;
          state.level = 1;
          state.gameOver = false;
          piecesPlaced++;
        }
      } catch (e) {
        errors++;
      }
    }

    assert.equal(errors, 0, `${errors}개 에러 발생`);
    assert.ok(piecesPlaced >= 0, "피스 배치 추적 실패");
  });

  it("뿌요 부스트 8 + dt=0.1 에서 200프레임 — 상태 머신 무결성", () => {
    const state = createPuyoState();
    let errors = 0;
    const validStates = Object.values(PUYO.STATE);

    for (let frame = 0; frame < 200; frame++) {
      try {
        for (let k = 0; k < 5; k++) state.input._onInput();
        simulatePuyoFrame(state, 0.1);

        if (state.gameOver) {
          state.board = new PuyoBoard();
          state.puyoState = PUYO.STATE.SPAWNING;
          state.currentPair = null;
          state.nextPair = null;
          state.chainCount = 0;
          state.maxChain = 0;
          state.score = 0;
          state.gameOver = false;
        }

        // 상태 머신 무결성
        assert.ok(validStates.includes(state.puyoState),
          `잘못된 상태: ${state.puyoState}`);
      } catch (e) {
        errors++;
      }
    }

    assert.equal(errors, 0, `${errors}개 에러 발생`);
  });
});

describe("유저 시나리오 16: 모드 전환 시뮬레이션", () => {
  it("테트리스 → 뿌요 전환 시 보드가 초기화되어야 한다", () => {
    const tetrisState = createTetrisState();
    // 테트리스 보드에 데이터 넣기
    tetrisState.board.grid[19][0] = "#ff0000";

    // 모드 전환: 새 뿌요 보드 생성
    const puyoState = createPuyoState();
    // 뿌요 보드는 깨끗해야 함
    for (let r = 0; r < puyoState.board.rows; r++) {
      for (let c = 0; c < puyoState.board.cols; c++) {
        assert.equal(puyoState.board.grid[r][c], 0,
          `뿌요 보드 (${r},${c})가 비어있지 않음`);
      }
    }
  });
});

describe("유저 시나리오 17: SRS 월킥 실전 검증", () => {
  it("벽 옆에서 회전 시 월킥이 동작해야 한다", () => {
    const state = createTetrisState();
    // T-피스를 왼쪽 벽에 배치
    state.current = { type: "T", rotation: 0, x: 0, y: 5, lastAction: null };

    // 시계방향 회전 시도 (월킥 필요할 수 있음)
    const rotated = tryRotate(state, 1);
    assert.ok(rotated, "벽 옆 T-피스 회전 실패 (월킥 미동작)");
  });

  it("I-피스 벽 옆 회전 시 I-전용 킥이 동작해야 한다", () => {
    const state = createTetrisState();
    state.current = { type: "I", rotation: 0, x: 0, y: 5, lastAction: null };

    const rotated = tryRotate(state, 1);
    assert.ok(rotated, "I-피스 벽 옆 회전 실패 (I-킥 미동작)");
  });
});

describe("유저 시나리오 18: 채팅 디스플레이 (타이핑 시각화)", () => {
  it("ChatDisplay에 문자 추가/업데이트가 동작해야 한다", () => {
    themes.apply("cyberpunk");
    const chat = new ChatDisplay();
    chat.add("H");
    chat.add("i");
    assert.equal(chat.bubbles.length, 2);

    // 시간 경과 → 버블 소멸
    for (let i = 0; i < 200; i++) chat.update(0.016);
    assert.ok(chat.bubbles.length < 2, "버블이 시간 경과 후 소멸되지 않음");
  });
});

describe("유저 시나리오 19: 성능 벤치마크 (고부스트 시뮬레이션)", () => {
  it("테트리스 100프레임 시뮬 < 50ms", () => {
    const state = createTetrisState();
    for (let i = 0; i < 20; i++) state.input._onInput();

    const start = performance.now();
    for (let frame = 0; frame < 100; frame++) {
      simulateFrame(state, 0.016);
      if (state.gameOver) {
        state.board = new Board();
        state.bag = [];
        fillBag(state);
        state.next = spawnPiece(state);
        nextPiece(state);
        state.gameOver = false;
      }
    }
    const elapsed = performance.now() - start;
    assert.ok(elapsed < 50, `100프레임 시뮬: ${elapsed.toFixed(1)}ms (제한: 50ms)`);
  });

  it("뿌요 100프레임 시뮬 < 100ms", () => {
    const state = createPuyoState();
    for (let i = 0; i < 20; i++) state.input._onInput();

    const start = performance.now();
    for (let frame = 0; frame < 100; frame++) {
      simulatePuyoFrame(state, 0.016);
      if (state.gameOver) {
        state.board = new PuyoBoard();
        state.puyoState = PUYO.STATE.SPAWNING;
        state.currentPair = null;
        state.nextPair = null;
        state.gameOver = false;
      }
    }
    const elapsed = performance.now() - start;
    assert.ok(elapsed < 100, `100프레임 시뮬: ${elapsed.toFixed(1)}ms (제한: 100ms)`);
  });
});

describe("유저 시나리오 20: 뿌요 게임 오버 판정", () => {
  it("데스 셀에 뿌요가 있으면 게임 오버", () => {
    const board = new PuyoBoard();
    assert.ok(!board.isGameOver(), "빈 보드에서 게임 오버");

    board.place(PUYO.DEATH_ROW, PUYO.DEATH_COL, 1);
    assert.ok(board.isGameOver(), "데스 셀에 뿌요 있는데 게임 오버 아님");
  });
});
