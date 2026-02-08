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

// Safe squares (indices on main track)
const SAFE_INDICES = [0, 8, 13, 21, 26, 34, 39, 47];

// Start index on main track for each color
const START_INDEX = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};

// For finished tokens, we place them in a small cluster per color
const FINISH_SPOTS = {
  red:   [{x: 50, y: 50}, {x: 46, y: 50}, {x: 54, y: 50}, {x: 50, y: 46}],
  green: [{x: 50, y: 50}, {x: 46, y: 54}, {x: 54, y: 54}, {x: 50, y: 58}],
  yellow:[{x: 50, y: 50}, {x: 42, y: 50}, {x: 42, y: 46}, {x: 42, y: 54}],
  blue:  [{x: 50, y: 50}, {x: 58, y: 50}, {x: 58, y: 46}, {x: 58, y: 54}],
};

let players = [];
let currentPlayerIndex = 0;
let gameStarted = false;
let rolling = false;
let pendingRoll = null;
let awaitingMove = false;

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
  boardEl.innerHTML = "";
}

// =========================
// PATH COORDINATES (LOOP AROUND BOARD)
// =========================
// We'll approximate a loop path around the board using percentages.
// This isn't pixel-perfect Ludo, but visually it goes around the edges
// and feels like a real track.

const TRACK_COORDS = [];
(function buildTrackCoords() {
  const centerX = 50;
  const centerY = 50;
  const radius = 38; // stay inside board
  for (let i = 0; i < TRACK_LENGTH; i++) {
    const angle = (2 * Math.PI * i) / TRACK_LENGTH - Math.PI / 2; // start at top
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    TRACK_COORDS.push({ x, y });
  }
})();

// Home positions (where tokens sit before entering track)
const HOME_SPOTS = {
  red: [
    {x: 25, y: 25},
    {x: 30, y: 25},
    {x: 25, y: 30},
    {x: 30, y: 30},
  ],
  green: [
    {x: 75, y: 25},
    {x: 80, y: 25},
    {x: 75, y: 30},
    {x: 80, y: 30},
  ],
  yellow: [
    {x: 25, y: 75},
    {x: 30, y: 75},
    {x: 25, y: 80},
    {x: 30, y: 80},
  ],
  blue: [
    {x: 75, y: 75},
    {x: 80, y: 75},
    {x: 75, y: 80},
    {x: 80, y: 80},
  ],
};

// =========================
// DICE
// =========================
function biasedRollFor(player) {
  // Hidden buff: any name containing "code red" has ~50% extra chance for 5 or 6
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

  players.forEach((player, pIndex) => {
    player.tokens.forEach((pos, tIndex) => {
      const tokenVisual = document.createElement("div");
      tokenVisual.className = "token-visual";

      const token = document.createElement("div");
      token.className = `token ${player.color}`;
      token.dataset.playerIndex = pIndex;
      token.dataset.tokenIndex = tIndex;

      tokenVisual.appendChild(token);

      let coord;

      if (pos === HOME_POS) {
        coord = HOME_SPOTS[player.color][tIndex];
      } else if (pos === FINISHED_POS) {
        coord = FINISH_SPOTS[player.color][tIndex];
      } else {
        coord = TRACK_COORDS[pos];
      }

      tokenVisual.style.left = `${coord.x}%`;
      tokenVisual.style.top = `${coord.y}%`;

      tokenLayerEl.appendChild(tokenVisual);
    });
  });

  // Attach click handlers only when awaiting move
  if (awaitingMove && pendingRoll != null) {
    enableTokenClicksForCurrentPlayer();
  }
}

// =========================
// MOVE LOGIC
// =========================
function isSafeIndex(index) {
  return SAFE_INDICES.includes(index);
}

