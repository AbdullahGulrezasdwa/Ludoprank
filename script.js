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
const TRACK_LENGTH = 52;       // 0..51 on track, 52 = finished
const HOME_POS = -1;
const FINISHED_POS = 52;

// Safe zones on the track (classic-ish Ludo style)
const SAFE_INDICES = [0, 8, 13, 21, 26, 34, 39, 47];

// Starting indices on the track for each color
const START_INDEX = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};

// Visual rows for token tracks (0–3)
const COLOR_ROW = {
  red: 0,
  green: 1,
  yellow: 2,
  blue: 3,
};

let players = [];          // { color, name, isCodeRed, tokens: [pos,...] }
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
/* BOARD VISUAL (BACKGROUND GRID) */
// =========================
function buildBoard() {
  boardEl.innerHTML = "";
  for (let i = 0; i < 15 * 15; i++) {
    const cell = document.createElement("div");
    cell.className = "cell path";
    boardEl.appendChild(cell);
  }
  // Neutral grid background; your CSS already makes it look like a Ludo board.
}

// =========================
/* DICE: 3D ANIMATION + CODE RED BUFF */
// =========================
function biasedRollFor(player) {
  const isCodeRed = player.isCodeRed;
  if (!isCodeRed) {
    return Math.floor(Math.random() * 6) + 1;
  }
  // ~50% chance to bias toward 5 or 6
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
/* TOKEN RENDERING (VISIBLE MOVEMENT) */
// =========================
//
// token-layer is used as a "track overlay":
// - Each color gets a horizontal lane (row 0–3).
// - X position is based on token.pos (0..52).
// - HOME (-1) is at the far left.
// - FINISHED (52) is at the far right.
//
function renderTokens() {
  tokenLayerEl.innerHTML = "";
  const laneHeight = 100 / 4; // 4 rows

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
        xPercent = 2; // left side
      } else if (pos === FINISHED_POS) {
        xPercent = 96; // right side
      } else {
        // 0..51 mapped to 10..90%
        xPercent = 10 + (pos / (TRACK_LENGTH - 1)) * 80;
      }

      const yPercent = row * laneHeight + laneHeight / 2;

      tokenVisual.style.position = "absolute";
      tokenVisual.style.left = `${xPercent}%`;
      tokenVisual.style.top = `${yPercent}%`;

      tokenLayerEl.appendChild(tokenVisual);
    });
  });
}

// =========================
/* MOVE LOGIC, SAFE ZONES, CAPTURE, WIN */
// =========================
function isSafeIndex(index) {
  return SAFE_INDICES.includes(index);
}

function moveToken(player, tokenIndex, roll) {
  const tokens = player.tokens;
  let pos = tokens[tokenIndex];

  // If at home
  if (pos === HOME_POS) {
    if (roll === 6) {
      tokens[tokenIndex] = START_INDEX[player.color];
      log(`${player.name} brought a token out from home.`, player.color);
    } else {
      log(`${player.name} needs a 6 to leave home.`, player.color);
    }
    return;
  }

  // If already finished
  if (pos === FINISHED_POS) {
    log(`${player.name}'s token is already finished.`, player.color);
    return;
  }

  // On track
  const newPos = pos + roll;
  if (newPos > FINISHED_POS) {
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

  // Capture logic: if any opponent token is on newPos and it's not safe, send them home
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

  // Priority 1: if any token can finish exactly, do that
  for (let i = 0; i < tokens.length; i++) {
    const pos = tokens[i];
    if (pos >= 0 && pos < FINISHED_POS && pos + roll === FINISHED_POS) {
      return i;
    }
  }

  // Priority 2: bring a token out of home if roll is 6
  if (roll === 6) {
    const homeIdx = tokens.findIndex(p => p === HOME_POS);
    if (homeIdx !== -1) return homeIdx;
  }

  // Priority 3: move the first token that is on track and can move
  for (let i = 0; i < tokens.length; i++) {
    const pos = tokens[i];
    if (pos >= 0 && pos < FINISHED_POS && pos + roll <= FINISHED_POS) {
      return i;
    }
  }

  // No valid move
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
/* TURN HANDLING */
// =========================
function nextPlayer() {
  if (players.length === 0) return;
  currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
  const p = players[currentPlayerIndex];
  setStatusPlayer(p);
}

// =========================
/* EVENT HANDLERS */
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

  const first = players[0];
  setStatusPlayer(first);
  log("Game started!", null);
  players.forEach(p => {
    if (p.isCodeRed) {
      log(`${p.name} has the CODE RED buff (better 5/6 odds).`, p.color);
    }
  });

  btnStart.disabled = true;
  btnRoll.disabled = false;
});

btnRoll.addEventListener("click", () => {
  if (!gameStarted || rolling || players.length === 0) return;
  rolling = true;
  const player = players[currentPlayerIndex];

  // Fake spin
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
/* INIT */
// =========================
buildBoard();
setLastRoll(null);
currentPlayerEl.textContent = "—";
log("Set player names, then press Start Game.");
