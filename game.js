const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const W = 240, H = 160;
const TILE = 16;

// プレイヤー画像
const playerImg = new Image();
playerImg.src = "./player.png";
playerImg.onload = () => draw();

// 御三家画像
const monImages = {};
["フラメル","ヴァッサ","ケイム"].forEach(name => {
  const img = new Image();
  img.src = "./assets/" + encodeURIComponent(name) + ".png";
  img.onload = () => draw();
  monImages[name] = img;
});

// マップ
const MAP = [
  "################",
  "#......GGG.....#",
  "#..####...###..#",
  "#..#..#...#.#..#",
  "#..#..#...#.#..#",
  "#..####...###..#",
  "#..............#",
  "################"
].map(row => row.slice(0,16));

// ミトモンデータ
const MONS = {
  フラメル: { maxHp: 35, atk: 8,  def: 5,  move: "ひのこ" },
  ヴァッサ: { maxHp: 32, atk: 7,  def: 6,  move: "みずでっぽう" },
  ケイム:   { maxHp: 38, atk: 6,  def: 7,  move: "はっぱカッター" },
};

// 自分（フラメル固定）
const PLAYER_MON = {
  name: "フラメル",
  maxHp: 35,
  hp: 35,
  atk: 8,
  def: 5,
  move: "ひのこ",
};

const state = {
  mode: "field",   // "field" / "battle" / "result"
  msg: "",
  msgQueue: [],
  player: { x: 2, y: 2 },
  playerMon: { ...PLAYER_MON },
  enemy: null,
  result: "",       // "win" / "lose"
  waitInput: false, // メッセージ送り待ち
  battlePhase: "select", // "select" / "anim" / "end"
  cursor: 0,        // コマンド選択のカーソル位置（BATTLE_MENUの添字）
};

function tileAt(x,y){
  if(y<0||y>=MAP.length) return "#";
  if(x<0||x>=MAP[y].length) return "#";
  return MAP[y][x];
}

function tryMove(dx,dy){
  if(state.mode !== "field") return;
  const nx = state.player.x + dx;
  const ny = state.player.y + dy;
  if(tileAt(nx,ny)==="#") return;
  state.player.x = nx;
  state.player.y = ny;
  if(tileAt(nx,ny)==="G" && Math.random()<0.20) startBattle();
  draw();
}

function startBattle(){
  const names = ["フラメル","ヴァッサ","ケイム"];
  const ename = names[Math.floor(Math.random()*names.length)];
  const base = MONS[ename];
  state.enemy = { name: ename, maxHp: base.maxHp, hp: base.maxHp,
                  atk: base.atk, def: base.def, move: base.move };
  state.playerMon = { ...PLAYER_MON };
  state.mode = "battle";
  state.battlePhase = "select";
  state.cursor = 0;
  state.waitInput = false;
  pushMsg(`野生の${ename}が あらわれた！`, true);
}

// メッセージキュー
function pushMsg(text, waitAfter){
  state.msgQueue.push({ text, waitAfter: !!waitAfter });
  if(state.msgQueue.length === 1) showNextMsg();
}

function showNextMsg(){
  if(state.msgQueue.length === 0){
    state.msg = "";
    state.waitInput = false;
    draw();
    return;
  }
  const item = state.msgQueue.shift();
  state.msg = item.text;
  state.waitInput = item.waitAfter;
  draw();
  if(!item.waitAfter){
    setTimeout(()=>{ showNextMsg(); }, 900);
  }
}

function advanceMsg(){
  if(!state.waitInput) return;
  state.waitInput = false;
  // エンカウントメッセージの後 → select フェーズへ
  if(state.battlePhase === "select" && state.msgQueue.length === 0){
    state.msg = "どうする？";
    draw();
    return;
  }
  showNextMsg();
}

// ダメージ計算（簡易）
function calcDmg(atk, def){
  const base = Math.max(1, atk - Math.floor(def/2));
  return base + Math.floor(Math.random()*3);
}

function doPlayerAttack(){
  state.battlePhase = "anim";
  const dmg = calcDmg(state.playerMon.atk, state.enemy.def);
  state.enemy.hp = Math.max(0, state.enemy.hp - dmg);
  pushMsg(`フラメルの ${state.playerMon.move}！`, false);
  pushMsg(`${state.enemy.name}に ${dmg}ダメージ！`, true);

  if(state.enemy.hp <= 0){
    state.battlePhase = "end";
    pushMsg(`野生の${state.enemy.name}は たおれた！`, false);
    pushMsg(`しょうり！`, true);
    state._nextResult = "win";
  } else {
    // 敵の攻撃
    setTimeout(()=>{ doEnemyAttack(); }, 1800);
  }
}

