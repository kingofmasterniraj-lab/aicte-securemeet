import "dotenv/config";
import http from "http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Server } from "socket.io";
import { v4 as uuid } from "uuid";

const app = express();
const server = http.createServer(app);

const PORT = Number(process.env.PORT || 5000);
const JWT_SECRET = process.env.JWT_SECRET || "development-only-change-me";
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: CLIENT_URL, credentials: false }));
app.use(express.json({ limit: "1mb" }));
app.use(rateLimit({ windowMs: 60_000, limit: 120 }));

const io = new Server(server, {
  cors: { origin: CLIENT_URL, methods: ["GET", "POST"] }
});

const users = new Map();
const meetings = new Map();

async function seed() {
  const passwordHash = await bcrypt.hash("DemoPass123!", 12);
  const demo = [
    ["demo.admin@securemeet.local", "Demo Administrator", "Admin"],
    ["demo.hod@securemeet.local", "Demo HOD", "HOD"],
    ["demo.faculty@securemeet.local", "Demo Faculty", "Faculty"],
    ["demo.institute@securemeet.local", "Demo Institute", "Institute"]
  ];

  for (const [email, name, role] of demo) {
    users.set(email, {
      id: uuid(), email, name, role, passwordHash
    });
  }
}

function sign(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: "2h" }
  );
}

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Authentication required" });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function roles(...allowed) {
  return (req, res, next) =>
    allowed.includes(req.user.role)
      ? next()
      : res.status(403).json({ error: "Insufficient permissions" });
}

app.get("/api/health", (_, res) => {
  res.json({ ok: true, service: "AICTE SecureMeet API", demo: true });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const user = users.get(email.toLowerCase().trim());
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  res.json({
    token: sign(user),
    user: {
      id: user.id, email: user.email, name: user.name, role: user.role
    }
  });
});

app.get("/api/me", auth, (req, res) => {
  res.json({ user: req.user });
});

app.get("/api/meetings", auth, (_, res) => {
  res.json([...meetings.values()]);
});

app.post("/api/meetings", auth, (req, res) => {
  const { title, scheduledAt } = req.body || {};
  if (!title || typeof title !== "string" || title.length > 120) {
    return res.status(400).json({ error: "Valid meeting title is required" });
  }

  const id = uuid();
  const meeting = {
    id,
    title: title.trim(),
    scheduledAt: scheduledAt || new Date().toISOString(),
    hostId: req.user.sub,
    hostName: req.user.name,
    status: "scheduled",
    createdAt: new Date().toISOString()
  };

  meetings.set(id, meeting);
  res.status(201).json(meeting);
});

app.get("/api/admin/stats", auth, roles("Admin"), (_, res) => {
  res.json({
    users: users.size,
    meetings: meetings.size,
    activeRooms: io.sockets.adapter.rooms.size,
    mode: "demo"
  });
});

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication required"));
    socket.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    next(new Error("Invalid token"));
  }
});

io.on("connection", socket => {
  socket.on("meeting:join", ({ meetingId }) => {
    if (!meetings.has(meetingId)) return;
    socket.join(meetingId);
    socket.to(meetingId).emit("peer:joined", { peerId: socket.id });
  });

  socket.on("peer:offer", ({ meetingId, targetId, offer }) => {
    io.to(targetId).emit("peer:offer", {
      fromId: socket.id, offer
    });
  });

  socket.on("peer:answer", ({ targetId, answer }) => {
    io.to(targetId).emit("peer:answer", {
      fromId: socket.id, answer
    });
  });

  socket.on("peer:ice", ({ targetId, candidate }) => {
    io.to(targetId).emit("peer:ice", {
      fromId: socket.id, candidate
    });
  });

  socket.on("meeting:chat", ({ meetingId, message }) => {
    if (typeof message !== "string") return;
    const clean = message.trim().slice(0, 1000);
    if (!clean) return;
    io.to(meetingId).emit("meeting:chat", {
      id: uuid(), sender: socket.user.name, message: clean,
      at: new Date().toISOString()
    });
  });

  socket.on("disconnecting", () => {
    for (const room of socket.rooms) {
      if (room !== socket.id) socket.to(room).emit("peer:left", { peerId: socket.id });
    }
  });
});

seed().then(() => {
  server.listen(PORT, () => console.log(`SecureMeet API running on :${PORT}`));
});
