(function () {
  const SIZE = 4;
  let grid = [];
  let score = 0;
  let best = 0;
  let won = false;
  let gameOver = false;

  const boardEl = document.getElementById('board');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlayText = document.getElementById('overlayText');
  const overlayBtn = document.getElementById('overlayBtn');

  best = parseInt(localStorage.getItem('best2048') || '0', 10);
  bestEl.textContent = best;

  function emptyGrid() {
    return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  }

  function addRandomTile() {
    const empty = [];
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (grid[r][c] === 0) empty.push({ r, c });
    if (empty.length === 0) return;
    const { r, c } = empty[Math.floor(Math.random() * empty.length)];
    grid[r][c] = Math.random() < 0.9 ? 2 : 4;
  }

  function render() {
    boardEl.innerHTML = '';
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        const v = grid[r][c];
        if (v !== 0) {
          const tile = document.createElement('div');
          const cls = v <= 2048 ? 't' + v : 'tsuper';
          tile.className = 'tile ' + cls;
          tile.textContent = v;
          tile.style.position = 'absolute';
          tile.style.inset = '0';
          cell.appendChild(tile);
        }
        boardEl.appendChild(cell);
      }
    }
    scoreEl.textContent = score;
    bestEl.textContent = best;
  }

  function slideRow(row) {
    const arr = row.filter(v => v !== 0);
    const result = [];
    let gained = 0;
    let merged = false;
    for (let i = 0; i < arr.length; i++) {
      if (i + 1 < arr.length && arr[i] === arr[i + 1]) {
        const v = arr[i] * 2;
        result.push(v);
        gained += v;
        i++;
        merged = true;
      } else {
        result.push(arr[i]);
      }
    }
    while (result.length < SIZE) result.push(0);
    return { row: result, gained, merged };
  }

  function move(direction) {
    let moved = false;
    let totalGained = 0;
    let anyMerged = false;

    const rotate = (g) => {
      const ng = emptyGrid();
      for (let r = 0; r < SIZE; r++)
        for (let c = 0; c < SIZE; c++)
          ng[SIZE - 1 - c][r] = g[r][c];
      return ng;
    };

    let g = grid;
    // 统一方向:把要移动的轴变换到"向左"处理
    if (direction === 'up') g = rotate(rotate(rotate(grid)));
    else if (direction === 'down') g = rotate(grid);
    else if (direction === 'right') {
      g = grid.map(row => row.slice().reverse());
    }

    const result = [];
    for (let r = 0; r < SIZE; r++) {
      const sl = slideRow(g[r]);
      result.push(direction === 'right' ? sl.row.slice().reverse() : sl.row);
      totalGained += sl.gained;
      if (sl.gained > 0) anyMerged = true;
    }

    // 变换回原方向
    let newGrid;
    if (direction === 'up') {
      newGrid = emptyGrid();
      for (let r = 0; r < SIZE; r++)
        for (let c = 0; c < SIZE; c++)
          newGrid[r][c] = result[SIZE - 1 - c][r];
    } else if (direction === 'down') {
      newGrid = emptyGrid();
      for (let r = 0; r < SIZE; r++)
        for (let c = 0; c < SIZE; c++)
          newGrid[c][SIZE - 1 - r] = result[r][c];
    } else {
      newGrid = result;
    }

    // 判断是否真的移动了
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (newGrid[r][c] !== grid[r][c]) moved = true;

    if (!moved) return false;

    grid = newGrid;
    score += totalGained;
    if (score > best) {
      best = score;
      localStorage.setItem('best2048', best);
    }
    return true;
  }

  function canMove() {
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++) {
        if (grid[r][c] === 0) return true;
        if (c + 1 < SIZE && grid[r][c] === grid[r][c + 1]) return true;
        if (r + 1 < SIZE && grid[r][c] === grid[r + 1][c]) return true;
      }
    return false;
  }

  function checkState() {
    if (!won && grid.some(row => row.includes(2048))) {
      won = true;
      showOverlay('你赢了!', '成功拼出 2048,太棒了!', '继续游戏');
      return;
    }
    if (!canMove()) {
      gameOver = true;
      showOverlay('游戏结束', '已经没有可移动的格子了', '再来一局');
    }
  }

  function showOverlay(title, text, btnText) {
    overlayTitle.textContent = title;
    overlayText.textContent = text;
    overlayBtn.textContent = btnText;
    overlay.classList.add('show');
  }

  function hideOverlay() {
    overlay.classList.remove('show');
  }

  function step(direction) {
    if (gameOver && !won) return;
    const moved = move(direction);
    if (moved) {
      addRandomTile();
      render();
      checkState();
    }
  }

  function newGame() {
    grid = emptyGrid();
    score = 0;
    won = false;
    gameOver = false;
    addRandomTile();
    addRandomTile();
    hideOverlay();
    render();
  }

  // 键盘
  document.addEventListener('keydown', (e) => {
    const map = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      w: 'up', s: 'down', a: 'left', d: 'right',
      W: 'up', S: 'down', A: 'left', D: 'right'
    };
    const dir = map[e.key];
    if (dir) {
      e.preventDefault();
      step(dir);
    }
  });

  // 触摸滑动
  let touchStartX = 0, touchStartY = 0;
  const board = document.querySelector('.board');
  board.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  board.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      step(dx > 0 ? 'right' : 'left');
    } else {
      step(dy > 0 ? 'down' : 'up');
    }
  }, { passive: true });

  overlayBtn.addEventListener('click', () => {
    if (won) { hideOverlay(); checkState(); }
    else newGame();
  });

  document.getElementById('newGame').addEventListener('click', newGame);

  newGame();
})();
