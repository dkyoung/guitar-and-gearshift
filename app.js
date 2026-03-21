const setupScreen = document.getElementById('setup-screen');
const gameScreen = document.getElementById('game-screen');
const messageScreen = document.getElementById('message-screen');
const setupForm = document.getElementById('setup-form');
const fullNameInput = document.getElementById('full-name');
const birthDateInput = document.getElementById('birth-date');
const playerNameLabel = document.getElementById('player-name');
const scoreLabel = document.getElementById('score');
const targetScoreLabel = document.getElementById('target-score');
const statusText = document.getElementById('status-text');
const gameBoard = document.getElementById('game-board');
const playerCar = document.getElementById('player-car');
const moveLeftButton = document.getElementById('move-left');
const moveRightButton = document.getElementById('move-right');
const messageTitle = document.getElementById('message-title');
const messageBody = document.getElementById('message-body');
const restartButton = document.getElementById('restart-button');

const LANE_COUNT = 3;
const PLAYER_BOTTOM_OFFSET = 18;
const SAFE_START_DURATION = 1600;
const INITIAL_SPAWN_DELAY = 950;
const MIN_SPAWN_DELAY = 400;
const SPAWN_ACCELERATION = 35;
const INITIAL_STATUS = 'Grab 🎸 🎂 🎵, dodge 🕳️ 🚧, and use Arrow keys, A / D, or the buttons below.';

// Debug: effective hitboxes are tuned here so collisions match the visible emoji/art instead of full containers.
const PLAYER_HITBOX_SCALE_X = 0.48;
const PLAYER_HITBOX_SCALE_Y = 0.6;
const ITEM_HITBOX_SCALE_X = 0.4;
const ITEM_HITBOX_SCALE_Y = 0.45;
const collectibles = [
  { emoji: '🎸', points: 10 },
  { emoji: '🎂', points: 15 },
  { emoji: '🎵', points: 5 },
];
const obstacles = ['🕳️', '🚧'];

const state = {
  fullName: '',
  firstName: '',
  age: 0,
  score: 0,
  targetScore: 0,
  running: false,
  animationId: null,
  spawnTimerId: null,
  playerLane: 1,
  playerX: 0,
  items: [],
  boardWidth: 0,
  boardHeight: 0,
  itemSize: 60,
  playerSize: 82,
  lanes: [],
  spawnDelay: INITIAL_SPAWN_DELAY,
  gameStartTime: 0,
  collisionsEnabledAt: 0,
};

function calculateAge(birthDateValue) {
  const birthDate = new Date(`${birthDateValue}T00:00:00`);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const hasHadBirthday =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());

  if (!hasHadBirthday) {
    age -= 1;
  }

  return age;
}