function doEnemyAttack(){
  if(state.mode !== "battle" || !state.enemy) return; // 戦闘が終わっていたら何もしない
  const dmg = calcDmg(state.enemy.atk, state.playerMon.def);
  state.playerMon.hp = Math.max(0, state.playerMon.hp - dmg);
  pushMsg(`${state.enemy.name}の ${state.enemy.move}！`, false);
  pushMsg(`フラメルに ${dmg}ダメージ！`, true);

  if(state.playerMon.hp <= 0){
    state.battlePhase = "end";
    pushMsg(`フラメルは たおれた！`, false);
    pushMsg(`まけてしまった…`, true);
    state._nextResult = "lose";
  } else {
    // ダメージメッセージを送り終えると advanceMsg() が「どうする？」を出す
    // （メッセージ表示中にコマンドが押せてしまうのを防ぐ）
    state.battlePhase = "select";
  }
}

function endBattle(){
  // にげる
  state.mode = "field";
  state.msg = "";
  state.msgQueue = [];
  state.waitInput = false;
  state.enemy = null;
  draw();
}

function goResult(){
  state.mode = "result";
  state.result = state._nextResult;
  draw();
}

// ── 描画 ──

// 半透明の枠つきメッセージボックス
function drawBox(text,x,y,w,h){
  ctx.fillStyle="rgba(0,0,0,0.78)";
  ctx.fillRect(x,y,w,h);
  ctx.strokeStyle="#cfcfcf";
  ctx.lineWidth=2;
  ctx.strokeRect(x+1,y+1,w-2,h-2);
  ctx.lineWidth=1;
  ctx.fillStyle="#fff";
  ctx.font="10px sans-serif";
  ctx.fillText(text, x+8, y+Math.floor(h/2)+4);
}

function drawField(){
  ctx.clearRect(0,0,W,H);
  for(let y=0;y<MAP.length;y++){
    for(let x=0;x<MAP[y].length;x++){
      const t=MAP[y][x];
      ctx.fillStyle = t==="#" ? "#0f2a1a" : t==="G" ? "#1f7a2f" : "#66aa66";
      ctx.fillRect(x*TILE,y*TILE,TILE,TILE);
    }
  }
  ctx.fillStyle="#ff3b30";
  ctx.fillRect(state.player.x*TILE, state.player.y*TILE, TILE, TILE);
  drawBox("フィールド  矢印/タッチで移動", 4,4,W-8,22);
}

function drawHpBar(x,y,w,hp,maxHp){
  // ラベル
  ctx.fillStyle="#fff";
  ctx.font="8px sans-serif";
  ctx.fillText(`HP`, x, y+8);
  // 外枠
  ctx.strokeStyle="#fff";
  ctx.strokeRect(x+14, y+1, w, 7);
  // バー
  const ratio = hp/maxHp;
  ctx.fillStyle = ratio>0.5 ? "#44dd44" : ratio>0.25 ? "#dddd22" : "#dd2222";
  ctx.fillRect(x+15, y+2, Math.floor((w-2)*ratio), 5);
  // 数値
  ctx.fillStyle="#fff";
  ctx.fillText(`${hp}/${maxHp}`, x+14+w+3, y+8);
}

