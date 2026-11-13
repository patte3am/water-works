// Water Works - Project 6 development
const DIFFICULTIES = {
  easy: {
    name: 'Easy',
    goal: 15,
    duration: 45,
    spawnInterval: 1100,
    pollutionChance: 0.12,
    itemLifetime: 2200
  },
  normal: {
    name: 'Normal',
    goal: 20,
    duration: 30,
    spawnInterval: 850,
    pollutionChance: 0.22,
    itemLifetime: 1750
  },
  hard: {
    name: 'Hard',
    goal: 25,
    duration: 20,
    spawnInterval: 620,
    pollutionChance: 0.32,
    itemLifetime: 1350
  }
};

const MILESTONES = [
  { percent: 25, message: '25% there! Every drop counts.' },
  { percent: 50, message: 'Halfway to your clean water goal!' },
  { percent: 75, message: '75% there! Keep the clean water flowing.' },
  { percent: 100, message: 'Goal reached! You made every drop count!' }
];

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
let difficultyKey = 'normal';
let timeLeft = DIFFICULTIES[difficultyKey].duration;
let gameActive = false;
let isMuted = false;
let countdownTimer = null;
let spawnTimer = null;
let confettiTimeout = null;
let audioContext = null;
let activeItems = new Map();
let milestonesShown = new Set();

const scoreEl = document.getElementById('score');
const goalEl = document.getElementById('goal');
const timerEl = document.getElementById('timer');
const gameInstructionsEl = document.getElementById('game-instructions');
const gameStatusEl = document.getElementById('game-status');
const milestoneMessageEl = document.getElementById('milestone-message');
const messageContainerEl = document.getElementById('message-container');
const startButton = document.getElementById('start-game');
const resetButton = document.getElementById('reset-game');
const muteButton = document.getElementById('mute-toggle');
const difficultySelect = document.getElementById('difficulty');
const confettiLayer = document.getElementById('confetti-layer');
const timeChip = document.getElementById('time-chip');
const goalProgress = document.getElementById('goal-progress');
const goalProgressFill = document.getElementById('goal-progress-fill');
const grid = document.querySelector('.game-grid');

function getDifficulty() {
  return DIFFICULTIES[difficultyKey];
}

function createGrid() {
  grid.innerHTML = '';

  for (let i = 0; i < 9; i += 1) {
    const cell = document.createElement('div');
    cell.className = 'grid-cell';
    cell.setAttribute('data-index', i);
    grid.appendChild(cell);
  }
}

function clearGrid() {
  activeItems.forEach((expiryTimer) => clearTimeout(expiryTimer));
  activeItems.clear();

  grid.querySelectorAll('.grid-cell').forEach((cell) => {
    cell.innerHTML = '';
    cell.classList.remove('shake');
  });
}

function updateScoreDisplay() {
  scoreEl.textContent = String(score);
  goalEl.textContent = String(getDifficulty().goal);
  goalProgress.setAttribute('aria-valuemax', String(getDifficulty().goal));
  goalProgress.setAttribute('aria-valuenow', String(score));
  goalProgressFill.style.width = `${Math.min(score / getDifficulty().goal, 1) * 100}%`;
}

function updateTimerDisplay() {
  timerEl.textContent = `${timeLeft}s`;
  timeChip.classList.toggle('warning', timeLeft <= 10 && timeLeft > 0);
}

function updateDifficultyDetails() {
  const difficulty = getDifficulty();
  gameInstructionsEl.textContent =
    `Collect ${difficulty.goal} clean water drops in ${difficulty.duration} seconds. Avoid polluted water!`;
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

  confettiTimeout = setTimeout(removeConfetti, 4200);
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

  requestAnimationFrame(() => feedback.classList.add('visible'));
  setTimeout(() => feedback.remove(), 650);
}

function playSound(effect) {
  if (isMuted) {
    return;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }

  if (!audioContext) {
    audioContext = new AudioContextClass();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }

  const sounds = {
    collect: { notes: [659, 880], wave: 'sine', duration: 0.09 },
    polluted: { notes: [220, 165], wave: 'sawtooth', duration: 0.12 },
    start: { notes: [392, 523, 659], wave: 'triangle', duration: 0.11 },
    win: { notes: [523, 659, 784, 1046], wave: 'triangle', duration: 0.14 },
    loss: { notes: [392, 330, 262, 196], wave: 'sine', duration: 0.16 }
  };
  const sound = sounds[effect];
  if (!sound) {
    return;
  }

  const startAt = audioContext.currentTime + 0.015;
  sound.notes.forEach((frequency, index) => {
    const noteStart = startAt + index * sound.duration;
    const oscillator = audioContext.createOscillator();
    const volume = audioContext.createGain();
    oscillator.type = sound.wave;
    oscillator.frequency.setValueAtTime(frequency, noteStart);
    volume.gain.setValueAtTime(0.0001, noteStart);
    volume.gain.exponentialRampToValueAtTime(0.12, noteStart + 0.015);
    volume.gain.exponentialRampToValueAtTime(0.0001, noteStart + sound.duration);
    oscillator.connect(volume);
    volume.connect(audioContext.destination);
    oscillator.start(noteStart);
    oscillator.stop(noteStart + sound.duration);
  });
}

