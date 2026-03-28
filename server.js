const express = require("express");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const DEFAULT_ADMIN_TOKEN_HASH = "fb7cd66cd9802076b019b15ddf51cfbfd6ae603642a4153a5b78ae8696515bd4";
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "reactions.json");
const REGISTRATION_EVENT_IDS = new Set([
  "rubiks-cube-competition",
  "sudoku-game-easy-level",
  "codm-tournament",
]);
const INDIVIDUAL_EVENT_IDS = new Set([
  "rubiks-cube-competition",
  "sudoku-game-easy-level",
]);
const TEAM_EVENT_ID = "codm-tournament";
const FAMILY_OPTIONS = ["Family 1 - Claude", "Family 2 - Grok", "Family 3 - Gemini", "Family 4 - Dola"];
const FAMILY_TEAM_PREFIX = {
  "Family 1 - Claude": "A",
  "Family 2 - Grok": "B",
  "Family 3 - Gemini": "C",
  "Family 4 - Dola": "D",
};
const MAX_PARTICIPANTS_PER_FAMILY = 2;
const MAX_PARTICIPANTS_PER_EVENT = 8;
const MAX_TEAMS_PER_FAMILY = 2;
const TEAM_SIZE = 4;
const MAX_TEAMS_PER_EVENT = FAMILY_OPTIONS.length * MAX_TEAMS_PER_FAMILY;
const EVENT_TITLE_MAP = {
  "rubiks-cube-competition": "Rubik's Cube Competition",
  "sudoku-game-easy-level": "Sudoku Game (Easy Level)",
  "codm-tournament": "Call of Duty: Mobile (CODM) Tournament",
};

function normalizeAdminTokenHash(value) {
  if (typeof value !== "string") {
    return "";
  }

  const normalizedValue = value.trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(normalizedValue) ? normalizedValue : "";
}

function hashToken(value) {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function resolveAdminTokenHash() {
  const configuredHash = normalizeAdminTokenHash(process.env.RESPONSE_ADMIN_TOKEN_HASH);
  if (configuredHash) {
    return configuredHash;
  }

  if (typeof process.env.RESPONSE_ADMIN_TOKEN === "string" && process.env.RESPONSE_ADMIN_TOKEN.trim()) {
    return hashToken(process.env.RESPONSE_ADMIN_TOKEN.trim());
  }

  return DEFAULT_ADMIN_TOKEN_HASH;
}

const ADMIN_TOKEN_HASH = resolveAdminTokenHash();

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
  registrations: [],
  updatedAt: new Date().toISOString(),
};

let mutationQueue = Promise.resolve();
const streamClients = new Set();
const registrationStreamClients = new Set();

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

function sanitizeEventId(eventId) {
  if (typeof eventId !== "string") {
    return "";
  }

  const normalized = eventId.trim().toLowerCase();
  return /^[a-z0-9-]{3,80}$/.test(normalized) ? normalized : "";
}

function sanitizeFamily(family) {
  if (typeof family !== "string") {
    return "";
  }

  const normalized = family.trim();
  return FAMILY_OPTIONS.includes(normalized) ? normalized : "";
}

function sanitizePersonName(value) {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  return normalized.slice(0, 80);
}

function sanitizeMembers(members) {
  if (!Array.isArray(members)) {
    return [];
  }

  return members
    .map((member) => sanitizePersonName(member))
    .filter((member) => Boolean(member));
}

