const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreElement = document.getElementById("score");
const livesElement = document.getElementById("lives");
const levelElement = document.getElementById("level");
const startButton = document.getElementById("startButton");
const menuDialog = document.getElementById("menuDialog");
const newGameButton = document.getElementById("newGameButton");
const chooseLevelButton = document.getElementById("chooseLevelButton");
const levelDialog = document.getElementById("levelDialog");
const backToMenuButton = document.getElementById("backToMenuButton");
const playerNameInput = document.getElementById("playerName");
const leaderboardList = document.getElementById("leaderboardList");
const nameDialog = document.getElementById("nameDialog");
const nameForm = document.getElementById("nameForm");
const nameError = document.getElementById("nameError");
const cancelNameButton = document.getElementById("cancelNameButton");
const menuScoresButton = document.getElementById("menuScoresButton");
const scoresDialog = document.getElementById("scoresDialog");
const closeScoresButton = document.getElementById("closeScoresButton");

const paddle = {
  width: 130,
  height: 16,
  x: canvas.width / 2 - 65,
  y: canvas.height - 44,
  speed: 430,
};

const ball = {
  x: canvas.width / 2,
  y: canvas.height - 65,
  radius: 9,
  speed: 330,
  dx: 220,
  dy: -245,
};

const brick = {
  columns: 8,
  rows: 5,
  width: 82,
  height: 24,
  gap: 10,
  top: 70,
  left: 55,
};

const colors = ["#ff5c7a", "#ff9f43", "#ffd93d", "#58d68d", "#52a7ff"];
let bricks = [];
let score = 0;
let lives = 3;
let running = false;
let ended = false;
let lastTime = 0;
let keys = {};
let playerName = "";
let level = 1;
let selectedLevel = 1;
let gifts = [];
let transitionTimeout;
const leaderboardKey = "kolorowe-odbicie-wyniki";

function getLeaderboard() {
  try {
    return JSON.parse(localStorage.getItem(leaderboardKey)) || [];
  } catch {
    return [];
  }
}

function renderLeaderboard() {
  const leaderboard = getLeaderboard();
  leaderboardList.replaceChildren();

  if (leaderboard.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.textContent = "Brak wyników";
    leaderboardList.appendChild(emptyItem);
    return;
  }

  for (const entry of leaderboard) {
    const item = document.createElement("li");
    item.textContent = `${entry.name} — ${entry.score} pkt`;
    leaderboardList.appendChild(item);
  }
}

function saveScore() {
  if (score <= 0) return;

  const leaderboard = getLeaderboard();
  leaderboard.push({ name: playerName, score });
  leaderboard.sort((a, b) => b.score - a.score);
  const topResults = leaderboard.slice(0, 5);

  try {
    localStorage.setItem(leaderboardKey, JSON.stringify(topResults));
  } catch {
    // Gra może działać mimo ograniczeń pamięci przeglądarki.
  }
  renderLeaderboard();
}

function createBricks() {
  bricks = [];
  for (let row = 0; row < brick.rows; row++) {
    for (let column = 0; column < brick.columns; column++) {
      let shape = "rounded";
      let hits = 1;

      if (level === 2) {
        shape = (row + column) % 2 === 0 ? "diamond" : "hexagon";
      }
      if (level === 3) {
        shape = ["triangle", "circle", "hexagon"][(row + column) % 3];
      }
      if (level === 2 && ((row === 1 && column === 2) || (row === 3 && column === 5))) {
        shape = "double";
        hits = 2;
      }
      if (level === 3 && ((row === 1 && column === 2) || (row === 3 && column === 5))) {
        shape = "double";
        hits = 2;
      }

      bricks.push({
        x: brick.left + column * (brick.width + brick.gap),
        y: brick.top + row * (brick.height + brick.gap),
        width: brick.width,
        height: brick.height,
        color: colors[row],
        shape,
        hits,
        active: true,
      });
    }
  }
}

