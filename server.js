const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const ADMIN_TOKEN_HASH = process.env.RESPONSE_ADMIN_TOKEN_HASH || "fb7cd66cd9802076b019b15ddf51cfbfd6ae603642a4153a5b78ae8696515bd4";
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "reactions.json");

const app = express();
app.use(express.json({ limit: "16kb" }));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Token-Hash");

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
});

let store = {
  votes: {},
  updatedAt: new Date().toISOString(),
};

let mutationQueue = Promise.resolve();
const streamClients = new Set();

function sanitizeResponseType(responseType) {
  return responseType === "interested" || responseType === "excited" ? responseType : "";
}

function sanitizeVoterId(voterId) {
  if (typeof voterId !== "string") {
    return "";
  }

  const normalized = voterId.trim();
  return /^[A-Za-z0-9_-]{8,128}$/.test(normalized) ? normalized : "";
}

function getCounts() {
  const counts = { interested: 0, excited: 0 };
  const voteValues = Object.values(store.votes);

  for (let i = 0; i < voteValues.length; i += 1) {
    const vote = voteValues[i];
    if (vote === "interested") {
      counts.interested += 1;
    } else if (vote === "excited") {
      counts.excited += 1;
    }
  }

  return counts;
}

function buildState(reason) {
  const counts = getCounts();

  return {
    counts,
    total: counts.interested + counts.excited,
    updatedAt: store.updatedAt,
    reason: reason || "snapshot",
  };
}

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(DATA_FILE);
  } catch (error) {
    const initial = {
      votes: {},
      updatedAt: new Date().toISOString(),
    };

    await fs.writeFile(DATA_FILE, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function loadStore() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object") {
      return;
    }

    const votes = parsed.votes && typeof parsed.votes === "object" ? parsed.votes : {};
    const updatedAt = typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString();

    store = {
      votes,
      updatedAt,
    };
  } catch (error) {
    console.error("Unable to load persisted reactions. Starting with defaults.");
  }
}

async function persistStore() {
  const tempFile = DATA_FILE + ".tmp";
  await fs.writeFile(tempFile, JSON.stringify(store, null, 2), "utf8");
  await fs.rename(tempFile, DATA_FILE);
}

function broadcastState(reason) {
  const payload = JSON.stringify(buildState(reason));

  streamClients.forEach((client) => {
    if (client.writableEnded) {
      streamClients.delete(client);
      return;
    }

    client.write("event: counts\\n");
    client.write("data: " + payload + "\\n\\n");
  });
}

function queueMutation(mutate, reason) {
  const resultPromise = mutationQueue.then(async () => {
    const result = await mutate();

    if (result && result.changed) {
      store.updatedAt = new Date().toISOString();
      await persistStore();
      broadcastState(reason);
    }

    return result && Object.prototype.hasOwnProperty.call(result, "data") ? result.data : undefined;
  });

  mutationQueue = resultPromise.catch((error) => {
    console.error("Mutation processing failed:", error);
  });

  return resultPromise;
}

app.get("/api/reactions", (req, res) => {
  res.json(buildState("snapshot"));
});

app.get("/api/reactions/vote-status", (req, res) => {
  const voterId = sanitizeVoterId(req.query.voterId);

  if (!voterId) {
    res.json({ hasVoted: false, responseType: "", updatedAt: store.updatedAt });
    return;
  }

  const responseType = sanitizeResponseType(store.votes[voterId]);
  res.json({
    hasVoted: Boolean(responseType),
    responseType,
    updatedAt: store.updatedAt,
  });
});

app.post("/api/reactions", async (req, res) => {
  const responseType = sanitizeResponseType(req.body && req.body.responseType);
  const voterId = sanitizeVoterId(req.body && req.body.voterId);

  if (!responseType || !voterId) {
    res.status(400).json({ error: "invalid_payload" });
    return;
  }

  try {
    const outcome = await queueMutation(() => {
      const existingResponse = sanitizeResponseType(store.votes[voterId]);

      if (existingResponse) {
        return {
          changed: false,
          data: {
            duplicate: true,
            responseType: existingResponse,
          },
        };
      }

      store.votes[voterId] = responseType;
      return {
        changed: true,
        data: {
          duplicate: false,
          responseType,
        },
      };
    }, "vote");

    const state = buildState("vote");

    if (outcome && outcome.duplicate) {
      res.status(409).json({
        error: "already_voted",
        responseType: outcome.responseType,
        counts: state.counts,
        total: state.total,
        updatedAt: state.updatedAt,
      });
      return;
    }

    res.status(201).json({
      counts: state.counts,
      total: state.total,
      updatedAt: state.updatedAt,
      responseType: outcome && outcome.responseType ? outcome.responseType : responseType,
    });
  } catch (error) {
    console.error("Unable to record vote:", error);
    res.status(500).json({ error: "internal_error" });
  }
});

app.post("/api/reactions/reset", async (req, res) => {
  const providedHash = String(req.header("X-Admin-Token-Hash") || "").trim();

  if (!providedHash || providedHash !== ADMIN_TOKEN_HASH) {
    res.status(403).json({ error: "forbidden" });
    return;
  }

  try {
    await queueMutation(() => {
      store.votes = {};
      return {
        changed: true,
        data: {},
      };
    }, "reset");

    const state = buildState("reset");
    res.json({
      counts: state.counts,
      total: state.total,
      updatedAt: state.updatedAt,
    });
  } catch (error) {
    console.error("Unable to reset votes:", error);
    res.status(500).json({ error: "internal_error" });
  }
});

app.get("/api/reactions/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }

  const initialPayload = JSON.stringify(buildState("snapshot"));
  res.write("event: counts\\n");
  res.write("data: " + initialPayload + "\\n\\n");

  streamClients.add(res);

  const keepAlive = setInterval(() => {
    if (!res.writableEnded) {
      res.write(": keep-alive\\n\\n");
    }
  }, 25000);

  req.on("close", () => {
    clearInterval(keepAlive);
    streamClients.delete(res);
  });
});

app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

async function startServer() {
  await ensureDataFile();
  await loadStore();

  app.listen(PORT, HOST, () => {
    console.log("Shared reaction server running at http://localhost:" + PORT);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
