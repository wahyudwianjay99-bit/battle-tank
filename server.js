
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const W = 800;
const H = 600;
const MAX_PLAYERS = 5;

const players = {};
let bullets = [];
let nextBulletId = 1;

const spawnPoints = [
  [100, 100],
  [700, 500],
  [700, 100],
  [100, 500],
  [400, 300]
];

const colors = [
  "#38bdf8", "#fb7185", "#a3e635",
  "#fbbf24", "#c084fc"
];

io.on("connection", socket => {
  const ids = Object.keys(players);

  if (ids.length >= MAX_PLAYERS) {
    socket.emit("full");
    socket.disconnect(true);
    return;
  }

  const index = ids.length;
  const [x, y] = spawnPoints[index];

  players[socket.id] = {
    id: socket.id,
    name: "Pemain " + (index + 1),
    x, y,
    angle: 0,
    hp: 100,
    color: colors[index],
    inputX: 0,
    inputY: 0,
    shooting: false,
    lastShot: 0
  };

  socket.emit("welcome", { id: socket.id });
  io.emit("state", { players, bullets, width: W, height: H });

  socket.on("input", data => {
    const p = players[socket.id];
    if (!p || !data) return;

    const x = Number(data.x);
    const y = Number(data.y);
    const a = Number(data.angle);

    p.inputX = Number.isFinite(x)
      ? Math.max(-1, Math.min(1, x)) : 0;
    p.inputY = Number.isFinite(y)
      ? Math.max(-1, Math.min(1, y)) : 0;

    if (Number.isFinite(a)) p.angle = a;
    p.shooting = data.shooting === true;
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    bullets = bullets.filter(b => b.owner !== socket.id);

    // Atur ulang warna dan nama pemain yang tersisa.
    Object.values(players).forEach((p, i) => {
      p.name = "Pemain " + (i + 1);
      p.color = colors[i];
    });

    io.emit("state", { players, bullets, width: W, height: H });
  });
});

function respawn(p) {
  p.hp = 100;
  p.x = 400;
  p.y = 300;
}

setInterval(() => {
  for (const p of Object.values(players)) {
    p.x += p.inputX * 3;
    p.y += p.inputY * 3;

    p.x = Math.max(22, Math.min(W - 22, p.x));
    p.y = Math.max(22, Math.min(H - 22, p.y));

    if (p.shooting && Date.now() - p.lastShot >= 450) {
      p.lastShot = Date.now();

      bullets.push({
        id: nextBulletId++,
        owner: p.id,
        x: p.x + Math.cos(p.angle) * 25,
        y: p.y + Math.sin(p.angle) * 25,
        vx: Math.cos(p.angle) * 7,
        vy: Math.sin(p.angle) * 7,
        life: 100
      });
    }
  }

  for (const b of bullets) {
    b.x += b.vx;
    b.y += b.vy;
    b.life--;

    for (const p of Object.values(players)) {
      if (p.id === b.owner) continue;

      if (Math.hypot(p.x - b.x, p.y - b.y) < 25) {
        p.hp -= 25;
        b.life = 0;

        if (p.hp <= 0) respawn(p);
        break;
      }
    }
  }

  bullets = bullets.filter(b =>
    b.life > 0 &&
    b.x >= 0 && b.x <= W &&
    b.y >= 0 && b.y <= H
  );

  io.volatile.emit("state", {
    players, bullets, width: W, height: H
  });
}, 1000 / 30);

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log("Tank Online berjalan di port " + PORT);
});
          
