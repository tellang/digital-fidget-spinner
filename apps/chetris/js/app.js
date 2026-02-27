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
    // 메뉴가 열려있으면 메뉴만 닫기
    var menu = document.getElementById("ctx-menu");
    if (menu.style.display !== "none" && menu.style.display !== "") {
      menu.style.display = "none";
      return;
    }
    window.__TAURI__.core.invoke("exit_app");
  }
});

// 컨텍스트 메뉴
(function() {
  var menu = document.getElementById("ctx-menu");

  function updateState() {
    menu.querySelectorAll("[data-theme]").forEach(function(el) {
      var active = themes.active && themes.active.id === el.dataset.theme;
      el.classList.toggle("active", active);
      var t = themes.get(el.dataset.theme);
      if (t) el.style.color = active ? t.borderColor : "";
    });
    // 모드 상태 반영
    menu.querySelectorAll(".ctx-mode").forEach(function(el) {
      var active = settings.get("gameMode") === el.dataset.mode;
      el.classList.toggle("active", active);
    });
    menu.querySelectorAll(".ctx-toggle").forEach(function(el) {
      el.classList.toggle("checked", !!settings.get(el.dataset.key));
    });
  }

  // 우클릭 → 메뉴 표시
  document.addEventListener("contextmenu", function(e) {
    e.preventDefault();
    updateState();
    menu.style.display = "block";
    var x = Math.min(e.clientX, window.innerWidth - menu.offsetWidth - 2);
    var y = Math.min(e.clientY, window.innerHeight - menu.offsetHeight - 2);
    menu.style.left = Math.max(2, x) + "px";
    menu.style.top = Math.max(2, y) + "px";
  });

  // 좌클릭 외부 → 메뉴 닫기
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
