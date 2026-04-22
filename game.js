const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");

const hpValue = document.querySelector("#hpValue");
const enemiesValue = document.querySelector("#enemiesValue");
const timeValue = document.querySelector("#timeValue");
const stateValue = document.querySelector("#stateValue");
const overlay = document.querySelector("#overlay");
const overlayMessage = document.querySelector("#overlayMessage");
const startButton = document.querySelector("#startButton");

const world = {
  width: canvas.width,
  height: canvas.height,
};

const keys = new Set();
let rafId = null;
let lastTs = 0;
let running = false;
let elapsed = 0;

let player;
let enemies;
let attackEvents;

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function createPlayer() {
  return {
    x: world.width / 2,
    y: world.height / 2,
    r: 18,
    hp: 100,
    maxHp: 100,
    speed: 250,
    facingX: 1,
    facingY: 0,
    attackCooldown: 0,
    dashCooldown: 0,
    dashTime: 0,
    invulnTime: 0,
  };
}

function createEnemy(index) {
  const edge = Math.floor(Math.random() * 4);
  const margin = 28;
  let x = 0;
  let y = 0;

  if (edge === 0) {
    x = rand(margin, world.width - margin);
    y = margin;
  } else if (edge === 1) {
    x = world.width - margin;
    y = rand(margin, world.height - margin);
  } else if (edge === 2) {
    x = rand(margin, world.width - margin);
    y = world.height - margin;
  } else {
    x = margin;
    y = rand(margin, world.height - margin);
  }

  const hp = rand(36, 58);

  return {
    id: index,
    x,
    y,
    r: 17,
    hp,
    maxHp: hp,
    speed: rand(85, 130),
    contactCooldown: 0,
    windup: rand(0.2, 1.2),
  };
}

function resetGame() {
  player = createPlayer();
  enemies = Array.from({ length: 12 }, (_, i) => createEnemy(i));
  attackEvents = [];
  elapsed = 0;
  lastTs = 0;
  updateHud("戦闘中");
}

function updateHud(stateLabel) {
  hpValue.textContent = Math.max(0, player?.hp ?? 0).toFixed(0);
  enemiesValue.textContent = `${enemies?.length ?? 0}`;
  timeValue.textContent = `${elapsed.toFixed(1)}s`;
  stateValue.textContent = stateLabel;

  if (player) {
    if (player.hp <= 25) {
      hpValue.style.color = "#ff5f75";
    } else if (player.hp <= 60) {
      hpValue.style.color = "#ffd56b";
    } else {
      hpValue.style.color = "#94ff8a";
    }
  }
}

function clampEntity(ent) {
  ent.x = Math.max(ent.r, Math.min(world.width - ent.r, ent.x));
  ent.y = Math.max(ent.r, Math.min(world.height - ent.r, ent.y));
}

function handleInput(dt) {
  const left = keys.has("ArrowLeft") || keys.has("a");
  const right = keys.has("ArrowRight") || keys.has("d");
  const up = keys.has("ArrowUp") || keys.has("w");
  const down = keys.has("ArrowDown") || keys.has("s");

  const vx = (right ? 1 : 0) - (left ? 1 : 0);
  const vy = (down ? 1 : 0) - (up ? 1 : 0);

  let norm = Math.hypot(vx, vy) || 1;
  let speed = player.speed;

  if (player.dashTime > 0) {
    speed *= 2.4;
  }

  if (vx !== 0 || vy !== 0) {
    player.facingX = vx / norm;
    player.facingY = vy / norm;
  }

  player.x += (vx / norm) * speed * dt;
  player.y += (vy / norm) * speed * dt;
  clampEntity(player);
}

function performAttack() {
  if (player.attackCooldown > 0 || !running) {
    return;
  }

  player.attackCooldown = 0.42;
  const range = 78;
  const arcDot = 0.15;
  let hits = 0;

  enemies = enemies.filter((e) => {
    const dx = e.x - player.x;
    const dy = e.y - player.y;
    const dist = Math.hypot(dx, dy);

    if (dist > range + e.r) {
      return true;
    }

    const nx = dx / (dist || 1);
    const ny = dy / (dist || 1);
    const dot = nx * player.facingX + ny * player.facingY;

    if (dot < arcDot) {
      return true;
    }

    e.hp -= rand(23, 35);
    hits += 1;
    attackEvents.push({ x: e.x, y: e.y, ttl: 0.16, type: "hit" });
    return e.hp > 0;
  });

  attackEvents.push({
    x: player.x + player.facingX * 32,
    y: player.y + player.facingY * 32,
    ttl: 0.1,
    type: hits > 0 ? "slash-hit" : "slash-miss",
  });
}

function triggerDash() {
  if (player.dashCooldown > 0 || !running) {
    return;
  }

  player.dashCooldown = 2.1;
  player.dashTime = 0.25;
  player.invulnTime = 0.18;
}

