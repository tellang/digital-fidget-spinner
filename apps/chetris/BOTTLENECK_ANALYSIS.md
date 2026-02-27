# CHATRIS 병목 분석 리포트

> 분석 대상: `apps/chetris/js/` 전체 (12 모듈, ~4,000 LOC)
> 분석 일시: 2026-02-27
> 분석 관점: 로직적 병목, 동기적 병목, 캐싱 기회

---

## 1. Critical — AI 탐색 동기 블로킹

### 위치: `ai.js:13-72` — `findBestMove()`

**문제**: 매 피스 스폰마다 동기적으로 브루트포스 탐색을 실행한다.
게임 루프(`_update` → `_lockPiece` → `_nextPiece` → `findBestMove`) 안에서 호출되어
탐색 완료까지 프레임이 멈춘다.

**비용 분석**:
```
후보 수: 최대 4회전 × 10열 = ~40개 위치
후보당:
  - board.clone(): 20행 × spread 복사 = 200셀 할당
  - sim.place() + sim.clearLines(): 배열 조작
  - _aggregateHeight(): 10열 × 20행 스캔
  - _maxHeight(): 10열 × 20행 스캔
  - _smartBumpiness(): 10열 × 20행 스캔 + 인접 비교
  - getHoles(): 10열 × 20행 스캔

합계/피스: ~40 × (200 할당 + 800 셀 읽기) ≈ 8,000 할당 + 32,000 읽기
```

**심각도**: 보드가 복잡한 상태(구멍 많음, 높은 스택)에서 GC 압력과 CPU 스파이크 발생 가능.
16ms 프레임 예산 내에서 처리되어야 하는데 보장이 없다.

**권장**:
- 컬럼 높이 배열을 한 번만 계산하고 4개 평가 함수(`_aggregateHeight`, `_maxHeight`, `_smartBumpiness`, `getHoles`)에서 공유
- `board.clone()` 대신 incremental place/undo 패턴 사용
- 필요시 Web Worker로 분리 (비동기 탐색)

---

## 2. Critical — 렌더러 과도한 ctx.save/restore

### 위치: `renderer.js:138-183` — `_drawCell()`

**문제**: glow 활성 테마(cyberpunk, matrix, vaporwave, abyss, eclipse, glass — 6/9 테마)에서
배치된 모든 블록에 대해 개별 `ctx.save()/restore()` 호출.

```
최악: 200셀 × save/restore = 400회 상태 스택 조작/프레임
+ _drawStat × 5 = 10회 추가
+ _drawHeader = 2회 추가
= 프레임당 최대 ~412회 save/restore
```

**현재 최적화**: `needsSave` 플래그로 glow 불필요 시 스킵 — 좋은 시도이나 대부분의 테마에서 glow가 활성.

**권장**:
- 동일 색상 블록을 배치(batch)로 묶어 save/restore 1회로 통합
- 또는 placed blocks를 오프스크린 캔버스에 캐시 (아래 §6 참조)

---

## 3. High — 매 프레임 DOM 접근

### 위치: `game.js:134` + `game.js:406-412`

**문제**:
```javascript
// game.js:134 — 매 프레임마다 opacity 설정
document.getElementById("game-container").style.opacity = this.currentOpacity;

// game.js:406-412 — 매 프레임마다 getElementById + classList
const container = document.getElementById("game-container");
if (boost > 2.5) {
  container.classList.add("boosted");
} else {
  container.classList.remove("boosted");
}
```

`getElementById`는 빠르지만 매 프레임 호출은 불필요. `style.opacity` 설정은 reflow/repaint를 트리거할 수 있다.

**권장**:
- 생성자에서 `this.container = document.getElementById("game-container")` 캐시
- opacity는 값이 변경될 때만 설정 (`if (prev !== current)`)
- boosted 클래스도 상태 변경 시에만 토글

---

## 4. High — 반복 계산: getGhostY + getCells

### 위치: `game.js:420-426` + `constants.js:119-130`

**문제**: `getGhostY()`는 피스를 한 칸씩 내려보며 충돌 체크하는 O(ROWS) 루프.
프레임마다 `_render()`에서 호출되지만 피스 위치가 바뀌지 않은 프레임에서도 재계산한다.

`getCells()`도 매 프레임 `_render()`에서 호출되며, `_lockPiece()`에서도 호출.
동일 피스 상태에서 중복 계산.