function drawBattle(){
  ctx.clearRect(0,0,W,H);

  // 背景グラデ
  const grad = ctx.createLinearGradient(0,0,0,H);
  grad.addColorStop(0,"#1a2a4a");
  grad.addColorStop(1,"#0b0c10");
  ctx.fillStyle = grad;
  ctx.fillRect(0,0,W,H);

  // 地面ライン
  ctx.fillStyle="#2a3a2a";
  ctx.fillRect(0,90,W,10);
  ctx.fillStyle="#334433";
  ctx.fillRect(0,100,W,60);

  // 敵画像（右上）
  const eImg = monImages[state.enemy.name];
  if(eImg && eImg.complete && eImg.naturalWidth>0){
    ctx.drawImage(eImg, 138,10,70,70);
  } else {
    ctx.fillStyle="#4488ff";
    ctx.fillRect(138,10,70,70);
  }

  // 自分画像（左下）
  const pImg = monImages[state.playerMon.name];
  if(pImg && pImg.complete && pImg.naturalWidth>0){
    ctx.drawImage(pImg, 18,55,70,70);
  } else {
    ctx.fillStyle="#ff3b30";
    ctx.fillRect(18,55,70,70);
  }

  // 敵ステータス枠（左上）
  ctx.fillStyle="rgba(0,0,0,0.6)";
  ctx.fillRect(2,2,110,28);
  ctx.strokeStyle="#aaa";
  ctx.strokeRect(2,2,110,28);
  ctx.fillStyle="#fff";
  ctx.font="bold 9px sans-serif";
  ctx.fillText(`野生 ${state.enemy.name}`, 6,13);
  drawHpBar(4,14,62, state.enemy.hp, state.enemy.maxHp);

  // 自分ステータス枠（右下上部）
  ctx.fillStyle="rgba(0,0,0,0.6)";
  ctx.fillRect(128,78,110,28);
  ctx.strokeStyle="#aaa";
  ctx.strokeRect(128,78,110,28);
  ctx.fillStyle="#fff";
  ctx.font="bold 9px sans-serif";
  ctx.fillText(`フラメル`, 132,89);
  drawHpBar(130,90,62, state.playerMon.hp, state.playerMon.maxHp);

  // メッセージ枠
  ctx.fillStyle="rgba(0,0,0,0.82)";
  ctx.fillRect(2,112,W-4,44);
  ctx.strokeStyle="#fff";
  ctx.strokeRect(2,112,W-4,44);

  if(inCommandSelect()){
    // コマンド選択（BATTLE_MENU はタップ判定と共通）
    ctx.fillStyle="#fff";
    ctx.font="10px sans-serif";
    ctx.fillText("どうする？", 8,124);
    BATTLE_MENU.forEach((m,i)=>{
      const sel = i===state.cursor;
      ctx.fillStyle = sel ? "#ffe566" : "#aaa";
      ctx.fillRect(m.x,m.y,m.w,m.h);
      ctx.fillStyle="#000";
      ctx.font="bold 10px sans-serif";
      ctx.fillText(m.label, m.x+4, m.y+12);
      if(sel){ ctx.fillStyle="#ffe566"; ctx.fillText("▶", m.x-10, m.y+12); }
    });

    // 技名表示
    ctx.fillStyle="#ccc";
    ctx.font="9px sans-serif";
    ctx.fillText(`▶ ${state.playerMon.move}`, 8,140);

  } else {
    // メッセージ表示
    ctx.fillStyle="#fff";
    ctx.font="10px sans-serif";
    wrapText(state.msg, 8,126,W-16,13);
    if(state.waitInput){
      // ▼ 送りマーク
      ctx.fillStyle="#fff";
      ctx.font="10px sans-serif";
      ctx.fillText("▼", W-14,152);
    }
  }
}

function drawResult(){
  ctx.clearRect(0,0,W,H);
  const win = state.result==="win";
  ctx.fillStyle = win ? "#0a2a0a" : "#2a0a0a";
  ctx.fillRect(0,0,W,H);

  ctx.fillStyle = win ? "#44ff44" : "#ff4444";
  ctx.font = "bold 22px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(win ? "しょうり！" : "はいぼく…", W/2, 60);
  ctx.textAlign = "left";

  ctx.fillStyle="#fff";
  ctx.font="10px sans-serif";
  ctx.textAlign="center";
  ctx.fillText("Aボタン / タップで もどる", W/2, 100);
  ctx.textAlign="left";
}

function draw(){
  // 画面(シーン)が変わったら仮想パッドの表示を更新
  if(document.body.dataset.scene !== state.mode){
    document.body.dataset.scene = state.mode;
    if(window.PadUI) PadUI.refresh();
  }
  if(state.mode==="field") drawField();
  else if(state.mode==="battle") drawBattle();
  else drawResult();
}

function wrapText(text,x,y,maxWidth,lineHeight){
  const chars=text.split("");
  let line="";
  for(let i=0;i<chars.length;i++){
    const test=line+chars[i];
    if(ctx.measureText(test).width>maxWidth && i>0){
      ctx.fillText(line,x,y);
      line=chars[i];
      y+=lineHeight;
    } else { line=test; }
  }
  ctx.fillText(line,x,y);
}

// ── コマンド層（入力方法に依存しない）──
// 画面タッチ・仮想パッド・外部ゲームパッド・キーボードは、すべてこの層の関数を呼ぶ。
// 例：「たたかう」をタップしても、カーソルを合わせてAボタンを押しても、同じ BATTLE_MENU[i].run() が実行される。
// 戦闘の選択肢を増やす（技選択・対象選択など）ときは、BATTLE_MENU のようなメニュー定義を足せばよい。

const BATTLE_MENU = [
  { id:"fight", label:"たたかう", x:100, y:114, w:64, h:16, run:()=>doPlayerAttack() },
  { id:"run",   label:"にげる",   x:168, y:114, w:64, h:16, run:()=>endBattle() },
];

