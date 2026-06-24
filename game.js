const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const W = 240, H = 160;
const TILE = 16;

// プレイヤー画像
const playerImg = new Image();
playerImg.src = "./player.png";
let playerImgReady = false;
playerImg.onload = () => { playerImgReady = true; draw(); };

// 御三家画像
const flamelImg = new Image();
flamelImg.src = "./assets/フラメル.png";

const vassaImg = new Image();
vassaImg.src = "./assets/ヴァッサ.png";

// マップ：#=壁、.=道、G=草むら
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

const state = {
  mode: "field",
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
      if (t === "#") ctx.fillStyle = "#0f2a1a";
      else if (t === "G") ctx.fillStyle = "#1f7a2f";
      else ctx.fillStyle = "#66aa66";
      ctx.fillRect(x*TILE, y*TILE, TILE, TILE);
    }
  }

  // プレイヤー
  ctx.fillStyle = "#ff3b30";
  ctx.fillRect(state.player.x*TILE, state.player.y*TILE, TILE, TILE);

  drawBox("フィールド  矢印/タッチで移動", 4, 4, W-8, 22);
}

function drawBattle() {
  ctx.clearRect(0, 0, W, H);

  // 背景
  ctx.fillStyle = "#0b0c10";
  ctx.fillRect(0, 0, W, H);

  // 敵（ヴァッサ）：右上
  if (vassaImg.complete && vassaImg.naturalWidth > 0) {
    ctx.drawImage(vassaImg, 148, 12, 64, 64);
  } else {
    ctx.fillStyle = "#4488ff";
    ctx.fillRect(148, 12, 64, 64);
  }

  // 自分（フラメル）：左下
  if (flamelImg.complete && flamelImg.naturalWidth > 0) {
    ctx.drawImage(flamelImg, 20, 72, 64, 64);
  } else {
    ctx.fillStyle = "#ff3b30";
    ctx.fillRect(20, 72, 64, 64);
  }

  // メッセージ枠
  drawBox(state.msg || "どうする？", 6, 112, W - 12, 42);

  // にげるボタン
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

// キーボード操作
document.addEventListener("keydown", (e) => {
  if (state.mode === "field"){
    if (e.key === "ArrowUp")    tryMove(0,-1);
    if (e.key === "ArrowDown")  tryMove(0, 1);
    if (e.key === "ArrowLeft")  tryMove(-1,0);
    if (e.key === "ArrowRight") tryMove( 1,0);
  } else {
    if (e.key === "Escape" || e.key === "Enter"){ endBattle(); draw(); }
  }
});

// 十字キー
document.querySelectorAll(".dpad-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const d = btn.dataset.dir;
    if (d === "up")    tryMove(0,-1);
    if (d === "down")  tryMove(0, 1);
    if (d === "left")  tryMove(-1,0);
    if (d === "right") tryMove(1, 0);
  });
});

// バトル画面タップで「にげる」
canvas.addEventListener("click", (ev)=>{
  if (state.mode !== "battle") return;
  const rect = canvas.getBoundingClientRect();
  const sx = (ev.c
