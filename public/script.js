// script.js
const wsProto = (location.protocol === 'https:') ? 'wss://' : 'ws://';
const wsUrl = wsProto + location.host;
const ws = new WebSocket(wsUrl);

const overlay = document.getElementById('overlay');
const statusEl = document.getElementById('status');
const playersEl = document.getElementById('players');
const resetBtn = document.getElementById('resetBtn');

let you = null;
let board = Array(9).fill(null);
let currentTurn = 'X';

// Create 9 cells (responsive — uses percentages so it works on your image)
for (let i = 0; i < 9; i++) {
  const div = document.createElement('div');
  div.className = 'cell';
  div.dataset.index = i;
  const mark = document.createElement('div');
  mark.className = 'mark';
  mark.innerText = '';
  div.appendChild(mark);
  overlay.appendChild(div);

  div.addEventListener('click', () => {
    // send move if possible
    if (!you || you === 'observer') return;
    if (board[i]) return;
    if (you !== currentTurn) return;
    ws.send(JSON.stringify({ type: 'move', index: i }));
  });
}

function renderBoard() {
  const cells = document.querySelectorAll('.cell');
  cells.forEach((c, idx) => {
    const mark = c.querySelector('.mark');
    mark.innerText = board[idx] || '';
  });
}

function setStatus(text) {
  statusEl.innerText = text;
}

function setPlayers(counts) {
  playersEl.innerHTML = `Players — X: ${counts.X}, O: ${counts.O}`;
}

ws.addEventListener('open', () => {
  setStatus('Connected — waiting for server data...');
});

ws.addEventListener('message', (ev) => {
  try {
    const data = JSON.parse(ev.data);
    if (data.type === 'init') {
      you = data.you;
      board = data.board;
      currentTurn = data.currentTurn;
      renderBoard();
      setStatus(`You are "${you}"`);
      setPlayers(data.playersCount || { X:0, O:0 });
    } else if (data.type === 'state') {
      board = data.board;
      currentTurn = data.currentTurn;
      renderBoard();
      setStatus(`Turn: ${currentTurn} — you: ${you}`);
    } else if (data.type === 'meta') {
      setPlayers(data.playersCount);
    } else if (data.type === 'gameOver') {
      board = data.board;
      renderBoard();
      if (data.winner) setStatus(`Game Over — Winner: ${data.winner}`);
      else setStatus('Game Over — Draw');
    } else if (data.type === 'error') {
      // show temporary error
      const prev = statusEl.innerText;
      setStatus('Error: ' + data.message);
      setTimeout(() => setStatus(prev), 2500);
    }
  } catch (e) {
    console.error('Failed to parse', e);
  }
});

ws.addEventListener('close', () => {
  setStatus('Disconnected — reconnecting may be required');
});

// reset button
resetBtn.addEventListener('click', () => {
  ws.send(JSON.stringify({ type: 'reset' }));
});

function drawX(ctx, cx, cy, size) {
    ctx.lineWidth = 6;

    // White outline
    ctx.strokeStyle = "white";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(cx - size, cy - size);
    ctx.lineTo(cx + size, cy + size);
    ctx.moveTo(cx + size, cy - size);
    ctx.lineTo(cx - size, cy + size);
    ctx.stroke();

    // Inner black lines
    ctx.strokeStyle = "black";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cx - size, cy - size);
    ctx.lineTo(cx + size, cy + size);
    ctx.moveTo(cx + size, cy - size);
    ctx.lineTo(cx - size, cy + size);
    ctx.stroke();
}

function drawO(ctx, cx, cy, size) {
    ctx.lineWidth = 6;

    // White outline
    ctx.strokeStyle = "white";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, size, 0, Math.PI * 2);
    ctx.stroke();

    // Inner black circle
    ctx.strokeStyle = "black";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, size, 0, Math.PI * 2);
    ctx.stroke();
}
