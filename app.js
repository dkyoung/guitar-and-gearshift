const setupScreen = document.getElementById('setup-screen');
const gameScreen = document.getElementById('game-screen');
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
const pauseButton = document.getElementById('pause-button');
const boardOverlay = document.getElementById('board-overlay');
const overlayState = document.getElementById('overlay-state');
const overlayTitle = document.getElementById('overlay-title');
const overlayBody = document.getElementById('overlay-body');
const overlayPlayer = document.getElementById('overlay-player');
const overlayScore = document.getElementById('overlay-score');
const overlayTarget = document.getElementById('overlay-target');
const shareButton = document.getElementById('share-button');
const shareFeedback = document.getElementById('share-feedback');
const resumeButton = document.getElementById('resume-button');
const restartButton = document.getElementById('restart-button');
const resetButton = document.getElementById('reset-button');
const cancelButton = document.getElementById('cancel-button');
const exitButton = document.getElementById('exit-button');
const stoppedActions = document.getElementById('stopped-actions');
const stoppedRestartButton = document.getElementById('stopped-restart');
const stoppedResetButton = document.getElementById('stopped-reset');
const stoppedExitButton = document.getElementById('stopped-exit');
const audioToggleButton = document.getElementById('audio-toggle');

const LANE_COUNT = 3;
const PLAYER_BOTTOM_OFFSET = 18;
const SAFE_START_DURATION = 1600;
const INITIAL_SPAWN_DELAY = 950;
const MIN_SPAWN_DELAY = 400;
const SPAWN_ACCELERATION = 35;
const INITIAL_STATUS = 'Grab 🎸 🎂 🎵, dodge 🕳️ 🚧, and use Arrow keys, A / D, or the buttons below.';
const GAME_URL = 'https://dkyoung.github.io/guitar-and-gearshift/';
// Debug: obstacle collision fairness is tuned here so an obstacle must enter deeper into the player zone before crashing.
const OBSTACLE_FATAL_ZONE_DEPTH = 0.35;

// Debug: effective hitboxes are tuned here so collisions match the visible emoji/art instead of full containers.
// Debug: player hitbox tuning keeps the car collision box centered inside the visible emoji/art.
const PLAYER_HITBOX_SCALE_X = 0.48;
const PLAYER_HITBOX_SCALE_Y = 0.6;
// Debug: collectible hitbox tuning stays a bit forgiving so pickups still feel friendly.
const COLLECTIBLE_HITBOX_SCALE = { x: 0.46, y: 0.5 };
// Debug: pothole hitbox tuning stays close to the current collision feel.
const POTHOLE_HITBOX_SCALE = { x: 0.4, y: 0.45 };
// Debug: barrier hitbox tuning is smaller so crashes line up better with the visible barricade.
const BARRIER_HITBOX_SCALE = { x: 0.24, y: 0.28 };
const collectibles = [
  { emoji: '🎸', points: 10 },
  { emoji: '🎂', points: 15 },
  { emoji: '🎵', points: 5 },
];
const obstacles = ['🕳️', '🚧'];

const PHASES = {
  SETUP: 'setup',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAMEOVER: 'gameover',
  STOPPED: 'stopped',
};

const AUDIO_STATES = {
  MENU: 'menu',
  GAMEPLAY: 'gameplay',
  PAUSED: 'paused',
  WIN: 'win',
  CRASH: 'crash',
  PICKUP: 'pickup',
};

// Debug: plug real audio files into these placeholder paths later without changing the audio state logic below.
const AUDIO_ASSETS = {
  loops: {
    [AUDIO_STATES.MENU]: { src: 'audio/menu-loop.mp3', volume: 0.38 },
    [AUDIO_STATES.GAMEPLAY]: { src: 'audio/gameplay-loop.mp3', volume: 0.44 },
    [AUDIO_STATES.PAUSED]: { src: 'audio/paused-loop.mp3', volume: 0.24 },
  },
  stings: {
    [AUDIO_STATES.WIN]: { src: 'audio/win-sting.mp3', volume: 0.68 },
    [AUDIO_STATES.CRASH]: { src: 'audio/crash-sting.mp3', volume: 0.72 },
    // Debug: pickup sting tuning stays here so collectible grabs can layer cleanly over the gameplay loop.
    [AUDIO_STATES.PICKUP]: { src: 'audio/pickup-sting.mp3', volume: 0.34, allowOverlap: true },
  },
};

