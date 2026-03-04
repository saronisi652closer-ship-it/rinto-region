const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const W = 240, H = 160;
const TILE = 16;

// マップ：#=壁、.=道、G=草むら
const MAP = [
  "################",
  "#......GGG.....#",
  "#..####...###..#",
  "#..#..#...#.#..#",
  "#..#..#...#.#..#",
  "#..####...###..#",
  "#...............".padEnd(16,"#"), // 念のため
  "################"
].map(row => row.slice(0,16));

const state = {
  mode: "field", // "field" or "battle"
  msg: "",
  player: { x: 2, y: 2 },
  enemyName: "",
};

function tileAt(x,y){
  if (y < 0 || y >= MAP.length) return "#";
  if (x < 0 || x >= MAP[y].length) return "#";
  return MAP[y][x];
}

function tryMove(dx,dy){
  if (state.mode !== "field") return;

  const nx = state.player.x + dx;
  const ny = state.player.y + dy;
  if (tileAt(nx,ny) === "#") return;

  state.player.x = nx;
  state.player.y = ny;

  // 草むらならエンカウント（20%）
  if (tileAt(nx,ny) === "G" && Math.random() < 0.20){
    startBattle();
  }
  draw();
}

function startBattle(){
  state.mode = "battle";
  const enemies = ["ムシっぽいの","トリっぽいの","ノーマルっぽいの"];
  state.enemyName = enemies[Math.floor(Math.random()*enemies.length)];
  state.msg = `野生の${state.enemyName}が あらわれた！`;
}

function endBattle(){
  state.mode = "field";
  state.msg = "";
  state.enemyName = "";
}

function drawField(){
  ctx.clearRect(0,0,W,H);

  for(let y=0; y<MAP.length; y++){
    for(let x=0; x<MAP[y].length; x++){
      const t = MAP[y][x];
      if (t === "#") ctx.fillStyle = "#0f2a1a";    // 壁（濃い緑）
      else if (t === "G") ctx.fillStyle = "#1f7a2f"; // 草
      else ctx.fillStyle = "#66aa66";             // 道
      ctx.fillRect(x*TILE, y*TILE, TILE, TILE);
    }
  }

  // プレイヤー
  ctx.fillStyle = "#ff3b30";
  ctx.fillRect(state.player.x*TILE, state.player.y*TILE, TILE, TILE);

  // 簡易UI
  drawBox("フィールド  矢印/タッチで移動", 4, 4, W-8, 22);
}

function drawBattle(){
  ctx.clearRect(0,0,W,H);

  // 背景
  ctx.fillStyle = "#1a1a2a";
  ctx.fillRect(0,0,W,H);

  // 敵（仮）
  ctx.fillStyle = "#f5d000";
  ctx.fillRect(160, 30, 48, 48);

  // 自分（仮）
  ctx.fillStyle = "#ff3b30";
  ctx.fillRect(32, 78, 48, 48);

  // メッセージ
  drawBox(state.msg || "どうする？", 6, 112, W-12, 42);

  // コマンド（簡易）
  drawButton("にげる", 156, 120, 78, 16);
}

function drawBox(text, x,y,w,h){
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.fillRect(x,y,w,h);
  ctx.strokeStyle = "#ffffff";
  ctx.strokeRect(x,y,w,h);

  ctx.fillStyle = "#fff";
  ctx.font = "10px sans-serif";
  wrapText(text, x+6, y+14, w-12, 12);
}

function drawButton(label, x,y,w,h){
  ctx.fillStyle = "#222";
  ctx.fillRect(x,y,w,h);
  ctx.strokeStyle = "#fff";
  ctx.strokeRect(x,y,w,h);
  ctx.fillStyle = "#fff";
  ctx.font = "10px sans-serif";
  ctx.fillText(label, x+8, y+12);
}

function wrapText(text, x, y, maxWidth, lineHeight){
  const words = text.split("");
  let line = "";
  for (let i=0; i<words.length; i++){
    const testLine = line + words[i];
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && i > 0){
      ctx.fillText(line, x, y);
      line = words[i];
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y);
}

function draw(){
  if (state.mode === "field") drawField();
  else drawBattle();
}

document.addEventListener("keydown", (e) => {
  if (state.mode === "field"){
    if (e.key === "ArrowUp") tryMove(0,-1);
    if (e.key === "ArrowDown") tryMove(0, 1);
    if (e.key === "ArrowLeft") tryMove(-1,0);
    if (e.key === "ArrowRight") tryMove( 1,0);
  } else {
    // バトル中：Esc or Enter で逃げる
    if (e.key === "Escape" || e.key === "Enter") { endBattle(); draw(); }
  }
});

// タッチD-Pad
document.querySelectorAll(".pad button").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    const d = btn.dataset.dir;
    if (d==="up") tryMove(0,-1);
    if (d==="down") tryMove(0, 1);
    if (d==="left") tryMove(-1,0);
    if (d==="right") tryMove(1,0);
  });
});

// バトル画面クリックで「にげる」判定（簡易）
canvas.addEventListener("click", (ev)=>{
  if (state.mode !== "battle") return;
  // 画面上の「にげる」ボタン領域（156,120,78,16）
  const rect = canvas.getBoundingClientRect();
  const sx = (ev.clientX - rect.left) * (canvas.width / rect.width);
  const sy = (ev.clientY - rect.top) * (canvas.height / rect.height);
  if (sx>=156 && sx<=234 && sy>=120 && sy<=136){
    endBattle();
    draw();
  }
});

draw();
