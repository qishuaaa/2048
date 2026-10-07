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

  // ---- 音效 ----
  let audioCtx = null;
  let soundOn = true;

  function getAudioCtx() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { audioCtx = null; }
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function playMergeSound(value) {
    if (!soundOn) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    const base = 220 + Math.log2(value) * 40;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(base, ctx.currentTime);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(base * 2, ctx.currentTime);
    gain2.gain.setValueAtTime(0.12, ctx.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime);
    osc2.stop(ctx.currentTime + 0.12);
  }

  function playMoveSound() {
    if (!soundOn) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
  }

  // ---- 图片自定义 ----
  const VALUES = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048];
  const STORAGE_KEY = 'tileImages2048';
  let tileImages = loadImages();

  function loadImages() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveImages() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tileImages));
    } catch (e) {
      alert('图片太多或太大,无法保存(浏览器存储已满)。请换小一点的图片。');
    }
  }

  function clearImages() {
    tileImages = {};
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }

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
          const img = tileImages[v];
          if (img) {
            tile.className = 'tile has-img';
            tile.style.backgroundImage = 'url(' + img + ')';
            const num = document.createElement('span');
            num.className = 'tile-num';
            num.textContent = v;
            tile.appendChild(num);
          } else {
            const cls = v <= 2048 ? 't' + v : 'tsuper';
            tile.className = 'tile ' + cls;
            tile.textContent = v;
          }
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
    let maxMerged = 0;
    for (let i = 0; i < arr.length; i++) {
      if (i + 1 < arr.length && arr[i] === arr[i + 1]) {
        const v = arr[i] * 2;
        result.push(v);
        gained += v;
        if (v > maxMerged) maxMerged = v;
        i++;
      } else {
        result.push(arr[i]);
      }
    }
    while (result.length < SIZE) result.push(0);
    return { row: result, gained, maxMerged };
  }

  function move(direction) {
    let moved = false;
    let totalGained = 0;
    let maxMerged = 0;

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
      if (sl.maxMerged > maxMerged) maxMerged = sl.maxMerged;
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

    if (!moved) return { moved: false, maxMerged: 0 };

    grid = newGrid;
    score += totalGained;
    if (score > best) {
      best = score;
      localStorage.setItem('best2048', best);
    }
    return { moved: true, maxMerged };
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
    const res = move(direction);
    if (res.moved) {
      if (res.maxMerged > 0) playMergeSound(res.maxMerged);
      else playMoveSound();
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

  // ---- 音效开关 ----
  const soundToggle = document.getElementById('soundToggle');
  soundToggle.addEventListener('click', () => {
    soundOn = !soundOn;
    soundToggle.textContent = soundOn ? '🔊 音效:开' : '🔇 音效:关';
    if (soundOn) getAudioCtx(); // 解锁 AudioContext
  });

  // 首次交互时解锁音频
  document.addEventListener('pointerdown', function unlockAudio() {
    getAudioCtx();
    document.removeEventListener('pointerdown', unlockAudio);
  }, { once: false });

  // ---- 图片自定义 UI ----
  const uploader = document.getElementById('uploader');
  const uploaderList = document.getElementById('uploaderList');
  const fileInput = document.getElementById('fileInput');

  function renderSlots() {
    uploaderList.innerHTML = '';
    VALUES.forEach((v) => {
      const slot = document.createElement('div');
      slot.className = 'slot';
      const img = tileImages[v];
      if (img) {
        const imEl = document.createElement('img');
        imEl.src = img;
        slot.appendChild(imEl);
      } else {
        const emptyEl = document.createElement('span');
        emptyEl.className = 'slot-empty';
        emptyEl.textContent = '空';
        slot.appendChild(emptyEl);
      }
      const numLab = document.createElement('span');
      numLab.className = 'slot-num';
      numLab.textContent = v;
      slot.appendChild(numLab);
      uploaderList.appendChild(slot);
    });
  }

  function handleFiles(files) {
    const imgFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (imgFiles.length === 0) return;
    let idx = 0;
    VALUES.forEach((v) => {
      if (idx >= imgFiles.length) return;
      if (!tileImages[v]) {
        const f = imgFiles[idx];
        const reader = new FileReader();
        reader.onload = (e) => {
          tileImages[v] = e.target.result;
          saveImages();
          renderSlots();
          render();
        };
        reader.readAsDataURL(f);
        idx++;
      }
    });
  }

  document.getElementById('customize').addEventListener('click', () => {
    uploader.classList.remove('hidden');
    renderSlots();
  });

  document.getElementById('closeUploader').addEventListener('click', () => {
    uploader.classList.add('hidden');
  });

  document.getElementById('uploadBtn').addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
    e.target.value = '';
  });

  document.getElementById('resetImg').addEventListener('click', () => {
    if (confirm('确定恢复默认配色并清除所有自定义图片吗?')) {
      clearImages();
      renderSlots();
      render();
    }
  });

  newGame();
})();
