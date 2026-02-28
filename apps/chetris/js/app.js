// === Tauri 통합 & UI 초기화 (인라인에서 분리 — CSP 호환) ===

// body.ready 안전 폴백 — 3초 내 렌더러가 ready를 못 붙이면 강제 표시
setTimeout(function() {
  if (!document.body.classList.contains("ready")) {
    document.body.classList.add("ready");
  }
}, 3000);

// Tauri 키보드 포커스 확보
window.addEventListener("DOMContentLoaded", function() {
  window.focus();
  document.body.setAttribute("tabindex", "-1");
  document.body.focus();
});

// 클릭 시에도 포커스 확보
document.addEventListener("click", function() {
  document.body.focus();
});

// Tauri ESC 종료 핸들러
document.addEventListener("keydown", function(e) {
  if (e.key === "Escape" && window.__TAURI__) {
    // 브라우저 모드: 인라인 메뉴 닫기
    var menu = document.getElementById("ctx-menu");
    if (menu && menu.style.display !== "none" && menu.style.display !== "") {
      menu.style.display = "none";
      return;
    }
    window.__TAURI__.core.invoke("exit_app");
  }
});

// Tauri 윈도우 드래그 (data-tauri-drag-region 대체 — 우클릭 비간섭)
(function() {
  if (!window.__TAURI__) return;
  var container = document.getElementById("game-container");
  container.addEventListener("mousedown", function(e) {
    if (e.button !== 0) return;
    if (e.target.closest("#ctx-menu")) return;
    window.__TAURI__.webviewWindow.getCurrentWebviewWindow().startDragging();
  });
})();

// 컨텍스트 메뉴 (우클릭)
(function() {
  var menu = document.getElementById("ctx-menu");

  function updateState() {
    menu.querySelectorAll("[data-theme]").forEach(function(el) {
      var active = themes.active && themes.active.id === el.dataset.theme;
      el.classList.toggle("active", active);
      var t = themes.get(el.dataset.theme);
      if (t) el.style.color = active ? t.borderColor : "";
    });
    menu.querySelectorAll(".ctx-mode").forEach(function(el) {
      var active = settings.get("gameMode") === el.dataset.mode;
      el.classList.toggle("active", active);
    });
    menu.querySelectorAll(".ctx-toggle").forEach(function(el) {
      el.classList.toggle("checked", !!settings.get(el.dataset.key));
    });
  }

  // 우클릭 → Tauri: 외부 설정 윈도우, 브라우저: 인라인 메뉴
  document.addEventListener("contextmenu", function(e) {
    e.preventDefault();
    if (window.__TAURI__) {
      window.__TAURI__.core.invoke("open_settings_window", { x: e.screenX, y: e.screenY });
      return;
    }
    // 브라우저 폴백: 인라인 메뉴
    updateState();
    menu.style.display = "block";
    var x = Math.min(e.clientX, window.innerWidth - menu.offsetWidth - 2);
    var y = Math.min(e.clientY, window.innerHeight - menu.offsetHeight - 2);
    menu.style.left = Math.max(2, x) + "px";
    menu.style.top = Math.max(2, y) + "px";
  });

  // 좌클릭 외부 → 메뉴 닫기 (브라우저 모드)
  document.addEventListener("mousedown", function(e) {
    if (e.button === 0 && !menu.contains(e.target)) {
      menu.style.display = "none";
    }
  });

  // 테마 선택
  menu.querySelectorAll("[data-theme]").forEach(function(el) {
    el.addEventListener("click", function() {
      themes.apply(el.dataset.theme);
      settings.set("theme", el.dataset.theme);
      updateState();
    });
  });

  // 모드 선택
  menu.querySelectorAll(".ctx-mode").forEach(function(el) {
    el.addEventListener("click", function() {
      settings.set("gameMode", el.dataset.mode);
      updateState();
      menu.style.display = "none";
    });
  });

  // 설정 토글
  menu.querySelectorAll(".ctx-toggle").forEach(function(el) {
    el.addEventListener("click", function() {
      var key = el.dataset.key;
      var val = !settings.get(key);
      settings.set(key, val);
      if (key === "autoStart" && window.__TAURI__) {
        window.__TAURI__.core.invoke("set_auto_start", { enable: val });
      }
      updateState();
    });
  });

  // 위치 이동
  menu.querySelectorAll(".ctx-pos").forEach(function(el) {
    el.addEventListener("click", function() {
      if (window.__TAURI__) {
        window.__TAURI__.core.invoke("position_window_cmd", { position: el.dataset.pos });
      }
      menu.style.display = "none";
    });
  });

  // 종료
  menu.querySelector(".ctx-quit").addEventListener("click", function() {
    if (window.__TAURI__) {
      window.__TAURI__.core.invoke("exit_app");
    }
  });

  // 버전 표시 (Tauri API에서 동적 로드)
  var verEl = document.getElementById("ctx-ver");
  if (window.__TAURI__) {
    window.__TAURI__.app.getVersion().then(function(v) {
      verEl.textContent = "CHATRIS v" + v;
    });
  } else {
    verEl.textContent = "CHATRIS (dev)";
  }
})();

