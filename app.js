const setupScreen = document.getElementById('setup-screen');
const gameScreen = document.getElementById('game-screen');
const messageScreen = document.getElementById('message-screen');
const setupForm = document.getElementById('setup-form');
const fullNameInput = document.getElementById('full-name');
const birthDateInput = document.getElementById('birth-date');
const playerNameLabel = document.getElementById('player-name');
const scoreLabel = document.getElementById('score');
const targetScoreLabel = document.getElementById('target-score');
const gameBoard = document.getElementById('game-board');
const playerCar = document.getElementById('player-car');
const moveLeftButton = document.getElementById('move-left');
const moveRightButton = document.getElementById('move-right');
const messageTitle = document.getElementById('message-title');
const messageBody = document.getElementById('message-body');
const restartButton = document.getElementById('restart-button');

const collectibles = [
  { emoji: '🎸', points: 10 },
  { emoji: '🎂', points: 15 },
  { emoji: '🎵', points: 5 },
];

const obstacles = ['🕳️', '🚧'];
const lanePositions = [18, 86, 154, 222, 290, 358];

const state = {
  fullName: '',
  firstName: '',
  age: 0,
  score: 0,
  targetScore: 0,
  running: false,
  animationId: null,
  spawnTimerId: null,
  playerX: 0,
  items: [],
  boardWidth: 0,
  boardHeight: 0,
  moveStep: 28,
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

function updateHud() {
  playerNameLabel.textContent = state.firstName;
  scoreLabel.textContent = state.score;
  targetScoreLabel.textContent = state.targetScore;
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
  } else {
    showMessage(
      'Crash!',
      `${state.firstName}, your ride hit an obstacle. Final score: ${state.score}.`,
      false
    );
  }
}

function movePlayer(direction) {
  if (!state.running) {
    return;
  }

  state.playerX = clamp(state.playerX + direction * state.moveStep, 0, state.boardWidth - 48);
  playerCar.style.left = `${state.playerX}px`;
}

function spawnItem() {
  if (!state.running) {
    return;
  }

  const isCollectible = Math.random() < 0.72;
  const randomLane = lanePositions[Math.floor(Math.random() * lanePositions.length)];
  const itemConfig = isCollectible
    ? collectibles[Math.floor(Math.random() * collectibles.length)]
    : { emoji: obstacles[Math.floor(Math.random() * obstacles.length)], points: 0 };

  const element = document.createElement('div');
  element.className = 'falling-item';
  element.textContent = itemConfig.emoji;
  element.style.left = `${clamp(randomLane, 0, state.boardWidth - 48)}px`;
  element.style.top = '-48px';
  gameBoard.appendChild(element);

  state.items.push({
    element,
    x: parseFloat(element.style.left),
    y: -48,
    speed: 2.4 + Math.random() * 1.8,
    type: isCollectible ? 'collectible' : 'obstacle',
    points: itemConfig.points,
  });
}

function isColliding(item) {
  const playerRect = {
    left: state.playerX,
    right: state.playerX + 48,
    top: state.boardHeight - 64,
    bottom: state.boardHeight - 16,
  };

  const itemRect = {
    left: item.x,
    right: item.x + 48,
    top: item.y,
    bottom: item.y + 48,
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
  state.animationId = requestAnimationFrame(gameLoop);
}

function startGame() {
  state.score = 0;
  state.targetScore = state.age * 10;
  state.boardWidth = gameBoard.clientWidth;
  state.boardHeight = gameBoard.clientHeight;
  state.playerX = (state.boardWidth / 2) - 24;
  playerCar.style.left = `${state.playerX}px`;
  clearItems();
  updateHud();
  showScreen(gameScreen);

  state.running = true;
  state.spawnTimerId = setInterval(spawnItem, 900);
  gameLoop();
}

setupForm.addEventListener('submit', (event) => {
  event.preventDefault();

  // Personalization happens here: values are read from the form and kept only in memory.
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

  // Core game targets are personalized from the player age.
  startGame();
});

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();

  if (key === 'arrowleft' || key === 'a') {
    movePlayer(-1);
  }

  if (key === 'arrowright' || key === 'd') {
    movePlayer(1);
  }
});

moveLeftButton.addEventListener('click', () => movePlayer(-1));
moveRightButton.addEventListener('click', () => movePlayer(1));
restartButton.addEventListener('click', () => {
  stopGameLoop();
  showScreen(setupScreen);
  setupForm.reset();
  fullNameInput.focus();
});

window.addEventListener('resize', () => {
  if (!state.running) {
    return;
  }

  state.boardWidth = gameBoard.clientWidth;
  state.boardHeight = gameBoard.clientHeight;
  state.playerX = clamp(state.playerX, 0, state.boardWidth - 48);
  playerCar.style.left = `${state.playerX}px`;
});
