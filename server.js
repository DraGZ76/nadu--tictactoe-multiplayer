// server.js
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

// Game state (single shared game)
let board = Array(9).fill(null); // null or 'X'/'O'
let currentTurn = "X";
let players = new Map(); // ws => symbol ('X'/'O')
let symbolCount = { X: 0, O: 0 };

function broadcast(obj) {
  const str = JSON.stringify(obj);
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(str);
  });
}

function resetGame() {
  board = Array(9).fill(null);
  currentTurn = "X";
  players.clear();
  symbolCount = { X: 0, O: 0 };
}

wss.on("connection", (ws) => {
  // Assign symbol if available
  let assigned = null;
  if (symbolCount.X === 0) {
    assigned = 'X'; symbolCount.X++;
    players.set(ws, 'X');
  } else if (symbolCount.O === 0) {
    assigned = 'O'; symbolCount.O++;
    players.set(ws, 'O');
  } else {
    assigned = 'observer';
  }

  // Send initial state to the new client
  ws.send(JSON.stringify({
    type: "init",
    board,
    currentTurn,
    you: assigned,
    playersCount: { X: symbolCount.X, O: symbolCount.O }
  }));

  // Notify all that a client connected (useful to update UI)
  broadcast({
    type: "meta",
    playersCount: { X: symbolCount.X, O: symbolCount.O }
  });

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.type === "move") {
        const idx = data.index;
        const symbol = players.get(ws);
        // Validate
        if (!["X", "O"].includes(symbol)) {
          ws.send(JSON.stringify({ type: "error", message: "Spectators cannot play" }));
          return;
        }
        if (symbol !== currentTurn) {
          ws.send(JSON.stringify({ type: "error", message: "Not your turn" }));
          return;
        }
        if (typeof idx !== "number" || idx < 0 || idx > 8) {
          ws.send(JSON.stringify({ type: "error", message: "Invalid index" }));
          return;
        }
        if (board[idx] !== null) {
          ws.send(JSON.stringify({ type: "error", message: "Cell already taken" }));
          return;
        }

        // Make move
        board[idx] = symbol;

        // Check win or draw
        const winner = checkWinner(board);
        const isDraw = !winner && board.every(cell => cell !== null);

        if (winner) {
          broadcast({ type: "gameOver", winner, board });
          // Reset after a short delay (clients can implement their own)
          setTimeout(() => {
            board = Array(9).fill(null);
            currentTurn = "X";
            broadcast({ type: "state", board, currentTurn });
          }, 4000);
          return;
        } else if (isDraw) {
          broadcast({ type: "gameOver", winner: null, board });
          setTimeout(() => {
            board = Array(9).fill(null);
            currentTurn = "X";
            broadcast({ type: "state", board, currentTurn });
          }, 4000);
          return;
        }

        // Toggle turn
        currentTurn = currentTurn === "X" ? "O" : "X";
        broadcast({ type: "state", board, currentTurn });
      } else if (data.type === "reset") {
        board = Array(9).fill(null);
        currentTurn = "X";
        broadcast({ type: "state", board, currentTurn });
      }
    } catch (e) {
      console.error("Error parsing message:", e);
    }
  });

  ws.on("close", () => {
    // Release symbol if any
    const sym = players.get(ws);
    if (sym === 'X') symbolCount.X = Math.max(0, symbolCount.X - 1);
    else if (sym === 'O') symbolCount.O = Math.max(0, symbolCount.O - 1);
    players.delete(ws);

    broadcast({
      type: "meta",
      playersCount: { X: symbolCount.X, O: symbolCount.O }
    });
  });
});

function checkWinner(b) {
  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
  for (let line of lines) {
    const [a,b1,c] = line;
    if (b[a] && b[a] === b[b1] && b[a] === b[c]) return b[a];
  }
  return null;
}

server.listen(PORT, () => {
  console.log("Server listening on port", PORT);
});