function startNextLevel() {
  running = false;
  level++;
  levelElement.textContent = level;
  createBricks();
  gifts = [];
  resetBall();
  draw();

  ctx.fillStyle = "rgba(8, 12, 32, 0.82)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "white";
  ctx.textAlign = "center";
  ctx.font = "700 42px system-ui";
  ctx.fillText(`Poziom ${level}!`, canvas.width / 2, canvas.height / 2);

  clearTimeout(transitionTimeout);
  transitionTimeout = setTimeout(() => {
    running = true;
    lastTime = performance.now();
    requestAnimationFrame(update);
  }, 1200);
}

function resetBall() {
  ball.x = canvas.width / 2;
  ball.y = canvas.height - 65;
  const direction = Math.random() > 0.5 ? 1 : -1;
  const launchAngle = Math.PI * 0.23;
  ball.dx = ball.speed * Math.sin(launchAngle) * direction;
  ball.dy = -ball.speed * Math.cos(launchAngle);
}

function startGame(startLevel) {
  clearTimeout(transitionTimeout);
  score = 0;
  lives = 3;
  level = startLevel;
  ended = false;
  running = true;
  startButton.hidden = true;
  ball.speed = 330;
  paddle.width = 130;
  paddle.x = canvas.width / 2 - paddle.width / 2;
  gifts = [];
  createBricks();
  resetBall();
  scoreElement.textContent = score;
  livesElement.textContent = lives;
  levelElement.textContent = level;
  startButton.textContent = "Menu";
  lastTime = performance.now();
  requestAnimationFrame(update);
}

function endGame(message) {
  running = false;
  ended = true;
  startButton.hidden = false;
  saveScore();
  try {
    localStorage.setItem("kolorowe-odbicie-gracz", playerName);
  } catch {
    // Nazwa gracza nie musi być zapisana.
  }
  draw();
  ctx.fillStyle = "rgba(8, 12, 32, 0.82)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "white";
  ctx.textAlign = "center";
  ctx.font = "700 42px system-ui";
  ctx.fillText(message, canvas.width / 2, canvas.height / 2 - 10);
  ctx.font = "24px system-ui";
  ctx.fillText(`Wynik: ${score}`, canvas.width / 2, canvas.height / 2 + 36);
  startButton.textContent = "Menu";
}

function maybeDropGift(block) {
  if (level !== 3 || Math.random() > 0.35) return;

  gifts.push({
    x: block.x + block.width / 2,
    y: block.y + block.height / 2,
    radius: 14,
    speed: 150,
    type: Math.random() < 0.5 ? "speed" : "shrink",
  });
}

function catchGift(gift) {
  if (gift.type === "speed") {
    const oldSpeed = ball.speed;
    ball.speed = Math.min(ball.speed * 1.2, 594);
    const speedFactor = ball.speed / oldSpeed;
    ball.dx *= speedFactor;
    ball.dy *= speedFactor;
    return;
  }

  const oldWidth = paddle.width;
  paddle.width = Math.max(70, paddle.width * 0.8);
  paddle.x += (oldWidth - paddle.width) / 2;
  paddle.x = Math.max(0, Math.min(canvas.width - paddle.width, paddle.x));
}

