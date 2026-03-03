<div align="center">

<br>

```
 ██████╗██╗  ██╗ █████╗ ████████╗██████╗ ██╗███████╗
██╔════╝██║  ██║██╔══██╗╚══██╔══╝██╔══██╗██║██╔════╝
██║     ███████║███████║   ██║   ██████╔╝██║███████╗
██║     ██╔══██║██╔══██║   ██║   ██╔══██╗██║╚════██║
╚██████╗██║  ██║██║  ██║   ██║   ██║  ██║██║███████║
 ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝╚═╝╚══════╝
```

**타이핑하면 빨라지는 AI 테트리스**

[![Version](https://img.shields.io/badge/version-4.5.0-00fff2?style=flat-square)](https://github.com/tellang/digital-fidget-spinner/releases)
[![License](https://img.shields.io/badge/license-MIT-b026ff?style=flat-square)](../../LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows-39ff14?style=flat-square)](#)
[![Tauri](https://img.shields.io/badge/Tauri-v2-ff6600?style=flat-square)](https://v2.tauri.app)
[![Size](https://img.shields.io/badge/size-~5MB-ffee00?style=flat-square)](#)

키보드를 두드릴수록 게임이 빨라집니다.<br>
AI가 플레이하고, 당신의 타이핑이 부스트합니다.<br>
바탕화면 위에 항상 떠있는 초소형 오버레이.

<br>

[**다운로드**](https://github.com/tellang/digital-fidget-spinner/releases) · [빌드 가이드](#빌드) · [테마](#테마)

</div>

---

## 어떻게 동작하나요?

```
당신이 타이핑    →    글로벌 키보드 훅 감지    →    테트리스 가속 (최대 8x)
```

**포커스 불필요.** 코딩하든, 채팅하든, 문서 작업하든 — 키보드만 치면 바탕화면 구석의 테트리스가 미친 듯이 빨라집니다.

---

## 기능

<table>
<tr>
<td width="50%">

### AI 자동 플레이
4-feature 휴리스틱 + T-스핀 + SRS 월킥.<br>
테트리스 + **뿌요뿌요** 듀얼 모드 지원.

</td>
<td width="50%">

### 타이핑 부스트
키 입력마다 속도 증가, 최대 **8배**.<br>
멈추면 자연스럽게 감속(디케이).

</td>
</tr>
<tr>
<td>

### 10종 테마
Vaporwave / Abyss / Cloud / Eclipse 등 추가.<br>
시스템 밝기에 따른 **자동 테마 감지**.

</td>
<td>

### 독립 설정 패널
별도 윈도우에서 테마, 모드, 옵션 실시간 변경.<br>
**4코너 위치 프리셋** 및 자동 업데이트 지원.

</td>
</tr>
</table>

---

## 테마

| Cyberpunk Neon | Game Boy | Pastel Dream | Matrix | Glassmorphism |
|:-:|:-:|:-:|:-:|:-:|
| 네온 글로우 + CRT | 4색 그린 미니멀 | 파스텔 + 둥근 블록 | 그린 모노크롬 | 반투명 프로스트 |

| Retro Arcade | Vaporwave Sunset | Connected Abyss | Cloud Dancer | Solar Eclipse |
|:-:|:-:|:-:|:-:|:-:|
| 클래식 테트리스 | 80s 핑크 + 그리드 | 심해 네온 + 글로우 | 밝은 미니멀 파스텔 | 블랙 & 오렌지 대비 |

---

## 빠른 시작

[**Releases**](https://github.com/tellang/digital-fidget-spinner/releases)에서 받으세요:

| 파일 | 용도 |
|------|------|
| `CHATRIS_*_x64-setup.exe` | 설치형 (자동 업데이트 포함) |
| `CHATRIS_*_x64_en-US.msi` | MSI 설치 |

> 자동 업데이트 내장 — 한번 설치하면 이후 버전은 자동.

### 조작

| 동작 | 방법 |
|------|------|
| 가속 | 아무 앱에서 타이핑 |
| 즉시 드롭 | 빠른 연타 |
| 이동 | 위젯 드래그 |
| 위치 프리셋 | 설정 → 위치 (↖ ↗ ↙ ↘) |
| 설정 패널 | 우클릭 → 설정 (별도 창) |
| 테마/모드 | 설정 패널에서 전환 |
| 종료 | `ESC` 또는 설정 → 종료 |

---

## 빌드

```bash
# 필수: Node.js 18+, Rust 1.70+, VS Build Tools (C++)
npm install
npm run tauri:dev        # 개발
npm run tauri:build      # 프로덕션 → src-tauri/target/release/
```

---

<details>
<summary><strong>기술 스택</strong></summary>
<br>

| 영역 | 기술 |
|------|------|
| 프론트엔드 | 순수 HTML/CSS/JS — 프레임워크 없음 |
| 렌더링 | Canvas 2D API |
| 데스크탑 | **Tauri v2** (Rust + WebView2) |
| 게임 루프 | setTimeout (비활성 탭 호환) |
| AI | 4-feature 가중합 + SRS + T-스핀 |
| 글로벌 입력 | rdev (OS 레벨 키보드 훅) |
| 자동 업데이트 | tauri-plugin-updater + GitHub Releases |

### 왜 Tauri?

| | Tauri | Electron | 브라우저 |
|---|:---:|:---:|:---:|
| 투명 오버레이 | O | O | X |
| 글로벌 키훅 | O | O (추가 모듈) | X |
| 시스템 트레이 | O | O | X |
| 배포 크기 | **~5MB** | ~150MB | -- |

</details>

<details>
<summary><strong>AI 동작 원리</strong></summary>
<br>

### 테트리스
매 피스마다 가능한 모든 (회전 x 위치) 조합을 시뮬레이션:

```
점수 = 높이합     x (-0.51)
     + 클리어라인 x (+3.60)
     + 구멍수     x (-0.36)
     + 범프니스   x (-0.18)
     + 최고높이   x (-0.10)
     + T-스핀     x (+2.00)
```

### 뿌요뿌요
2-ahead 연쇄 탐색 + DFS 기반 최적 배치:
- 현재 피스와 다음 피스 조합으로 최대 연쇄 개수 계산
- 보너스 스코어링: 연쇄 수 + 동시 제거 블록 수

동점이면 랜덤 선택 — 매번 다른 게임 전개.

</details>

<details>
<summary><strong>프로젝트 구조</strong></summary>
<br>

```
chetris/
├── index.html              # 메인 게임 윈도우 (투명 배경, CRT 효과)
├── settings.html           # 별도 설정 윈도우 UI
├── js/
│   ├── app.js              # 설정 패널 컨트롤러 + 타이핑 이벤트
│   ├── themes.js           # ThemeRegistry (10종 테마)
│   ├── settings.js         # 설정 영속화 (Tauri invoke)
│   ├── constants.js        # SRS 피스/월킥 데이터 (테트리스)
│   ├── board.js            # 테트리스 보드 + T-스핀 검출
│   ├── ai.js               # 4-feature 테트리스 AI
│   ├── puyo-ai.js          # 뿌요뿌요 AI (2-ahead DFS)
│   ├── puyo-board.js       # 뿌요뿌요 보드 + 연쇄 판정
│   ├── puyo-constants.js   # 뿌요뿌요 상수
│   ├── effects.js          # 파티클 + 흔들림 이펙트
│   ├── input.js            # 글로벌 키훅 + 채팅 버블
│   ├── renderer.js         # Canvas 2D 네온 렌더러
│   └── game.js             # 메인 게임 루프
├── src-tauri/
│   ├── Cargo.toml          # 의존성 (tauri, rdev, updater)
│   ├── tauri.conf.json     # 윈도우 설정 + 업데이터
│   └── src/lib.rs          # 트레이, 글로벌 키훅, 설정, 자동 업데이트
└── scripts/
    └── copy-dist.js        # 빌드 스크립트
```

</details>

<details>
<summary><strong>배포 & 자동 업데이트</strong></summary>
<br>

GitHub Releases 기반 자동 업데이트:
토스트 알림 스타일로 비침투적 업데이트를 지원합니다.

</details>

---

## 버전

| | 내용 |
|---|------|
| **v4.4** | 설정 패널 UI 최적화, 토글 레이아웃 개선 |
| **v4.3** | 신규 테마 2종 (Cloud Dancer, Solar Eclipse) + 위치 프리셋 |
| **v4.2** | 설정 패널 윈도우 분리, 섹션 접기/펼치기, 토스트 알림 |
| **v4.1** | 신규 테마 2종 (Vaporwave Sunset, Connected Abyss) |
| **v4.0** | 뿌요뿌요 모드 추가, 밝기 기반 자동 테마 감지 |
| **v3.1** | 업데이트 모달 UI + 우클릭 메뉴 + 버전 표시 |
| **v3.0** | 설정 시스템 + 자동 페이드 + 시작 등록 + 자동 업데이트 |
| **v2.0** | ThemeRegistry (6종) + 트레이 테마 전환 |
| **v1.0** | AI 자동 플레이 + Tauri 오버레이 + 글로벌 키훅 |

---

<div align="center">

MIT License

</div>