function createAudioClip({ src, volume }, { loop = false } = {}) {
  const clip = new Audio(src);
  clip.loop = loop;
  clip.preload = 'none';
  clip.volume = volume;
  return clip;
}

const audioManager = {
  hasInteracted: false,
  isMuted: false,
  desiredLoopState: AUDIO_STATES.MENU,
  currentLoopState: '',
  currentLoop: null,
  loopClips: new Map(),
  soundClips: new Map(),
  activeSoundClips: new Set(),
  activePickupClips: new Set(),

  init() {
    const unlockAudio = () => {
      if (this.hasInteracted) {
        return;
      }

      this.hasInteracted = true;
      document.removeEventListener('pointerdown', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);

      // Debug: setup/menu audio only starts after a user gesture so mobile autoplay rules are respected.
      if (this.desiredLoopState) {
        this.playLoop(this.desiredLoopState);
      }
    };

    document.addEventListener('pointerdown', unlockAudio);
    document.addEventListener('keydown', unlockAudio);
    document.addEventListener('touchstart', unlockAudio);
    this.updateToggleButton();
  },

  getLoopClip(stateKey) {
    const config = AUDIO_ASSETS.loops[stateKey];

    if (!config) {
      return null;
    }

    if (!this.loopClips.has(stateKey)) {
      this.loopClips.set(stateKey, createAudioClip(config, { loop: true }));
    }

    return this.loopClips.get(stateKey);
  },

  getSoundClip(stateKey) {
    const config = AUDIO_ASSETS.stings[stateKey];

    if (!config) {
      return null;
    }

    if (!this.soundClips.has(stateKey)) {
      this.soundClips.set(stateKey, createAudioClip(config));
    }

    return this.soundClips.get(stateKey);
  },

  applyMuteState() {
    const clips = [this.currentLoop, ...this.soundClips.values(), ...this.activeSoundClips].filter(Boolean);
    clips.forEach((clip) => {
      clip.muted = this.isMuted;
    });
  },

  safePlay(clip) {
    if (!clip) {
      return;
    }

    try {
      const playAttempt = clip.play();

      if (playAttempt && typeof playAttempt.catch === 'function') {
        playAttempt.catch(() => {
          // Debug: missing placeholder files or blocked playback should fail silently until real audio is added.
        });
      }
    } catch (error) {
      // Debug: keep gameplay stable even if an audio file is missing or the browser blocks playback.
    }
  },

  stopLoop() {
    if (!this.currentLoop) {
      return;
    }

    this.currentLoop.pause();
    this.currentLoop.currentTime = 0;
    this.currentLoop = null;
    this.currentLoopState = '';
  },

  playLoop(stateKey) {
    this.desiredLoopState = stateKey;

    if (!this.hasInteracted) {
      return;
    }

    const nextLoop = this.getLoopClip(stateKey);

    if (!nextLoop) {
      this.stopLoop();
      return;
    }

    if (this.currentLoop === nextLoop) {
      this.applyMuteState();
      this.safePlay(nextLoop);
      return;
    }

    this.stopLoop();
    this.currentLoop = nextLoop;
    this.currentLoopState = stateKey;
    this.currentLoop.currentTime = 0;
    this.applyMuteState();
    this.safePlay(this.currentLoop);
  },

  playSound(stateKey) {
    if (!this.hasInteracted) {
      return;
    }

    const sound = this.getSoundClip(stateKey);
    const config = AUDIO_ASSETS.stings[stateKey];

    if (!sound || !config) {
      return;
    }

    const clipToPlay = config.allowOverlap ? createAudioClip(config) : sound;

    if (!config.allowOverlap) {
      clipToPlay.pause();
      clipToPlay.currentTime = 0;
    } else {
      // Debug: pickup overlap tuning keeps fast collectible chains audible without turning into a wall of sound.
      if (stateKey === AUDIO_STATES.PICKUP) {
        const activePickupCount = this.activePickupClips.size;
        clipToPlay.volume = config.volume * Math.max(0.6, 1 - (activePickupCount * 0.18));
        clipToPlay.playbackRate = 0.97 + (Math.random() * 0.06);
        this.activePickupClips.add(clipToPlay);
      }

      this.activeSoundClips.add(clipToPlay);
      clipToPlay.addEventListener('ended', () => {
        this.activePickupClips.delete(clipToPlay);
        this.activeSoundClips.delete(clipToPlay);
      }, { once: true });
    }

    this.applyMuteState();
    this.safePlay(clipToPlay);
  },

  // Debug: audio state switching is centralized here so setup, gameplay, pause, win, and crash all use one simple path.
  transitionTo(stateKey) {
    if (stateKey === AUDIO_STATES.WIN || stateKey === AUDIO_STATES.CRASH) {
      this.stopLoop();
      this.playSound(stateKey);
      return;
    }

    this.playLoop(stateKey);
  },

  toggleMute() {
    this.isMuted = !this.isMuted;
    this.applyMuteState();
    this.updateToggleButton();
  },

  // Debug: mute logic is kept in one place so the button always reflects whether every clip is muted.
  updateToggleButton() {
    audioToggleButton.textContent = this.isMuted ? 'Music: Off' : 'Music: On';
    audioToggleButton.setAttribute('aria-pressed', String(this.isMuted));
    audioToggleButton.setAttribute('aria-label', this.isMuted ? 'Turn music on' : 'Turn music off');
  },
};

