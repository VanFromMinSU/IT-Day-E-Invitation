(function () {
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const interestedButton = document.getElementById("interested-button");
      const excitedButton = document.getElementById("excited-button");
      const responseSummary = document.getElementById("response-summary");
      const teaserModal = document.getElementById("teaser-modal");
      const teaserTitle = document.getElementById("teaser-title");
      const teaserSelectionStep = document.getElementById("event-selection-step");
      const teaserSelectionContext = document.getElementById("event-selection-context");
      const teaserSelectionList = document.getElementById("event-selection-list");
      const teaserDetailStep = document.getElementById("event-detail-step");
      const teaserChangeEventButton = document.getElementById("teaser-change-event-button");
      const teaserVenue = document.getElementById("teaser-venue");
      const teaserMechanics = document.getElementById("teaser-mechanics");
      const teaserRegistration = document.getElementById("teaser-registration");
      const appToast = document.getElementById("app-toast");
      const countdownChip = document.getElementById("countdown-chip");
      const responseVoterStorageKey = "itDayResponseVoterId";
      const responseChoiceStorageKey = "itDayResponseChoice";
      const responseApiBaseUrl = "/api/reactions";
      const responsePollingIntervalMs = 15000;
      const responseReconnectBaseDelayMs = 1800;
      const responseReconnectMaxDelayMs = 30000;
      const responseRpcTimeoutMs = 12000;
      const responseHttpTimeoutMs = 12000;
      const responseUnavailableMessage = "Live response counter is unavailable. Retrying in background.";
      const eventRegistrationApiBaseUrl = "/api/event-registrations";
      const eventRegistrationPollingIntervalMs = 12000;
      const adminModeParam = "admin";
      const adminResetAuthorizationKey = {};
      const appConfig = window.APP_CONFIG && typeof window.APP_CONFIG === "object" ? window.APP_CONFIG : {};
      const supabaseUrl = typeof appConfig.supabaseUrl === "string" ? appConfig.supabaseUrl.trim() : "";
      const supabaseAnonKey = typeof appConfig.supabaseAnonKey === "string" ? appConfig.supabaseAnonKey.trim() : "";
      const supabaseModule = window.supabase && typeof window.supabase.createClient === "function" ? window.supabase : null;
      const supabaseClient = supabaseModule && supabaseUrl && supabaseAnonKey
        ? supabaseModule.createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
          },
        })
        : null;
      const registrationEventIds = new Set(["rubiks-cube-competition", "sudoku-game-easy-level", "codm-tournament"]);
      let isAdminAuthorized = false;
      let isAdminModeRequested = false;
      let authStateSubscription = null;
      let responseAdminActions = null;
      let resetCountsButton = null;
      let responsePollIntervalId = null;
      let responseRealtimeChannel = null;
      let registrationPollIntervalId = null;
      let registrationRealtimeChannel = null;
      let responseCounts = { interested: 0, excited: 0 };
      const registrationStateByEventId = {};
      let hasSubmittedResponse = false;
      let submittedResponseType = "";
      let isResponseSubmissionPending = false;
      let isResponseBackendReady = false;
      let responseReconnectTimerId = null;
      let responseReconnectAttempts = 0;
      let isResponseReconnectInProgress = false;
      let responseStatusNotice = null;
      let hasShownBackendUnavailableNotice = false;
      let toastTimer;

      const familyOptions = ["Family 1 - Claude", "Family 2 - Grok", "Family 3 - Gemini", "Family 4 - Dola"];

      const eventGroupCatalog = {
        "grand-opening": {
          label: "Grand Opening",
          eventIds: ["parade-brass-band", "opening-ceremony"],
        },
        "academic-coding": {
          label: "Academic and Coding Arena",
          eventIds: [
            "it-quiz-bee",
            "fast-typing",
            "family-booth",
            "parlor-games",
            "programming-java",
            "programming-python",
            "programming-sql",
            "programming-csharp",
          ],
        },
        esports: {
          label: "Esports Showdown",
          eventIds: ["mobile-legends-tournament", "codm-tournament"],
        },
        "sports-fun": {
          label: "Sports and Fun Activities",
          eventIds: ["basketball-half-court", "beach-volleyball", "scavenger-hunt"],
        },
        "mind-games": {
          label: "Mind-Challenging Games",
          eventIds: ["chess-tournament", "rubiks-cube-competition", "sudoku-game-easy-level"],
        },
        "main-stage": {
          label: "Main Stage Highlights",
          eventIds: ["battle-of-the-bands", "mr-and-ms-it-2026"],
        },
      };

      const eventTitleMap = {
        "parade-brass-band": "Parade (with Brass Band)",
        "opening-ceremony": "Opening Ceremony",
        "it-quiz-bee": "IT Quiz Bee",
        "fast-typing": "Fast Typing",
        "family-booth": "Family Booth",
        "parlor-games": "Parlor Games",
        "programming-java": "Programming Competition - Java",
        "programming-python": "Programming Competition - Python",
        "programming-sql": "Programming Competition - SQL",
        "programming-csharp": "Programming Competition - C#",
        "mobile-legends-tournament": "Mobile Legends Tournament",
        "codm-tournament": "Call of Duty: Mobile (CODM) Tournament",
        "basketball-half-court": "Basketball (Men's Half Court)",
        "beach-volleyball": "Beach Volleyball (Women)",
        "scavenger-hunt": "Scavenger Hunt",
        "chess-tournament": "Chess Tournament",
        "rubiks-cube-competition": "Rubik's Cube Competition",
        "sudoku-game-easy-level": "Sudoku Game (Easy Level)",
        "battle-of-the-bands": "Battle of the Bands",
        "mr-and-ms-it-2026": "Mr. and Ms. IT 2026",
      };

      const eventCatalog = {
        "rubiks-cube-competition": {
          eventId: "rubiks-cube-competition",
          title: "Rubik's Cube Competition",
          venue: "Electronics Lab",
          registrationType: "individual",
          mechanicsHtml:
            '<ol>' +
            "<li><strong>Participants</strong><ul><li>A maximum of 8 participants will compete.</li><li>Only two participants per family/group are allowed.</li><li>Each participant must bring their own Rubik\'s Cube.</li><li>Each participant must download and use a cube timer app for official timing.</li></ul></li>" +
            "<li><strong>Competition Format</strong><ul><li>The competition will follow the World Cube Association (WCA)-style format.</li><li>Each round will use an Average of 5 system:</li><li>Each competitor solves the cube 5 times.</li><li>The fastest and slowest times are dropped.</li><li>The average of the remaining 3 solves is recorded.</li><li>All solves must be timed using the cube timer app.</li></ul></li>" +
            "<li><strong>Rounds</strong><ul><li>Round 1 (Qualifying): All 8 participants compete. Top 6 advance.</li><li>Round 2 (Semifinals): 6 participants compete. Top 3 advance.</li><li>Round 3 (Finals): 3 participants compete. The lowest average wins.</li></ul></li>" +
            "<li><strong>Timing and Inspection</strong><ul><li>Each participant is given 15 seconds of inspection time before each solve.</li><li>Timing starts when the cube is touched after inspection.</li><li>Stackmat-style timing or cube timer app must be used consistently.</li></ul></li>" +
            "<li><strong>Penalties</strong><ul><li>+2 seconds penalty for minor misalignments (for example, one face not fully turned).</li><li>DNF (Did Not Finish) for major violations (for example, cube not solved, timer misuse).</li></ul></li>" +
            "<li><strong>Fairness</strong><ul><li>All cubes must be standard 3x3 Rubik\'s Cubes (no unfair modifications).</li><li>Scrambles will be generated and applied uniformly for each round.</li><li>Judges/facilitators will verify times and enforce rules.</li></ul></li>" +
            "<li><strong>Winner</strong><ul><li>The competitor with the lowest average time in the Final Round is declared champion.</li><li>In case of a tie, a tiebreaker round (average of 3 solves) will be held.</li></ul></li>" +
            "</ol>",
        },
        "sudoku-game-easy-level": {
          eventId: "sudoku-game-easy-level",
          title: "Sudoku Game (Easy Level)",
          venue: "Electronics Lab",
          registrationType: "individual",
          mechanicsHtml:
            '<h5>I. Participants</h5>' +
            "<ul><li>A total of eight (8) players will participate.</li><li>Participants come from four (4) families, with two (2) members per family.</li></ul>" +
            '<p><strong>Note:</strong></p>' +
            "<ul><li>Each family must have exactly two participants.</li><li>Any family with incomplete participants will be disqualified and have points deducted in overall scoring.</li></ul>" +
            '<h5>II. Game Materials</h5>' +
            "<ul><li>Each participant receives three (3) Sudoku puzzles: Puzzle A, Puzzle B, Puzzle C.</li><li>Each answer sheet must contain Participant\'s Name and Family Name.</li></ul>" +
            '<h5>III. Game Proper</h5>' +
            "<ul><li>Solve all three puzzles.</li><li>Answers must be clearly written on the answer sheet.</li><li>Time Limit: 1 hour.</li></ul>" +
            '<h5>IV. Answering Rules</h5>' +
            "<ul><li>Participants may use pencil first, then finalize with ballpen.</li><li>Only ballpen answers are valid; otherwise, participant is disqualified.</li></ul>" +
            '<h5>V. Time Rules</h5>' +
            "<ul><li>Submit papers within 1 hour; submission time is recorded by facilitator.</li></ul>" +
            '<h5>VI. Winning Criteria</h5>' +
            "<ul><li>Based on accuracy, not speed.</li><li>Participants submitting later can still win if answers are correct.</li></ul>" +
            '<h5>VII. Tie-Breaker Rule</h5>' +
            "<ul><li>Conducted only if there is time remaining.</li><li>Occurs if:</li><li>1. Same time and same mistake in Puzzle A.</li><li>2. Same time and perfect score (rare).</li></ul>" +
            '<h5>VIII. Cheating Rule</h5>' +
            "<ul><li>Cheating or talking during the puzzle is strictly prohibited.</li><li>Penalty: Both family members disqualified.</li></ul>" +
            '<h5>IX. Judging Summary</h5>' +
            "<ul><li>Primary: Accuracy</li><li>Secondary: Submission time</li><li>Tie-breaker: Additional round if applicable.</li></ul>" +
            '<p><strong>Automatic Disqualification:</strong></p>' +
            "<ul><li>Incomplete participants</li><li>Cheating</li><li>No ballpen marks</li><li>Exceeding 1-hour time limit</li></ul>",
        },
        "codm-tournament": {
          eventId: "codm-tournament",
          title: "Call of Duty: Mobile (CODM) Tournament",
          venue: "Auditorium",
          registrationType: "team",
          mechanicsHtml:
            '<ol>' +
            "<li><strong>Tournament Overview</strong><ul><li>Format: Squad Battle Royale</li><li>Total Families: 4</li><li>Squads per Family: 2</li><li>Players per Squad: 4</li><li>Total Squads: 8</li><li>Total Players: 32</li><li>Platform: Mobile only</li></ul></li>" +
            "<li><strong>Team Structure</strong><ul><li>Each family will field two squads.</li><li>Each squad must have exactly four players.</li><li>Players cannot switch squads once the tournament begins.</li></ul></li>" +
            "<li><strong>Match Format</strong><ul><li>Total Matches: 5</li><li>All squads play in the same lobby per match.</li><li>Custom Room will be used (Room ID and Password from organizer).</li><li>Maps: Isolated or Blackout (organizer decision).</li><li>Perspective: TPP (Third-Person Perspective).</li></ul></li>" +
            "<li><strong>Scoring System</strong><ul><li>Placement points: 1st=20, 2nd=15, 3rd=12, 4th=10, 5th=8, 6th=6, 7th=4, 8th=2.</li><li>Kill points: 1 kill = 1 point.</li><li>Total score per match = Placement points + Kill points.</li></ul></li>" +
            "<li><strong>Win Conditions</strong><ul><li>Squad Champion: highest total points after all matches.</li><li>Family Champion: combined points of both squads from the same family.</li></ul></li>" +
            "<li><strong>Tiebreakers</strong><ul><li>Higher total kills.</li><li>Most first-place finishes.</li><li>Better placement in the final match.</li></ul></li>" +
            "<li><strong>Game Rules</strong><ul><li>Play fairly, no external assistance.</li><li>Strictly prohibited: cheating, hacking, emulators, account sharing, intentional feeding, and leaving match.</li><li>No teaming between squads, even from the same family.</li></ul></li>" +
            "<li><strong>Match Procedure</strong><ul><li>Organizer provides Room ID and Password.</li><li>Players join on time.</li><li>After each match, screenshot results and submit to organizer.</li></ul></li>" +
            "<li><strong>Disconnection Rule</strong><ul><li>Match continues if a player disconnects.</li><li>Restart only for server-wide issues.</li></ul></li>" +
            "<li><strong>Sportsmanship</strong><ul><li>Respect players and organizers.</li><li>No toxic behavior, trash talk, or harassment.</li><li>Follow organizer instructions.</li></ul></li>" +
            "<li><strong>Final Authority</strong><ul><li>Organizer has final decision on all disputes.</li><li>Rules may be adjusted before tournament starts.</li></ul></li>" +
            "</ol>",
        },
      };

      function showToast(message) {
        if (!appToast) {
          return;
        }

        appToast.textContent = message;
        appToast.classList.add("is-visible");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
          appToast.classList.remove("is-visible");
        }, 2600);
      }

      function ensureResponseStatusNotice() {
        if (responseStatusNotice || !responseSummary) {
          return responseStatusNotice;
        }

        responseStatusNotice = document.createElement("p");
        responseStatusNotice.id = "response-status-notice";
        responseStatusNotice.className = "response-status-notice";
        responseStatusNotice.setAttribute("aria-live", "polite");
        responseStatusNotice.hidden = true;
        responseSummary.insertAdjacentElement("afterend", responseStatusNotice);
        return responseStatusNotice;
      }

      function setResponseStatusNotice(message, isWarning) {
        const statusNotice = ensureResponseStatusNotice();
        if (!statusNotice) {
          return;
        }

        if (!message) {
          statusNotice.textContent = "";
          statusNotice.hidden = true;
          statusNotice.classList.remove("is-warning");
          return;
        }

        statusNotice.textContent = message;
        statusNotice.hidden = false;
        statusNotice.classList.toggle("is-warning", Boolean(isWarning));
      }

      function clearResponseReconnectTimer() {
        if (responseReconnectTimerId) {
          clearTimeout(responseReconnectTimerId);
          responseReconnectTimerId = null;
        }
      }

      function getResponseReconnectDelayMs() {
        const exponentialDelay = responseReconnectBaseDelayMs * Math.pow(2, Math.min(responseReconnectAttempts, 5));
        const jitter = Math.floor(Math.random() * 450);
        return Math.min(responseReconnectMaxDelayMs, exponentialDelay + jitter);
      }

      function setResponseBackendReady(isReady, options) {
        const config = options && typeof options === "object" ? options : {};
        isResponseBackendReady = Boolean(isReady);

        if (isResponseBackendReady) {
          responseReconnectAttempts = 0;
          clearResponseReconnectTimer();
          setResponseStatusNotice("", false);
        } else if (config.showNotice !== false) {
          setResponseStatusNotice(responseUnavailableMessage, true);
        }

        updateResponseButtonsState();
      }

      function scheduleResponseReconnect() {
        if (responseReconnectTimerId || isResponseReconnectInProgress) {
          return;
        }

        const reconnectDelayMs = getResponseReconnectDelayMs();
        responseReconnectAttempts += 1;
        responseReconnectTimerId = setTimeout(() => {
          responseReconnectTimerId = null;
          runResponseReconnectAttempt();
        }, reconnectDelayMs);
      }

      function reportResponseConnectionFailure(error, context, options) {
        const config = options && typeof options === "object" ? options : {};

        if (config.log !== false) {
          console.error("[responses] " + context, error);
        }

        setResponseBackendReady(false, {
          showNotice: config.showNotice !== false,
        });
        scheduleResponseReconnect();
      }

      function updateCountdown() {
        if (!countdownChip) {
          return;
        }

        const eventDate = new Date("2026-04-22T06:00:00");
        const now = new Date();
        const diffMs = eventDate.getTime() - now.getTime();

        if (diffMs <= 0) {
          countdownChip.textContent = "Happening now!";
          return;
        }

        const totalMinutes = Math.floor(diffMs / 60000);
        const days = Math.floor(totalMinutes / (60 * 24));
        const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
        const minutes = totalMinutes % 60;
        countdownChip.textContent = "Starts in " + days + "d " + hours + "h " + minutes + "m";
      }

      function sanitizeResponseCount(value) {
        const numeric = Number(value);
        return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
      }

      function normalizeResponseCounts(counts) {
        const safeCounts = counts && typeof counts === "object" ? counts : {};
        return {
          interested: sanitizeResponseCount(safeCounts.interested),
          excited: sanitizeResponseCount(safeCounts.excited),
        };
      }

      function isValidResponseType(responseType) {
        return responseType === "interested" || responseType === "excited";
      }

      function getStoredResponseType() {
        try {
          const stored = localStorage.getItem(responseChoiceStorageKey);
          return isValidResponseType(stored) ? stored : "";
        } catch (error) {
          return "";
        }
      }

      function persistResponseType(responseType) {
        try {
          if (isValidResponseType(responseType)) {
            localStorage.setItem(responseChoiceStorageKey, responseType);
          } else {
            localStorage.removeItem(responseChoiceStorageKey);
          }
        } catch (error) {
          // Ignore storage errors; server validation still prevents duplicate submissions.
        }
      }

      function getOrCreateResponseVoterId() {
        let existing = "";

        try {
          existing = localStorage.getItem(responseVoterStorageKey) || "";
        } catch (error) {
          existing = "";
        }

        if (existing) {
          return existing;
        }

        const generatedId = window.crypto && typeof window.crypto.randomUUID === "function"
          ? window.crypto.randomUUID()
          : "visitor-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);

        try {
          localStorage.setItem(responseVoterStorageKey, generatedId);
        } catch (error) {
          // Continue without storage persistence.
        }

        return generatedId;
      }

      function renderResponseCounts(counts) {
        if (!responseSummary) {
          return;
        }

        const normalized = normalizeResponseCounts(counts);
        responseCounts = normalized;
        const total = normalized.interested + normalized.excited;
        responseSummary.textContent = "Interested: " + normalized.interested + " | Excited: " + normalized.excited + " | Total: " + total;
      }

      function updateResponseButtonsState() {
        const shouldDisable = hasSubmittedResponse || isResponseSubmissionPending || !isResponseBackendReady;

        if (interestedButton) {
          interestedButton.disabled = shouldDisable;
          interestedButton.setAttribute("aria-pressed", submittedResponseType === "interested" ? "true" : "false");
        }

        if (excitedButton) {
          excitedButton.disabled = shouldDisable;
          excitedButton.setAttribute("aria-pressed", submittedResponseType === "excited" ? "true" : "false");
        }
      }

      function setResponseSelection(responseType, persistSelection) {
        submittedResponseType = isValidResponseType(responseType) ? responseType : "";
        hasSubmittedResponse = Boolean(submittedResponseType);

        if (persistSelection) {
          persistResponseType(submittedResponseType);
        }

        updateResponseButtonsState();
      }

      function getResponseStatePayload(payload) {
        if (payload && payload.counts && typeof payload.counts === "object") {
          return payload.counts;
        }

        return payload;
      }

      function buildResult(status, payload) {
        return {
          ok: status >= 200 && status < 300,
          status,
          payload: payload && typeof payload === "object" ? payload : {},
        };
      }

      function showBackendUnavailableNotice() {
        if (hasShownBackendUnavailableNotice) {
          return;
        }

        hasShownBackendUnavailableNotice = true;
        console.warn("[responses] Supabase client is unavailable. Falling back to same-origin API when possible.");
      }

      function withTimeout(promise, timeoutMs, timeoutMessage) {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            reject(new Error(timeoutMessage || "Request timed out."));
          }, timeoutMs);

          promise
            .then((result) => {
              clearTimeout(timer);
              resolve(result);
            })
            .catch((error) => {
              clearTimeout(timer);
              reject(error);
            });
        });
      }

      async function callBackendRpc(functionName, params) {
        if (!supabaseClient) {
          showBackendUnavailableNotice();
          return buildResult(503, {
            error: "backend_unavailable",
            message: "Supabase backend is not configured.",
          });
        }

        let rpcResponse;
        try {
          rpcResponse = await withTimeout(
            supabaseClient.rpc(functionName, params || {}),
            responseRpcTimeoutMs,
            "Backend request timed out."
          );
        } catch (error) {
          console.error("[backend rpc] " + functionName + " request failed.", error);
          return buildResult(503, {
            error: "backend_unreachable",
            message: error && error.message ? error.message : "Unable to reach backend.",
          });
        }

        const data = rpcResponse && Object.prototype.hasOwnProperty.call(rpcResponse, "data") ? rpcResponse.data : null;
        const error = rpcResponse && Object.prototype.hasOwnProperty.call(rpcResponse, "error") ? rpcResponse.error : null;

        if (error) {
          console.error("[backend rpc] " + functionName + " returned an error.", error);
          return buildResult(500, {
            error: "rpc_error",
            message: error.message || "Unable to reach backend.",
          });
        }

        const payload = data && typeof data === "object" ? data : {};
        const statusNumber = typeof payload.status === "number" ? payload.status : Number(payload.status);
        const status = Number.isFinite(statusNumber) ? statusNumber : 200;
        return buildResult(status, payload);
      }

      function mergeRequestHeaders(defaultHeaders, requestHeaders) {
        const merged = {};
        const defaults = defaultHeaders && typeof defaultHeaders === "object" ? defaultHeaders : {};
        const requested = requestHeaders && typeof requestHeaders === "object" ? requestHeaders : {};

        const defaultKeys = Object.keys(defaults);
        for (let i = 0; i < defaultKeys.length; i += 1) {
          merged[defaultKeys[i]] = defaults[defaultKeys[i]];
        }

        const requestedKeys = Object.keys(requested);
        for (let i = 0; i < requestedKeys.length; i += 1) {
          merged[requestedKeys[i]] = requested[requestedKeys[i]];
        }

        return merged;
      }

      async function fetchFromHttpApi(url, options) {
        const requestOptions = options && typeof options === "object" ? options : {};
        const method = String(requestOptions.method || "GET").toUpperCase();
        const hasBody = Object.prototype.hasOwnProperty.call(requestOptions, "body");
        const headers = mergeRequestHeaders(
          hasBody ? { "Content-Type": "application/json" } : {},
          requestOptions.headers
        );
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, responseHttpTimeoutMs);

        try {
          const response = await fetch(url, {
            method,
            headers,
            body: hasBody ? requestOptions.body : undefined,
            cache: requestOptions.cache,
            credentials: "same-origin",
            signal: controller.signal,
          });

          const contentType = response.headers.get("content-type") || "";
          let payload = {};

          if (contentType.includes("application/json")) {
            payload = await response.json();
          } else {
            const textPayload = await response.text();
            payload = textPayload ? { message: textPayload.slice(0, 240) } : {};
          }

          return buildResult(response.status, payload);
        } catch (error) {
          console.error("[http api] Request failed for " + method + " " + url + ".", error);
          return buildResult(503, {
            error: "http_unreachable",
            message: error && error.message ? error.message : "HTTP backend request failed.",
          });
        } finally {
          clearTimeout(timeoutId);
        }
      }

      async function callBackendWithFallback(functionName, params, requestUrl, requestOptions) {
        const rpcResult = await callBackendRpc(functionName, params || {});
        if (rpcResult.ok || rpcResult.status === 400 || rpcResult.status === 403 || rpcResult.status === 409) {
          return rpcResult;
        }

        const fallbackResult = await fetchFromHttpApi(requestUrl.toString(), requestOptions);
        if (fallbackResult.ok || fallbackResult.status === 400 || fallbackResult.status === 403 || fallbackResult.status === 409) {
          return fallbackResult;
        }

        if (fallbackResult.status === 404 || fallbackResult.status === 405) {
          return rpcResult;
        }

        if (rpcResult.status >= 500) {
          return rpcResult;
        }

        return fallbackResult;
      }

      function waitForDuration(durationMs) {
        return new Promise((resolve) => {
          setTimeout(resolve, durationMs);
        });
      }

      function shouldRetryResponseSubmission(result) {
        if (!result) {
          return true;
        }

        return result.status === 408 || result.status === 429 || result.status === 503 || result.status >= 500;
      }

      async function submitResponseWithRetry(payload) {
        const maxAttempts = 3;
        let latestResult = null;

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
          latestResult = await fetchJson(responseApiBaseUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });

          if (!shouldRetryResponseSubmission(latestResult) || attempt === maxAttempts) {
            return latestResult;
          }

          const retryDelayMs = 360 * Math.pow(2, attempt - 1);
          await waitForDuration(retryDelayMs);
        }

        return latestResult || buildResult(503, {
          error: "submission_unavailable",
          message: "Unable to submit your response right now.",
        });
      }

      async function fetchJson(url, options) {
        const requestUrl = new URL(url, window.location.origin);
        const requestOptions = options && typeof options === "object" ? options : {};
        const method = String(requestOptions.method || "GET").toUpperCase();
        let body = {};

        if (typeof requestOptions.body === "string" && requestOptions.body) {
          try {
            body = JSON.parse(requestOptions.body);
          } catch (error) {
            body = {};
          }
        } else if (requestOptions.body && typeof requestOptions.body === "object") {
          body = requestOptions.body;
        }

        if (requestUrl.pathname === responseApiBaseUrl && method === "GET") {
          return callBackendWithFallback("get_reaction_state", {}, requestUrl, requestOptions);
        }

        if (requestUrl.pathname === responseApiBaseUrl + "/vote-status" && method === "GET") {
          return callBackendWithFallback("get_vote_status", {
            p_voter_id: requestUrl.searchParams.get("voterId") || "",
          }, requestUrl, requestOptions);
        }

        if (requestUrl.pathname === responseApiBaseUrl && method === "POST") {
          return callBackendWithFallback("submit_vote", {
            p_voter_id: body && typeof body.voterId === "string" ? body.voterId : "",
            p_response_type: body && typeof body.responseType === "string" ? body.responseType : "",
          }, requestUrl, requestOptions);
        }

        if (requestUrl.pathname === responseApiBaseUrl + "/reset" && method === "POST") {
          return callBackendWithFallback("reset_reactions", {}, requestUrl, requestOptions);
        }

        if (requestUrl.pathname === eventRegistrationApiBaseUrl && method === "GET") {
          return callBackendWithFallback("get_registration_state", {
            p_event_id: requestUrl.searchParams.get("eventId") || "",
          }, requestUrl, requestOptions);
        }

        if (requestUrl.pathname === eventRegistrationApiBaseUrl && method === "POST") {
          return callBackendWithFallback("submit_event_registration", {
            p_event_id: body && typeof body.eventId === "string" ? body.eventId : "",
            p_family: body && typeof body.family === "string" ? body.family : "",
            p_name: body && typeof body.name === "string" ? body.name : null,
            p_captain: body && typeof body.captain === "string" ? body.captain : null,
            p_members: body && Array.isArray(body.members) ? body.members : null,
          }, requestUrl, requestOptions);
        }

        return buildResult(404, {
          error: "unsupported_route",
          message: "Unsupported backend route.",
        });
      }

      async function fetchResponseSnapshot() {
        const result = await fetchJson(responseApiBaseUrl, { cache: "no-store" });
        if (!result.ok) {
          const snapshotError = new Error("Could not fetch response counts.");
          snapshotError.result = result;
          throw snapshotError;
        }

        renderResponseCounts(getResponseStatePayload(result.payload));
        setResponseBackendReady(true, { showNotice: false });
        return result.payload;
      }

      async function fetchVoteStatus(voterId) {
        const voteStatusUrl = responseApiBaseUrl + "/vote-status?voterId=" + encodeURIComponent(voterId);
        const result = await fetchJson(voteStatusUrl, { cache: "no-store" });
        if (!result.ok) {
          const voteStatusError = new Error("Could not fetch vote status.");
          voteStatusError.result = result;
          throw voteStatusError;
        }

        setResponseBackendReady(true, { showNotice: false });
        return result.payload;
      }

      async function synchronizeResponseState() {
        const voterId = getOrCreateResponseVoterId();
        const [snapshot, status] = await Promise.all([fetchResponseSnapshot(), fetchVoteStatus(voterId)]);

        if (status && status.hasVoted && isValidResponseType(status.responseType)) {
          setResponseSelection(status.responseType, true);
        } else {
          setResponseSelection("", true);
        }

        setResponseBackendReady(true, { showNotice: false });

        return { snapshot, status };
      }

      async function runResponseReconnectAttempt() {
        if (isResponseReconnectInProgress) {
          return;
        }

        isResponseReconnectInProgress = true;
        try {
          await synchronizeResponseState();
          setResponseBackendReady(true, { showNotice: false });
        } catch (error) {
          reportResponseConnectionFailure(error, "Background reconnect attempt failed.", {
            log: true,
            showNotice: true,
          });
        } finally {
          isResponseReconnectInProgress = false;
        }
      }

      function onResponseStreamMessage() {
        synchronizeResponseState().catch((error) => {
          reportResponseConnectionFailure(error, "Realtime reaction sync failed.", {
            log: false,
            showNotice: true,
          });
        });
      }

      function startResponsePolling() {
        if (responsePollIntervalId) {
          clearInterval(responsePollIntervalId);
        }

        responsePollIntervalId = setInterval(() => {
          fetchResponseSnapshot().catch((error) => {
            reportResponseConnectionFailure(error, "Polling response snapshot failed.", {
              log: false,
              showNotice: true,
            });
          });
        }, responsePollingIntervalMs);
      }

      function startResponseRealtimeSync() {
        if (!supabaseClient) {
          return false;
        }

        if (responseRealtimeChannel) {
          supabaseClient.removeChannel(responseRealtimeChannel);
          responseRealtimeChannel = null;
        }

        if (responsePollIntervalId) {
          clearInterval(responsePollIntervalId);
          responsePollIntervalId = null;
        }

        responseRealtimeChannel = supabaseClient
          .channel("itday-reaction-updates")
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "event_votes",
            },
            () => {
              onResponseStreamMessage();
            }
          )
          .subscribe((status) => {
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
              startResponsePolling();
            }
          });

        return true;
      }

      async function initializeResponseCounters() {
        setResponseSelection(getStoredResponseType(), false);
        renderResponseCounts(responseCounts);
        setResponseBackendReady(false, { showNotice: false });

        try {
          await synchronizeResponseState();
        } catch (error) {
          reportResponseConnectionFailure(error, "Initial response sync failed.", {
            log: true,
            showNotice: true,
          });
        }

        const isRealtimeActive = startResponseRealtimeSync();
        if (!isRealtimeActive) {
          startResponsePolling();
        }
      }

      function removeAdminResetControls() {
        if (resetCountsButton) {
          resetCountsButton.removeEventListener("click", onAdminResetClick);
          resetCountsButton = null;
        }

        if (responseAdminActions) {
          responseAdminActions.remove();
          responseAdminActions = null;
        }
      }

      function ensureAdminResetControls() {
        if (!responseSummary || responseAdminActions || (!isAdminAuthorized && !isAdminModeRequested)) {
          return;
        }

        responseAdminActions = document.createElement("div");
        responseAdminActions.className = "response-admin-actions";
        responseAdminActions.id = "response-admin-actions";

        resetCountsButton = document.createElement("button");
        resetCountsButton.type = "button";
        resetCountsButton.className = "btn btn-secondary admin-reset-button";
        resetCountsButton.id = "reset-counts-button";
        resetCountsButton.textContent = "Reset Counts";
        resetCountsButton.addEventListener("click", onAdminResetClick);

        responseAdminActions.appendChild(resetCountsButton);
        responseSummary.insertAdjacentElement("afterend", responseAdminActions);
      }

      async function refreshAdminAuthorization() {
        if (!supabaseClient) {
          isAdminAuthorized = false;
          return false;
        }

        const { data, error } = await supabaseClient.auth.getSession();
        if (error || !data || !data.session || !data.session.user) {
          isAdminAuthorized = false;
          return false;
        }

        const appMetadata = data.session.user.app_metadata || {};
        isAdminAuthorized = appMetadata.role === "admin";
        return isAdminAuthorized;
      }

      async function promptAdminSignIn() {
        if (!supabaseClient) {
          showBackendUnavailableNotice();
          return false;
        }

        const email = window.prompt("Enter admin email:");
        if (!email) {
          return false;
        }

        const password = window.prompt("Enter admin password:");
        if (!password) {
          return false;
        }

        const { error } = await supabaseClient.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          showToast("Admin sign-in failed.");
          return false;
        }

        const isAuthorized = await refreshAdminAuthorization();
        if (!isAuthorized) {
          showToast("Signed-in account is not allowed to reset counts.");
          return false;
        }

        ensureAdminResetControls();
        return true;
      }

      async function initializeAdminAccess() {
        isAdminModeRequested = false;
        removeAdminResetControls();

        const params = new URLSearchParams(window.location.search);
        const adminModeValue = (params.get(adminModeParam) || "").toLowerCase();
        isAdminModeRequested = adminModeValue === "1" || adminModeValue === "true";

        if (params.has(adminModeParam)) {
          params.delete(adminModeParam);
          const nextQuery = params.toString();
          const nextUrl = window.location.pathname + (nextQuery ? "?" + nextQuery : "") + window.location.hash;
          window.history.replaceState({}, document.title, nextUrl);
        }

        await refreshAdminAuthorization();

        if (supabaseClient && !authStateSubscription) {
          const authListener = supabaseClient.auth.onAuthStateChange(() => {
            refreshAdminAuthorization().then(() => {
              if (isAdminAuthorized || isAdminModeRequested) {
                ensureAdminResetControls();
              } else {
                removeAdminResetControls();
              }
            });
          });

          authStateSubscription = authListener && authListener.data ? authListener.data.subscription : null;
        }

        if (isAdminAuthorized || isAdminModeRequested) {
          ensureAdminResetControls();
        }
      }

      async function trackResponse(responseType) {
        if (!isValidResponseType(responseType)) {
          return;
        }

        if (!isResponseBackendReady) {
          setResponseStatusNotice(responseUnavailableMessage, true);
          scheduleResponseReconnect();
          showToast(responseUnavailableMessage);
          return;
        }

        if (hasSubmittedResponse) {
          showToast("You already submitted a response on this browser.");
          return;
        }

        if (isResponseSubmissionPending) {
          return;
        }

        const previousCounts = {
          interested: responseCounts.interested,
          excited: responseCounts.excited,
        };
        const previousSelection = submittedResponseType;
        const optimisticCounts = {
          interested: responseCounts.interested,
          excited: responseCounts.excited,
        };

        optimisticCounts[responseType] += 1;
        isResponseSubmissionPending = true;
        setResponseSelection(responseType, true);
        renderResponseCounts(optimisticCounts);

        try {
          const result = await submitResponseWithRetry({
            responseType,
            voterId: getOrCreateResponseVoterId(),
          });

          if (result.status === 409) {
            renderResponseCounts(getResponseStatePayload(result.payload));
            const existingType = result.payload && isValidResponseType(result.payload.responseType) ? result.payload.responseType : getStoredResponseType();
            setResponseSelection(existingType, true);
            showToast("You already submitted a response on this browser.");
            return;
          }

          if (!result.ok) {
            const submitError = new Error("Failed to submit response.");
            submitError.result = result;
            throw submitError;
          }

          renderResponseCounts(getResponseStatePayload(result.payload));
          setResponseBackendReady(true, { showNotice: false });
          const acceptedType = result.payload && isValidResponseType(result.payload.responseType) ? result.payload.responseType : responseType;
          setResponseSelection(acceptedType, true);

          const total = responseCounts.interested + responseCounts.excited;
          showToast("Thanks for your response. Total reactions: " + total + ".");
        } catch (error) {
          console.error("[responses] Could not submit vote.", error);
          renderResponseCounts(previousCounts);
          setResponseSelection(previousSelection, true);

          const failedResult = error && error.result ? error.result : null;
          if (failedResult && failedResult.status >= 500) {
            reportResponseConnectionFailure(error, "Vote submission failed due to backend error.", {
              log: false,
              showNotice: true,
            });
          }

          let submitErrorMessage = "Could not submit your response. Please try again.";
          if (failedResult && failedResult.status === 503) {
            submitErrorMessage = responseUnavailableMessage;
          } else if (failedResult && failedResult.status >= 500) {
            submitErrorMessage = "Could not submit your response right now. Reconnecting in background.";
          } else if (
            failedResult &&
            failedResult.payload &&
            typeof failedResult.payload.message === "string" &&
            failedResult.payload.message.trim()
          ) {
            submitErrorMessage = failedResult.payload.message.trim();
          }

          showToast(submitErrorMessage);
        } finally {
          isResponseSubmissionPending = false;
          updateResponseButtonsState();
        }
      }

      async function resetResponseCounts(authorizationKey) {
        if (!isAdminAuthorized || authorizationKey !== adminResetAuthorizationKey) {
          showToast("Admin access required.");
          return;
        }

        const result = await fetchJson(responseApiBaseUrl + "/reset", {
          method: "POST",
          body: JSON.stringify({}),
        });

        if (!result.ok) {
          showToast("Unable to reset counts right now.");
          return;
        }

        renderResponseCounts(getResponseStatePayload(result.payload));
        setResponseSelection("", true);
        showToast("Response counts reset.");
      }

      async function onAdminResetClick() {
        if (!isAdminAuthorized) {
          const signedIn = await promptAdminSignIn();
          if (!signedIn) {
            showToast("Admin authentication required.");
            return;
          }
        }

        const approved = window.confirm("Reset all Interested and Excited counts?");
        if (!approved) {
          return;
        }

        resetResponseCounts(adminResetAuthorizationKey);
      }

      function humanizeEventId(eventId) {
        return eventId
          .replace(/-/g, " ")
          .replace(/\b\w/g, (character) => character.toUpperCase());
      }

      function getEventGroupKeyFromEventId(eventId) {
        const groupKeys = Object.keys(eventGroupCatalog);
        for (let i = 0; i < groupKeys.length; i += 1) {
          const key = groupKeys[i];
          if (eventGroupCatalog[key].eventIds.includes(eventId)) {
            return key;
          }
        }

        return "";
      }

      function slugify(value) {
        return (value || "event")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || "event";
      }

      function inferEventId(title, description, explicitId) {
        if (explicitId) {
          return explicitId;
        }

        const combined = (title + " " + description).toLowerCase();
        if (combined.includes("parade") || combined.includes("brass band")) {
          return "parade-brass-band";
        }

        if (combined.includes("opening ceremony") || combined.includes("flag raising")) {
          return "opening-ceremony";
        }

        if (combined.includes("quiz bee")) {
          return "it-quiz-bee";
        }

        if (combined.includes("typing")) {
          return "fast-typing";
        }

        if (combined.includes("mobile legends")) {
          return "mobile-legends-tournament";
        }

        if (combined.includes("basketball")) {
          return "basketball-half-court";
        }

        if (combined.includes("beach volleyball")) {
          return "beach-volleyball";
        }

        if (combined.includes("scavenger")) {
          return "scavenger-hunt";
        }

        if (combined.includes("chess")) {
          return "chess-tournament";
        }

        if (combined.includes("sudoku")) {
          return "sudoku-game-easy-level";
        }

        if (combined.includes("rubik")) {
          return "rubiks-cube-competition";
        }

        if (combined.includes("call of duty") || combined.includes("codm")) {
          return "codm-tournament";
        }

        return slugify(title);
      }

      function inferEventGroupKey(title, description, explicitGroup, inferredEventId) {
        if (explicitGroup) {
          return explicitGroup;
        }

        const fromEventId = getEventGroupKeyFromEventId(inferredEventId);
        if (fromEventId) {
          return fromEventId;
        }

        const combined = (title + " " + description).toLowerCase();
        if (combined.includes("opening") || combined.includes("parade") || combined.includes("ceremony")) {
          return "grand-opening";
        }

        if (combined.includes("academic") || combined.includes("coding") || combined.includes("programming") || combined.includes("quiz") || combined.includes("typing")) {
          return "academic-coding";
        }

        if (combined.includes("esports") || combined.includes("mobile legends") || combined.includes("call of duty") || combined.includes("codm")) {
          return "esports";
        }

        if (combined.includes("sports") || combined.includes("basketball") || combined.includes("volleyball") || combined.includes("scavenger")) {
          return "sports-fun";
        }

        if (combined.includes("mind") || combined.includes("chess") || combined.includes("rubik") || combined.includes("sudoku")) {
          return "mind-games";
        }

        if (combined.includes("main stage") || combined.includes("finale") || combined.includes("battle of the bands") || combined.includes("mr. and ms")) {
          return "main-stage";
        }

        return "";
      }

      function getEventDetailsById(eventId) {
        if (eventCatalog[eventId]) {
          return eventCatalog[eventId];
        }

        return {
          eventId,
          title: eventTitleMap[eventId] || humanizeEventId(eventId),
          venue: "To be updated",
          registrationType: "coming-soon",
          mechanicsHtml: "<p>To be updated.</p>",
        };
      }

      function getEventSelectionContextFromTarget(target) {
        const title = target.getAttribute("data-teaser-title") || "Event Details";
        const description = target.getAttribute("data-teaser-text") || "";
        const explicitId = target.getAttribute("data-event-id");
        const explicitGroup = target.getAttribute("data-event-group");
        const eventId = inferEventId(title, description, explicitId);
        const groupKey = inferEventGroupKey(title, description, explicitGroup, eventId);

        return {
          groupKey,
          categoryTitle: title,
          fallbackEventId: eventId,
        };
      }

      function getSelectionEvents(context) {
        const group = context.groupKey ? eventGroupCatalog[context.groupKey] : null;
        if (group && Array.isArray(group.eventIds) && group.eventIds.length > 0) {
          return group.eventIds;
        }

        return context.fallbackEventId ? [context.fallbackEventId] : [];
      }

      function setTeaserStep(mode) {
        const selectionActive = mode === "selection";
        if (teaserSelectionStep) {
          teaserSelectionStep.classList.toggle("is-active", selectionActive);
        }

        if (teaserDetailStep) {
          teaserDetailStep.classList.toggle("is-active", !selectionActive);
        }

        if (teaserChangeEventButton) {
          teaserChangeEventButton.hidden = selectionActive;
        }
      }

      function renderEventSelection(context) {
        if (!teaserSelectionList || !teaserSelectionContext) {
          return;
        }

        const groupLabel = context.groupKey && eventGroupCatalog[context.groupKey] ? eventGroupCatalog[context.groupKey].label : context.categoryTitle;
        const selectionEvents = getSelectionEvents(context);
        teaserSelectionContext.textContent = "Category: " + groupLabel + ". Select one event to view details and registration.";

        if (selectionEvents.length === 0) {
          teaserSelectionList.innerHTML = '<p class="event-registration-soon">No events available yet for this category.</p>';
          return;
        }

        teaserSelectionList.innerHTML = selectionEvents
          .map((eventId) => {
            const eventDetails = getEventDetailsById(eventId);
            return (
              '<button type="button" class="event-selection-option" data-select-event="true" data-event-id="' +
              eventId +
              '">' +
              '<span class="event-selection-option__title">' +
              eventDetails.title +
              "</span>" +
              '<span class="event-selection-option__meta">' +
              "Venue: " +
              eventDetails.venue +
              "</span>" +
              "</button>"
            );
          })
          .join("");
      }

      function isManagedRegistrationEvent(eventId) {
        return registrationEventIds.has(eventId);
      }

      function escapeHtml(value) {
        return String(value || "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\"/g, "&quot;")
          .replace(/'/g, "&#39;");
      }

      function getRegistrationStatePayload(payload) {
        if (payload && payload.state && typeof payload.state === "object") {
          return payload.state;
        }

        return payload;
      }

      function getRegistrationClosedValidationMessage(eventId) {
        if (eventId === "codm-tournament") {
          return "Registration is now closed. Maximum teams reached.";
        }

        return "Registration is now closed. Maximum participants reached.";
      }

      function getFamilyLimitValidationMessage(eventId) {
        if (eventId === "sudoku-game-easy-level") {
          return "This family already has 2 participants registered.";
        }

        return "This family has reached the maximum number of participants.";
      }

      function getTeamLimitValidationMessage() {
        return "This family has already registered the maximum number of teams.";
      }

      function getTeamSizeValidationMessage() {
        return "Each team must have exactly 4 members including the Team Captain/Leader.";
      }

      async function fetchEventRegistrationState(eventId) {
        const requestUrl = eventRegistrationApiBaseUrl + "?eventId=" + encodeURIComponent(eventId);
        const result = await fetchJson(requestUrl, { cache: "no-store" });

        if (!result.ok) {
          throw new Error("Could not fetch event registration state.");
        }

        const state = getRegistrationStatePayload(result.payload);
        if (state && state.eventId) {
          registrationStateByEventId[state.eventId] = state;
          refreshActiveEventRegistrationFormState();
        }

        return state;
      }

      function getCachedEventRegistrationState(eventId) {
        return eventId ? registrationStateByEventId[eventId] || null : null;
      }

      function cacheRegistrationState(state) {
        if (!state || !state.eventId) {
          return;
        }

        registrationStateByEventId[state.eventId] = state;
        refreshActiveEventRegistrationFormState();
      }

      function getActiveEventId() {
        return teaserModal ? teaserModal.dataset.activeEventId || "" : "";
      }

      function getActiveEventRegistrationForm() {
        if (!teaserRegistration) {
          return null;
        }

        const form = teaserRegistration.querySelector(".event-registration-form");
        return form instanceof HTMLFormElement ? form : null;
      }

      function getFamilyAvailabilityMap(state) {
        const stats = state && state.stats && Array.isArray(state.stats.perFamily) ? state.stats : null;
        const availability = {};

        if (!stats) {
          return availability;
        }

        stats.perFamily.forEach((entry) => {
          if (entry && entry.family) {
            availability[entry.family] = entry;
          }
        });

        return availability;
      }

      function getCurrentTeamMemberState(form) {
        const captainField = form.elements.namedItem("captain");
        const captain = captainField && typeof captainField.value === "string" ? captainField.value.trim() : "";
        const memberInputs = Array.from(form.querySelectorAll('input[name="members[]"]'));
        const members = memberInputs.map((input) => input.value.trim());
        const filledMembers = members.filter((member) => member.length > 0);

        return {
          captain,
          members,
          filledMembers,
        };
      }

      function renderEventRegistrationStatus(form, eventId, state) {
        const statusPanel = form.querySelector("[data-registration-status='true']");
        if (!statusPanel) {
          return;
        }

        if (!state || !state.stats) {
          statusPanel.innerHTML = "";
          return;
        }

        const stats = state.stats;
        const lines = [];

        if (stats.mode === "individual") {
          if (typeof stats.remainingParticipants === "number" && typeof stats.maxParticipants === "number") {
            lines.push("Total remaining slots: " + stats.remainingParticipants + " / " + stats.maxParticipants + ".");
          }

          if (Array.isArray(stats.perFamily)) {
            stats.perFamily.forEach((entry) => {
              lines.push(entry.family + ": " + entry.count + "/" + entry.limit + " registered (remaining " + entry.remaining + ").");
            });
          }

          if (eventId === "sudoku-game-easy-level") {
            if (stats.allFamiliesComplete) {
              lines.push("All families are complete with 2 participants each.");
            } else {
              lines.push("Each family must complete 2 participants.");
            }
          }

          if (stats.isClosed) {
            lines.unshift(getRegistrationClosedValidationMessage(eventId));
          }
        }

        if (stats.mode === "team") {
          if (typeof stats.remainingTeams === "number" && typeof stats.maxTeams === "number") {
            lines.push("Total remaining team slots: " + stats.remainingTeams + " / " + stats.maxTeams + ".");
          }

          if (Array.isArray(stats.perFamily)) {
            stats.perFamily.forEach((entry) => {
              lines.push(entry.family + ": " + entry.count + "/" + entry.limit + " teams registered (remaining " + entry.remaining + ").");
            });
          }

          const teamState = getCurrentTeamMemberState(form);
          const currentTotal = (teamState.captain ? 1 : 0) + teamState.filledMembers.length;
          lines.push("Current team size entered: " + currentTotal + "/4.");
          lines.push("Each team must have exactly 4 members including the Team Captain/Leader.");

          if (Array.isArray(stats.teams) && stats.teams.length > 0) {
            const teamLabels = stats.teams.map((team) => team.teamLabel).filter((teamLabel) => Boolean(teamLabel));
            if (teamLabels.length > 0) {
              lines.push("Registered teams: " + teamLabels.join(", ") + ".");
            }
          }

          if (stats.isClosed) {
            lines.unshift(getRegistrationClosedValidationMessage(eventId));
          }
        }

        statusPanel.innerHTML =
          '<ul class="event-registration-status-list">' +
          lines.map((line) => "<li>" + escapeHtml(line) + "</li>").join("") +
          "</ul>";
      }

      function applyFamilySlotAvailability(form, state) {
        const familySelect = form.elements.namedItem("family");
        if (!(familySelect instanceof HTMLSelectElement)) {
          return;
        }

        const availability = getFamilyAvailabilityMap(state);
        const options = Array.from(familySelect.options);

        options.forEach((option) => {
          if (!option.value) {
            option.disabled = false;
            return;
          }

          const familyState = availability[option.value];
          option.disabled = Boolean(familyState && familyState.remaining <= 0);
        });

        if (familySelect.value && availability[familySelect.value] && availability[familySelect.value].remaining <= 0) {
          familySelect.value = "";
        }
      }

      function setFormControlsDisabled(form, disabled) {
        const controls = form.querySelectorAll("input, select, button[type='submit'], button[data-add-member='true'], button[data-remove-member='true']");
        controls.forEach((control) => {
          control.disabled = disabled;
        });
      }

      function updateTeamSubmitAvailability(form, state) {
        const submitButton = form.querySelector('button[type="submit"]');
        if (!(submitButton instanceof HTMLButtonElement)) {
          return;
        }

        const stats = state && state.stats ? state.stats : null;
        if (stats && stats.isClosed) {
          submitButton.disabled = true;
          return;
        }

        if ((form.dataset.registrationType || "") !== "team") {
          return;
        }

        const teamState = getCurrentTeamMemberState(form);
        const hasEmptyMemberSlot = teamState.members.some((member) => member.length === 0);
        submitButton.disabled = !teamState.captain || hasEmptyMemberSlot || teamState.filledMembers.length !== 3;
      }

      function refreshEventRegistrationFormState(form, eventId) {
        const state = getCachedEventRegistrationState(eventId);
        renderEventRegistrationStatus(form, eventId, state);

        if (!state || !state.stats) {
          updateTeamSubmitAvailability(form, null);
          return;
        }

        const stats = state.stats;
        const isClosed = Boolean(stats.isClosed);

        setFormControlsDisabled(form, isClosed);

        if (!isClosed) {
          applyFamilySlotAvailability(form, state);
        }

        updateTeamSubmitAvailability(form, state);

        if (isClosed) {
          setEventFormFeedback(form, getRegistrationClosedValidationMessage(eventId), true);
        }
      }

      function refreshActiveEventRegistrationFormState() {
        const activeEventId = getActiveEventId();
        const form = getActiveEventRegistrationForm();

        if (!activeEventId || !form) {
          return;
        }

        refreshEventRegistrationFormState(form, activeEventId);
      }

      function stopRegistrationRealtimeSync() {
        if (registrationPollIntervalId) {
          clearInterval(registrationPollIntervalId);
          registrationPollIntervalId = null;
        }

        if (registrationRealtimeChannel && supabaseClient) {
          supabaseClient.removeChannel(registrationRealtimeChannel);
          registrationRealtimeChannel = null;
        }

      }

      function onRegistrationStreamMessage(eventId) {
        if (!eventId) {
          return;
        }

        fetchEventRegistrationState(eventId).catch(() => {
          // Keep background sync silent.
        });
      }

      function startRegistrationPolling(eventId) {
        if (registrationPollIntervalId) {
          clearInterval(registrationPollIntervalId);
        }

        registrationPollIntervalId = setInterval(() => {
          fetchEventRegistrationState(eventId).catch(() => {
            // Keep background polling silent.
          });
        }, eventRegistrationPollingIntervalMs);
      }

      function startRegistrationRealtimeSync(eventId) {
        if (!supabaseClient || !isManagedRegistrationEvent(eventId)) {
          return false;
        }

        if (registrationRealtimeChannel) {
          supabaseClient.removeChannel(registrationRealtimeChannel);
          registrationRealtimeChannel = null;
        }

        if (registrationPollIntervalId) {
          clearInterval(registrationPollIntervalId);
          registrationPollIntervalId = null;
        }

        registrationRealtimeChannel = supabaseClient
          .channel("itday-registration-" + eventId)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "event_registrations",
              filter: "event_id=eq." + eventId,
            },
            () => {
              onRegistrationStreamMessage(eventId);
            }
          )
          .subscribe((status) => {
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
              startRegistrationPolling(eventId);
            }
          });

        return true;
      }

      async function activateRegistrationSync(eventId) {
        stopRegistrationRealtimeSync();

        if (!isManagedRegistrationEvent(eventId)) {
          return;
        }

        try {
          await fetchEventRegistrationState(eventId);
        } catch (error) {
          showToast("Live registration updates are unavailable. Retrying in background.");
        }

        const isRealtimeActive = startRegistrationRealtimeSync(eventId);
        if (!isRealtimeActive) {
          startRegistrationPolling(eventId);
        }
      }

      async function ensureLatestRegistrationState(eventId) {
        if (!isManagedRegistrationEvent(eventId)) {
          return null;
        }

        try {
          return await fetchEventRegistrationState(eventId);
        } catch (error) {
          return getCachedEventRegistrationState(eventId);
        }
      }

      async function submitEventRegistration(payload) {
        return fetchJson(eventRegistrationApiBaseUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
      }

      function showSelectedEventDetails(eventId) {
        const details = getEventDetailsById(eventId);
        if (!teaserTitle || !teaserVenue || !teaserMechanics) {
          return;
        }

        teaserTitle.textContent = details.title;
        teaserVenue.textContent = details.venue;
        teaserMechanics.innerHTML = details.mechanicsHtml;
        renderEventRegistration(details);
        teaserModal.dataset.activeEventId = details.eventId;
        teaserModal.dataset.activeEventTitle = details.title;
        setTeaserStep("details");
        activateRegistrationSync(details.eventId);
        refreshActiveEventRegistrationFormState();
      }

      function buildFamilyOptionsMarkup() {
        return familyOptions
          .map((family) => '<option value="' + family + '">' + family + "</option>")
          .join("");
      }

      function buildTeamMemberRowMarkup() {
        return (
          '<div class="event-member-row">' +
          '<input name="members[]" type="text" placeholder="Member name" required />' +
          '<button type="button" class="event-member-remove" data-remove-member="true" aria-label="Remove member">Remove</button>' +
          "</div>"
        );
      }

      function renderEventRegistration(details) {
        if (!teaserRegistration) {
          return;
        }

        if (details.registrationType === "coming-soon") {
          teaserRegistration.innerHTML = '<p class="event-registration-soon">Registration form coming soon for this event.</p>';
          return;
        }

        if (details.registrationType === "individual") {
          teaserRegistration.innerHTML =
            '<form class="event-registration-form" data-registration-type="individual" novalidate>' +
            '<div class="event-form-grid">' +
            '<div class="event-form-field">' +
            '<label for="event-family">Family</label>' +
            '<select id="event-family" name="family" required><option value="">Select family</option>' +
            buildFamilyOptionsMarkup() +
            "</select>" +
            "</div>" +
            '<div class="event-form-field">' +
            '<label for="event-name">Name</label>' +
            '<input id="event-name" name="name" type="text" autocomplete="name" placeholder="Enter participant name" required />' +
            "</div>" +
            "</div>" +
            '<div class="event-registration-status" data-registration-status="true" aria-live="polite"></div>' +
            '<p class="event-form-feedback" aria-live="polite"></p>' +
            '<div class="registration-actions event-form-actions">' +
            '<button type="submit" class="btn btn-primary">Submit Registration</button>' +
            "</div>" +
            "</form>";
          return;
        }

        teaserRegistration.innerHTML =
          '<form class="event-registration-form" data-registration-type="team" novalidate>' +
          '<div class="event-form-grid">' +
          '<div class="event-form-field">' +
          '<label for="event-family">Family</label>' +
          '<select id="event-family" name="family" required><option value="">Select family</option>' +
          buildFamilyOptionsMarkup() +
          "</select>" +
          "</div>" +
          '<div class="event-form-field">' +
          '<label for="event-captain">Team Captain</label>' +
          '<input id="event-captain" name="captain" type="text" autocomplete="name" placeholder="Enter team captain" required />' +
          "</div>" +
          "</div>" +
          '<div class="event-members-wrap">' +
          '<div class="event-members-header">' +
          "<strong>Members</strong>" +
          '<button type="button" class="btn btn-secondary event-inline-button" data-add-member="true">Add Member</button>' +
          "</div>" +
          '<div class="event-members-list">' + buildTeamMemberRowMarkup() + buildTeamMemberRowMarkup() + buildTeamMemberRowMarkup() + "</div>" +
          "</div>" +
          '<div class="event-registration-status" data-registration-status="true" aria-live="polite"></div>' +
          '<p class="event-form-feedback" aria-live="polite"></p>' +
          '<div class="registration-actions event-form-actions">' +
          '<button type="submit" class="btn btn-primary">Submit Team Registration</button>' +
          "</div>" +
          "</form>";
      }

      function addTeamMemberRow(membersList) {
        const memberRow = document.createElement("div");
        memberRow.className = "event-member-row";
        memberRow.innerHTML =
          '<input name="members[]" type="text" placeholder="Member name" required />' +
          '<button type="button" class="event-member-remove" data-remove-member="true" aria-label="Remove member">Remove</button>';
        membersList.appendChild(memberRow);
      }

      function resetTeamMembers(membersList, count) {
        membersList.innerHTML = "";

        for (let i = 0; i < count; i += 1) {
          addTeamMemberRow(membersList);
        }
      }

      function setEventFormFeedback(form, message, isError) {
        const feedback = form.querySelector(".event-form-feedback");
        if (!feedback) {
          return;
        }

        feedback.textContent = message;
        feedback.classList.toggle("error", Boolean(isError));
      }

      function openTeaserModal(selectionContext) {
        if (!teaserModal || !teaserTitle || !teaserVenue || !teaserMechanics) {
          return;
        }

        teaserTitle.textContent = "Select Event";
        teaserModal.dataset.activeGroupKey = selectionContext.groupKey || "";
        renderEventSelection(selectionContext);
        setTeaserStep("selection");
        teaserModal.classList.add("is-open");
        teaserModal.setAttribute("aria-hidden", "false");
        document.body.classList.add("modal-open");
      }

      function closeTeaserModal() {
        if (!teaserModal) {
          return;
        }

        stopRegistrationRealtimeSync();

        teaserModal.classList.remove("is-open");
        teaserModal.setAttribute("aria-hidden", "true");
        teaserModal.dataset.activeEventId = "";
        teaserModal.dataset.activeEventTitle = "";
        teaserModal.dataset.activeGroupKey = "";

        document.body.classList.remove("modal-open");
      }

      initializeAdminAccess();
      initializeResponseCounters();

      if (interestedButton) {
        interestedButton.addEventListener("click", () => {
          trackResponse("interested");
        });
      }

      if (excitedButton) {
        excitedButton.addEventListener("click", () => {
          trackResponse("excited");
        });
      }

      window.addEventListener("beforeunload", () => {
        clearResponseReconnectTimer();

        if (responsePollIntervalId) {
          clearInterval(responsePollIntervalId);
        }

        if (responseRealtimeChannel && supabaseClient) {
          supabaseClient.removeChannel(responseRealtimeChannel);
          responseRealtimeChannel = null;
        }

        if (authStateSubscription && typeof authStateSubscription.unsubscribe === "function") {
          authStateSubscription.unsubscribe();
          authStateSubscription = null;
        }

        stopRegistrationRealtimeSync();
      });

      if (teaserModal) {
        teaserModal.addEventListener("click", (event) => {
          const target = event.target;
          if (target instanceof HTMLElement && target.dataset.teaserClose === "true") {
            closeTeaserModal();
            return;
          }

          if (!(target instanceof HTMLElement)) {
            return;
          }

          const selectEventButton = target.closest("[data-select-event='true']");
          if (selectEventButton instanceof HTMLElement) {
            const selectedEventId = selectEventButton.dataset.eventId || "";
            if (selectedEventId) {
              showSelectedEventDetails(selectedEventId);
            }
            return;
          }

          const addMemberButton = target.closest("[data-add-member='true']");
          if (addMemberButton instanceof HTMLElement) {
            const form = addMemberButton.closest(".event-registration-form");
            const membersList = form ? form.querySelector(".event-members-list") : null;
            if (membersList) {
              const rows = membersList.querySelectorAll(".event-member-row");
              if (rows.length >= 3) {
                if (form instanceof HTMLFormElement) {
                  setEventFormFeedback(form, getTeamSizeValidationMessage(), true);
                }
                return;
              }

              addTeamMemberRow(membersList);
              const activeEventId = getActiveEventId();
              if (form instanceof HTMLFormElement && activeEventId) {
                refreshEventRegistrationFormState(form, activeEventId);
              }
            }
            return;
          }

          const removeMemberButton = target.closest("[data-remove-member='true']");
          if (removeMemberButton instanceof HTMLElement) {
            const membersList = removeMemberButton.closest(".event-members-list");
            if (!membersList) {
              return;
            }

            const rows = membersList.querySelectorAll(".event-member-row");
            if (rows.length <= 1) {
              const onlyInput = rows[0] ? rows[0].querySelector("input") : null;
              if (onlyInput) {
                onlyInput.value = "";
              }
              return;
            }

            const row = removeMemberButton.closest(".event-member-row");
            if (row) {
              row.remove();
              const form = membersList.closest(".event-registration-form");
              const activeEventId = getActiveEventId();
              if (form instanceof HTMLFormElement && activeEventId) {
                refreshEventRegistrationFormState(form, activeEventId);
              }
            }
          }
        });

        teaserModal.addEventListener("input", (event) => {
          const target = event.target;
          if (!(target instanceof HTMLElement)) {
            return;
          }

          const form = target.closest(".event-registration-form");
          const activeEventId = getActiveEventId();
          if (form instanceof HTMLFormElement && activeEventId) {
            refreshEventRegistrationFormState(form, activeEventId);
          }
        });

        teaserModal.addEventListener("change", (event) => {
          const target = event.target;
          if (!(target instanceof HTMLElement)) {
            return;
          }

          const form = target.closest(".event-registration-form");
          const activeEventId = getActiveEventId();
          if (form instanceof HTMLFormElement && activeEventId) {
            refreshEventRegistrationFormState(form, activeEventId);
          }
        });

        teaserModal.addEventListener("submit", async (event) => {
          const form = event.target;
          if (!(form instanceof HTMLFormElement) || !form.classList.contains("event-registration-form")) {
            return;
          }

          event.preventDefault();

          if (form.dataset.isSubmitting === "true") {
            return;
          }

          const registrationType = form.dataset.registrationType || "coming-soon";
          const activeEventId = teaserModal.dataset.activeEventId || "event";
          const activeEventTitle = teaserModal.dataset.activeEventTitle || "Event";
          const family = (form.elements.namedItem("family") && form.elements.namedItem("family").value) || "";
          const trimmedFamily = family.trim();

          if (!trimmedFamily) {
            setEventFormFeedback(form, "Please select a family.", true);
            return;
          }

          const latestState = await ensureLatestRegistrationState(activeEventId);
          if (latestState && latestState.stats && latestState.stats.isClosed) {
            setEventFormFeedback(form, getRegistrationClosedValidationMessage(activeEventId), true);
            refreshEventRegistrationFormState(form, activeEventId);
            return;
          }

          if (latestState && latestState.stats && Array.isArray(latestState.stats.perFamily)) {
            const familyEntry = latestState.stats.perFamily.find((entry) => entry.family === trimmedFamily);

            if (registrationType === "individual" && familyEntry && familyEntry.count >= 2) {
              setEventFormFeedback(form, getFamilyLimitValidationMessage(activeEventId), true);
              refreshEventRegistrationFormState(form, activeEventId);
              return;
            }

            if (registrationType === "team" && familyEntry && familyEntry.count >= 2) {
              setEventFormFeedback(form, getTeamLimitValidationMessage(), true);
              refreshEventRegistrationFormState(form, activeEventId);
              return;
            }
          }

          if (registrationType === "individual") {
            const nameField = form.elements.namedItem("name");
            const participantName = nameField && typeof nameField.value === "string" ? nameField.value.trim() : "";

            if (!participantName) {
              setEventFormFeedback(form, "Please enter the participant name.", true);
              return;
            }

            const payload = {
              eventId: activeEventId,
              family: trimmedFamily,
              name: participantName,
            };

            form.dataset.isSubmitting = "true";

            try {
              const result = await submitEventRegistration(payload);
              const nextState = getRegistrationStatePayload(result.payload);
              cacheRegistrationState(nextState);

              if (!result.ok) {
                const message = result.payload && result.payload.message
                  ? result.payload.message
                  : "Unable to submit registration right now.";
                setEventFormFeedback(form, message, true);
                showToast(message);
                return;
              }

              setEventFormFeedback(form, "Registration submitted successfully.", false);
              showToast("Registration submitted for " + activeEventTitle + ".");
              form.reset();
            } finally {
              form.dataset.isSubmitting = "false";
              refreshEventRegistrationFormState(form, activeEventId);
            }

            return;
          }

          if (registrationType === "team") {
            const teamState = getCurrentTeamMemberState(form);
            const captain = teamState.captain;
            const members = teamState.members;
            const filledMembers = teamState.filledMembers;

            if (!captain) {
              setEventFormFeedback(form, "Please enter the team captain.", true);
              return;
            }

            if (members.some((member) => member.length === 0)) {
              setEventFormFeedback(form, "Please complete all team member fields or remove extras.", true);
              return;
            }

            if (filledMembers.length !== 3) {
              setEventFormFeedback(form, getTeamSizeValidationMessage(), true);
              return;
            }

            const payload = {
              eventId: activeEventId,
              family: trimmedFamily,
              captain,
              members: filledMembers,
            };

            form.dataset.isSubmitting = "true";

            try {
              const result = await submitEventRegistration(payload);
              const nextState = getRegistrationStatePayload(result.payload);
              cacheRegistrationState(nextState);

              if (!result.ok) {
                const message = result.payload && result.payload.message
                  ? result.payload.message
                  : "Unable to submit team registration right now.";
                setEventFormFeedback(form, message, true);
                showToast(message);
                return;
              }

              const teamLabel = result.payload && result.payload.registration
                ? result.payload.registration.teamLabel || ""
                : "";

              setEventFormFeedback(form, "Team registration submitted successfully.", false);
              showToast(teamLabel ? teamLabel + " registered for " + activeEventTitle + "." : "Team registered for " + activeEventTitle + ".");
              form.reset();
              const membersList = form.querySelector(".event-members-list");
              if (membersList) {
                resetTeamMembers(membersList, 3);
              }
            } finally {
              form.dataset.isSubmitting = "false";
              refreshEventRegistrationFormState(form, activeEventId);
            }

            return;
          }

          setEventFormFeedback(form, "Registration form coming soon for this event.", false);
        });
      }

      if (teaserChangeEventButton) {
        teaserChangeEventButton.addEventListener("click", () => {
          teaserTitle.textContent = "Select Event";
          stopRegistrationRealtimeSync();
          teaserModal.dataset.activeEventId = "";
          teaserModal.dataset.activeEventTitle = "";
          setTeaserStep("selection");
        });
      }

      const teaserTargets = document.querySelectorAll(".interactive-event[data-teaser-title]");
      teaserTargets.forEach((target) => {
        target.addEventListener("click", () => {
          const selectionContext = getEventSelectionContextFromTarget(target);
          openTeaserModal(selectionContext);
        });

        target.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            const selectionContext = getEventSelectionContextFromTarget(target);
            openTeaserModal(selectionContext);
          }
        });
      });

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && teaserModal && teaserModal.classList.contains("is-open")) {
          closeTeaserModal();
        }
      });

      const facebookButton = document.getElementById("facebook-button");
      if (facebookButton) {
        facebookButton.addEventListener("click", (event) => {
          event.preventDefault();
          showToast("Opening official CCS Facebook page.");
          window.open("https://www.facebook.com/mindorostateuccs", "_blank", "noopener,noreferrer");
        });
      }

      const officialWebsiteButton = document.getElementById("official-website-button");
      if (officialWebsiteButton) {
        officialWebsiteButton.addEventListener("click", (event) => {
          event.preventDefault();
          showToast("Official website details will be posted here soon.");
        });
      }

      const contactOfficeButton = document.getElementById("contact-office-button");
      if (contactOfficeButton) {
        contactOfficeButton.addEventListener("click", (event) => {
          event.preventDefault();
          showToast("Contact office information will be announced on the official CCS page.");
        });
      }

      updateCountdown();
      setInterval(updateCountdown, 60000);

      // Reveal sections when entering the viewport for lightweight entrance animation.
      const revealTargets = document.querySelectorAll(".reveal");
      if (!prefersReducedMotion && "IntersectionObserver" in window) {
        const observer = new IntersectionObserver(
          (entries, obs) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                entry.target.classList.add("in-view");
                obs.unobserve(entry.target);
              }
            });
          },
          { threshold: 0.16 }
        );
        revealTargets.forEach((el) => observer.observe(el));
      } else {
        revealTargets.forEach((el) => el.classList.add("in-view"));
      }

      // Keep the footer year current without editing static content every year.
      const footerSmall = document.querySelector("footer small");
      if (footerSmall) {
        const year = new Date().getFullYear();
        footerSmall.textContent = "IT Day 2026 | Mindoro State University | Updated " + year + ".";
      }

      // Canvas particle field for expressive but lightweight ambient movement.
      if (prefersReducedMotion) {
        return;
      }

      const canvas = document.getElementById("particle-canvas");
      if (!canvas || !canvas.getContext) {
        return;
      }

      const ctx = canvas.getContext("2d");
      const particles = [];
      const maxParticles = Math.min(85, Math.max(35, Math.floor(window.innerWidth / 17)));
      const palette = ["#40f0ff", "#8dff9b", "#ffd75e"];

      function resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(window.innerWidth * dpr);
        canvas.height = Math.floor(window.innerHeight * dpr);
        canvas.style.width = window.innerWidth + "px";
        canvas.style.height = window.innerHeight + "px";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      function createParticle() {
        return {
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          r: Math.random() * 1.8 + 0.5,
          vx: (Math.random() - 0.5) * 0.22,
          vy: (Math.random() - 0.5) * 0.24,
          alpha: Math.random() * 0.4 + 0.2,
          hue: palette[Math.floor(Math.random() * palette.length)],
        };
      }

      function initParticles() {
        particles.length = 0;
        for (let i = 0; i < maxParticles; i += 1) {
          particles.push(createParticle());
        }
      }

      function updateParticle(p) {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < -12) p.x = window.innerWidth + 12;
        if (p.x > window.innerWidth + 12) p.x = -12;
        if (p.y < -12) p.y = window.innerHeight + 12;
        if (p.y > window.innerHeight + 12) p.y = -12;
      }

      function draw() {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

        for (let i = 0; i < particles.length; i += 1) {
          const p = particles[i];
          updateParticle(p);

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = hexToRgba(p.hue, p.alpha);
          ctx.fill();
        }

        // Draw sparse proximity lines for a subtle circuit-network effect.
        for (let i = 0; i < particles.length; i += 1) {
          for (let j = i + 1; j < particles.length; j += 1) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 120) {
              const opacity = (1 - dist / 120) * 0.09;
              ctx.strokeStyle = "rgba(64, 240, 255, " + opacity.toFixed(3) + ")";
              ctx.lineWidth = 0.6;
              ctx.beginPath();
              ctx.moveTo(particles[i].x, particles[i].y);
              ctx.lineTo(particles[j].x, particles[j].y);
              ctx.stroke();
            }
          }
        }

        requestAnimationFrame(draw);
      }

      function hexToRgba(hex, alpha) {
        const normalized = hex.replace("#", "");
        const bigint = parseInt(normalized, 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
      }

      resizeCanvas();
      initParticles();
      draw();

      let resizeTimeout;
      window.addEventListener("resize", () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          resizeCanvas();
          initParticles();
        }, 120);
      });
    })();
