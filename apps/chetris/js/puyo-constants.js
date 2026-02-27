// === 뿌요뿌요 전용 상수 ===

// 뿌요 보드 크기
const PUYO = {
  COLS: 6,
  ROWS: 12,
  HIDDEN_ROWS: 1,  // 최상단 숨김 행
  CELL: 13,        // 셀 크기 (px)
  COLORS: 4,       // 기본 색상 수

  // 보드 레이아웃 (캔버스 164x252px 내)
  BOARD_X: 10,
  BOARD_Y: 20,
  SIDE_X: 100,

  // 뿌요 쌍 오프셋: [dr, dc] - 메인 기준 서브 위치
  // 0=위, 1=오른쪽, 2=아래, 3=왼쪽
  PAIR_OFFSETS: [
    [-1, 0],   // 0: 서브가 위
    [0, 1],    // 1: 서브가 오른쪽
    [1, 0],    // 2: 서브가 아래
    [0, -1],   // 3: 서브가 왼쪽
  ],

  // 스폰 위치
  SPAWN_COL: 2,    // 3번째 열 (0-indexed)
  SPAWN_ROW: 0,

  // 데스 셀 (게임 오버 판정)
  DEATH_COL: 2,
  DEATH_ROW: 0,

  // 연쇄 점수 시스템
  CHAIN_POWER: [0, 0, 8, 16, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 480, 512],
  GROUP_BONUS: [0, 0, 0, 0, 0, 2, 3, 4, 5, 6, 7, 10],  // index = 뿌요 수 (4개=0, 5개=2, ...)
  COLOR_BONUS: [0, 0, 3, 6, 12, 24],                      // index = 색상 수

  // 속도
  BASE_DROP_DELAY: 800,
  BASE_MOVE_DELAY: 70,

  // 애니메이션 타이밍 (ms)
  SETTLE_TIME: 200,     // 중력 적용 애니메이션
  POP_TIME: 300,        // 팝 애니메이션
  CHAIN_DELAY: 100,     // 연쇄 간 딜레이

  // 상태 머신
  STATE: {
    DROPPING: 'dropping',
    SETTLING: 'settling',
    MATCHING: 'matching',
    CHAINING: 'chaining',
    SPAWNING: 'spawning',
    GAME_OVER: 'game_over',
  },
};