function getMovableTokens(player, roll) {
  const tokens = player.tokens;
  const movable = [];

  for (let i = 0; i < tokens.length; i++) {
    const pos = tokens[i];

    if (pos === HOME_POS) {
      if (roll === 6) {
        movable.push(i);
      }
      continue;
    }

    if (pos === FINISHED_POS) continue;

    const newPos = pos + roll;
    if (newPos > FINISHED_POS) continue;

    movable.push(i);
  }

  return movable;
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
  log(`${player.name} moved a token along the track.`, player.color);

  // Capture logic
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

function checkWin(player) {
  if (player.tokens.every(p => p === FINISHED_POS)) {
    log(`${player.name} has WON the game!`, player.color);
    btnRoll.disabled = true;
    gameStarted = false;
    awaitingMove = false;
    pendingRoll = null;
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
// TOKEN CLICK HANDLING
// =========================
function clearHighlights() {
  document.querySelectorAll(".token.highlight").forEach(el => {
    el.classList.remove("highlight");
  });
}

function enableTokenClicksForCurrentPlayer() {
  clearHighlights();
  const player = players[currentPlayerIndex];
  const roll = pendingRoll;

  const movable = getMovableTokens(player, roll);
  if (movable.length === 0) {
    log(`${player.name} has no valid moves.`, player.color);
    awaitingMove = false;
    pendingRoll = null;

    const won = checkWin(player);
    if (!won) {
      if (roll !== 6) {
        nextPlayer();
      } else {
        log(`${player.name} gets another turn for rolling a 6!`, player.color);
      }
    }
    renderTokens();
    return;
  }

  // Highlight movable tokens
  const tokenEls = document.querySelectorAll(".token");
  tokenEls.forEach(tokenEl => {
    const pIndex = Number(tokenEl.dataset.playerIndex);
    const tIndex = Number(tokenEl.dataset.tokenIndex);
    if (pIndex === currentPlayerIndex && movable.includes(tIndex)) {
      tokenEl.classList.add("highlight");
      tokenEl.addEventListener("click", onTokenClick);
    }
  });
}

function disableAllTokenClicks() {
  document.querySelectorAll(".token").forEach(tokenEl => {
    tokenEl.replaceWith(tokenEl.cloneNode(true)); // quick way to remove listeners
  });
}

function onTokenClick(e) {
  if (!awaitingMove || pendingRoll == null) return;

  const tokenEl = e.currentTarget;
  const pIndex = Number(tokenEl.dataset.playerIndex);
  const tIndex = Number(tokenEl.dataset.tokenIndex);

  if (pIndex !== currentPlayerIndex) return;

  const player = players[currentPlayerIndex];
  const roll = pendingRoll;

  disableAllTokenClicks();
  clearHighlights();

  moveToken(player, tIndex, roll);
  renderTokens();

  const won = checkWin(player);

  awaitingMove = false;
  pendingRoll = null;

  if (!won) {
    if (roll !== 6) {
      nextPlayer();
    } else {
      log(`${player.name} gets another turn for rolling a 6!`, player.color);
    }
  }
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
      // Silent buff, no visible hint
      console.debug(`${p.name} has hidden CODE RED buff.`);
    }
  });

  btnStart.disabled = true;
  btnRoll.disabled = false;
});

btnRoll.addEventListener("click", () => {
  if (!gameStarted || rolling || awaitingMove) return;
  rolling = true;

  const player = players[currentPlayerIndex];

  const fakeValue = Math.floor(Math.random() * 6) + 1;
  animateDiceTo(fakeValue);

  setTimeout(() => {
    const roll = biasedRollFor(player);
    pendingRoll = roll;
    animateDiceTo(roll);
    setLastRoll(roll);
    log(`${player.name} rolled a ${roll}.`, player.color);

    awaitingMove = true;
    rolling = false;

    renderTokens(); // this will enable clicks for movable tokens
  }, 600);
});

// =========================
// INIT
// =========================
buildBoard();
setLastRoll(null);
currentPlayerEl.textContent = "—";
log("Set player names, then press Start Game.");
