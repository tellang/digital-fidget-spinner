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

[![Version](https://img.shields.io/badge/version-3.1.0-00fff2?style=flat-square)](https://github.com/tellang/digital-fidget-spinner/releases)
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
동점 배치는 랜덤 선택 — 매번 다른 패턴.

</td>
<td width="50%">

### 타이핑 부스트
키 입력마다 속도 증가, 최대 **8배**.<br>
멈추면 자연스럽게 감속(디케이).

</td>
</tr>
<tr>
<td>

### 6종 테마
Cyberpunk / Game Boy / Pastel / Matrix / Glass / Retro<br>
시스템 트레이에서 실시간 전환.

</td>
<td>

### 설정 시스템
파티클, 진동, 자동 페이드, 시작프로그램 등록.<br>
트레이 메뉴에서 토글. 자동 저장.

</td>
</tr>
</table>

---

## 테마

| Cyberpunk Neon | Game Boy | Pastel Dream |
|:-:|:-:|:-:|
| 네온 글로우 + CRT + 비네트 | 4색 그린 미니멀 | 파스텔 + 둥근 블록 |

| Matrix | Glassmorphism | Retro Arcade |
|:-:|:-:|:-:|
| 그린 모노크롬 터미널 | 반투명 프로스트 | 클래식 테트리스 |

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
| 위치 프리셋 | 트레이 / 우클릭 → 위치 |
| 테마 | 트레이 / 우클릭 → 테마 |
| 설정 | 트레이 / 우클릭 → 설정 |
| 종료 | `ESC` 또는 트레이 → 종료 |

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

매 피스마다 가능한 모든 (회전 x 위치) 조합을 시뮬레이션:

```
점수 = 높이합     x (-0.51)
     + 클리어라인 x (+3.60)
     + 구멍수     x (-0.36)
     + 범프니스   x (-0.18)
     + 최고높이   x (-0.10)
     + T-스핀     x (+2.00)
```

동점이면 랜덤 선택 — 매번 다른 게임 전개.

</details>

<details>
<summary><strong>프로젝트 구조</strong></summary>
<br>

```
chetris/
├── index.html              # 투명 배경, CRT 효과
├── js/
│   ├── themes.js           # ThemeRegistry (6종)
│   ├── settings.js         # 설정 영속화
│   ├── constants.js        # SRS 피스/월킥 데이터
│   ├── board.js            # 보드 + T-스핀 검출
│   ├── ai.js               # 4-feature 테트리스 AI
│   ├── puyo-ai.js          # 뿌요 AI
│   ├── puyo-board.js       # 뿌요 보드
│   ├── puyo-constants.js   # 뿌요 상수
│   ├── effects.js          # 파티클 + 흔들림
│   ├── input.js            # 글로벌 입력 + 채팅 버블
│   ├── renderer.js         # Canvas 네온 렌더러
│   └── game.js             # 메인 루프
├── src-tauri/
│   ├── Cargo.toml          # tauri, rdev, updater
│   ├── tauri.conf.json     # 윈도우 + 업데이터
│   └── src/lib.rs          # 트레이, 키훅, 설정, 업데이트
└── scripts/
    └── copy-dist.js        # 빌드 스크립트
```

</details>

<details>
<summary><strong>배포 & 자동 업데이트</strong></summary>
<br>

GitHub Releases 기반 자동 업데이트:

```bash
# 1. 서명 키 생성
npx tauri signer generate -w ~/.tauri/chatris.key

# 2. tauri.conf.json → pubkey, endpoints 설정
# 3. GitHub Secrets → TAURI_SIGNING_PRIVATE_KEY, PASSWORD
# 4. 태그 push → 자동 빌드/릴리스
git tag v3.1.0 && git push origin v3.1.0
```

</details>

---

## 버전

| | 내용 |
|---|------|
| **v3.1** | 업데이트 모달 UI + 우클릭 메뉴 + 버전 표시 |
| **v3.0** | 설정 시스템 + 자동 페이드 + 시작 등록 + 자동 업데이트 |
| **v2.0** | ThemeRegistry (6종) + 트레이 테마 전환 |
| **v1.0** | AI 자동 플레이 + Tauri 오버레이 + 글로벌 키훅 |

---

<div align="center">

MIT License

</div>