const state = {
  fullName: '',
  firstName: '',
  age: 0,
  score: 0,
  targetScore: 0,
  phase: PHASES.SETUP,
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
  pauseStartedAt: 0,
  lastRunWon: false,
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

function setStatus(message, tone = '') {
  statusText.textContent = message;
  statusText.classList.remove('status-win', 'status-loss');

  if (tone) {
    statusText.classList.add(tone);
  }
}

function updateHud() {
  playerNameLabel.textContent = state.firstName;
  scoreLabel.textContent = state.score;
  targetScoreLabel.textContent = state.targetScore;
}

function updatePlayingStatus() {
  const pointsLeft = Math.max(state.targetScore - state.score, 0);
  setStatus(`${state.firstName}, collect ${pointsLeft} more points and avoid the hazards.`);
}

function showScreen(screenToShow) {
  [setupScreen, gameScreen].forEach((screen) => {
    screen.classList.toggle('hidden', screen !== screenToShow);
  });
}

function clearItems() {
  state.items.forEach((item) => item.element.remove());
  state.items = [];
}

function stopGameLoop() {
  if (state.animationId) {
    cancelAnimationFrame(state.animationId);
    state.animationId = null;
  }

  if (state.spawnTimerId) {
    clearTimeout(state.spawnTimerId);
    state.spawnTimerId = null;
  }
}

function setPhase(nextPhase) {
  state.phase = nextPhase;
  const isPlaying = nextPhase === PHASES.PLAYING;
  pauseButton.textContent = isPlaying ? 'Pause' : 'Paused';
  pauseButton.disabled = !isPlaying;
  moveLeftButton.disabled = !isPlaying;
  moveRightButton.disabled = !isPlaying;
  stoppedActions.classList.toggle('hidden', nextPhase !== PHASES.STOPPED);
}

function populateOverlay() {
  overlayPlayer.textContent = state.fullName || state.firstName || 'Player';
  overlayScore.textContent = state.score;
  overlayTarget.textContent = state.targetScore;
}

function setShareFeedback(message = '') {
  shareFeedback.textContent = message;
  shareFeedback.classList.toggle('hidden', !message);
}

// Debug: share message is built here so completed runs use one short result summary in both native and fallback sharing.
function buildShareMessage(includeLink = true) {
  const resultText = state.lastRunWon
    ? `I cleared my run with ${state.score}/${state.targetScore} in Guitar & Gearshift!`
    : `I scored ${state.score}/${state.targetScore} in Guitar & Gearshift.`;

  return includeLink ? `${resultText} Can you beat it? Play here: ${GAME_URL}` : `${resultText} Can you beat it?`;
}

async function copyShareMessage(message) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(message);
    return;
  }

  const helper = document.createElement('textarea');
  helper.value = message;
  helper.setAttribute('readonly', '');
  helper.style.position = 'absolute';
  helper.style.left = '-9999px';
  document.body.appendChild(helper);
  helper.select();
  const copied = document.execCommand('copy');
  helper.remove();

  if (!copied) {
    throw new Error('Clipboard copy failed.');
  }
}

