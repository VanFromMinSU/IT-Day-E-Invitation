(function () {
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const interestedButton = document.getElementById("interested-button");
      const excitedButton = document.getElementById("excited-button");
      const responseSummary = document.getElementById("response-summary");
      const responseAdminActions = document.getElementById("response-admin-actions");
      const resetCountsButton = document.getElementById("reset-counts-button");
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
      const responseStorageKey = "itDayResponseCounts";
      const eventRegistrationStorageKey = "itDayEventRegistrations";
      const adminSessionKey = "itDayAdminAuthorized";
      const adminTokenParam = "adminToken";
      const adminTokenHash = "fb7cd66cd9802076b019b15ddf51cfbfd6ae603642a4153a5b78ae8696515bd4";
      let isAdminAuthorized = false;
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

      function getResponseCounts() {
        const fallback = { interested: 0, excited: 0 };

        try {
          const raw = localStorage.getItem(responseStorageKey);
          if (!raw) {
            return fallback;
          }

          const parsed = JSON.parse(raw);
          if (!parsed || typeof parsed !== "object") {
            return fallback;
          }

          const interested = Number(parsed.interested);
          const excited = Number(parsed.excited);
          return {
            interested: Number.isFinite(interested) && interested > 0 ? Math.floor(interested) : 0,
            excited: Number.isFinite(excited) && excited > 0 ? Math.floor(excited) : 0,
          };
        } catch (error) {
          return fallback;
        }
      }

      function saveResponseCounts(counts) {
        try {
          localStorage.setItem(responseStorageKey, JSON.stringify(counts));
        } catch (error) {
          showToast("Response counted, but local storage is unavailable on this browser.");
        }
      }

      function renderResponseCounts(counts) {
        if (!responseSummary) {
          return;
        }

        const total = counts.interested + counts.excited;
        responseSummary.textContent = "Interested: " + counts.interested + " | Excited: " + counts.excited + " | Total: " + total;
      }

      function setAdminResetVisibility(isVisible) {
        if (responseAdminActions) {
          responseAdminActions.hidden = !isVisible;
        }

        if (resetCountsButton) {
          resetCountsButton.hidden = !isVisible;
        }
      }

      async function hashText(value) {
        if (!window.crypto || !window.crypto.subtle) {
          return "";
        }

        const encoder = new TextEncoder();
        const data = encoder.encode(value);
        const digest = await window.crypto.subtle.digest("SHA-256", data);
        const bytes = Array.from(new Uint8Array(digest));
        return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
      }

      async function initializeAdminAccess() {
        if (!resetCountsButton) {
          return;
        }

        if (sessionStorage.getItem(adminSessionKey) === "true") {
          isAdminAuthorized = true;
          setAdminResetVisibility(true);
          return;
        }

        const params = new URLSearchParams(window.location.search);
        const adminToken = params.get(adminTokenParam);

        if (!adminToken) {
          setAdminResetVisibility(false);
          return;
        }

        const tokenHash = await hashText(adminToken.trim());
        isAdminAuthorized = tokenHash === adminTokenHash;
        if (isAdminAuthorized) {
          sessionStorage.setItem(adminSessionKey, "true");
        }

        params.delete(adminTokenParam);
        const nextQuery = params.toString();
        const nextUrl = window.location.pathname + (nextQuery ? "?" + nextQuery : "") + window.location.hash;
        window.history.replaceState({}, document.title, nextUrl);
        setAdminResetVisibility(isAdminAuthorized);
      }

      function trackResponse(responseType) {
        const counts = getResponseCounts();
        if (responseType === "interested") {
          counts.interested += 1;
        } else if (responseType === "excited") {
          counts.excited += 1;
        } else {
          return;
        }

        saveResponseCounts(counts);
        renderResponseCounts(counts);

        const total = counts.interested + counts.excited;
        showToast("Thanks for your response. Total reactions: " + total + ".");
      }

      function resetResponseCounts() {
        if (!isAdminAuthorized) {
          showToast("Admin access required.");
          return;
        }

        const zeroCounts = { interested: 0, excited: 0 };
        saveResponseCounts(zeroCounts);
        renderResponseCounts(zeroCounts);
        showToast("Response counts reset.");
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
      }

      function getEventRegistrations() {
        try {
          const raw = localStorage.getItem(eventRegistrationStorageKey);
          if (!raw) {
            return [];
          }

          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
          return [];
        }
      }

      function saveEventRegistration(payload) {
        const existing = getEventRegistrations();
        existing.push(payload);

        try {
          localStorage.setItem(eventRegistrationStorageKey, JSON.stringify(existing));
          return true;
        } catch (error) {
          return false;
        }
      }

      function buildFamilyOptionsMarkup() {
        return familyOptions
          .map((family) => '<option value="' + family + '">' + family + "</option>")
          .join("");
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
          '<div class="event-members-list">' +
          '<div class="event-member-row">' +
          '<input name="members[]" type="text" placeholder="Member name" required />' +
          '<button type="button" class="event-member-remove" data-remove-member="true" aria-label="Remove member">Remove</button>' +
          "</div>" +
          "</div>" +
          "</div>" +
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

        teaserModal.classList.remove("is-open");
        teaserModal.setAttribute("aria-hidden", "true");
        teaserModal.dataset.activeEventId = "";
        teaserModal.dataset.activeEventTitle = "";
        teaserModal.dataset.activeGroupKey = "";

        document.body.classList.remove("modal-open");
      }

      renderResponseCounts(getResponseCounts());
      setAdminResetVisibility(false);
      initializeAdminAccess();

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

      if (resetCountsButton) {
        resetCountsButton.addEventListener("click", () => {
          if (!isAdminAuthorized) {
            showToast("Admin access required.");
            return;
          }

          const approved = window.confirm("Reset all Interested and Excited counts?");
          if (!approved) {
            return;
          }

          resetResponseCounts();
        });
      }

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
              addTeamMemberRow(membersList);
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
            }
          }
        });

        teaserModal.addEventListener("submit", (event) => {
          const form = event.target;
          if (!(form instanceof HTMLFormElement) || !form.classList.contains("event-registration-form")) {
            return;
          }

          event.preventDefault();

          const registrationType = form.dataset.registrationType || "coming-soon";
          const activeEventId = teaserModal.dataset.activeEventId || "event";
          const activeEventTitle = teaserModal.dataset.activeEventTitle || "Event";
          const family = (form.elements.namedItem("family") && form.elements.namedItem("family").value) || "";
          const trimmedFamily = family.trim();

          if (!trimmedFamily) {
            setEventFormFeedback(form, "Please select a family.", true);
            return;
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
              eventTitle: activeEventTitle,
              registrationType,
              family: trimmedFamily,
              name: participantName,
              submittedAt: new Date().toISOString(),
            };

            const saved = saveEventRegistration(payload);
            setEventFormFeedback(form, saved ? "Registration submitted successfully." : "Registration captured, but local storage is unavailable.", !saved);
            showToast(saved ? "Registration submitted for " + activeEventTitle + "." : "Registration saved in session only.");
            if (saved) {
              form.reset();
            }
            return;
          }

          if (registrationType === "team") {
            const captainField = form.elements.namedItem("captain");
            const captain = captainField && typeof captainField.value === "string" ? captainField.value.trim() : "";
            const members = Array.from(form.querySelectorAll('input[name="members[]"]'))
              .map((input) => input.value.trim())
              .filter((value) => value.length > 0);

            if (!captain) {
              setEventFormFeedback(form, "Please enter the team captain.", true);
              return;
            }

            if (members.length === 0) {
              setEventFormFeedback(form, "Please add at least one team member.", true);
              return;
            }

            const payload = {
              eventId: activeEventId,
              eventTitle: activeEventTitle,
              registrationType,
              family: trimmedFamily,
              captain,
              members,
              submittedAt: new Date().toISOString(),
            };

            const saved = saveEventRegistration(payload);
            setEventFormFeedback(form, saved ? "Team registration submitted successfully." : "Registration captured, but local storage is unavailable.", !saved);
            showToast(saved ? "Team registered for " + activeEventTitle + "." : "Registration saved in session only.");
            if (saved) {
              form.reset();
              const membersList = form.querySelector(".event-members-list");
              if (membersList) {
                membersList.innerHTML = "";
                addTeamMemberRow(membersList);
              }
            }
            return;
          }

          setEventFormFeedback(form, "Registration form coming soon for this event.", false);
        });
      }

      if (teaserChangeEventButton) {
        teaserChangeEventButton.addEventListener("click", () => {
          teaserTitle.textContent = "Select Event";
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