function inCommandSelect(){
  return state.mode==="battle" && state.battlePhase==="select" && !state.waitInput && state.msg==="どうする？";
}

function activateMenu(i){
  const m = BATTLE_MENU[i];
  if(!m || !inCommandSelect()) return;
  state.cursor = i;
  m.run();
}

function advanceOrResult(){
  if(state._nextResult) goResult();
  else advanceMsg();
}

// 決定（Aボタン / 画面タップ共通）
function cmdConfirm(){
  if(state.mode==="battle"){
    if(state.waitInput) advanceOrResult();      // メッセージ送り
    else activateMenu(state.cursor);            // コマンド決定
  } else if(state.mode==="result"){
    returnToField();
  }
}

// キャンセル（Bボタン）：コマンド選択中は「にげる」
function cmdCancel(){
  if(inCommandSelect()) activateMenu(BATTLE_MENU.findIndex(m=>m.id==="run"));
}

// カーソル移動
function cmdCursor(delta){
  if(!inCommandSelect()) return;
  state.cursor = (state.cursor + delta + BATTLE_MENU.length) % BATTLE_MENU.length;
  draw();
}

// 画面タップ（240x160座標）
function handleTap(x,y){
  if(state.mode==="battle"){
    if(state.waitInput){ cmdConfirm(); return; }
    if(inCommandSelect()){
      const i = BATTLE_MENU.findIndex(m=> x>=m.x && x<=m.x+m.w && y>=m.y && y<=m.y+m.h);
      if(i>=0) activateMenu(i);
    }
  } else if(state.mode==="result"){
    cmdConfirm();
  }
}

// フィールドの直接タッチ操作：触った方向へ移動、押し続けると連続移動
let touchHold = null;

function fieldDirFromPoint(x,y){
  const px = state.player.x*TILE + TILE/2;
  const py = state.player.y*TILE + TILE/2;
  const dx = x-px, dy = y-py;
  if(Math.hypot(dx,dy) < TILE*0.6) return null;
  return Math.abs(dx)>Math.abs(dy) ? [dx<0?-1:1, 0] : [0, dy<0?-1:1];
}

function stopTouchMove(id){
  if(!touchHold) return;
  if(id!==undefined && touchHold.id!==id) return;
  clearTimeout(touchHold.delay);
  clearInterval(touchHold.rate);
  touchHold = null;
}

function startTouchMove(ev){
  stopTouchMove();
  const hold = { id:ev.id, x:ev.x, y:ev.y };
  touchHold = hold;
  const step = ()=>{
    if(touchHold!==hold) return;
    if(state.mode!=="field"){ stopTouchMove(); return; }
    const d = fieldDirFromPoint(hold.x, hold.y);
    if(d) tryMove(d[0], d[1]);
  };
  step();
  hold.delay = setTimeout(()=>{ if(touchHold===hold) hold.rate = setInterval(step, 130); }, 260);
}

function onPointer(ev){
  if(ev.phase==="down"){
    if(state.mode==="field") startTouchMove(ev);
    else handleTap(ev.x, ev.y);
  } else if(ev.phase==="move"){
    if(touchHold && touchHold.id===ev.id){ touchHold.x = ev.x; touchHold.y = ev.y; }
  } else {
    stopTouchMove(ev.id);
  }
}

// ── 入力イベントの受け口（input.js から届く）──
const DIR_VEC = { up:[0,-1], down:[0,1], left:[-1,0], right:[1,0] };

function handleInput(ev){
  if(ev.type==="pointer") return onPointer(ev);
  if(ev.type!=="press") return;
  const a = ev.action;

  if(DIR_VEC[a]){
    if(state.mode==="field") return tryMove(DIR_VEC[a][0], DIR_VEC[a][1]); // 長押しで連続移動
    if(ev.repeat) return;
    return cmdCursor(a==="left"||a==="up" ? -1 : 1);
  }
  if(ev.repeat) return;
  if(a==="a") return cmdConfirm();
  if(a==="b") return cmdCancel();
  // l / r / select は今後の機能用に予約（menu / start は pad.js が設定画面を開く）
}

function returnToField(){
  stopTouchMove();
  state.mode="field";
  state.msg="";
  state.msgQueue=[];
  state.waitInput=false;
  state.enemy=null;
  state._nextResult=null;
  state.result="";
  state.battlePhase="select";
  state.cursor=0;
  draw();
}

Input.attachCanvas(canvas, W, H);
Input.on(handleInput);

draw();