function updateEnemies(dt) {
  for (const e of enemies) {
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;

    const nx = dx / dist;
    const ny = dy / dist;

    e.windup -= dt;
    let speedMul = e.windup <= 0 ? 1.4 : 1;

    if (e.windup <= -0.9) {
      e.windup = rand(0.5, 1.2);
    }

    e.x += nx * e.speed * speedMul * dt;
    e.y += ny * e.speed * speedMul * dt;
    clampEntity(e);

    e.contactCooldown = Math.max(0, e.contactCooldown - dt);

    if (dist < e.r + player.r + 2 && e.contactCooldown <= 0 && player.invulnTime <= 0) {
      const damage = rand(7, 12);
      player.hp -= damage;
      e.contactCooldown = 0.8;
      player.invulnTime = 0.25;
      attackEvents.push({ x: player.x, y: player.y, ttl: 0.16, type: "player-hit" });
    }
  }
}

function updateTimers(dt) {
  player.attackCooldown = Math.max(0, player.attackCooldown - dt);
  player.dashCooldown = Math.max(0, player.dashCooldown - dt);
  player.dashTime = Math.max(0, player.dashTime - dt);
  player.invulnTime = Math.max(0, player.invulnTime - dt);

  attackEvents = attackEvents.filter((v) => {
    v.ttl -= dt;
    return v.ttl > 0;
  });
}

function renderGrid() {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;

  for (let x = 40; x < world.width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, world.height);
    ctx.stroke();
  }

  for (let y = 40; y < world.height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(world.width, y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawRing(x, y, radius, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function render() {
  ctx.clearRect(0, 0, world.width, world.height);
  renderGrid();

  for (const e of enemies) {
    ctx.fillStyle = "#ff5f75";
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(e.x - 16, e.y - e.r - 10, 32, 4);
    ctx.fillStyle = "#ffd8de";
    ctx.fillRect(e.x - 16, e.y - e.r - 10, (Math.max(0, e.hp) / e.maxHp) * 32, 4);
  }

  const blink = player.invulnTime > 0 ? Math.sin(elapsed * 45) > 0 : true;
  if (blink) {
    ctx.fillStyle = "#6bd4ff";
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
    ctx.fill();
  }

  const attackReady = player.attackCooldown <= 0;
  drawRing(player.x, player.y, 29, attackReady ? "#94ff8a" : "#8fa8bb", 0.7);

  if (player.dashTime > 0) {
    drawRing(player.x, player.y, 37, "#6bd4ff", 0.9);
  }

  const fx = player.x + player.facingX * 24;
  const fy = player.y + player.facingY * 24;
  ctx.strokeStyle = "#d4f3ff";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(player.x, player.y);
  ctx.lineTo(fx, fy);
  ctx.stroke();

  for (const ev of attackEvents) {
    if (ev.type === "hit") {
      drawRing(ev.x, ev.y, 22 * (ev.ttl / 0.16), "#fff1a6", ev.ttl / 0.16);
    } else if (ev.type === "player-hit") {
      drawRing(ev.x, ev.y, 26 * (ev.ttl / 0.16), "#ff5f75", ev.ttl / 0.16);
    } else if (ev.type === "slash-hit") {
      drawRing(ev.x, ev.y, 30 * (ev.ttl / 0.1), "#94ff8a", ev.ttl / 0.1);
    } else {
      drawRing(ev.x, ev.y, 24 * (ev.ttl / 0.1), "#8fa8bb", ev.ttl / 0.1);
    }
  }
}

function frame(ts) {
  if (!running) {
    return;
  }

  const dt = Math.min(0.032, (ts - (lastTs || ts)) / 1000);
  lastTs = ts;
  elapsed += dt;

  handleInput(dt);
  updateEnemies(dt);
  updateTimers(dt);

  if (player.hp <= 0) {
    finishGame(false);
    return;
  }

  if (enemies.length === 0) {
    finishGame(true);
    return;
  }

  updateHud("戦闘中");
  render();
  rafId = requestAnimationFrame(frame);
}

function finishGame(win) {
  running = false;
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  updateHud(win ? "勝利" : "敗北");
  overlayMessage.textContent = win
    ? `勝利！ ${elapsed.toFixed(1)}秒で制圧した！`
    : "敗北… 体勢を立て直して再挑戦しよう。";
  overlay.classList.remove("hidden");
  render();
}

function startGame() {
  resetGame();
  running = true;
  overlay.classList.add("hidden");
  render();
  rafId = requestAnimationFrame(frame);
}

window.addEventListener("keydown", (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  keys.add(key);

  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) {
    event.preventDefault();
  }

  if (event.code === "Space") {
    performAttack();
  }

  if (event.key === "Shift") {
    triggerDash();
  }
});

window.addEventListener("keyup", (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  keys.delete(key);
});

startButton.addEventListener("click", () => {
  startGame();
});

resetGame();
render();
updateHud("待機中");
