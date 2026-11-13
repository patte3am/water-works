const GOAL_SCORE = 20;
const GAME_LENGTH = 30;
const SPAWN_INTERVAL_MS = 900;

const winningMessages = [
  'Awesome work! You reached your clean water goal!',
  'Every drop counts! You made a difference!',
  'Water Works Champion! You collected enough clean water!',
  'Mission accomplished! Clean water changes lives!'
];

const losingMessages = [
  'Every drop matters! Give it another try!',
  'You\'re getting closer to your clean water goal!',
  'Keep collecting! You can do it!',
  'Time ran out, but your clean water mission isn\'t over!'
];

let score = 0;
let timeLeft = GAME_LENGTH;
let gameActive = false;
let countdownTimer = null;
let spawnTimer = null;
let confettiTimeout = null;

const scoreEl = document.getElementById('score');
const goalEl = document.getElementById('goal');
const timerEl = document.getElementById('timer');
const gameStatusEl = document.getElementById('game-status');
const messageContainerEl = document.getElementById('message-container');
const startButton = document.getElementById('start-game');
const resetButton = document.getElementById('reset-game');
const confettiLayer = document.getElementById('confetti-layer');
const timeChip = document.getElementById('time-chip');

function createGrid() {
  const grid = document.querySelector('.game-grid');
  grid.innerHTML = '';

  for (let i = 0; i < 9; i += 1) {
    const cell = document.createElement('div');
    cell.className = 'grid-cell';
    cell.setAttribute('data-index', i);
    grid.appendChild(cell);
  }
}

function clearGrid() {
  const cells = document.querySelectorAll('.grid-cell');
  cells.forEach((cell) => {
    cell.innerHTML = '';
    cell.classList.remove('shake');
  });
}

function updateScoreDisplay() {
  scoreEl.textContent = String(score);
  goalEl.textContent = String(GOAL_SCORE);
}

function updateTimerDisplay() {
  timerEl.textContent = `${timeLeft}s`;
  timeChip.classList.toggle('warning', timeLeft < 10 && timeLeft > 0);
}

function setStatus(message) {
  gameStatusEl.textContent = message;
}

function hideResult() {
  messageContainerEl.hidden = true;
  messageContainerEl.textContent = '';
  messageContainerEl.className = 'message-container';
}

function showResult(message, type) {
  messageContainerEl.hidden = false;
  messageContainerEl.className = `message-container ${type}`;
  messageContainerEl.textContent = message;
}

function stopTimers() {
  clearInterval(spawnTimer);
  clearInterval(countdownTimer);
  spawnTimer = null;
  countdownTimer = null;
}

function removeConfetti() {
  confettiLayer.innerHTML = '';
  if (confettiTimeout) {
    clearTimeout(confettiTimeout);
    confettiTimeout = null;
  }
}

function launchConfetti() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  removeConfetti();

  const colors = ['#FFC907', '#2E9DF7', '#FF902A', '#159A48', '#F16061'];

  for (let i = 0; i < 70; i += 1) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.setProperty('--travel-x', `${(Math.random() * 180 - 90).toFixed(0)}px`);
    piece.style.setProperty('--fall-duration', `${(Math.random() * 1.8 + 2.2).toFixed(2)}s`);
    piece.style.setProperty('--rotation-angle', `${(Math.random() * 720 - 360).toFixed(0)}deg`);
    confettiLayer.appendChild(piece);
  }

  confettiTimeout = setTimeout(() => {
    removeConfetti();
  }, 4200);
}

function randomChoice(items) {
  const randomIndex = Math.floor(Math.random() * items.length);
  return items[randomIndex];
}

function showFloatingFeedback(cell, text, type) {
  const feedback = document.createElement('div');
  feedback.className = `floating-feedback ${type}`;
  feedback.textContent = text;
  cell.appendChild(feedback);

  requestAnimationFrame(() => {
    feedback.classList.add('visible');
  });

  setTimeout(() => {
    feedback.remove();
  }, 600);
}

function createItem(cell, type) {
  const item = document.createElement('button');
  item.type = 'button';
  item.dataset.type = type;
  item.className = `game-item ${type}`;
  item.setAttribute('aria-label', type === 'polluted' ? 'Polluted water' : 'Clean water');
  item.innerHTML = '<span class="item-icon">' + (type === 'polluted' ? '⚠' : '💧') + '</span>';

  item.addEventListener('click', (event) => {
    if (!gameActive || item.classList.contains('collected')) {
      return;
    }

    item.classList.add('collected');

    if (type === 'polluted') {
      score = Math.max(0, score - 2);
      setStatus('Polluted Water!');
      cell.classList.add('shake');
      showFloatingFeedback(cell, '-2', 'negative');
      setTimeout(() => cell.classList.remove('shake'), 350);
    } else {
      score += 1;
      setStatus('Clean water collected!');
      showFloatingFeedback(cell, '+1', 'positive');

      if (score >= GOAL_SCORE) {
        endGame('win');
      }
    }

    updateScoreDisplay();
    item.disabled = true;
    setTimeout(() => item.remove(), 140);
  });

  cell.appendChild(item);
  requestAnimationFrame(() => item.classList.add('active'));
}

function spawnItem() {
  if (!gameActive) {
    return;
  }

  const cells = [...document.querySelectorAll('.grid-cell')];
  const emptyCells = cells.filter((cell) => !cell.querySelector('.game-item'));

  if (emptyCells.length === 0) {
    return;
  }

  const targetCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  const type = Math.random() < 0.25 ? 'polluted' : 'clean';
  createItem(targetCell, type);
}

function startCountdown() {
  clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    if (!gameActive) {
      return;
    }

    timeLeft -= 1;

    if (timeLeft <= 0) {
      timeLeft = 0;
      updateTimerDisplay();
      endGame('loss');
      return;
    }

    updateTimerDisplay();
  }, 1000);
}

function resetBoardState() {
  stopTimers();
  clearGrid();
  removeConfetti();
  hideResult();
  score = 0;
  timeLeft = GAME_LENGTH;
  gameActive = false;
  updateScoreDisplay();
  updateTimerDisplay();
  setStatus('Ready to play');
  startButton.disabled = false;
  startButton.textContent = 'Start Game';
}

function startGame() {
  if (gameActive) {
    return;
  }

  stopTimers();
  removeConfetti();
  hideResult();
  clearGrid();

  score = 0;
  timeLeft = GAME_LENGTH;
  gameActive = true;

  updateScoreDisplay();
  updateTimerDisplay();
  setStatus('Playing');
  startButton.disabled = true;
  startButton.textContent = 'Game Running';

  spawnTimer = setInterval(spawnItem, SPAWN_INTERVAL_MS);
  startCountdown();
  spawnItem();
}

function endGame(result) {
  if (!gameActive) {
    return;
  }

  gameActive = false;
  stopTimers();
  clearGrid();

  const message = result === 'win'
    ? randomChoice(winningMessages)
    : randomChoice(losingMessages);

  showResult(message, result);
  setStatus(result === 'win' ? 'You won!' : 'Game over');

  if (result === 'win') {
    launchConfetti();
    startButton.textContent = 'Play Again';
  } else {
    startButton.textContent = 'Try Again';
  }

  startButton.disabled = false;
}

startButton.addEventListener('click', () => {
  if (gameActive) {
    return;
  }
  startGame();
});

resetButton.addEventListener('click', () => {
  resetBoardState();
});

createGrid();
resetBoardState();
