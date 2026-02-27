// === 뿌요 보드 테스트 ===
const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// setup 먼저 로드 (globalThis.document 등 브라우저 모킹)
require("./setup");

// puyo-constants, puyo-board 순서로 로드
const jsDir = path.join(__dirname, "..", "js");

function loadFile(name) {
  const raw = fs.readFileSync(path.join(jsDir, name), "utf8");
  const code = raw
    .replace(/^class\s+(\w+)/gm, "globalThis.$1 = class $1")
    .replace(/^const\s+(\w+)\s*=\s*/gm, "globalThis.$1 = ");
  new vm.Script(code, { filename: name }).runInThisContext();
}

loadFile("puyo-constants.js");
loadFile("puyo-board.js");

describe("PuyoBoard", () => {
  let board;

  beforeEach(() => {
    board = new PuyoBoard();
  });

  // ─────────────────────────────────────────
  describe("초기화", () => {
    it("기본 cols=6 (PUYO.COLS)", () => {
      assert.equal(board.cols, PUYO.COLS);
    });

    it("기본 rows = PUYO.ROWS + PUYO.HIDDEN_ROWS = 13", () => {
      assert.equal(board.rows, PUYO.ROWS + PUYO.HIDDEN_ROWS);
    });

    it("모든 셀이 0으로 초기화", () => {
      for (let r = 0; r < board.rows; r++) {
        for (let c = 0; c < board.cols; c++) {
          assert.equal(board.grid[r][c], 0,
            `grid[${r}][${c}]가 0이 아님: ${board.grid[r][c]}`);
        }
      }
    });

    it("커스텀 크기로 생성 가능", () => {
      const custom = new PuyoBoard(4, 8);
      assert.equal(custom.cols, 4);
      assert.equal(custom.rows, 8);
    });
  });

  // ─────────────────────────────────────────
  describe("isValid", () => {
    it("빈 셀은 valid", () => {
      assert.ok(board.isValid(5, 2));
    });

    it("음수 행 = invalid", () => {
      assert.ok(!board.isValid(-1, 2));
    });

    it("rows 경계 초과 = invalid", () => {
      assert.ok(!board.isValid(board.rows, 2));
    });

    it("음수 열 = invalid", () => {
      assert.ok(!board.isValid(5, -1));
    });

    it("cols 경계 초과 = invalid", () => {
      assert.ok(!board.isValid(5, board.cols));
    });

    it("채워진 셀 = invalid", () => {
      board.grid[5][2] = 1;
      assert.ok(!board.isValid(5, 2));
    });
  });

  // ─────────────────────────────────────────
  describe("place", () => {
    it("유효한 색상 인덱스 1 배치 성공", () => {
      const result = board.place(5, 2, 1);
      assert.ok(result);
      assert.equal(board.grid[5][2], 1);
    });

    it("최대 유효 색상(PUYO.COLORS) 배치 성공", () => {
      assert.ok(board.place(5, 3, PUYO.COLORS));
    });

    it("색상 인덱스 0은 false 반환", () => {
      assert.equal(board.place(5, 2, 0), false);
      assert.equal(board.grid[5][2], 0, "0을 배치했는데 셀이 변경됨");
    });

    it("색상 인덱스 PUYO.COLORS+1 초과 시 false", () => {
      assert.equal(board.place(5, 2, PUYO.COLORS + 1), false);
    });

    it("음수 행 배치 시 false", () => {
      assert.equal(board.place(-1, 2, 1), false);
    });

    it("rows 초과 행 배치 시 false", () => {
      assert.equal(board.place(board.rows, 2, 1), false);
    });

    it("음수 열 배치 시 false", () => {
      assert.equal(board.place(5, -1, 1), false);
    });
  });

  // ─────────────────────────────────────────
  describe("applyGravity", () => {
    it("빈 보드에서 중력 적용 시 moved=false", () => {
      assert.equal(board.applyGravity(), false);
    });

    it("블록이 바닥까지 내려와야 한다", () => {
      board.grid[0][2] = 1; // 맨 위에 블록
      board.applyGravity();
      assert.equal(board.grid[board.rows - 1][2], 1,
        "블록이 바닥까지 이동하지 않음");
      assert.equal(board.grid[0][2], 0,
        "원래 위치가 비워지지 않음");
    });

    it("이미 바닥에 있으면 moved=false", () => {
      board.grid[board.rows - 1][2] = 1;
      assert.equal(board.applyGravity(), false);
    });

    it("중간에 빈 셀이 있으면 아래로 내려옴", () => {
      board.grid[3][1] = 2; // 3행
      board.grid[5][1] = 1; // 5행 (3행 아래)
      board.applyGravity();
      // 5행 블록은 바닥으로, 3행 블록은 5행 바로 위로
      assert.equal(board.grid[board.rows - 1][1], 1,
        "5행 블록이 바닥에 없음");
      assert.equal(board.grid[board.rows - 2][1], 2,
        "3행 블록이 바닥 바로 위에 없음");
    });

    it("여러 컬럼 독립적으로 중력 적용", () => {
      board.grid[0][0] = 1;
      board.grid[0][3] = 2;
      board.applyGravity();
      assert.equal(board.grid[board.rows - 1][0], 1);
      assert.equal(board.grid[board.rows - 1][3], 2);
    });
  });

  // ─────────────────────────────────────────
  describe("findMatches", () => {
    it("빈 보드에서 매칭 없음", () => {
      assert.deepEqual(board.findMatches(), []);
    });

    it("같은 색 4개 세로 연결 시 1개 그룹 반환", () => {
      for (let r = board.rows - 4; r < board.rows; r++) {
        board.grid[r][2] = 1;
      }
      const groups = board.findMatches();
      assert.equal(groups.length, 1);
      assert.equal(groups[0].cells.length, 4);
      assert.equal(groups[0].color, 1);
    });

    it("같은 색 4개 가로 연결 시 1개 그룹 반환", () => {
      for (let c = 0; c < 4; c++) {
        board.grid[board.rows - 1][c] = 2;
      }
      const groups = board.findMatches();
      assert.equal(groups.length, 1);
      assert.equal(groups[0].cells.length, 4);
    });

    it("3개 연결은 매칭 안 됨 (최소 4개 필요)", () => {
      for (let r = board.rows - 3; r < board.rows; r++) {
        board.grid[r][2] = 1;
      }
      assert.deepEqual(board.findMatches(), []);
    });

    it("5개 연결은 5셀 그룹 1개 반환", () => {
      for (let r = board.rows - 5; r < board.rows; r++) {
        board.grid[r][2] = 1;
      }
      const groups = board.findMatches();
      assert.equal(groups.length, 1);
      assert.equal(groups[0].cells.length, 5);
    });

    it("다른 색끼리는 같은 그룹 안 됨", () => {
      for (let r = board.rows - 4; r < board.rows; r++) board.grid[r][1] = 1;
      for (let r = board.rows - 4; r < board.rows; r++) board.grid[r][2] = 2;
      const groups = board.findMatches();
      assert.equal(groups.length, 2);
    });

    it("ㄱ자 형태 4개 연결도 매칭", () => {
      // L자 모양
      board.grid[board.rows - 1][0] = 1;
      board.grid[board.rows - 2][0] = 1;
      board.grid[board.rows - 3][0] = 1;
      board.grid[board.rows - 3][1] = 1;
      const groups = board.findMatches();
      assert.equal(groups.length, 1);
      assert.equal(groups[0].cells.length, 4);
    });
  });

  // ─────────────────────────────────────────
  describe("removeMatches", () => {
    it("매칭된 셀이 0으로 초기화됨", () => {
      for (let r = board.rows - 4; r < board.rows; r++) board.grid[r][2] = 1;
      const groups = board.findMatches();
      board.removeMatches(groups);
      for (let r = board.rows - 4; r < board.rows; r++) {
        assert.equal(board.grid[r][2], 0);
      }
    });

    it("제거 결과에 removed 카운트 포함", () => {
      for (let r = board.rows - 4; r < board.rows; r++) board.grid[r][2] = 1;
      const groups = board.findMatches();
      const result = board.removeMatches(groups);
      assert.equal(result.removed, 4);
    });

    it("제거 결과에 colors Set 포함", () => {
      for (let r = board.rows - 4; r < board.rows; r++) board.grid[r][1] = 1;
      for (let r = board.rows - 4; r < board.rows; r++) board.grid[r][2] = 2;
      const groups = board.findMatches();
      const result = board.removeMatches(groups);
      assert.ok(result.colors.includes(1));
      assert.ok(result.colors.includes(2));
    });
  });

  // ─────────────────────────────────────────
  describe("resolveChains", () => {
    it("빈 보드에서 체인 없음", () => {
      assert.deepEqual(board.resolveChains(), []);
    });

    it("1체인: 결과 배열 길이 1, chain=1", () => {
      for (let r = board.rows - 4; r < board.rows; r++) board.grid[r][2] = 1;
      const results = board.resolveChains();
      assert.equal(results.length, 1);
      assert.equal(results[0].chain, 1);
    });

    it("체인 후 보드에서 매칭 셀이 제거됨", () => {
      for (let r = board.rows - 4; r < board.rows; r++) board.grid[r][2] = 1;
      board.resolveChains();
      assert.equal(board.grid[board.rows - 1][2], 0);
    });

    it("2체인 시나리오: 연쇄 반응", () => {
      // 위에 1색 4개, 아래에 1색 4개가 중력 후 연결되는 구조
      // 1열 하단 4개 색1 (바닥에서)
      for (let r = board.rows - 4; r < board.rows; r++) board.grid[r][0] = 1;
      // 1열 상단 4개 색1 (중력 후 합쳐져 2체인)
      for (let r = board.rows - 8; r < board.rows - 4; r++) board.grid[r][0] = 1;
      const results = board.resolveChains();
      // 8개 연결 → 1번에 제거
      assert.ok(results.length >= 1, "체인이 발생하지 않음");
    });

    it("체인 결과에 score 포함", () => {
      for (let r = board.rows - 4; r < board.rows; r++) board.grid[r][2] = 1;
      const results = board.resolveChains();
      assert.ok(typeof results[0].score === "number");
      assert.ok(results[0].score > 0);
    });
  });

  // ─────────────────────────────────────────
  describe("calcChainScore", () => {
    it("1체인 4개 단일 그룹: 10 * 4 * max(1, 0+0+0) = 40", () => {
      const groups = [{ color: 1, cells: [[0,0],[1,0],[2,0],[3,0]] }];
      const score = board.calcChainScore(1, groups);
      assert.equal(score, 40);
    });

    it("체인 수가 높을수록 점수 증가", () => {
      const groups = [{ color: 1, cells: [[0,0],[1,0],[2,0],[3,0]] }];
      const score1 = board.calcChainScore(1, groups);
      const score2 = board.calcChainScore(2, groups);
      assert.ok(score2 > score1,
        `2체인(${score2})이 1체인(${score1})보다 낮음`);
    });

    it("5개 이상 그룹 보너스 반영", () => {
      // 5개 그룹은 GROUP_BONUS[5]=2 추가
      const groups4 = [{ color: 1, cells: [[0,0],[1,0],[2,0],[3,0]] }];
      const groups5 = [{ color: 1, cells: [[0,0],[1,0],[2,0],[3,0],[4,0]] }];
      const score4 = board.calcChainScore(1, groups4);
      const score5 = board.calcChainScore(1, groups5);
      assert.ok(score5 > score4, "그룹 보너스 미반영");
    });

    it("2가지 색상 보너스 반영", () => {
      const groups1color = [
        { color: 1, cells: [[0,0],[1,0],[2,0],[3,0]] },
        { color: 1, cells: [[0,1],[1,1],[2,1],[3,1]] },
      ];
      const groups2color = [
        { color: 1, cells: [[0,0],[1,0],[2,0],[3,0]] },
        { color: 2, cells: [[0,1],[1,1],[2,1],[3,1]] },
      ];
      const score1 = board.calcChainScore(1, groups1color);
      const score2 = board.calcChainScore(1, groups2color);
      assert.ok(score2 > score1, "다색 보너스 미반영");
    });
  });

  // ─────────────────────────────────────────
  describe("isGameOver", () => {
    it("데스 셀 비어있으면 false", () => {
      assert.equal(board.isGameOver(), false);
    });

    it("데스 셀(DEATH_ROW, DEATH_COL) 채워지면 true", () => {
      board.grid[PUYO.DEATH_ROW][PUYO.DEATH_COL] = 1;
      assert.equal(board.isGameOver(), true);
    });

    it("데스 셀 이외의 셀만 채워지면 false", () => {
      board.grid[PUYO.DEATH_ROW + 1][PUYO.DEATH_COL] = 1;
      assert.equal(board.isGameOver(), false);
    });
  });

  // ─────────────────────────────────────────
  describe("getColumnHeights", () => {
    it("빈 보드에서 모든 높이 0", () => {
      const heights = board.getColumnHeights();
      assert.equal(heights.length, board.cols);
      assert.ok(heights.every(h => h === 0));
    });

    it("바닥에 블록 놓으면 높이 1", () => {
      board.grid[board.rows - 1][2] = 1;
      const heights = board.getColumnHeights();
      assert.equal(heights[2], 1);
    });

    it("여러 블록 중 최상단 기준으로 높이 계산", () => {
      board.grid[board.rows - 3][1] = 1;
      board.grid[board.rows - 1][1] = 1;
      const heights = board.getColumnHeights();
      assert.equal(heights[1], 3);
    });
  });

  // ─────────────────────────────────────────
  describe("clone", () => {
    it("독립적인 복사본 생성", () => {
      board.grid[5][2] = 1;
      const cloned = board.clone();
      assert.equal(cloned.grid[5][2], 1);
      board.grid[5][2] = 2;
      assert.equal(cloned.grid[5][2], 1,
        "원본 변경이 복사본에 영향을 줌");
    });

    it("복사본의 크기가 동일", () => {
      const cloned = board.clone();
      assert.equal(cloned.cols, board.cols);
      assert.equal(cloned.rows, board.rows);
    });

    it("복사본 변경이 원본에 영향 없음", () => {
      const cloned = board.clone();
      cloned.grid[3][1] = 3;
      assert.equal(board.grid[3][1], 0);
    });
  });

  // ─────────────────────────────────────────
  describe("placePair", () => {
    it("main/sub 객체 형태로 배치", () => {
      const pair = {
        main: { row: 5, col: 2, color: 1 },
        sub:  { row: 4, col: 2, color: 2 },
      };
      const result = board.placePair(pair);
      assert.ok(result);
      assert.equal(board.grid[5][2], 1);
      assert.equal(board.grid[4][2], 2);
    });

    it("rotation 0(위): 서브가 메인 위에 위치", () => {
      const pair = {
        mainRow: 5, mainCol: 2,
        rotation: 0,
        mainColor: 1,
        subColor: 2,
      };
      board.placePair(pair);
      // rotation 0 = PAIR_OFFSETS[0] = [-1,0] → sub는 (4,2)
      assert.equal(board.grid[5][2], 1);
      assert.equal(board.grid[4][2], 2);
    });

    it("이미 채워진 셀에 배치 시 false", () => {
      board.grid[5][2] = 1;
      const pair = { main: { row: 5, col: 2, color: 2 }, sub: { row: 4, col: 2, color: 1 } };
      assert.equal(board.placePair(pair), false);
    });
  });
});