function extractFirstName(fullName) {
  return fullName.trim().split(/\s+/)[0] || 'Player';
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function setStatus(message) {
  statusText.textContent = message;
}

function updateHud() {
  playerNameLabel.textContent = state.firstName;
  scoreLabel.textContent = state.score;
  targetScoreLabel.textContent = state.targetScore;

  const pointsLeft = Math.max(state.targetScore - state.score, 0);
  setStatus(`${state.firstName}, collect ${pointsLeft} more points and avoid the hazards.`);
}

function showScreen(screenToShow) {
  [setupScreen, gameScreen, messageScreen].forEach((screen) => {
    screen.classList.toggle('hidden', screen !== screenToShow);
  });
}

function clearItems() {
  state.items.forEach((item) => item.element.remove());
  state.items = [];
}

function stopGameLoop() {
  state.running = false;

  if (state.animationId) {
    cancelAnimationFrame(state.animationId);
    state.animationId = null;
  }

  if (state.spawnTimerId) {
    clearTimeout(state.spawnTimerId);
    state.spawnTimerId = null;
  }
}

function showMessage(title, body, isWin) {
  messageTitle.textContent = title;
  messageTitle.className = isWin ? 'status-win' : 'status-loss';
  messageBody.textContent = body;
  showScreen(messageScreen);
}

function endGame(isWin) {
  stopGameLoop();
  clearItems();

  if (isWin) {
    showMessage(
      'You Win!',
      `Happy Birthday, ${state.fullName}! You unlocked Age ${state.age}.`,
      true
    );
    return;
  }

  showMessage(
    'Crash!',
    `${state.firstName}, your ride hit an obstacle. Final score: ${state.score}.`,
    false
  );
}

function syncBoardMetrics() {
  const computed = window.getComputedStyle(document.documentElement);
  state.boardWidth = gameBoard.clientWidth;
  state.boardHeight = gameBoard.clientHeight;
  state.playerSize = Number.parseFloat(computed.getPropertyValue('--player-size')) || 82;
  state.itemSize = Number.parseFloat(computed.getPropertyValue('--item-size')) || 60;
}

function scheduleNextSpawn() {
  if (!state.running) {
    return;
  }

  state.spawnTimerId = window.setTimeout(() => {
    spawnItem();

    const elapsed = Date.now() - state.gameStartTime;
    const difficultyReduction = Math.floor(elapsed / 2000) * SPAWN_ACCELERATION;
    state.spawnDelay = Math.max(MIN_SPAWN_DELAY, INITIAL_SPAWN_DELAY - difficultyReduction);

    scheduleNextSpawn();
  }, state.spawnDelay);
}

function isSafeStartActive() {
  return Date.now() < state.collisionsEnabledAt;
}

function getCenteredHitbox(x, y, width, height, scaleX, scaleY) {
  const hitboxWidth = width * scaleX;
  const hitboxHeight = height * scaleY;
  const insetX = (width - hitboxWidth) / 2;
  const insetY = (height - hitboxHeight) / 2;

  return {
    left: x + insetX,
    right: x + insetX + hitboxWidth,
    top: y + insetY,
    bottom: y + insetY + hitboxHeight,
  };
}

function getPlayerRect() {
  return getCenteredHitbox(
    state.playerX,
    state.boardHeight - state.playerSize - PLAYER_BOTTOM_OFFSET,
    state.playerSize,
    state.playerSize,
    PLAYER_HITBOX_SCALE_X,
    PLAYER_HITBOX_SCALE_Y
  );
}

function calculateLanes() {
  syncBoardMetrics();

  if (!state.boardWidth || !state.boardHeight) {
    state.lanes = [];
    return;
  }

  const laneWidth = state.boardWidth / LANE_COUNT;

  // Debug: lane coordinates are defined here for the fixed 3-lane road system.
  state.lanes = Array.from({ length: LANE_COUNT }, (_, index) => {
    const laneCenter = laneWidth * index + laneWidth / 2;
    return Math.round(clamp(laneCenter - state.playerSize / 2, 0, state.boardWidth - state.playerSize));
  });
}

function renderPlayer() {
  if (!state.lanes.length) {
    return;
  }

  state.playerX = clamp(state.lanes[state.playerLane], 0, state.boardWidth - state.playerSize);
  playerCar.style.left = `${state.playerX}px`;
}

function movePlayer(direction) {
  if (!state.running) {
    return;
  }

  state.playerLane = clamp(state.playerLane + direction, 0, state.lanes.length - 1);
  renderPlayer();
}

function pickSpawnLane() {
  const laneIndexes = state.lanes.map((_, index) => index);

  if (isSafeStartActive()) {
    return laneIndexes.filter((laneIndex) => laneIndex !== state.playerLane);
  }

  return laneIndexes;
}

function spawnItem(forceCollectible = false) {
  if (!state.running || !state.lanes.length) {
    return;
  }

  const spawnableLanes = pickSpawnLane();

  if (!spawnableLanes.length) {
    return;
  }

  const isCollectible = forceCollectible || Math.random() < 0.75;
  const laneIndex = spawnableLanes[Math.floor(Math.random() * spawnableLanes.length)];
  const laneWidth = state.boardWidth / LANE_COUNT;
  const itemX = Math.round(clamp(
    laneWidth * laneIndex + laneWidth / 2 - state.itemSize / 2,
    0,
    state.boardWidth - state.itemSize
  ));
  const itemConfig = isCollectible
    ? collectibles[Math.floor(Math.random() * collectibles.length)]
    : { emoji: obstacles[Math.floor(Math.random() * obstacles.length)], points: 0 };

  const element = document.createElement('div');
  element.className = 'falling-item';
  element.textContent = itemConfig.emoji;
  element.style.left = `${itemX}px`;
  element.style.top = `-${state.itemSize}px`;
  gameBoard.appendChild(element);

  state.items.push({
    element,
    laneIndex,
    x: itemX,
    y: -state.itemSize,
    speed: 2.5 + Math.random() * 1.1 + Math.min(1.8, (INITIAL_SPAWN_DELAY - state.spawnDelay) / 260),
    type: isCollectible ? 'collectible' : 'obstacle',
    points: itemConfig.points,
  });
}

function isColliding(item) {
  const playerRect = getPlayerRect();
  const itemRect = getCenteredHitbox(
    item.x,
    item.y,
    state.itemSize,
    state.itemSize,
    ITEM_HITBOX_SCALE_X,
    ITEM_HITBOX_SCALE_Y
  );

  // Debug: collision overlap is calculated here using centered inner hitboxes.
  return !(
    playerRect.right <= itemRect.left ||
    playerRect.left >= itemRect.right ||
    playerRect.bottom <= itemRect.top ||
    playerRect.top >= itemRect.bottom
  );
}

function updateItems() {
  const collisionsActive = !isSafeStartActive();

  state.items = state.items.filter((item) => {
    item.y += item.speed;
    item.element.style.top = `${item.y}px`;

    // Debug: collision timing / safe-start logic is implemented here.
    if (collisionsActive && isColliding(item)) {
      item.element.remove();

      if (item.type === 'obstacle') {
        endGame(false);
        return false;
      }

      state.score += item.points;
      updateHud();

      if (state.score >= state.targetScore) {
        endGame(true);
      }

      return false;
    }

    if (item.y > state.boardHeight) {
      item.element.remove();
      return false;
    }

    return true;
  });
}

function gameLoop() {
  if (!state.running) {
    return;
  }

  updateItems();
  state.animationId = window.requestAnimationFrame(gameLoop);
}

function startGame() {
  stopGameLoop();
  clearItems();
  showScreen(gameScreen);
  calculateLanes();
  state.score = 0;
  state.targetScore = state.age * 10;
  state.spawnDelay = INITIAL_SPAWN_DELAY;
  state.gameStartTime = Date.now();
  state.collisionsEnabledAt = state.gameStartTime + SAFE_START_DURATION;

  // Debug: spawn position is set here so the player begins centered in a valid lane.
  state.playerLane = Math.floor(state.lanes.length / 2);
  renderPlayer();

  // Debug: player size is controlled via CSS custom properties read in syncBoardMetrics().
  updateHud();
  setStatus(`${state.firstName}, get ready! Hazards become dangerous in ${SAFE_START_DURATION / 1000} seconds.`);

  state.running = true;
  spawnItem(true);
  scheduleNextSpawn();
  gameLoop();
}

function handleDirectionalButton(direction) {
  movePlayer(direction);
}

setupForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const fullName = fullNameInput.value.trim();
  const birthDate = birthDateInput.value;
  const age = calculateAge(birthDate);

  if (!fullName || !birthDate || Number.isNaN(age) || age < 1) {
    window.alert('Please enter a valid name and birth date.');
    return;
  }

  state.fullName = fullName;
  state.firstName = extractFirstName(fullName);
  state.age = age;

  startGame();
});

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();

  if (key === 'arrowleft' || key === 'a') {
    event.preventDefault();
    movePlayer(-1);
  }

  if (key === 'arrowright' || key === 'd') {
    event.preventDefault();
    movePlayer(1);
  }
});

[moveLeftButton, moveRightButton].forEach((button) => {
  button.addEventListener('touchstart', (event) => {
    event.preventDefault();
  }, { passive: false });
});

moveLeftButton.addEventListener('click', () => handleDirectionalButton(-1));
moveRightButton.addEventListener('click', () => handleDirectionalButton(1));
restartButton.addEventListener('click', () => {
  stopGameLoop();
  clearItems();
  showScreen(setupScreen);
  setupForm.reset();
  setStatus(INITIAL_STATUS);
  fullNameInput.focus();
});

window.addEventListener('resize', () => {
  calculateLanes();

  if (!state.lanes.length) {
    return;
  }
  state.playerLane = clamp(state.playerLane, 0, state.lanes.length - 1);
  renderPlayer();

  state.items.forEach((item) => {
    const laneWidth = state.boardWidth / LANE_COUNT;
    item.x = Math.round(clamp(
      laneWidth * item.laneIndex + laneWidth / 2 - state.itemSize / 2,
      0,
      state.boardWidth - state.itemSize
    ));
    item.element.style.left = `${item.x}px`;
  });
});

setStatus(INITIAL_STATUS);
birthDateInput.max = new Date().toISOString().split('T')[0];