// 외부 설정 윈도우에서 변경된 설정 수신
(function() {
  if (!window.__TAURI__) return;
  window.__TAURI__.event.listen("settings-changed", function(e) {
    settings.set(e.payload.key, e.payload.value);
  });
})();

// === 설정 패널 모드 (#settings 해시 라우트) ===
(function() {
  if (window.location.hash !== "#settings") return;
  document.body.classList.add("settings-mode");

  // 설정 로드 대기 후 초기화
  settings.load().then(function() {
    var themeList = themes.names.map(function(id) {
      var t = themes.get(id);
      return { id: id, name: t.name, color: t.borderColor };
    });

    // 테마 그리드 빌드
    var grid = document.getElementById("sp-themes");
    themeList.forEach(function(t) {
      var btn = document.createElement("div");
      btn.className = "sp-btn";
      btn.dataset.theme = t.id;
      btn.innerHTML = '<span class="sp-dot" style="color:' + t.color + '"></span>' + t.name;
      btn.addEventListener("click", function() {
        settings.set("theme", t.id);
        notifyMain("theme", t.id);
        spUpdate();
      });
      grid.appendChild(btn);
    });

    // 모드
    document.querySelectorAll(".sp-mode-btn").forEach(function(btn) {
      btn.addEventListener("click", function() {
        settings.set("gameMode", btn.dataset.mode);
        notifyMain("gameMode", btn.dataset.mode);
        spUpdate();
      });
    });

    // 토글
    document.querySelectorAll(".sp-switch").forEach(function(sw) {
      sw.addEventListener("click", function() {
        var key = sw.dataset.key;
        var val = !settings.get(key);
        settings.set(key, val);
        notifyMain(key, val);
        if (key === "autoStart" && window.__TAURI__) {
          window.__TAURI__.core.invoke("set_auto_start", { enable: val });
        }
        spUpdate();
      });
    });

    // 위치
    document.querySelectorAll(".sp-pos-btn").forEach(function(btn) {
      btn.addEventListener("click", function() {
        if (window.__TAURI__) {
          window.__TAURI__.core.invoke("position_window_cmd", { position: btn.dataset.pos });
        }
      });
    });

    // 닫기 (숨기기)
    document.getElementById("sp-close").addEventListener("click", function() {
      if (window.__TAURI__) {
        window.__TAURI__.webviewWindow.getCurrentWebviewWindow().hide();
      }
    });

    // 종료
    document.getElementById("sp-quit").addEventListener("click", function() {
      if (window.__TAURI__) {
        window.__TAURI__.core.invoke("exit_app");
      }
    });

    // ESC 닫기
    document.addEventListener("keydown", function(e) {
      if (e.key === "Escape" && window.__TAURI__) {
        window.__TAURI__.webviewWindow.getCurrentWebviewWindow().hide();
      }
    });

    // 버전
    if (window.__TAURI__) {
      window.__TAURI__.app.getVersion().then(function(v) {
        document.getElementById("sp-ver").textContent = "CHATRIS v" + v;
      });
    }

    // 윈도우 다시 보일 때 설정 새로고침
    document.addEventListener("visibilitychange", function() {
      if (!document.hidden) {
        settings.load().then(spUpdate);
      }
    });

    spUpdate();
  });

  function notifyMain(key, value) {
    if (window.__TAURI__) {
      window.__TAURI__.event.emit("settings-changed", { key: key, value: value });
    }
  }

  function spUpdate() {
    // 테마
    document.querySelectorAll("#sp-themes .sp-btn").forEach(function(btn) {
      btn.classList.toggle("active", btn.dataset.theme === settings.get("theme"));
    });
    // 모드
    document.querySelectorAll(".sp-mode-btn").forEach(function(btn) {
      btn.classList.toggle("active", btn.dataset.mode === settings.get("gameMode"));
    });
    // 토글
    document.querySelectorAll(".sp-switch").forEach(function(sw) {
      sw.classList.toggle("on", !!settings.get(sw.dataset.key));
    });
  }
})();

// Silent Update — 토스 스타일: 자동 다운로드, 토스트만 살짝
(function() {
  if (!window.__TAURI__) return;
  var toast = document.getElementById("update-toast");
  var text = document.getElementById("toast-text");
  var bar = document.getElementById("toast-bar");

  function showToast(msg, duration) {
    text.textContent = msg;
    toast.classList.add("visible");
    if (duration) {
      setTimeout(function() { toast.classList.remove("visible"); }, duration);
    }
  }

  window.__TAURI__.event.listen("update-available", function(e) {
    showToast("⚡ updating...");
    bar.style.width = "0%";
    window.__TAURI__.core.invoke("install_update").catch(function() {
      toast.classList.remove("visible");
    });
  });

  window.__TAURI__.event.listen("update-progress", function(e) {
    var d = e.payload.downloaded;
    var t = e.payload.total;
    if (t) {
      bar.style.width = Math.round(d / t * 100) + "%";
    }
  });

  window.__TAURI__.event.listen("update-installed", function() {
    bar.style.width = "100%";
    showToast("✓ next launch", 3000);
  });
})();
