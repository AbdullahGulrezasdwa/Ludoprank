// =========================
// DOM ELEMENTS
// =========================
const boardEl         = document.getElementById("board");
const tokenLayerEl    = document.getElementById("token-layer");
const btnStart        = document.getElementById("btn-start");
const btnRoll         = document.getElementById("btn-roll");
const diceEl          = document.getElementById("dice");
const currentPlayerEl = document.getElementById("current-player");
const lastRollEl      = document.getElementById("last-roll");
const logEl           = document.getElementById("log");

const nameInputs = {
  red:    document.getElementById("player-red"),
  green:  document.getElementById("player-green"),
  yellow: document.getElementById("player-yellow"),
  blue:   document.getElementById("player-blue"),
};

// =========================
// CONSTANTS & GAME STATE
// =========================
const COLORS_IN_ORDER = ["red", "green", "yellow", "blue"];
const TOKENS_PER_PLAYER = 4;
const TRACK_LENGTH = 52;
const HOME_POS = -1;
const FINISHED_POS = 52;

const SAFE_INDICES = [0, 8, 13, 21, 26, 34, 39, 47];

const START_INDEX = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};

const COLOR_ROW = {
  red: 0,
  green: 1,
  yellow: 2,
  blue: 3,
};

let players = [];
let currentPlayerIndex = 0;
let gameStarted = false;
let rolling = false;

// =========================
// LOGGING & STATUS
// =========================
function log(message, color) {
  const div = document.createElement("div");
  div.className = "log-entry";
  if (color) {
    div.innerHTML = `<span>[${color.toUpperCase()}]</span> ${message}`;
  } else {
    div.textContent = message;
  }
  logEl.appendChild(div);
  logEl.scrollTop = logEl.scrollHeight;
}

function setStatusPlayer(player) {
  currentPlayerEl.textContent = `${player.name} (${player.color.toUpperCase()})`;
}

function setLastRoll(value) {
  lastRollEl.textContent = value != null ? value : "—";
}

// =========================
// BOARD VISUAL
// =========================
function buildBoard() {
  // No grid cells — board image handles visuals
  boardEl.innerHTML = "";
}

// =========================
// DICE
// =========================
function biasedRollFor(player) {
  if (!player.isCodeRed) {
    return Math.floor(Math.random() * 6) + 1;
  }
  if (Math.random() < 0.5) {
    return Math.random() < 0.5 ? 5 : 6;
  }
  return Math.floor(Math.random() * 6) + 1;
}

function animateDiceTo(value) {
  let rotation;
  switch (value) {
    case 1: rotation = "rotateX(0deg) rotateY(0deg)"; break;
    case 2: rotation = "rotateX(0deg) rotateY(180deg)"; break;
    case 3: rotation = "rotateX(90deg) rotateY(0deg)"; break;
    case 4: rotation = "rotateX(-90deg) rotateY(0deg)"; break;
    case 5: rotation = "rotateX(0deg) rotateY(90deg)"; break;
    case 6: rotation = "rotateX(0deg) rotateY(-90deg)"; break;
    default: rotation = "rotateX(0deg) rotateY(0deg)";
  }
  diceEl.style.transform = rotation;
}

// =========================
// TOKEN RENDERING
// =========================
function renderTokens() {
  tokenLayerEl.innerHTML = "";

  const laneHeight = 100 / 4;

  players.forEach(player => {
    const row = COLOR_ROW[player.color];

    player.tokens.forEach((pos, idx) => {
      const tokenVisual = document.createElement("div");
      tokenVisual.className = "token-visual";

      const token = document.createElement("div");
      token.className = `token ${player.color}`;
      tokenVisual.appendChild(token);

      let xPercent;

      if (pos === HOME_POS) {
        xPercent = 5;
      } else if (pos === FINISHED_POS) {
        xPercent = 95;
      } else {
        xPercent = 10 + (pos / (TRACK_LENGTH - 1)) * 80;
      }

      const yPercent = row * laneHeight + laneHeight / 2;

      tokenVisual.style.left = `${xPercent}%`;
      tokenVisual.style.top = `${yPercent}%`;

      tokenLayerEl.appendChild(tokenVisual);
    });
  });
}

// =========================
// MOVE LOGIC
// =========================
function isSafeIndex(index) {
  return SAFE_INDICES.includes(index);
}

