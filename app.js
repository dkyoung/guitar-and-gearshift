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

const ITEM_SIZE = 48;
const PLAYER_BOTTOM_OFFSET = 16;
const INITIAL_STATUS = 'Grab 🎸 🎂 🎵, dodge 🕳️ 🚧, and use Arrow keys, A / D, or the buttons below.';
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
  playerLane: 0,
  playerX: 0,
  items: [],
  boardWidth: 0,
  boardHeight: 0,
  lanes: [],
  spawnDelay: 700,
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
    clearInterval(state.spawnTimerId);
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

function calculateLanes() {
  state.boardWidth = gameBoard.clientWidth;
  state.boardHeight = gameBoard.clientHeight;

  const laneCount = state.boardWidth < 340 ? 4 : 5;
  const usableWidth = state.boardWidth - ITEM_SIZE;
  const gap = laneCount > 1 ? usableWidth / (laneCount - 1) : 0;

  state.lanes = Array.from({ length: laneCount }, (_, index) => Math.round(index * gap));
}

function renderPlayer() {
  if (!state.lanes.length) {
    return;
  }

  state.playerX = state.lanes[state.playerLane];
  playerCar.style.left = `${state.playerX}px`;
}

function movePlayer(direction) {
  if (!state.running) {
    return;
  }

  state.playerLane = clamp(state.playerLane + direction, 0, state.lanes.length - 1);
  renderPlayer();
}

function spawnItem() {
  if (!state.running || !state.lanes.length) {
    return;
  }

  const isCollectible = Math.random() < 0.8;
  const laneIndex = Math.floor(Math.random() * state.lanes.length);
  const itemConfig = isCollectible
    ? collectibles[Math.floor(Math.random() * collectibles.length)]
    : { emoji: obstacles[Math.floor(Math.random() * obstacles.length)], points: 0 };

  const element = document.createElement('div');
  element.className = 'falling-item';
  element.textContent = itemConfig.emoji;
  element.style.left = `${state.lanes[laneIndex]}px`;
  element.style.top = `-${ITEM_SIZE}px`;
  gameBoard.appendChild(element);

  state.items.push({
    element,
    laneIndex,
    x: state.lanes[laneIndex],
    y: -ITEM_SIZE,
    speed: 3.1 + Math.random() * 1.7,
    type: isCollectible ? 'collectible' : 'obstacle',
    points: itemConfig.points,
  });
}

function isColliding(item) {
  const playerRect = {
    left: state.playerX,
    right: state.playerX + ITEM_SIZE,
    top: state.boardHeight - ITEM_SIZE - PLAYER_BOTTOM_OFFSET,
    bottom: state.boardHeight - PLAYER_BOTTOM_OFFSET,
  };

  const itemRect = {
    left: item.x,
    right: item.x + ITEM_SIZE,
    top: item.y,
    bottom: item.y + ITEM_SIZE,
  };

  return !(
    playerRect.right < itemRect.left ||
    playerRect.left > itemRect.right ||
    playerRect.bottom < itemRect.top ||
    playerRect.top > itemRect.bottom
  );
}

function updateItems() {
  state.items = state.items.filter((item) => {
    item.y += item.speed;
    item.element.style.top = `${item.y}px`;

    if (isColliding(item)) {
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
  calculateLanes();
  state.score = 0;
  state.targetScore = state.age * 10;
  state.playerLane = Math.floor(state.lanes.length / 2);
  renderPlayer();
  updateHud();
  showScreen(gameScreen);

  state.running = true;
  spawnItem();
  state.spawnTimerId = window.setInterval(spawnItem, state.spawnDelay);
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
  if (!state.running) {
    return;
  }

  calculateLanes();
  state.playerLane = clamp(state.playerLane, 0, state.lanes.length - 1);
  renderPlayer();

  state.items.forEach((item) => {
    item.x = state.lanes[clamp(item.laneIndex, 0, state.lanes.length - 1)];
    item.element.style.left = `${item.x}px`;
  });
});

setStatus(INITIAL_STATUS);
birthDateInput.max = new Date().toISOString().split('T')[0];