// Debug: native share vs clipboard fallback is handled here so the end-of-run card works well on mobile and desktop browsers.
async function shareResult() {
  if (state.phase !== PHASES.GAMEOVER) {
    return;
  }

  const shareText = buildShareMessage(false);
  const shareMessage = buildShareMessage(true);
  const shareData = {
    title: 'Guitar & Gearshift',
    text: shareText,
    url: GAME_URL,
  };

  setShareFeedback('');
  shareButton.disabled = true;

  try {
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (error) {
        if (error && error.name === 'AbortError') {
          return;
        }
      }
    }

    await copyShareMessage(shareMessage);
    setShareFeedback('Share text copied! Paste it into a message and challenge your friends.');
  } catch (error) {
    setShareFeedback('Sharing is unavailable here, but you can still tell friends to play the game link above.');
  } finally {
    shareButton.disabled = false;
  }
}

// Debug: end-of-run overlay/card handling is managed here so the final board stays visible behind the summary.
function showOverlay({ stateLabel, title, body, showResume = false, showShare = false }) {
  populateOverlay();
  overlayState.textContent = stateLabel;
  overlayTitle.textContent = title;
  overlayBody.textContent = body;
  resumeButton.classList.toggle('hidden', !showResume);
  shareButton.classList.toggle('hidden', !showShare);
  setShareFeedback('');
  boardOverlay.classList.remove('hidden');
}

function hideOverlay() {
  setShareFeedback('');
  boardOverlay.classList.add('hidden');
}

function resetGameBoardView() {
  hideOverlay();
  stoppedActions.classList.add('hidden');
  setStatus(INITIAL_STATUS);
}

function freezeBoard(phase) {
  stopGameLoop();
  setPhase(phase);
}

// Debug: pause/resume state handling lives here so the board can freeze without losing the current run state.
function pauseGame() {
  if (state.phase !== PHASES.PLAYING) {
    return;
  }

  state.pauseStartedAt = Date.now();
  audioManager.transitionTo(AUDIO_STATES.PAUSED);
  freezeBoard(PHASES.PAUSED);
  setStatus(`${state.firstName}, your ride is paused. Resume when you're ready.`);
  showOverlay({
    stateLabel: 'Paused',
    title: 'Game Paused',
    body: 'Take a breather, check the road, and resume when you want to keep driving.',
    showResume: true,
    showShare: false,
  });
}

function resumeGame() {
  if (state.phase !== PHASES.PAUSED) {
    return;
  }

  const pauseDuration = Date.now() - state.pauseStartedAt;
  audioManager.transitionTo(AUDIO_STATES.GAMEPLAY);
  state.gameStartTime += pauseDuration;
  state.collisionsEnabledAt += pauseDuration;
  state.pauseStartedAt = 0;
  hideOverlay();
  setPhase(PHASES.PLAYING);
  updatePlayingStatus();
  scheduleNextSpawn();
  gameLoop();
}

function showGameOverOverlay(isWin) {
  const title = isWin ? 'Birthday Road Cleared!' : 'Crash!';
  const body = isWin
    ? `${state.firstName}, you reached your goal and unlocked Age ${state.age}.`
    : `${state.firstName}, the ride is over, but your final board is still here to enjoy.`;

  showOverlay({
    stateLabel: isWin ? 'Run Complete' : 'Run Over',
    title,
    body,
    showResume: false,
    showShare: true,
  });
}