**권장**:
- 피스 이동/회전 시에만 ghostY와 cells를 캐시
- `this._cachedGhostY`, `this._cachedCells` 패턴

---

## 5. High — ParticleSystem shadowBlur 비용

### 위치: `effects.js:141-156` — `ParticleSystem.draw()`

**문제**:
```javascript
ctx.shadowBlur = 10; // 모든 파티클에 적용
```

Canvas 2D의 `shadowBlur`는 가우시안 블러를 GPU/CPU에서 수행하며, 각 `fillRect`마다 적용된다.
파티클 300개 × shadowBlur = 300회 블러 연산/프레임.

**권장**:
- 파티클 전용 오프스크린 캔버스에 shadowBlur 없이 렌더 후, 전체에 CSS filter blur 적용
- 또는 파티클 수가 임계치(예: 100) 초과 시 shadowBlur를 0으로 자동 전환

---

## 6. High — Board.clearLines() 배열 조작

### 위치: `board.js:27-43`

**문제**:
```javascript
for (const r of rows.sort((a, b) => a - b)) {
  this.grid.splice(r, 1);  // O(ROWS) 시프트
}
for (let i = 0; i < rows.length; i++) {
  this.grid.unshift(new Array(C.COLS).fill(0));  // O(ROWS) 시프트
}
```

`splice`는 배열 요소를 앞으로 시프트, `unshift`는 뒤로 시프트.
4줄 동시 클리어 시: 4 × O(20) splice + 4 × O(20) unshift = 160회 요소 이동.
AI에서 40번 clone → clearLines를 호출하므로 누적 비용이 크다.

**참고**: splice 후 인덱스가 바뀌므로 정렬 후 순차 삭제는 버그 위험도 있음 (현재 코드는 오름차순 정렬로 동작하지만 fragile).

**권장**:
```javascript
// 필터 + 패딩: splice/unshift 대신 한 번에 재구성
const kept = this.grid.filter((_, r) => !rowSet.has(r));
const padding = Array.from({ length: count }, () => new Array(C.COLS).fill(0));
this.grid = [...padding, ...kept];
```

---

## 7. Medium — Constants getter 간접 참조

### 위치: `constants.js:20-24`

**문제**:
```javascript
get COLORS() { return themes.active.colors; },
get NEON_POOL() { return themes.active.neonPool; },
get BG() { return themes.active.bg; },
```

핫 루프(AI 탐색, 렌더링)에서 `C.COLORS[piece.type]`을 호출할 때마다
getter → `themes.active` 프로퍼티 접근 → private `#active` 접근 체인이 발생.

V8 최적화가 인라인할 수 있지만, 인라인 캐시 미스 시 성능 저하.

**권장**:
- 테마 변경 시에만 `C.COLORS`를 직접 값으로 업데이트하는 observer 패턴
- 또는 핫 경로에서 `const colors = C.COLORS;` 로 로컬 캐시

---

## 8. Medium — ChatDisplay/FlashEffect/ChainDisplay splice 패턴

### 위치:
- `input.js:93-101` — `ChatDisplay.update()`
- `effects.js:266-270` — `FlashEffect.update()`
- `effects.js:202-207` — `ChainDisplay.update()`

**문제**: 역순 순회 + `splice(i, 1)`은 각 제거마다 O(n) 시프트.
ParticleSystem은 swap-and-pop으로 이미 최적화되어 있지만 이 3개 클래스는 그렇지 않다.

**권장**: 동일한 swap-and-pop 패턴 적용. 순서가 중요하면 dirty flag + 일괄 필터.

---

## 9. Medium — Puyo 셀 렌더링 비용

### 위치: `renderer.js:405-474` — `_drawPuyoCell()`

**문제**: 셀 하나당:
- `createRadialGradient()` × 1 (GPU 리소스 할당)
- `arc()` × 6 (원형 path 생성)
- `fill()` × 5 (래스터화)
- `save()/restore()` × 1

가시 셀 60개 기준: 60 × gradient 생성 + 360 arc + 300 fill = 프레임당 매우 무거운 연산.

**권장**: 색상별 Puyo 셀을 오프스크린 캔버스에 프리렌더 후 `drawImage()`로 스탬프.

---

## 10. Low — Settings 저장 디바운싱 없음

### 위치: `settings.js:20-25`

**문제**:
```javascript
set(key, value) {
  if (this.#data[key] === value) return;
  this.#data[key] = value;
  this.#notify(key, value);
  this.#save();  // 매 set마다 즉시 저장
}
```