function updateMilestones() {
  const reached = MILESTONES.find((milestone) => (
    score >= Math.ceil(getDifficulty().goal * milestone.percent / 100)
    && !milestonesShown.has(milestone.percent)
  ));

  if (reached) {
    milestonesShown.add(reached.percent);
    milestoneMessageEl.textContent = reached.message;
  }
}

function createItem(cell, type) {
  const item = document.createElement('button');
  item.type = 'button';
  item.dataset.type = type;
  item.className = `game-item ${type}`;
  item.setAttribute('aria-label', type === 'polluted' ? 'Polluted water, avoid' : 'Clean water, collect');
  item.innerHTML = `<span class="item-icon" aria-hidden="true">${type === 'polluted' ? '⚠' : '💧'}</span>`;

  item.addEventListener('click', () => {
    if (!gameActive || !item.isConnected || item.classList.contains('collected')) {
      return;
    }

    clearTimeout(activeItems.get(item));
    activeItems.delete(item);
    item.classList.add('collected');
    item.disabled = true;

    if (type === 'polluted') {
      score = Math.max(0, score - 2);
      setStatus('Polluted water! 2 points lost.');
      cell.classList.add('shake');
      showFloatingFeedback(cell, '-2', 'negative');
      setTimeout(() => cell.classList.remove('shake'), 350);
      playSound('polluted');
    } else {
      score += 1;
      setStatus('Clean water collected!');
      showFloatingFeedback(cell, '+1', 'positive');
      playSound('collect');
    }

    updateScoreDisplay();
    updateMilestones();
    setTimeout(() => item.remove(), 150);

    if (type === 'clean' && score >= getDifficulty().goal) {
      endGame('win');
    }
  });

  cell.appendChild(item);
  requestAnimationFrame(() => item.classList.add('active'));

  const expiryTimer = setTimeout(() => {
    activeItems.delete(item);
    item.remove();
  }, getDifficulty().itemLifetime);
  activeItems.set(item, expiryTimer);
}

function spawnItem() {
  if (!gameActive) {
    return;
  }

  const emptyCells = [...grid.querySelectorAll('.grid-cell')]
    .filter((cell) => !cell.querySelector('.game-item'));

  if (emptyCells.length === 0) {
    return;
  }

  const targetCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  const type = Math.random() < getDifficulty().pollutionChance ? 'polluted' : 'clean';
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
  timeLeft = getDifficulty().duration;
  gameActive = false;
  milestonesShown = new Set();
  milestoneMessageEl.textContent = '';
  difficultySelect.disabled = false;
  updateDifficultyDetails();
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
  timeLeft = getDifficulty().duration;
  gameActive = true;
  milestonesShown = new Set();
  milestoneMessageEl.textContent = '';
  difficultySelect.disabled = true;

  updateScoreDisplay();
  updateTimerDisplay();
  updateDifficultyDetails();
  setStatus(`Playing ${getDifficulty().name} mode. Collect clean water!`);
  startButton.disabled = true;
  startButton.textContent = 'Game Running';

  playSound('start');
  spawnTimer = setInterval(spawnItem, getDifficulty().spawnInterval);
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
  difficultySelect.disabled = false;

  const message = result === 'win'
    ? randomChoice(winningMessages)
    : randomChoice(losingMessages);

  showResult(message, result);
  setStatus(result === 'win' ? 'You won!' : 'Game over');
  playSound(result);

  if (result === 'win') {
    launchConfetti();
    startButton.textContent = 'Play Again';
  } else {
    startButton.textContent = 'Try Again';
  }

  startButton.disabled = false;
}

difficultySelect.addEventListener('change', () => {
  if (gameActive) {
    return;
  }

  difficultyKey = difficultySelect.value;
  resetBoardState();
  setStatus(`${getDifficulty().name} mode selected`);
});

startButton.addEventListener('click', startGame);
resetButton.addEventListener('click', resetBoardState);
muteButton.addEventListener('click', () => {
  isMuted = !isMuted;
  muteButton.setAttribute('aria-pressed', String(isMuted));
  muteButton.setAttribute('aria-label', isMuted ? 'Turn game sounds on' : 'Mute game sounds');
  muteButton.textContent = isMuted ? 'Sound: Off' : 'Sound: On';
});

createGrid();
resetBoardState();