function update(time) {
  if (!running) return;

  const delta = Math.min((time - lastTime) / 1000, 0.025);
  lastTime = time;

  if (keys.arrowleft || keys.a) {
    paddle.x -= paddle.speed * delta;
  }
  if (keys.arrowright || keys.d) {
    paddle.x += paddle.speed * delta;
  }
  paddle.x = Math.max(0, Math.min(canvas.width - paddle.width, paddle.x));

  ball.x += ball.dx * delta;
  ball.y += ball.dy * delta;

  if (ball.x - ball.radius <= 0 || ball.x + ball.radius >= canvas.width) {
    ball.dx *= -1;
  }
  if (ball.y - ball.radius <= 0) {
    ball.dy *= -1;
  }

  if (
    ball.dy > 0 &&
    ball.x + ball.radius >= paddle.x &&
    ball.x - ball.radius <= paddle.x + paddle.width &&
    ball.y + ball.radius >= paddle.y &&
    ball.y - ball.radius <= paddle.y + paddle.height
  ) {
    ball.y = paddle.y - ball.radius;
    const hitPosition = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);
    const angle = hitPosition * Math.PI / 3;
    ball.dx = ball.speed * Math.sin(angle);
    ball.dy = -ball.speed * Math.cos(angle);
  }

  for (const block of bricks) {
    if (!block.active) continue;

    if (
      ball.x + ball.radius >= block.x &&
      ball.x - ball.radius <= block.x + block.width &&
      ball.y + ball.radius >= block.y &&
      ball.y - ball.radius <= block.y + block.height
    ) {
      block.hits--;
      score += 10;
      scoreElement.textContent = score;
      if (block.hits <= 0) {
        block.active = false;
        maybeDropGift(block);
      }

      const overlapLeft = ball.x + ball.radius - block.x;
      const overlapRight = block.x + block.width - (ball.x - ball.radius);
      const overlapTop = ball.y + ball.radius - block.y;
      const overlapBottom = block.y + block.height - (ball.y - ball.radius);
      const smallestOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

      if (smallestOverlap === overlapLeft || smallestOverlap === overlapRight) {
        ball.dx *= -1;
      } else {
        ball.dy *= -1;
      }
      break;
    }
  }

  for (let index = gifts.length - 1; index >= 0; index--) {
    const gift = gifts[index];
    gift.y += gift.speed * delta;

    if (
      gift.y + gift.radius >= paddle.y &&
      gift.y - gift.radius <= paddle.y + paddle.height &&
      gift.x + gift.radius >= paddle.x &&
      gift.x - gift.radius <= paddle.x + paddle.width
    ) {
      catchGift(gift);
      gifts.splice(index, 1);
    } else if (gift.y - gift.radius > canvas.height) {
      gifts.splice(index, 1);
    }
  }

  if (bricks.every((block) => !block.active)) {
    if (level < 3) {
      startNextLevel();
      return;
    }
    endGame("Wygrana!");
    return;
  }

  if (ball.y - ball.radius > canvas.height) {
    lives--;
    livesElement.textContent = lives;
    if (lives <= 0) {
      endGame("Koniec gry");
      return;
    }
    resetBall();
  }

  draw();
  requestAnimationFrame(update);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#10162f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const block of bricks) {
    if (!block.active) continue;
    ctx.fillStyle = block.color;
    ctx.beginPath();

    if (block.shape === "diamond") {
      ctx.moveTo(block.x + block.width / 2, block.y);
      ctx.lineTo(block.x + block.width, block.y + block.height / 2);
      ctx.lineTo(block.x + block.width / 2, block.y + block.height);
      ctx.lineTo(block.x, block.y + block.height / 2);
      ctx.closePath();
    } else if (block.shape === "hexagon" || block.shape === "double") {
      ctx.moveTo(block.x + 12, block.y);
      ctx.lineTo(block.x + block.width - 12, block.y);
      ctx.lineTo(block.x + block.width, block.y + block.height / 2);
      ctx.lineTo(block.x + block.width - 12, block.y + block.height);
      ctx.lineTo(block.x + 12, block.y + block.height);
      ctx.lineTo(block.x, block.y + block.height / 2);
      ctx.closePath();
    } else if (block.shape === "triangle") {
      ctx.moveTo(block.x + block.width / 2, block.y);
      ctx.lineTo(block.x + block.width, block.y + block.height);
      ctx.lineTo(block.x, block.y + block.height);
      ctx.closePath();
    } else if (block.shape === "circle") {
      ctx.ellipse(
        block.x + block.width / 2,
        block.y + block.height / 2,
        block.width / 2,
        block.height / 2,
        0,
        0,
        Math.PI * 2,
      );
    } else {
      ctx.roundRect(block.x, block.y, block.width, block.height, 6);
    }
    ctx.fill();

    if (block.shape === "double") {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 15px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(String(block.hits), block.x + block.width / 2, block.y + block.height - 6);
    }
  }

  for (const gift of gifts) {
    ctx.fillStyle = gift.type === "speed" ? "#ffcf33" : "#c77dff";
    ctx.beginPath();
    ctx.arc(gift.x, gift.y, gift.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#10162f";
    if (gift.type === "speed") {
      ctx.beginPath();
      ctx.moveTo(gift.x + 2, gift.y - 11);
      ctx.lineTo(gift.x - 6, gift.y + 1);
      ctx.lineTo(gift.x - 1, gift.y + 1);
      ctx.lineTo(gift.x - 3, gift.y + 10);
      ctx.lineTo(gift.x + 7, gift.y - 3);
      ctx.lineTo(gift.x + 2, gift.y - 3);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(gift.x - 7, gift.y - 5, 14, 10);
      ctx.clearRect(gift.x - 4, gift.y - 3, 8, 6);
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 9px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("-20%", gift.x, gift.y + 3);
    }
  }

  ctx.fillStyle = "#f4f7ff";
  ctx.beginPath();
  ctx.roundRect(paddle.x, paddle.y, paddle.width, paddle.height, 8);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fill();
}