function endGame(isWin) {
  state.lastRunWon = isWin;
  audioManager.transitionTo(isWin ? AUDIO_STATES.WIN : AUDIO_STATES.CRASH);
  freezeBoard(PHASES.GAMEOVER);
  showGameOverOverlay(isWin);

  if (isWin) {
    setStatus(`Great driving, ${state.firstName}! Final score ${state.score}/${state.targetScore}.`, 'status-win');
    return;
  }

  setStatus(`${state.firstName}, the crash ended this run. Final score ${state.score}/${state.targetScore}.`, 'status-loss');
}

function syncBoardMetrics() {
  const computed = window.getComputedStyle(document.documentElement);
  state.boardWidth = gameBoard.clientWidth;
  state.boardHeight = gameBoard.clientHeight;
  state.playerSize = Number.parseFloat(computed.getPropertyValue('--player-size')) || 82;
  state.itemSize = Number.parseFloat(computed.getPropertyValue('--item-size')) || 60;
}

function scheduleNextSpawn() {
  if (state.phase !== PHASES.PLAYING) {
    return;
  }

  state.spawnTimerId = window.setTimeout(() => {
    if (state.phase !== PHASES.PLAYING) {
      return;
    }

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

function getItemHitboxScale(itemType, itemEmoji) {
  if (itemType === 'collectible') {
    return COLLECTIBLE_HITBOX_SCALE;
  }

  if (itemEmoji === '🕳️') {
    return POTHOLE_HITBOX_SCALE;
  }

  return BARRIER_HITBOX_SCALE;
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
  if (state.phase !== PHASES.PLAYING) {
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
  if (state.phase !== PHASES.PLAYING || !state.lanes.length) {
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
  const itemHitboxScale = getItemHitboxScale(
    isCollectible ? 'collectible' : 'obstacle',
    itemConfig.emoji
  );

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
    hitboxScale: itemHitboxScale,
    points: itemConfig.points,
  });
}

function getItemRect(item) {
  const itemHitboxScale = item.hitboxScale;

  return getCenteredHitbox(
    item.x,
    item.y,
    state.itemSize,
    state.itemSize,
    itemHitboxScale.x,
    itemHitboxScale.y
  );
}

function areRectsOverlapping(rectA, rectB) {
  return !(
    rectA.right <= rectB.left ||
    rectA.left >= rectB.right ||
    rectA.bottom <= rectB.top ||
    rectA.top >= rectB.bottom
  );
}

function isColliding(item) {
  const playerRect = getPlayerRect();
  const itemRect = getItemRect(item);

  // Debug: collision overlap is calculated here using centered inner hitboxes.
  return areRectsOverlapping(playerRect, itemRect);
}

function isObstacleCrashCollision(item) {
  const playerRect = getPlayerRect();
  const itemRect = getItemRect(item);

  if (!areRectsOverlapping(playerRect, itemRect)) {
    return false;
  }

  const playerHeight = playerRect.bottom - playerRect.top;
  const fatalLineY = playerRect.top + playerHeight * OBSTACLE_FATAL_ZONE_DEPTH;

  return itemRect.top >= fatalLineY;
}

function updateItems() {
  const collisionsActive = !isSafeStartActive();

  state.items = state.items.filter((item) => {
    item.y += item.speed;
    item.element.style.top = `${item.y}px`;

    // Debug: obstacle collision fairness is implemented here, while collectible pickups stay immediate.
    if (collisionsActive && item.type === 'obstacle' && isObstacleCrashCollision(item)) {
      endGame(false);
      return true;
    }

    if (collisionsActive && item.type === 'collectible' && isColliding(item)) {
      item.element.remove();
      // Debug: pickup sound is triggered here exactly when a collectible is successfully collected.
      audioManager.playSound(AUDIO_STATES.PICKUP);
      state.score += item.points;
      updateHud();

      if (state.score >= state.targetScore) {
        endGame(true);
        return true;
      }

      updatePlayingStatus();
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
  if (state.phase !== PHASES.PLAYING) {
    return;
  }

  updateItems();
  state.animationId = window.requestAnimationFrame(gameLoop);
}

function isEditableElement(element) {
  if (!(element instanceof Element)) {
    return false;
  }

  return Boolean(element.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])'));
}

function shouldHandleMovementKey(event) {
  const key = event.key.toLowerCase();
  const isMovementKey = key === 'arrowleft' || key === 'arrowright' || key === 'a' || key === 'd';

  if (!isMovementKey) {
    return false;
  }

  return state.phase === PHASES.PLAYING && !gameScreen.classList.contains('hidden') && !isEditableElement(document.activeElement);
}

function startGame() {
  stopGameLoop();
  clearItems();
  showScreen(gameScreen);
  audioManager.transitionTo(AUDIO_STATES.GAMEPLAY);
  calculateLanes();
  state.score = 0;
  state.targetScore = state.age * 10;
  state.spawnDelay = INITIAL_SPAWN_DELAY;
  state.gameStartTime = Date.now();
  state.collisionsEnabledAt = state.gameStartTime + SAFE_START_DURATION;
  state.pauseStartedAt = 0;
  state.lastRunWon = false;

  // Debug: spawn position is set here so the player begins centered in a valid lane.
  state.playerLane = Math.floor(state.lanes.length / 2);
  renderPlayer();

  // Debug: player size is controlled via CSS custom properties read in syncBoardMetrics().
  updateHud();
  setStatus(`${state.firstName}, get ready! Hazards become dangerous in ${SAFE_START_DURATION / 1000} seconds.`);
  hideOverlay();
  setPhase(PHASES.PLAYING);

  spawnItem(true);
  scheduleNextSpawn();
  gameLoop();
}

function handleDirectionalButton(direction) {
  movePlayer(direction);
}

function bindMovementButton(button, direction) {
  const handler = () => handleDirectionalButton(direction);

  if (window.PointerEvent) {
    button.addEventListener('pointerup', handler);
    return;
  }

  button.addEventListener('click', handler);
}

// Debug: restart/reset/exit behavior is grouped here so each action stays predictable from paused or finished runs.
function restartRun() {
  startGame();
}

function returnToSetup({ clearInputs }) {
  stopGameLoop();
  clearItems();
  resetGameBoardView();
  audioManager.transitionTo(AUDIO_STATES.MENU);
  setPhase(PHASES.SETUP);
  showScreen(setupScreen);

  if (clearInputs) {
    setupForm.reset();
  }

  fullNameInput.focus();
}

function cancelOverlay() {
  hideOverlay();
  stopGameLoop();
  audioManager.transitionTo(AUDIO_STATES.MENU);
  setPhase(PHASES.STOPPED);
  setStatus(`${state.firstName}, the run is stopped. Restart to replay or exit to setup.`);
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
  if (!shouldHandleMovementKey(event)) {
    return;
  }

  const key = event.key.toLowerCase();
  event.preventDefault();

  if (key === 'arrowleft' || key === 'a') {
    movePlayer(-1);
  }

  if (key === 'arrowright' || key === 'd') {
    movePlayer(1);
  }
});

bindMovementButton(moveLeftButton, -1);
bindMovementButton(moveRightButton, 1);
audioManager.init();
audioManager.transitionTo(AUDIO_STATES.MENU);
audioToggleButton.addEventListener('click', () => {
  audioManager.toggleMute();
});
pauseButton.addEventListener('click', pauseGame);
resumeButton.addEventListener('click', resumeGame);
shareButton.addEventListener('click', () => {
  void shareResult();
});
restartButton.addEventListener('click', restartRun);
resetButton.addEventListener('click', () => returnToSetup({ clearInputs: true }));
cancelButton.addEventListener('click', cancelOverlay);
exitButton.addEventListener('click', () => returnToSetup({ clearInputs: false }));
stoppedRestartButton.addEventListener('click', restartRun);
stoppedResetButton.addEventListener('click', () => returnToSetup({ clearInputs: true }));
stoppedExitButton.addEventListener('click', () => returnToSetup({ clearInputs: false }));

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
setPhase(PHASES.SETUP);
birthDateInput.max = new Date().toISOString().split('T')[0];
