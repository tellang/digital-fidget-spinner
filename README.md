<div align="center">

<br>

```
 ╔═══════════════════════════════════════╗
 ║   D I G I T A L                      ║
 ║     F I D G E T                      ║
 ║       S P I N N E R                  ║
 ╚═══════════════════════════════════════╝
```

**바탕화면 위의 디지털 장난감**

[![Platform](https://img.shields.io/badge/platform-Windows-39ff14?style=flat-square)](#)
[![License](https://img.shields.io/badge/license-MIT-b026ff?style=flat-square)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-v2-ff6600?style=flat-square)](https://v2.tauri.app)
[![Size](https://img.shields.io/badge/size-~5MB-ffee00?style=flat-square)](#)

바탕화면 구석에 항상 떠있는 초소형 위젯.<br>
코딩하면서, 회의하면서, 문서 쓰면서 — 심심풀이로 돌려보세요.<br>
**타이핑하면 반응합니다.**

<br>

[**다운로드**](https://github.com/tellang/digital-fidget-spinner/releases) · [위젯 목록](#위젯) · [빌드](#빌드)

</div>

---

## 컨셉

```
바탕화면 구석의 작은 창  ←  포커스 불필요
       ↑
   항상 최상단 오버레이   ←  다른 앱 위에 떠있음
       ↑
  키보드 입력에 반응      ←  글로벌 키훅 (OS 레벨)
       ↑
   AI가 알아서 플레이     ←  당신은 그냥 일하면 됨
```

타이핑할수록 위젯이 빨라지는 **피젯 스피너**. 손가락 대신 키보드로 돌리세요.

---

## 위젯

| 위젯 | 설명 | 상태 |
|------|------|:----:|
| [**CHATRIS**](apps/chetris/) | 타이핑하면 빨라지는 AI 테트리스 | `기본값` |
| *추가 예정* | | |

> 설정에서 위젯을 전환할 수 있습니다.

---

## 빠른 시작

[**Releases**](https://github.com/tellang/digital-fidget-spinner/releases)에서 최신 버전을 받으세요.

| 파일 | 용도 |
|------|------|
| `CHATRIS_*_x64-setup.exe` | 설치형 (자동 업데이트 포함) |
| `CHATRIS_*_x64_en-US.msi` | MSI 설치 |

> 자동 업데이트 내장 — 한번 설치하면 이후 버전은 자동.

---

## 빌드

```bash
cd apps/chetris
npm install
npm run tauri:dev        # 개발
npm run tauri:build      # 프로덕션
```

필수: Node.js 18+, Rust 1.70+, VS Build Tools (C++)

---

<details>
<summary><strong>기술 스택</strong></summary>
<br>

| 영역 | 기술 |
|------|------|
| 프레임워크 | **Tauri v2** (Rust + WebView2) |
| 프론트엔드 | 순수 HTML/CSS/JS, Canvas 2D |
| 입력 | rdev (OS 레벨 글로벌 키보드 훅) |
| 업데이트 | tauri-plugin-updater + GitHub Releases |
| CI/CD | GitHub Actions (태그 push 시 자동 빌드) |

배포 크기 **~5MB** — Electron 대비 1/30.

</details>

<details>
<summary><strong>프로젝트 구조</strong></summary>
<br>

```
digital-fidget-spinner/
├── apps/
│   └── chetris/              # AI 테트리스 위젯
│       ├── index.html        # 메인 진입점
│       ├── js/               # 프론트엔드 모듈
│       ├── src-tauri/        # Rust 백엔드
│       └── package.json
├── .github/workflows/
│   └── release.yml           # CI/CD
├── README.md
└── .gitignore
```

</details>

---

<div align="center">

MIT License

</div>