window.addEventListener("keydown", (event) => {
  if (event.target === playerNameInput) return;
  const key = event.key.toLowerCase();
  if (["arrowleft", "arrowright", "a", "d"].includes(key)) {
    keys[key] = true;
    if (key === "a") keys.a = true;
    if (key === "d") keys.d = true;
    event.preventDefault();
  }
});

window.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  keys[key] = false;
});

canvas.addEventListener("pointermove", (event) => {
  if (!running) return;
  const rect = canvas.getBoundingClientRect();
  paddle.x = ((event.clientX - rect.left) / rect.width) * canvas.width - paddle.width / 2;
  paddle.x = Math.max(0, Math.min(canvas.width - paddle.width, paddle.x));
});

try {
  playerNameInput.value = localStorage.getItem("kolorowe-odbicie-gracz") || "";
} catch {
  playerNameInput.value = "";
}

function openNameDialog() {
  nameError.textContent = "";
  nameDialog.showModal();
  playerNameInput.focus();
  playerNameInput.select();
}

nameForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const enteredName = playerNameInput.value.trim();

  if (!enteredName) {
    nameError.textContent = "Wpisz nazwę gracza.";
    playerNameInput.focus();
    return;
  }

  playerName = enteredName;
  nameDialog.close();
  startGame(selectedLevel);
});

cancelNameButton.addEventListener("click", () => {
  nameDialog.close();
  menuDialog.showModal();
});
nameDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  nameDialog.close();
  menuDialog.showModal();
});

newGameButton.addEventListener("click", () => {
  selectedLevel = 1;
  menuDialog.close();
  openNameDialog();
});

chooseLevelButton.addEventListener("click", () => {
  menuDialog.close();
  levelDialog.showModal();
});

levelDialog.querySelectorAll("[data-level]").forEach((button) => {
  button.addEventListener("click", () => {
    selectedLevel = Number(button.dataset.level);
    levelDialog.close();
    openNameDialog();
  });
});

backToMenuButton.addEventListener("click", () => {
  levelDialog.close();
  menuDialog.showModal();
});
levelDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  levelDialog.close();
  menuDialog.showModal();
});

startButton.addEventListener("click", () => menuDialog.showModal());
menuDialog.addEventListener("cancel", (event) => event.preventDefault());
menuScoresButton.addEventListener("click", () => {
  menuDialog.close();
  renderLeaderboard();
  scoresDialog.showModal();
});
closeScoresButton.addEventListener("click", () => {
  scoresDialog.close();
  menuDialog.showModal();
});
scoresDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  scoresDialog.close();
  menuDialog.showModal();
});

createBricks();
renderLeaderboard();
draw();
startButton.hidden = true;
menuDialog.showModal();