function moveToken(player, tokenIndex, roll) {
  const tokens = player.tokens;
  let pos = tokens[tokenIndex];

  if (pos === HOME_POS) {
    if (roll === 6) {
      tokens[tokenIndex] = START_INDEX[player.color];
      log(`${player.name} brought a token out from home.`, player.color);
    } else {
      log(`${player.name} needs a 6 to leave home.`, player.color);
    }
    return;
  }

  if (pos === FINISHED_POS) {
    log(`${player.name}'s token is already finished.`, player.color);
    return;
  }

  const newPos = pos + roll;
  if (newPos > FINFINISHED_POS) {
    log(`${player.name} needs an exact roll to finish.`, player.color);
    return;
  }

  if (newPos === FINISHED_POS) {
    tokens[tokenIndex] = FINISHED_POS;
    log(`${player.name} moved a token into the home area!`, player.color);
    return;
  }

  tokens[tokenIndex] = newPos;
  log(`${player.name} moved a token to position ${newPos}.`, player.color);

  if (!isSafeIndex(newPos)) {
    players.forEach(other => {
      if (other === player) return;
      other.tokens.forEach((opPos, opIdx) => {
        if (opPos === newPos) {
          other.tokens[opIdx] = HOME_POS;
          log(`${player.name} captured a ${other.color.toUpperCase()} token!`, player.color);
        }
      });
    });
  }
}

function autoChooseTokenIndex(player, roll) {
  const tokens = player.tokens;

  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] >= 0 && tokens[i] < FINISHED_POS && tokens[i] + roll === FINISHED_POS) {
      return i;
    }
  }

  if (roll === 6) {
    const homeIdx = tokens.findIndex(p => p === HOME_POS);
    if (homeIdx !== -1) return homeIdx;
  }

  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] >= 0 && tokens[i] < FINISHED_POS && tokens[i] + roll <= FINISHED_POS) {
      return i;
    }
  }

  return -1;
}

function checkWin(player) {
  if (player.tokens.every(p => p === FINISHED_POS)) {
    log(`${player.name} has WON the game!`, player.color);
    btnRoll.disabled = true;
    gameStarted = false;
    return true;
  }
  return false;
}

// =========================
// TURN HANDLING
// =========================
function nextPlayer() {
  currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
  setStatusPlayer(players[currentPlayerIndex]);
}

// =========================
// EVENT HANDLERS
// =========================
btnStart.addEventListener("click", () => {
  players = [];
  COLORS_IN_ORDER.forEach(color => {
    const name = nameInputs[color].value.trim();
    if (name) {
      players.push({
        color,
        name,
        isCodeRed: name.toLowerCase().includes("code red"),
        tokens: Array(TOKENS_PER_PLAYER).fill(HOME_POS),
      });
    }
  });

  if (players.length === 0) {
    alert("Add at least one player name to start.");
    return;
  }

  gameStarted = true;
  currentPlayerIndex = 0;
  logEl.innerHTML = "";
  setLastRoll(null);
  buildBoard();
  renderTokens();

  setStatusPlayer(players[0]);
  log("Game started!");

  players.forEach(p => {
    if (p.isCodeRed) {
      log(`${p.name} has the CODE RED buff (better 5/6 odds).`, p.color);
    }
  });

  btnStart.disabled = true;
  btnRoll.disabled = false;
});

btnRoll.addEventListener("click", () => {
  if (!gameStarted || rolling) return;
  rolling = true;

  const player = players[currentPlayerIndex];

  const fakeValue = Math.floor(Math.random() * 6) + 1;
  animateDiceTo(fakeValue);

  setTimeout(() => {
    const roll = biasedRollFor(player);
    animateDiceTo(roll);
    setLastRoll(roll);
    log(`${player.name} rolled a ${roll}.`, player.color);

    const tokenIndex = autoChooseTokenIndex(player, roll);
    if (tokenIndex === -1) {
      log(`${player.name} has no valid moves.`, player.color);
    } else {
      moveToken(player, tokenIndex, roll);
    }

    renderTokens();
    const won = checkWin(player);

    if (!won) {
      if (roll !== 6) {
        nextPlayer();
      } else {
        log(`${player.name} gets another turn for rolling a 6!`, player.color);
      }
    }

    rolling = false;
  }, 600);
});

// =========================
// INIT
// =========================
buildBoard();
setLastRoll(null);
currentPlayerEl.textContent = "—";
log("Set player names, then press Start Game.");