function createRegistrationId() {
  return "reg-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

function isRegistrationEventId(eventId) {
  return REGISTRATION_EVENT_IDS.has(eventId);
}

function buildEmptyFamilyCounter() {
  const counters = {};

  for (let i = 0; i < FAMILY_OPTIONS.length; i += 1) {
    counters[FAMILY_OPTIONS[i]] = 0;
  }

  return counters;
}

function getEventRegistrations(eventId) {
  if (!isRegistrationEventId(eventId)) {
    return [];
  }

  return store.registrations.filter((registration) => registration && registration.eventId === eventId);
}

function getRegistrationFamilyLimitMessage(eventId) {
  if (eventId === "sudoku-game-easy-level") {
    return "This family already has 2 participants registered.";
  }

  return "This family has reached the maximum number of participants.";
}

function getTeamLimitMessage() {
  return "This family has already registered the maximum number of teams.";
}

function getRegistrationClosedMessage(eventId) {
  if (eventId === TEAM_EVENT_ID) {
    return "Registration is now closed. Maximum teams reached.";
  }

  return "Registration is now closed. Maximum participants reached.";
}

function getTeamSizeMessage() {
  return "Each team must have exactly 4 members including the Team Captain/Leader.";
}

function buildIndividualStats(eventId, registrations) {
  const familyCounter = buildEmptyFamilyCounter();

  for (let i = 0; i < registrations.length; i += 1) {
    const registration = registrations[i];
    if (familyCounter[registration.family] >= 0) {
      familyCounter[registration.family] += 1;
    }
  }

  const totalParticipants = registrations.length;
  const perFamily = FAMILY_OPTIONS.map((family) => {
    const count = familyCounter[family] || 0;

    return {
      family,
      count,
      limit: MAX_PARTICIPANTS_PER_FAMILY,
      remaining: Math.max(0, MAX_PARTICIPANTS_PER_FAMILY - count),
    };
  });

  const allFamiliesComplete = eventId === "sudoku-game-easy-level"
    ? perFamily.every((entry) => entry.count === MAX_PARTICIPANTS_PER_FAMILY)
    : undefined;

  return {
    mode: "individual",
    totalParticipants,
    maxParticipants: MAX_PARTICIPANTS_PER_EVENT,
    remainingParticipants: Math.max(0, MAX_PARTICIPANTS_PER_EVENT - totalParticipants),
    isClosed: totalParticipants >= MAX_PARTICIPANTS_PER_EVENT,
    perFamily,
    allFamiliesComplete,
  };
}

function buildTeamStats(registrations) {
  const familyCounter = buildEmptyFamilyCounter();

  for (let i = 0; i < registrations.length; i += 1) {
    const registration = registrations[i];
    if (familyCounter[registration.family] >= 0) {
      familyCounter[registration.family] += 1;
    }
  }

  const totalTeams = registrations.length;

  return {
    mode: "team",
    totalTeams,
    maxTeams: MAX_TEAMS_PER_EVENT,
    remainingTeams: Math.max(0, MAX_TEAMS_PER_EVENT - totalTeams),
    isClosed: totalTeams >= MAX_TEAMS_PER_EVENT,
    perFamily: FAMILY_OPTIONS.map((family) => {
      const count = familyCounter[family] || 0;

      return {
        family,
        count,
        limit: MAX_TEAMS_PER_FAMILY,
        remaining: Math.max(0, MAX_TEAMS_PER_FAMILY - count),
      };
    }),
    teams: registrations.map((registration) => ({
      id: registration.id,
      family: registration.family,
      teamLabel: registration.teamLabel,
      teamSize: registration.teamSize,
      submittedAt: registration.submittedAt,
    })),
  };
}

function buildRegistrationStats(eventId, registrations) {
  if (!isRegistrationEventId(eventId)) {
    return null;
  }

  if (INDIVIDUAL_EVENT_IDS.has(eventId)) {
    return buildIndividualStats(eventId, registrations);
  }

  if (eventId === TEAM_EVENT_ID) {
    return buildTeamStats(registrations);
  }

  return null;
}

function buildRegistrationState(eventId, reason) {
  const registrations = getEventRegistrations(eventId);
  const stats = buildRegistrationStats(eventId, registrations);

  return {
    eventId,
    eventTitle: EVENT_TITLE_MAP[eventId] || eventId,
    registrations,
    stats,
    updatedAt: store.updatedAt,
    reason: reason || "snapshot",
  };
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
      registrations: [],
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
    const registrations = Array.isArray(parsed.registrations) ? parsed.registrations : [];
    const updatedAt = typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString();

    store = {
      votes,
      registrations,
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

function broadcastRegistrationState(reason, eventId) {
  if (!isRegistrationEventId(eventId)) {
    return;
  }

  const payload = JSON.stringify(buildRegistrationState(eventId, reason));

  registrationStreamClients.forEach((client) => {
    if (!client || !client.res || client.res.writableEnded) {
      registrationStreamClients.delete(client);
      return;
    }

    if (client.eventId !== eventId) {
      return;
    }

    client.res.write("event: registrations\\n");
    client.res.write("data: " + payload + "\\n\\n");
  });
}

function queueMutation(mutate, reason) {
  const resultPromise = mutationQueue.then(async () => {
    const result = await mutate();

    if (result && result.changed) {
      store.updatedAt = new Date().toISOString();
      await persistStore();

      if (reason === "vote" || reason === "reset") {
        broadcastState(reason);
      }

      if (result.registrationEventId) {
        broadcastRegistrationState(reason, result.registrationEventId);
      }
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
    console.warn("[admin reset] Forbidden reset attempt via /api/reactions/reset.", {
      hasProvidedHash: Boolean(providedHash),
    });
    res.status(403).json({ error: "forbidden", message: "Admin access required." });
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
    res.status(500).json({ error: "internal_error", message: "Unable to reset counts right now. Please try again later." });
  }
});

app.get("/api/event-registrations", (req, res) => {
  const eventId = sanitizeEventId(req.query.eventId);

  if (!isRegistrationEventId(eventId)) {
    res.status(400).json({ error: "invalid_event", message: "Unsupported registration event." });
    return;
  }

  res.json(buildRegistrationState(eventId, "snapshot"));
});

app.post("/api/event-registrations", async (req, res) => {
  const eventId = sanitizeEventId(req.body && req.body.eventId);
  const family = sanitizeFamily(req.body && req.body.family);

  if (!isRegistrationEventId(eventId) || !family) {
    res.status(400).json({ error: "invalid_payload", message: "Invalid event or family." });
    return;
  }

  try {
    const outcome = await queueMutation(() => {
      const registrations = getEventRegistrations(eventId);
      const stats = buildRegistrationStats(eventId, registrations);

      if (!stats) {
        return {
          changed: false,
          data: {
            status: 400,
            error: "invalid_event",
            message: "Unsupported registration event.",
          },
        };
      }

      if (stats.isClosed) {
        return {
          changed: false,
          data: {
            status: 409,
            error: "registration_closed",
            message: getRegistrationClosedMessage(eventId),
          },
        };
      }

      const familyEntry = Array.isArray(stats.perFamily)
        ? stats.perFamily.find((entry) => entry.family === family)
        : null;

      if (!familyEntry) {
        return {
          changed: false,
          data: {
            status: 400,
            error: "invalid_payload",
            message: "Invalid family selection.",
          },
        };
      }

      if (INDIVIDUAL_EVENT_IDS.has(eventId)) {
        if (familyEntry.count >= MAX_PARTICIPANTS_PER_FAMILY) {
          return {
            changed: false,
            data: {
              status: 409,
              error: "family_limit_reached",
              message: getRegistrationFamilyLimitMessage(eventId),
            },
          };
        }

        const participantName = sanitizePersonName(req.body && req.body.name);
        if (!participantName) {
          return {
            changed: false,
            data: {
              status: 400,
              error: "invalid_payload",
              message: "Please enter the participant name.",
            },
          };
        }

        const registration = {
          id: createRegistrationId(),
          eventId,
          eventTitle: EVENT_TITLE_MAP[eventId] || eventId,
          registrationType: "individual",
          family,
          name: participantName,
          submittedAt: new Date().toISOString(),
        };

        store.registrations.push(registration);
        return {
          changed: true,
          registrationEventId: eventId,
          data: {
            status: 201,
            registration,
          },
        };
      }

      if (eventId === TEAM_EVENT_ID) {
        if (familyEntry.count >= MAX_TEAMS_PER_FAMILY) {
          return {
            changed: false,
            data: {
              status: 409,
              error: "family_team_limit_reached",
              message: getTeamLimitMessage(),
            },
          };
        }

        const captain = sanitizePersonName(req.body && req.body.captain);
        const members = sanitizeMembers(req.body && req.body.members);

        if (!captain) {
          return {
            changed: false,
            data: {
              status: 400,
              error: "invalid_payload",
              message: "Please enter the team captain.",
            },
          };
        }

        if (members.length !== TEAM_SIZE - 1) {
          return {
            changed: false,
            data: {
              status: 400,
              error: "invalid_team_size",
              message: getTeamSizeMessage(),
            },
          };
        }

        const teamNumber = familyEntry.count + 1;
        const prefix = FAMILY_TEAM_PREFIX[family] || "X";
        const teamLabel = "Team " + prefix + String(teamNumber);
        const registration = {
          id: createRegistrationId(),
          eventId,
          eventTitle: EVENT_TITLE_MAP[eventId] || eventId,
          registrationType: "team",
          family,
          captain,
          members,
          teamLabel,
          teamSize: TEAM_SIZE,
          submittedAt: new Date().toISOString(),
        };

        store.registrations.push(registration);
        return {
          changed: true,
          registrationEventId: eventId,
          data: {
            status: 201,
            registration,
          },
        };
      }

      return {
        changed: false,
        data: {
          status: 400,
          error: "invalid_event",
          message: "Unsupported registration event.",
        },
      };
    }, "registration:" + eventId);

    const status = outcome && Number.isInteger(outcome.status) ? outcome.status : 500;
    const state = buildRegistrationState(eventId, status === 201 ? "registration" : "validation");

    if (status !== 201) {
      res.status(status).json({
        error: outcome && outcome.error ? outcome.error : "internal_error",
        message: outcome && outcome.message ? outcome.message : "Unable to process registration.",
        state,
      });
      return;
    }

    res.status(201).json({
      registration: outcome.registration,
      state,
      message: "Registration submitted successfully.",
    });
  } catch (error) {
    console.error("Unable to submit event registration:", error);
    const state = isRegistrationEventId(eventId) ? buildRegistrationState(eventId, "error") : undefined;
    res.status(500).json({ error: "internal_error", message: "Unable to process registration.", state });
  }
});

app.get("/api/event-registrations/stream", (req, res) => {
  const eventId = sanitizeEventId(req.query.eventId);

  if (!isRegistrationEventId(eventId)) {
    res.status(400).json({ error: "invalid_event", message: "Unsupported registration event." });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }

  const initialPayload = JSON.stringify(buildRegistrationState(eventId, "snapshot"));
  res.write("event: registrations\\n");
  res.write("data: " + initialPayload + "\\n\\n");

  const client = {
    res,
    eventId,
  };

  registrationStreamClients.add(client);

  const keepAlive = setInterval(() => {
    if (!res.writableEnded) {
      res.write(": keep-alive\\n\\n");
    }
  }, 25000);

  req.on("close", () => {
    clearInterval(keepAlive);
    registrationStreamClients.delete(client);
  });
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
