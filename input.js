/* input.js — 入力の共通化レイヤー
 *
 * 入力源（キーボード / 仮想パッド / 外部ゲームパッド / 画面タッチ）はすべてここに集約される。
 * ゲーム側は Input.on(handler) で受け取るイベントだけを見ればよく、
 * 入力方法を増やしたいときは Input.press / Input.release / (canvasのpointer) に流し込むだけ。
 *
 * イベント:
 *   { type:"press",   action, repeat }            ボタンが押された。方向キーは長押しで repeat:true が連続発火
 *   { type:"release", action }
 *   { type:"pointer", phase:"down|move|up", id, x, y }   ゲーム画面(240x160座標)上のタッチ/クリック
 *   { type:"source" }                              ゲームパッドの接続状態が変わった
 *
 * アクション: up down left right a b l r start select menu
 */
(function () {
  "use strict";

  const ACTIONS = ["up", "down", "left", "right", "a", "b", "l", "r", "start", "select", "menu"];
  const DIRS = ["up", "down", "left", "right"];
  const REPEAT_DELAY = 260; // 長押し開始までの待ち(ms)
  const REPEAT_RATE = 120;  // 連続移動の間隔(ms)

  const config = { swapAB: false }; // 外部ゲームパッドのA/B入れ替え（pad.jsの設定から更新される）

  const holders = Object.create(null); // action -> Set(入力源ID)  同時押し・複数指に対応
  const timers = Object.create(null);  // action -> {delay, rate}
  const handlers = [];
  let blocked = false;                 // 設定画面などの間、ゲームへ入力を流さない

  function emit(ev) {
    for (const h of handlers.slice()) {
      if (blocked && !h.always) continue;
      try { h.fn(ev); } catch (err) { console.error(err); }
    }
  }

  function on(fn, opts) {
    const h = { fn, always: !!(opts && opts.always) };
    handlers.push(h);
    return () => { const i = handlers.indexOf(h); if (i >= 0) handlers.splice(i, 1); };
  }

  function isDown(action) {
    const s = holders[action];
    return !!(s && s.size);
  }

  function startRepeat(action) {
    stopRepeat(action);
    const t = {};
    t.delay = setTimeout(() => {
      t.rate = setInterval(() => {
        if (isDown(action)) emit({ type: "press", action, repeat: true });
      }, REPEAT_RATE);
    }, REPEAT_DELAY);
    timers[action] = t;
  }

  function stopRepeat(action) {
    const t = timers[action];
    if (!t) return;
    clearTimeout(t.delay);
    clearInterval(t.rate);
    delete timers[action];
  }

  function press(action, source) {
    if (!ACTIONS.includes(action)) return;
    source = source || "?";
    const set = holders[action] || (holders[action] = new Set());
    const was = set.size > 0;
    set.add(source);
    if (was) return; // すでに別の入力源で押されている
    emit({ type: "press", action, repeat: false });
    if (DIRS.includes(action)) startRepeat(action);
  }

  function release(action, source) {
    const set = holders[action];
    if (!set) return;
    set.delete(source || "?");
    if (set.size === 0) {
      stopRepeat(action);
      emit({ type: "release", action });
    }
  }

  function releaseAll() {
    for (const action of ACTIONS) {
      const set = holders[action];
      if (set && set.size) {
        set.clear();
        stopRepeat(action);
        emit({ type: "release", action });
      }
    }
  }

  function setBlocked(v) { blocked = !!v; }

  // ── キーボード ──
  const KEYS = {
    ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
    w: "up", s: "down", a: "left", d: "right",
    Enter: "a", " ": "a", z: "a",
    Escape: "b", Backspace: "b", x: "b",
    q: "l", e: "r",
    Shift: "select", p: "start", m: "menu",
  };

  function keyName(e) { return e.key.length === 1 ? e.key.toLowerCase() : e.key; }

  window.addEventListener("keydown", (e) => {
    const t = e.target;
    const isForm = t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
    const k = keyName(e);
    if (isForm && k !== "Escape") return;
    const action = KEYS[k];
    if (!action) return;
    e.preventDefault();
    if (e.repeat) return; // 連続入力は自前のリピートで処理
    press(action, "kbd:" + k);
  });
  window.addEventListener("keyup", (e) => {
    const k = keyName(e);
    const action = KEYS[k];
    if (action) release(action, "kbd:" + k);
  });

  // ── 外部ゲームパッド（Gamepad API）──
  // 標準マッピング: 0=下 1=右 4=L1 5=R1 8=SELECT 9=START 12-15=十字 / 左スティック
  let padCount = 0;
  let pollId = 0;
  let prevPad = new Set();

  function padActions(gp) {
    const out = [];
    const b = gp.buttons || [];
    const down = (i) => b[i] && (b[i].pressed || b[i].value > 0.6);
    const A = config.swapAB ? 0 : 1; // 初期: 右ボタン=A(決定) / 下ボタン=B(キャンセル)
    const B = config.swapAB ? 1 : 0;
    if (down(A)) out.push("a");
    if (down(B)) out.push("b");
    if (down(4)) out.push("l");
    if (down(5)) out.push("r");
    if (down(8)) out.push("select");
    if (down(9)) out.push("start");
    if (down(16)) out.push("menu");
    if (down(12)) out.push("up");
    if (down(13)) out.push("down");
    if (down(14)) out.push("left");
    if (down(15)) out.push("right");
    const ax = (gp.axes && gp.axes[0]) || 0;
    const ay = (gp.axes && gp.axes[1]) || 0;
    if (Math.max(Math.abs(ax), Math.abs(ay)) > 0.55) {
      if (Math.abs(ax) > Math.abs(ay)) out.push(ax < 0 ? "left" : "right");
      else out.push(ay < 0 ? "up" : "down");
    }
    return out;
  }

  function poll() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const now = new Set();
    for (const gp of pads) {
      if (!gp || !gp.connected) continue;
      for (const a of padActions(gp)) now.add(a + "|gp" + gp.index);
    }
    for (const k of now) {
      if (!prevPad.has(k)) { const [a, src] = k.split("|"); press(a, src); }
    }
    for (const k of prevPad) {
      if (!now.has(k)) { const [a, src] = k.split("|"); release(a, src); }
    }
    prevPad = now;
    pollId = padCount > 0 ? requestAnimationFrame(poll) : 0;
  }

  function countPads() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let n = 0;
    for (const gp of pads) if (gp && gp.connected) n++;
    return n;
  }

  function padChanged() {
    padCount = countPads();
    if (padCount > 0 && !pollId) pollId = requestAnimationFrame(poll);
    emit({ type: "source" });
  }

  window.addEventListener("gamepadconnected", padChanged);
  window.addEventListener("gamepaddisconnected", () => {
    setTimeout(() => {
      padChanged();
      if (padCount === 0) {
        for (const k of prevPad) { const [a, src] = k.split("|"); release(a, src); }
        prevPad = new Set();
      }
    }, 0);
  });

  // ── ゲーム画面(canvas)のタッチ/クリック ──
  function attachCanvas(canvas, w, h) {
    const xy = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (w / r.width), y: (e.clientY - r.top) * (h / r.height) };
    };
    canvas.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
      emit(Object.assign({ type: "pointer", phase: "down", id: e.pointerId }, xy(e)));
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!canvas.hasPointerCapture || !canvas.hasPointerCapture(e.pointerId)) return;
      emit(Object.assign({ type: "pointer", phase: "move", id: e.pointerId }, xy(e)));
    });
    const up = (e) => emit(Object.assign({ type: "pointer", phase: "up", id: e.pointerId }, xy(e)));
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
  }

  // ── 誤スクロール・誤拡大の防止 ──
  ["gesturestart", "gesturechange", "gestureend"].forEach((t) =>
    document.addEventListener(t, (e) => e.preventDefault()));
  document.addEventListener("touchmove", (e) => {
    if (e.target.closest && e.target.closest(".scrollable, input, select")) return;
    e.preventDefault();
  }, { passive: false });
  document.addEventListener("dblclick", (e) => e.preventDefault());
  document.addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("wheel", (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });

  // 画面を離れた/フォーカスが外れたとき、押しっぱなしを解除
  window.addEventListener("blur", releaseAll);
  document.addEventListener("visibilitychange", () => { if (document.hidden) releaseAll(); });

  padChanged();

  window.Input = {
    ACTIONS, config, on, press, release, releaseAll, isDown, setBlocked, attachCanvas,
    get gamepadConnected() { return padCount > 0; },
  };
})();
