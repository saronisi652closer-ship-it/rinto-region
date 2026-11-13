/* pad.js — 仮想ゲームパッド(UI) / 画面レイアウト / 設定画面
 *
 * このファイルは「見た目と配置」だけを担当し、押下は Input.press / Input.release に渡すだけ。
 * ゲーム内部の処理（game.js）は仮想パッドの存在を知らない。
 */
(function () {
  "use strict";

  const GW = 240, GH = 160;                 // ゲーム画面の内部解像度
  const KEY = "mitomon_pad_settings_v1";
  const IDS = ["dpad", "a", "b", "l", "r", "start", "select", "menu"];
  const DEFAULTS = { mode: "auto", opacity: 0.6, scale: 1, vibrate: true, hideOnGamepad: true, swapAB: false, offsets: {} };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // ── 設定の保存/読み込み（端末内 localStorage）──
  function sanitize(o) {
    o = o && typeof o === "object" ? o : {};
    const s = Object.assign({}, DEFAULTS, { offsets: {} });
    if (["auto", "always", "hidden"].includes(o.mode)) s.mode = o.mode;
    if (typeof o.opacity === "number" && isFinite(o.opacity)) s.opacity = clamp(o.opacity, 0.15, 1);
    if (typeof o.scale === "number" && isFinite(o.scale)) s.scale = clamp(o.scale, 0.6, 1.6);
    for (const k of ["vibrate", "hideOnGamepad", "swapAB"]) if (typeof o[k] === "boolean") s[k] = o[k];
    if (o.offsets && typeof o.offsets === "object") {
      for (const id of IDS) {
        const v = o.offsets[id];
        if (v && isFinite(v.x) && isFinite(v.y)) s.offsets[id] = { x: clamp(v.x, -1, 1), y: clamp(v.y, -1, 1) };
      }
    }
    return s;
  }
  function load() {
    try { return sanitize(JSON.parse(localStorage.getItem(KEY) || "{}")); }
    catch (_) { return sanitize({}); }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (_) { /* 保存できなくても動作は続ける */ }
  }
  let S = load();
  Input.config.swapAB = S.swapAB;

  // ── DOM構築 ──
  const canvas = document.getElementById("game");
  const hud = document.getElementById("playerHud");

  const root = document.createElement("div");
  root.id = "pad";
  root.innerHTML = [
    '<div id="padInner">',
    '  <div class="pc" id="pc-dpad"><i class="arm up">▲</i><i class="arm left">◀</i><i class="arm right">▶</i><i class="arm down">▼</i><i class="hub"></i></div>',
    '  <div class="pc round" id="pc-b">B</div>',
    '  <div class="pc round" id="pc-a">A</div>',
    '  <div class="pc pill" id="pc-l">L</div>',
    '  <div class="pc pill" id="pc-r">R</div>',
    '  <div class="pc pill" id="pc-select">SELECT</div>',
    '  <div class="pc pill" id="pc-start">START</div>',
    '  <div class="pc round gear" id="pc-menu" aria-label="メニュー・設定">⚙</div>',
    "</div>",
  ].join("");
  document.body.appendChild(root);
  const inner = root.querySelector("#padInner");
  const el = {};
  IDS.forEach((id) => { el[id] = root.querySelector("#pc-" + id); });

  const editBar = document.createElement("div");
  editBar.id = "editBar";
  editBar.hidden = true;
  editBar.innerHTML = '<span>ボタンをドラッグして移動</span><button type="button" data-e="reset">リセット</button><button type="button" data-e="done">かんりょう</button>';
  document.body.appendChild(editBar);

  const settingsEl = document.createElement("div");
  settingsEl.id = "settings";
  settingsEl.hidden = true;
  settingsEl.innerHTML = [
    '<div class="sheet" role="dialog" aria-label="せってい">',
    '  <div class="sh-head"><b>せってい</b><button type="button" data-s="close" aria-label="とじる">✕</button></div>',
    '  <div class="sh-body scrollable">',
    '    <section><h3>仮想パッドの表示</h3>',
    '      <label class="opt"><input type="radio" name="padmode" value="always"> 常時表示 <small>すべての画面で表示</small></label>',
    '      <label class="opt"><input type="radio" name="padmode" value="auto"> 自動表示 <small>フィールドで表示 / 戦闘では薄く</small></label>',
    '      <label class="opt"><input type="radio" name="padmode" value="hidden"> 非表示 <small>画面タッチで操作</small></label>',
    '      <label class="chk"><input type="checkbox" id="s-hidegp"> ゲームパッド接続中は隠す（自動表示のとき）</label>',
    "    </section>",
    '    <section><h3>見た目</h3>',
    '      <label class="rng">とうめいど <output id="o-op"></output><input type="range" id="s-op" min="15" max="100" step="5"></label>',
    '      <label class="rng">ボタンサイズ <output id="o-sc"></output><input type="range" id="s-sc" min="60" max="160" step="5"></label>',
    '      <div class="row"><button type="button" data-s="edit">配置を調整</button><button type="button" data-s="resetpos">配置リセット</button></div>',
    "    </section>",
    '    <section><h3>そのほか</h3>',
    '      <label class="chk"><input type="checkbox" id="s-vib"> ボタンを押したとき振動する</label>',
    '      <label class="chk"><input type="checkbox" id="s-swap"> ゲームパッドのA/Bを入れ替える</label>',
    '      <div class="note">ゲームパッド: <b id="s-gp">未接続</b>（初期: 右ボタン=A / 下ボタン=B）</div>',
    '      <div class="row"><button type="button" data-s="reset">初期設定にもどす</button></div>',
    "    </section>",
    '    <section class="keys"><h3>キーボード</h3>',
    '      <div class="note">矢印/WASD=移動　Z・Enter・Space=A　X・Esc=B　Q/E=L/R　Shift=SELECT　P=START　M=メニュー</div>',
    "    </section>",
    "  </div>",
    "</div>",
  ].join("");
  document.body.appendChild(settingsEl);

  // ── 状態 ──
  let editing = false;
  let settingsOpen = false;
  let def = {};     // 各ボタンの初期配置 {id:{l,t,w,h}}
  let innerBox = { w: 0, h: 0 };

  // ── 表示ルール ──
  function gp() { return Input.gamepadConnected; }
  function computeVis() {
    const scene = document.body.dataset.scene || "field";
    if (S.mode === "hidden") return "none";
    if (S.mode === "always") return "full";
    if (S.hideOnGamepad && gp()) return "none";
    return scene === "field" ? "full" : "dim"; // 戦闘/結果ではタッチ優先で薄く表示
  }
  function stripOn() {
    return editing || S.mode === "always" || (S.mode === "auto" && !(S.hideOnGamepad && gp()));
  }
  function applyVis() {
    root.classList.remove("vis-full", "vis-dim", "vis-none");
    root.classList.add("vis-" + computeVis());
    root.classList.toggle("edit", editing);
    root.style.setProperty("--pad-op", String(S.opacity));
  }

  // ── レイアウト：ゲーム画面を画面内に100%フィットさせ、左右の余白にボタンを配置 ──
  function layout() {
    const box = inner.getBoundingClientRect();
    const IW = box.width, IH = box.height;
    if (!IW || !IH) return;
    innerBox = { w: IW, h: IH };
    const portrait = IH > IW;

    const strip = stripOn() ? clamp(Math.round(IH * 0.1), 30, 40) : 0; // START/SELECT用の帯
    const availH = IH - strip;
    const sc = Math.min(IW / GW, availH / GH);
    const cw = GW * sc, ch = GH * sc;
    const cl = (IW - cw) / 2;

    if (strip) {
      hud.style.display = "block";
      hud.style.left = box.left + Math.max(cl, 6) + "px";
      hud.style.top = box.top + IH - strip + (strip - 14) / 2 + "px";
    } else {
      hud.style.display = "none";
    }

    // 左右余白に収まる大きさ（縦画面は画面幅基準）
    const M = Math.max(0, (IW - cw) / 2);
    let D0 = portrait ? Math.min(IW * 0.42, 176) : Math.min(M * 0.94, availH * 0.5, 176);
    D0 = Math.max(D0, 88);
    const D = D0 * S.scale;
    const gap = portrait ? 8 : Math.max(4, (M - D) / 2);
    const edge = Math.max(8, gap);
    const bottomY = portrait ? IH - strip - D - 6 : IH - D - 10;

    def = {};
    def.dpad = { l: gap, t: bottomY, w: D, h: D };
    const abL = IW - D - gap;
    def.b = { l: abL + D * 0.02, t: bottomY + D * 0.48, w: D * 0.42, h: D * 0.42 };
    def.a = { l: abL + D * 0.54, t: bottomY + D * 0.1, w: D * 0.42, h: D * 0.42 };

    const m = clamp(D * 0.3, 34, 48);
    // 縦画面は⚙の下にゲーム画面を置く（横画面は上下中央）
    const ct = portrait ? 8 + m + 8 : (availH - ch) / 2;
    canvas.style.width = cw + "px";
    canvas.style.height = ch + "px";
    canvas.style.left = box.left + cl + "px";
    canvas.style.top = box.top + ct + "px";
    def.menu = { l: edge, t: 8, w: m, h: m };
    const pw = clamp(D * 0.62, 56, Math.max(56, M - 14));
    const ph = clamp(D * 0.24, 30, 40);
    const lrTop = portrait ? ct + ch + 8 : 8 + m + 8;
    def.l = { l: edge, t: lrTop, w: pw, h: ph };
    def.r = { l: IW - edge - pw, t: lrTop, w: pw, h: ph };

    const sh = Math.max(24, strip - 6);
    const sw = clamp(84 * S.scale, 64, 130);
    const gapSS = 10;
    const ssTop = IH - strip + (strip - sh) / 2;
    def.select = { l: IW / 2 - gapSS / 2 - sw, t: ssTop, w: sw, h: sh };
    def.start = { l: IW / 2 + gapSS / 2, t: ssTop, w: sw, h: sh };

    for (const id of IDS) {
      const d = def[id];
      const o = S.offsets[id] || { x: 0, y: 0 };
      const l = clamp(d.l + o.x * IW, 0, Math.max(0, IW - d.w));
      const t = clamp(d.t + o.y * IH, 0, Math.max(0, IH - d.h));
      const e = el[id];
      e.style.left = l + "px";
      e.style.top = t + "px";
      e.style.width = d.w + "px";
      e.style.height = d.h + "px";
    }
    el.a.style.fontSize = el.b.style.fontSize = D * 0.17 + "px";
    el.l.style.fontSize = el.r.style.fontSize = D * 0.13 + "px";
    el.start.style.fontSize = el.select.style.fontSize = Math.max(10, sh * 0.42) + "px";
    el.menu.style.fontSize = m * 0.55 + "px";
    el.dpad.style.fontSize = D * 0.13 + "px";
  }

  function refresh() { applyVis(); layout(); }

  // ── 触る処理（操作中は Input に渡し、配置調整中はドラッグ移動）──
  let awakeT = 0;
  function awake() {
    root.classList.add("awake");
    clearTimeout(awakeT);
    awakeT = setTimeout(() => root.classList.remove("awake"), 1800);
  }
  function haptic() {
    if (S.vibrate && navigator.vibrate) { try { navigator.vibrate(12); } catch (_) { /* noop */ } }
  }

  function bindControl(id, h) {
    const e = el[id];
    const drag = {};
    e.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      try { e.setPointerCapture(ev.pointerId); } catch (_) { /* noop */ }
      if (editing) {
        drag[ev.pointerId] = { sx: ev.clientX, sy: ev.clientY, l: parseFloat(e.style.left), t: parseFloat(e.style.top) };
        return;
      }
      awake();
      haptic();
      h.down(ev);
    });
    e.addEventListener("pointermove", (ev) => {
      if (editing) {
        const d = drag[ev.pointerId];
        if (!d) return;
        const dd = def[id];
        const l = clamp(d.l + ev.clientX - d.sx, 0, Math.max(0, innerBox.w - dd.w));
        const t = clamp(d.t + ev.clientY - d.sy, 0, Math.max(0, innerBox.h - dd.h));
        e.style.left = l + "px";
        e.style.top = t + "px";
        S.offsets[id] = { x: (l - dd.l) / innerBox.w, y: (t - dd.t) / innerBox.h };
        return;
      }
      if (h.move) h.move(ev);
    });
    const end = (ev) => {
      if (editing) {
        if (drag[ev.pointerId]) { delete drag[ev.pointerId]; save(); }
        return;
      }
      h.up(ev);
    };
    ["pointerup", "pointercancel", "lostpointercapture"].forEach((t) => e.addEventListener(t, end));
  }

  function bindAct(id, action) {
    const active = new Set();
    bindControl(id, {
      down(ev) { active.add(ev.pointerId); el[id].classList.add("down"); Input.press(action, "pad:" + ev.pointerId); },
      up(ev) {
        if (!active.delete(ev.pointerId)) return;
        Input.release(action, "pad:" + ev.pointerId);
        if (!active.size) el[id].classList.remove("down");
      },
    });
  }
  bindAct("a", "a");
  bindAct("b", "b");
  bindAct("l", "l");
  bindAct("r", "r");
  bindAct("start", "start");
  bindAct("select", "select");
  bindAct("menu", "menu");

  // 十字キー：1つのタッチ領域。指を滑らせて方向を変えられる。
  const dp = {}; // pointerId -> 方向 or null
  const arms = {};
  ["up", "down", "left", "right"].forEach((d) => { arms[d] = el.dpad.querySelector(".arm." + d); });
  function dirOf(ev) {
    const r = el.dpad.getBoundingClientRect();
    const dx = ev.clientX - (r.left + r.width / 2);
    const dy = ev.clientY - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) < r.width * 0.1) return null;
    return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "up" : "down");
  }
  function paintArms() {
    const on = new Set(Object.values(dp));
    for (const d in arms) arms[d].classList.toggle("on", on.has(d));
  }
  function setDir(ev) {
    const next = dirOf(ev);
    const cur = dp[ev.pointerId];
    if (next === cur) return;
    if (cur) Input.release(cur, "pad:" + ev.pointerId);
    dp[ev.pointerId] = next;
    if (next) Input.press(next, "pad:" + ev.pointerId);
    paintArms();
  }
  bindControl("dpad", {
    down(ev) { dp[ev.pointerId] = null; setDir(ev); },
    move(ev) { if (ev.pointerId in dp) setDir(ev); },
    up(ev) {
      if (!(ev.pointerId in dp)) return;
      const cur = dp[ev.pointerId];
      delete dp[ev.pointerId];
      if (cur) Input.release(cur, "pad:" + ev.pointerId);
      paintArms();
    },
  });

  // ── 設定画面 ──
  const $ = (sel) => settingsEl.querySelector(sel);
  function syncUI() {
    settingsEl.querySelectorAll('input[name="padmode"]').forEach((r) => { r.checked = r.value === S.mode; });
    $("#s-hidegp").checked = S.hideOnGamepad;
    $("#s-op").value = Math.round(S.opacity * 100);
    $("#o-op").textContent = Math.round(S.opacity * 100) + "%";
    $("#s-sc").value = Math.round(S.scale * 100);
    $("#o-sc").textContent = Math.round(S.scale * 100) + "%";
    $("#s-vib").checked = S.vibrate;
    $("#s-swap").checked = S.swapAB;
    $("#s-gp").textContent = gp() ? "接続中" : "未接続";
  }
  function updateBlock() { Input.setBlocked(settingsOpen || editing); }

  let openedAt = 0;
  function openSettings() {
    if (settingsOpen || editing) return;
    settingsOpen = true;
    openedAt = performance.now();
    Input.releaseAll();
    updateBlock();
    syncUI();
    settingsEl.hidden = false;
  }
  function closeSettings() {
    if (!settingsOpen) return;
    settingsOpen = false;
    settingsEl.hidden = true;
    updateBlock();
    save();
  }
  function startEdit() {
    closeSettings();
    editing = true;
    editBar.hidden = false;
    updateBlock();
    refresh();
  }
  function endEdit() {
    editing = false;
    editBar.hidden = true;
    updateBlock();
    save();
    refresh();
  }

  // 開いた直後は、メニューを押した指の「あとから来るクリック」が背景に当たって閉じないよう無視する
  settingsEl.addEventListener("click", (e) => {
    if (performance.now() - openedAt < 450) { e.stopPropagation(); e.preventDefault(); }
  }, true);
  settingsEl.addEventListener("click", (e) => { if (e.target === settingsEl) closeSettings(); });
  settingsEl.addEventListener("click", (e) => {
    const b = e.target.closest("[data-s]");
    if (!b) return;
    const a = b.dataset.s;
    if (a === "close") closeSettings();
    else if (a === "edit") startEdit();
    else if (a === "resetpos") { S.offsets = {}; save(); refresh(); }
    else if (a === "reset") { S = sanitize({}); Input.config.swapAB = S.swapAB; save(); syncUI(); refresh(); }
  });
  editBar.addEventListener("click", (e) => {
    const b = e.target.closest("[data-e]");
    if (!b) return;
    if (b.dataset.e === "done") endEdit();
    else { S.offsets = {}; save(); refresh(); }
  });
  settingsEl.querySelectorAll('input[name="padmode"]').forEach((r) =>
    r.addEventListener("change", () => { if (r.checked) { S.mode = r.value; save(); refresh(); } }));
  $("#s-hidegp").addEventListener("change", (e) => { S.hideOnGamepad = e.target.checked; save(); refresh(); });
  $("#s-op").addEventListener("input", (e) => {
    S.opacity = clamp(Number(e.target.value) / 100, 0.15, 1);
    $("#o-op").textContent = Math.round(S.opacity * 100) + "%";
    save(); applyVis();
  });
  $("#s-sc").addEventListener("input", (e) => {
    S.scale = clamp(Number(e.target.value) / 100, 0.6, 1.6);
    $("#o-sc").textContent = Math.round(S.scale * 100) + "%";
    save(); layout();
  });
  $("#s-vib").addEventListener("change", (e) => {
    S.vibrate = e.target.checked; save();
    if (S.vibrate && navigator.vibrate) { try { navigator.vibrate(30); } catch (_) { /* noop */ } }
  });
  $("#s-swap").addEventListener("change", (e) => { S.swapAB = e.target.checked; Input.config.swapAB = S.swapAB; save(); });

  // MENU / START でメニュー(設定)を開閉。設定画面・配置調整中は B でも閉じられる。
  Input.on((ev) => {
    if (ev.type === "source") { if (settingsOpen) syncUI(); refresh(); return; }
    if (ev.type !== "press" || ev.repeat) return;
    const a = ev.action;
    if (editing) { if (a === "b" || a === "menu" || a === "start") endEdit(); return; }
    if (a === "menu" || a === "start") { settingsOpen ? closeSettings() : openSettings(); }
    else if (a === "b" && settingsOpen) closeSettings();
  }, { always: true });

  window.addEventListener("resize", layout);
  window.addEventListener("orientationchange", () => setTimeout(layout, 200));
  if (window.visualViewport) window.visualViewport.addEventListener("resize", layout);

  window.PadUI = {
    refresh, openSettings, closeSettings,
    get settings() { return S; },
  };

  refresh();
})();