빠른 연속 설정 변경 시(예: 슬라이더 드래그) 매번 `localStorage.setItem` 또는 Tauri IPC 호출.

**권장**: 300ms 디바운스 적용.

---

## 캐싱 기회 종합

| # | 대상 | 캐시 전략 | 무효화 시점 | 예상 효과 |
|---|------|----------|-----------|----------|
| **C1** | 컬럼 높이 배열 | AI 평가 시 1회 계산, 4함수 공유 | 매 시뮬레이션 보드마다 | AI 탐색 **~75% 셀 읽기 절감** |
| **C2** | Placed blocks 오프스크린 | 보드 변경 시만 재렌더 | `place()` / `clearLines()` | 매 프레임 최대 200 `_drawCell` → **1 `drawImage`** |
| **C3** | Ghost Y 위치 | 피스 이동/회전 시만 재계산 | `_tryMove` / `_tryRotate` | 프레임당 O(20) 루프 제거 |
| **C4** | 사이드 패널 오프스크린 | score/lines/combo/level 변경 시만 재렌더 | 점수 갱신 시 | 프레임당 5× `_drawStat` + `save/restore` 제거 |
| **C5** | Puyo 셀 프리렌더 | 색상 × 테마별 프리렌더 | 테마 변경 시 | 프레임당 60× gradient+arc → **60 `drawImage`** |
| **C6** | 색상 파싱 결과 | `Map<string, {r,g,b,a}>` 메모이제이션 | 필요 없음 (immutable) | Puyo 렌더링 시 regex 제거 |
| **C7** | DOM 요소 참조 | 생성자에서 `getElementById` 1회 | 필요 없음 | 프레임당 DOM 조회 제거 |
| **C8** | 현재 피스 getCells() | 피스 이동/회전 시만 재계산 | `_tryMove` / `_tryRotate` / `_nextPiece` | 프레임당 중복 map() 제거 |
| **C9** | AI 보드 clone → undo | place() 역연산으로 clone 제거 | 루프 내 자동 | AI당 **~40 배열 할당 제거** |
| **C10** | 정적 헤더 텍스트 | 오프스크린 캔버스에 "CHATRIS" 렌더 | 테마 변경 시 | 프레임당 font 설정 + fillText 제거 |

---

## 우선순위 로드맵

```
Phase 1 — 즉시 적용 (< 1시간, 고효과)
├── C1: AI 컬럼 높이 공유 계산
├── C7: DOM 참조 캐시 + 조건부 업데이트
├── §8: splice → swap-and-pop 통일
└── §6: clearLines filter/padding 패턴

Phase 2 — 렌더 캐싱 (1~2시간, 체감 효과 큼)
├── C2: Placed blocks 오프스크린 캐시
├── C3: Ghost Y 캐시
├── C4: 사이드 패널 오프스크린 캐시
└── §5: 파티클 shadowBlur 최적화

Phase 3 — 고급 최적화 (2~4시간)
├── C5: Puyo 셀 프리렌더
├── C6: 색상 파싱 메모이제이션
├── C9: AI clone → undo 패턴
└── §1: findBestMove Web Worker 분리

Phase 4 — 폴리싱 (선택)
├── C10: 정적 텍스트 캐시
├── §10: Settings 디바운스
└── §7: Constants getter → observer 패턴
```

---

## 부록: 현재 코드의 좋은 최적화들

기존 코드에도 의도적인 최적화가 잘 적용되어 있다:

1. **그리드 오프스크린 캐시** (`renderer.js:92-114`) — 그리드 라인을 테마별 캐시. 모범적.
2. **ParticleSystem swap-and-pop** (`effects.js:127-138`) — GC 압력 최소화.
3. **ParticleSystem.MAX_PARTICLES** (`effects.js:35`) — 300개 상한으로 폭주 방지.
4. **배치 고스트 드로우** (`renderer.js:199-220`) — save/restore 2회로 4셀 통합.
5. **`needsSave` 분기** (`renderer.js:146-153`) — glow 불필요 시 save/restore 스킵.
6. **setTimeout 기반 루프** (`game.js:66-84`) — requestAnimationFrame 대신 사용하여 비활성 탭에서도 동작.
7. **7-bag 랜덤화** (`game.js:362-368`) — Fisher-Yates 셔플로 O(n) 보장.
