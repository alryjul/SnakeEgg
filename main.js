(() => {
  const BOARD_SIZE = 20;
  const TICK_MS = 120;

  const DIRECTIONS = {
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
    w: { x: 0, y: -1 },
    s: { x: 0, y: 1 },
    a: { x: -1, y: 0 },
    d: { x: 1, y: 0 },
  };

  const OPPOSITES = new Map([
    ["0,-1", "0,1"],
    ["0,1", "0,-1"],
    ["-1,0", "1,0"],
    ["1,0", "-1,0"],
  ]);

  const board = document.getElementById("board");
  const overlay = document.getElementById("overlay");
  const overlayText = document.getElementById("overlay-text");
  const eggMan = document.getElementById("egg-man");
  const laughAudio = document.getElementById("evil-laugh");
  const scoreEl = document.getElementById("score");
  const pauseBtn = document.getElementById("pause");

  const cells = [];

  function createGrid(size) {
    board.style.setProperty("--size", size);
    board.innerHTML = "";
    cells.length = 0;
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.x = String(x);
        cell.dataset.y = String(y);
        board.appendChild(cell);
        cells.push(cell);
      }
    }
  }

  function indexFor(x, y, size) {
    return y * size + x;
  }

  function pointsEqual(a, b) {
    return a.x === b.x && a.y === b.y;
  }

  function nextHead(head, dir) {
    return { x: head.x + dir.x, y: head.y + dir.y };
  }

  function wrap(point, size) {
    return {
      x: (point.x + size) % size,
      y: (point.y + size) % size,
    };
  }

  function occupies(snake, point) {
    return snake.some((segment) => pointsEqual(segment, point));
  }

  function placeFood(size, snake, rng) {
    const open = [];
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const point = { x, y };
        if (!occupies(snake, point)) {
          open.push(point);
        }
      }
    }
    if (open.length === 0) {
      return null;
    }
    const index = Math.floor(rng() * open.length);
    return open[index];
  }

  function createGame(rng = Math.random) {
    const startPos = Math.floor(BOARD_SIZE / 2);
    const state = {
      size: BOARD_SIZE,
      snake: [
        { x: startPos, y: startPos },
        { x: startPos - 1, y: startPos },
        { x: startPos - 2, y: startPos },
      ],
      dir: { x: 1, y: 0 },
      pendingDir: { x: 1, y: 0 },
      food: null,
      score: 0,
      status: "idle",
    };

    state.food = placeFood(state.size, state.snake, rng);

    function reset() {
      const fresh = createGame(rng).getState();
      state.size = fresh.size;
      state.snake = fresh.snake;
      state.dir = fresh.dir;
      state.pendingDir = fresh.pendingDir;
      state.food = fresh.food;
      state.score = 0;
      state.status = "idle";
    }

    function start() {
      if (state.status === "idle" || state.status === "gameover" || state.status === "won") {
        state.status = "playing";
      }
    }

    function setDirection(next) {
      const key = `${state.dir.x},${state.dir.y}`;
      const nextKey = `${next.x},${next.y}`;
      if (OPPOSITES.get(key) === nextKey) {
        return;
      }
      state.pendingDir = next;
    }

    function step() {
      if (state.status !== "playing") {
        return;
      }
      state.dir = state.pendingDir;
      const head = state.snake[0];
      const next = wrap(nextHead(head, state.dir), state.size);
      const tail = state.snake[state.snake.length - 1];
      const hitSelf = occupies(state.snake, next) && !pointsEqual(next, tail);

      if (hitSelf) {
        state.status = "gameover";
        return;
      }

      const ateFood = state.food && pointsEqual(next, state.food);
      state.snake.unshift(next);
      if (!ateFood) {
        state.snake.pop();
      } else {
        state.score += 1;
        state.food = placeFood(state.size, state.snake, rng);
        if (!state.food) {
          state.status = "won";
        }
      }
    }

    function togglePause() {
      if (state.status === "playing") {
        state.status = "paused";
      } else if (state.status === "paused") {
        state.status = "playing";
      }
    }

    function getState() {
      return JSON.parse(JSON.stringify(state));
    }

    return { reset, start, setDirection, step, togglePause, getState };
  }

  createGrid(BOARD_SIZE);
  const game = createGame();
  const scolds = [
    "Is that all you've got?",
    "Pathetic. Try harder.",
    "You call that a snake?",
    "Do better. Much better.",
    "Embarrassing performance.",
    "Hopeless. Try again.",
  ];
  let lastStatus = game.getState().status;
  let currentScold = "";
  let audioUnlocked = false;
  let laughVolume = 1;
  if (laughAudio) {
    laughAudio.autoplay = false;
    laughAudio.loop = false;
    laughAudio.pause();
    laughAudio.currentTime = 0;
    laughVolume = typeof laughAudio.volume === "number" ? laughAudio.volume : 1;
    laughAudio.muted = true;
    laughAudio.volume = 0;
  }
  if (eggMan) {
    const preload = new Image();
    preload.src = eggMan.src;
  }

  function render(state) {
    cells.forEach((cell) => {
      cell.className = "cell";
    });

    state.snake.forEach((segment, index) => {
      const cell = cells[indexFor(segment.x, segment.y, state.size)];
      if (!cell) {
        return;
      }
      cell.classList.add(index === 0 ? "cell--head" : "cell--snake");
    });

    if (state.food) {
      const foodCell = cells[indexFor(state.food.x, state.food.y, state.size)];
      if (foodCell) {
        foodCell.classList.add("cell--food");
      }
    }

    scoreEl.textContent = String(state.score);

    if (state.status === "paused") {
      overlayText.textContent = "Paused";
      overlay.classList.remove("hidden");
      eggMan.classList.add("hidden");
    } else if (state.status === "idle") {
      overlayText.textContent = "Press Start";
      overlay.classList.remove("hidden");
      eggMan.classList.add("hidden");
    } else if (state.status === "gameover") {
      if (lastStatus !== "gameover") {
        currentScold = scolds[Math.floor(Math.random() * scolds.length)];
        if (laughAudio && laughAudio.readyState >= 2) {
          if (audioUnlocked) {
            laughAudio.muted = false;
            laughAudio.volume = laughVolume;
            laughAudio.currentTime = 0;
            laughAudio.play().catch(() => {});
          }
        }
      }
      overlayText.textContent = currentScold;
      overlay.classList.remove("hidden");
      eggMan.classList.remove("hidden");
    } else if (state.status === "won") {
      overlayText.textContent = "You Win";
      overlay.classList.remove("hidden");
      eggMan.classList.add("hidden");
    } else {
      overlay.classList.add("hidden");
      eggMan.classList.add("hidden");
    }

    lastStatus = state.status;
  }

  function handleKey(event) {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (key in DIRECTIONS) {
      event.preventDefault();
      unlockAudio();
      game.setDirection(DIRECTIONS[key]);
      if (game.getState().status === "idle") {
        game.start();
      }
      return;
    }

    if (key === " " || key === "Spacebar") {
      event.preventDefault();
      unlockAudio();
      game.togglePause();
      return;
    }

    if (key === "r" || key === "R") {
      event.preventDefault();
      unlockAudio();
      game.reset();
      game.start();
    }

    if (key === "Enter") {
      event.preventDefault();
      unlockAudio();
      game.start();
    }
  }

  document.addEventListener("keydown", handleKey);
  const startBtn = document.getElementById("start");
  const updatePauseLabel = () => {
    const status = game.getState().status;
    pauseBtn.textContent = status === "paused" ? "Resume" : "Pause";
  };
  const updateStartLabel = () => {
    const status = game.getState().status;
    startBtn.textContent = status === "idle" ? "Start" : "Restart";
  };
  const unlockAudio = () => {
    if (!laughAudio || audioUnlocked) {
      return;
    }
    laughAudio.muted = true;
    laughAudio.volume = 0;
    laughAudio.play()
      .then(() => {
        laughAudio.pause();
        laughAudio.currentTime = 0;
        audioUnlocked = true;
      })
      .catch(() => {});
  };
  startBtn.addEventListener("click", () => {
    unlockAudio();
    if (game.getState().status === "idle") {
      game.start();
    } else {
      game.reset();
      game.start();
    }
  });
  pauseBtn.addEventListener("click", () => {
    unlockAudio();
    game.togglePause();
    updatePauseLabel();
  });

  let touchStart = null;
  let swipeHandled = false;
  const SWIPE_THRESHOLD = 22;

  function handleTouchStart(event) {
    if (event.touches.length !== 1) {
      return;
    }
    unlockAudio();
    const touch = event.touches[0];
    touchStart = { x: touch.clientX, y: touch.clientY };
    swipeHandled = false;
  }

  function applySwipe(dx, dy) {
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (Math.max(absX, absY) < SWIPE_THRESHOLD) {
      return false;
    }
    if (absX > absY) {
      game.setDirection(dx > 0 ? DIRECTIONS.ArrowRight : DIRECTIONS.ArrowLeft);
    } else {
      game.setDirection(dy > 0 ? DIRECTIONS.ArrowDown : DIRECTIONS.ArrowUp);
    }
    if (game.getState().status === "idle") {
      game.start();
    }
    return true;
  }

  function handleTouchMove(event) {
    if (!touchStart || swipeHandled) {
      return;
    }
    event.preventDefault();
    const touch = event.touches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    if (applySwipe(dx, dy)) {
      swipeHandled = true;
    }
  }

  function handleTouchEnd(event) {
    if (!touchStart) {
      return;
    }
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    if (!swipeHandled) {
      applySwipe(dx, dy);
    }
    touchStart = null;
    swipeHandled = false;
  }

  board.addEventListener("click", () => {
    unlockAudio();
    if (game.getState().status === "idle") {
      game.start();
    }
  });
  board.addEventListener("touchstart", handleTouchStart, { passive: true });
  board.addEventListener("touchmove", handleTouchMove, { passive: false });
  board.addEventListener("touchend", handleTouchEnd, { passive: true });

  render(game.getState());
  updatePauseLabel();
  updateStartLabel();
  setInterval(() => {
    game.step();
    render(game.getState());
    updatePauseLabel();
    updateStartLabel();
  }, TICK_MS);
})();
