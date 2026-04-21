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
      const primaryMenuButton = document.getElementById("primary-menu-button");
      const primaryMenuPanel = document.getElementById("primary-menu-panel");
      const appToast = document.getElementById("app-toast");
      const countdownChip = document.getElementById("countdown-chip");
      const appConfig = window.APP_CONFIG && typeof window.APP_CONFIG === "object" ? window.APP_CONFIG : {};
      const responseVoterStorageKey = "itDayResponseVoterId";
      const responseChoiceStorageKey = "itDayResponseChoice";
      const responseSyncStorageKey = "itDayResponseSyncState";
      const registrationSyncStorageKey = "itDayRegistrationSyncState";
      const registrationOwnerTokenStorageKey = "itDayRegistrationOwnerToken";
      const registrationOwnershipStorageKey = "itDayRegistrationOwnership";
      const configuredApiBaseUrl = typeof appConfig.apiBaseUrl === "string" ? appConfig.apiBaseUrl.trim() : "";
      const apiBaseUrl = resolveApiBaseUrl(configuredApiBaseUrl);
      const responseApiBaseUrl = apiBaseUrl + "/api/reactions";
      const responseApiPathname = getApiPathname(responseApiBaseUrl);
      const responsePollingIntervalMs = 15000;
      const responseReconnectBaseDelayMs = 1800;
      const responseReconnectMaxDelayMs = 30000;
      const responseRpcTimeoutMs = 12000;
      const responseHttpTimeoutMs = 12000;
      const responseUnavailableMessage = "Live response counter is unavailable. Retrying in background.";
      const responseAlreadySubmittedMessage = "You have already submitted your response. You can only respond once on this device.";
      const eventRegistrationApiBaseUrl = apiBaseUrl + "/api/event-registrations";
      const eventRegistrationApiPathname = getApiPathname(eventRegistrationApiBaseUrl);
      const eventMechanicsApiBaseUrl = apiBaseUrl + "/api/event-mechanics";
      const eventMechanicsApiPathname = getApiPathname(eventMechanicsApiBaseUrl);
      const resetRegistrationsApiBaseUrl = apiBaseUrl + "/api/reset-registrations";
      const resetRegistrationsApiPathname = getApiPathname(resetRegistrationsApiBaseUrl);
      const eventRegistrationPollingIntervalMs = 12000;
      const adminModeParam = "admin";
      const adminTokenParam = "adminToken";
      const adminTokenSessionStorageKey = "itDayAdminTokenHash";
      const adminTokenLocalStorageKey = "itDayAdminTokenHash";
      const adminResetTokenHeader = "X-Admin-Token-Hash";
      const adminResetAuthorizationKey = {};
      const supabaseUrl = typeof appConfig.supabaseUrl === "string" ? appConfig.supabaseUrl.trim() : "";
      const supabaseAnonKey = typeof appConfig.supabaseAnonKey === "string" ? appConfig.supabaseAnonKey.trim() : "";
      const defaultResponseAdminTokenHash = "fb7cd66cd9802076b019b15ddf51cfbfd6ae603642a4153a5b78ae8696515bd4";
      const configuredResponseAdminTokenHash =
        typeof appConfig.responseAdminTokenHash === "string" && /^[a-f0-9]{64}$/i.test(appConfig.responseAdminTokenHash.trim())
          ? appConfig.responseAdminTokenHash.trim().toLowerCase()
          : "";
      const responseAdminTokenHash = configuredResponseAdminTokenHash || defaultResponseAdminTokenHash;
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
      const registrationEventIds = new Set(["chess-tournament", "rubiks-cube-competition", "sudoku-game-easy-level", "it-quiz-bee", "codm-tournament", "mobile-legends-tournament", "fast-typing", "crimping-competition", "assembling-and-disassembling-competition", "battle-of-the-bands", "basketball-half-court", "mr-and-ms-it-2026"]);
      let isAdminAuthorized = false;
      let isAdminModeRequested = false;
      let isAdminTokenAuthorized = false;
      let adminTokenHash = "";
      let authStateSubscription = null;
      let responseAdminActions = null;
      let resetCountsButton = null;
      let resetRegistrationsButton = null;
      let isResetRequestPending = false;
      let isRegistrationResetPending = false;
      let responsePollIntervalId = null;
      let responseRealtimeChannel = null;
      let registrationPollIntervalId = null;
      let registrationRealtimeChannel = null;
      let responseCounts = { interested: 0, excited: 0 };
      const registrationStateByEventId = {};
      const mechanicsOverridesByEventId = {};
      const mechanicsEditStateByEventId = {};
      let ownedRegistrationLookup = loadOwnedRegistrationLookup();
      let registrationOwnerTokenHashCache = "";
      let registrationOwnerTokenHashCacheToken = "";
      const pendingRegistrationCancellationIds = new Set();
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
        "parade-slot": {
          label: "Parade",
          eventIds: ["parade-brass-band"],
        },
        "opening-program-slot": {
          label: "Opening Program",
          eventIds: ["opening-ceremony", "flag-raising", "harmonics", "program-proper"],
        },
        "academic-coding": {
          label: "Academic and Coding Arena",
          eventIds: [
            "it-quiz-bee",
            "fast-typing",
            "crimping-competition",
            "assembling-and-disassembling-competition",
            "family-booth",
            "parlor-games",
            "programming-java",
            "programming-python",
            "programming-sql",
            "programming-csharp",
          ],
        },
        esports: {
          label: "Esports Competition",
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
        "day1-opening-program-slot": {
          label: "Parade and Opening Program",
          eventIds: ["parade-brass-band", "opening-ceremony", "program-proper", "flag-raising", "invocation", "minsu-hymn", "opening-remarks", "competition-announcement", "hip-hop-competition"],
        },
        "day1-competitions-begin-slot": {
          label: "Competitions Begin",
          eventIds: ["programming-java", "programming-python", "programming-csharp", "programming-sql", "crimping-competition", "fast-typing", "assembling-and-disassembling-competition", "mobile-legends-tournament"],
        },
        "day1-sports-and-mind-games-slot": {
          label: "Sports and Mind Games",
          eventIds: ["basketball-half-court", "beach-volleyball", "chess-tournament", "rubiks-cube-competition", "sudoku-game-easy-level"],
        },
        "day2-continuation-of-competitions-slot": {
          label: "Continuation of Competitions",
          eventIds: ["ideathon-pitching", "it-quiz-bee", "digital-arts", "codm-tournament"],
        },
        "day2-major-program-slot": {
          label: "Major Program",
          eventIds: ["mr-and-ms-it-2026", "opening-proper-mainstage", "battle-of-the-bands", "same-day-edit", "teaser-showing", "awarding-ceremony"],
        },
      };

      const eventTitleMap = {
        "parade-brass-band": "Parade (with Brass Band)",
        "opening-ceremony": "Opening Ceremony",
        "flag-raising": "Flag Raising",
        harmonics: "Harmonics",
        "program-proper": "Program Proper",
        "it-quiz-bee": "IT Quiz Bee",
        "fast-typing": "Fast Typing Competition",
        "crimping-competition": "Crimping Competition",
        "assembling-and-disassembling-competition": "Assembling and Disassembling Competition",
        "family-booth": "Family Booth",
        "parlor-games": "Parlor Games",
        "programming-java": "Programming Competition - Java",
        "programming-python": "Programming Competition - Python",
        "programming-sql": "Programming Competition - SQL",
        "programming-csharp": "Programming Competition - C#",
        invocation: "Invocation",
        "minsu-hymn": "MinSU Hymn",
        "opening-remarks": "Opening Remarks",
        "competition-announcement": "Announcement of Competition",
        "hip-hop-competition": "Hip-hop Competition",
        "computer-aided-design-ad": "Computer Aided Design (A/D)",
        "ideathon-pitching": "Ideathon Pitching",
        "digital-arts": "Digital Arts",
        "opening-proper-mainstage": "Opening Proper",
        "live-band": "Live Band",
        "same-day-edit": "Same Day Edit",
        "teaser-showing": "Teaser Showing",
        "awarding-ceremony": "Awarding",
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
        "parade-brass-band": {
          eventId: "parade-brass-band",
          title: "Parade (with Brass Band)",
          venue: "Main Campus Grounds",
          registrationType: "none",
          mechanicsHtml:
            '<h5>Guidelines</h5>' +
            '<ul>' +
            '<li>All participants must assemble at least 15 minutes before call time.</li>' +
            '<li>Follow the designated parade route and marshal instructions at all times.</li>' +
            '<li>Maintain proper formation and avoid blocking emergency or access lanes.</li>' +
            '<li>Use only approved props, uniforms, and instruments for the parade segment.</li>' +
            '<li>Observe discipline, safety, and respectful behavior throughout the activity.</li>' +
            '</ul>',
        },
        "opening-ceremony": {
          eventId: "opening-ceremony",
          title: "Opening Ceremony",
          venue: "Auditorium",
          registrationType: "none",
          mechanicsHtml:
            '<h5>Guidelines</h5>' +
            '<ul>' +
            '<li>Participants and guests must be seated before the ceremony starts.</li>' +
            '<li>Observe proper decorum during messages, introductions, and acknowledgments.</li>' +
            '<li>Keep aisles clear and avoid movement while the program is in progress.</li>' +
            '<li>Mobile devices must be set to silent mode.</li>' +
            '<li>Follow ushers and organizers for seating and flow control.</li>' +
            '</ul>',
        },
        "day1-opening-program": {
          eventId: "day1-opening-program",
          title: "Parade and Opening Program",
          venue: "Auditorium and Main Campus Grounds",
          registrationType: "none",
          mechanicsHtml:
            '<h5>Program Outline</h5>' +
            '<ul>' +
            '<li>Opening Ceremony / Program Proper</li>' +
            '<li>Flag Raising</li>' +
            '<li>Invocation</li>' +
            '<li>MinSU Hymn</li>' +
            '<li>Opening Remarks</li>' +
            '<li>Announcement of Competition</li>' +
            '<li>Hip-hop Competition</li>' +
            '</ul>',
        },
        "day1-competitions-begin": {
          eventId: "day1-competitions-begin",
          title: "Competitions Begin",
          venue: "Competition Venues",
          registrationType: "none",
          mechanicsHtml:
            '<h5>Competition Blocks</h5>' +
            '<ul>' +
            '<li>Programming Competitions: Java, Python, C#, SQL</li>' +
            '<li>IT Skills Competitions: Crimping, Fast Typing, Assembling and Disassembling Competition</li>' +
            '<li>Esports Competition: Mobile Legends</li>' +
            '</ul>',
        },
        "day1-sports-and-mind-games": {
          eventId: "day1-sports-and-mind-games",
          title: "Sports and Mind Games",
          venue: "Sports and Game Venues",
          registrationType: "none",
          mechanicsHtml:
            '<h5>Afternoon Program</h5>' +
            '<ul>' +
            '<li>Sports: Basketball, Beach Volleyball</li>' +
            '<li>Mind Games: Chess, Rubik\'s Cube, Sudoku</li>' +
            '</ul>',
        },
        "day2-continuation-of-competitions": {
          eventId: "day2-continuation-of-competitions",
          title: "Continuation of Competitions",
          venue: "Competition Venues",
          registrationType: "none",
          mechanicsHtml:
            '<h5>Morning Program</h5>' +
            '<ul>' +
            '<li>Ideathon Pitching</li>' +
            '<li>IT Quiz Bee</li>' +
            '<li>Digital Arts</li>' +
            '<li>Esports Competition: Call of Duty Mobile</li>' +
            '</ul>',
        },
        "day2-major-program": {
          eventId: "day2-major-program",
          title: "Major Program",
          venue: "Main Stage",
          registrationType: "none",
          mechanicsHtml:
            '<h5>Afternoon Program</h5>' +
            '<ul>' +
            '<li>Mr. and Ms. IT 2026</li>' +
            '<li>Opening Proper</li>' +
            '<li>Battle of the Bands</li>' +
            '<li>Same Day Edit</li>' +
            '<li>Teaser Showing</li>' +
            '<li>Awarding</li>' +
            '</ul>',
        },
        "flag-raising": {
          eventId: "flag-raising",
          title: "Flag Raising",
          venue: "Auditorium",
          registrationType: "none",
          mechanicsHtml:
            '<h5>Guidelines</h5>' +
            '<ul>' +
            '<li>Everyone is expected to stand and face the flag during the rite.</li>' +
            '<li>Maintain silence and proper posture while the ceremony is ongoing.</li>' +
            '<li>Headwear should be removed unless required by official uniform protocol.</li>' +
            '<li>No unnecessary movement, conversation, or disruption is allowed.</li>' +
            '<li>Follow facilitator instructions from start to completion.</li>' +
            '</ul>',
        },
        harmonics: {
          eventId: "harmonics",
          title: "Harmonics",
          venue: "Auditorium",
          registrationType: "none",
          mechanicsHtml:
            '<h5>Guidelines</h5>' +
            '<ul>' +
            '<li>Performers must be ready backstage before their assigned cue.</li>' +
            '<li>Audio checks and technical setup must be completed prior to the segment.</li>' +
            '<li>Respect performance flow by minimizing noise and movement.</li>' +
            '<li>Use only approved accompaniment and equipment provided or cleared by organizers.</li>' +
            '<li>Observe stage safety and coordinator instructions at all times.</li>' +
            '</ul>',
        },
        "program-proper": {
          eventId: "program-proper",
          title: "Program Proper",
          venue: "Auditorium",
          registrationType: "none",
          mechanicsHtml:
            '<h5>Guidelines</h5>' +
            '<ul>' +
            '<li>Proceed according to the official sequence released by the program committee.</li>' +
            '<li>Speakers and participants must be present and prepared before their turn.</li>' +
            '<li>Observe time allotments to keep the program on schedule.</li>' +
            '<li>Maintain professional conduct and respect for all speakers and segments.</li>' +
            '<li>All announcements and transitions are under organizer control.</li>' +
            '</ul>',
        },
        invocation: {
          eventId: "invocation",
          title: "Invocation",
          venue: "Auditorium",
          registrationType: "none",
          mechanicsHtml:
            '<h5>Guidelines</h5>' +
            '<ul>' +
            '<li>Maintain silence and respect throughout the invocation.</li>' +
            '<li>All participants and guests should remain in place during the prayer segment.</li>' +
            '<li>Follow the host\'s cue for standing or sitting.</li>' +
            '</ul>',
        },
        "minsu-hymn": {
          eventId: "minsu-hymn",
          title: "MinSU Hymn",
          venue: "Auditorium",
          registrationType: "none",
          mechanicsHtml:
            '<h5>Guidelines</h5>' +
            '<ul>' +
            '<li>Participants are expected to stand respectfully while the hymn is played.</li>' +
            '<li>Sing along where appropriate and maintain proper decorum.</li>' +
            '<li>Await organizer instructions before transitioning to the next segment.</li>' +
            '</ul>',
        },
        "opening-remarks": {
          eventId: "opening-remarks",
          title: "Opening Remarks",
          venue: "Auditorium",
          registrationType: "none",
          mechanicsHtml:
            '<h5>Guidelines</h5>' +
            '<ul>' +
            '<li>Speakers should coordinate with program flow before stepping on stage.</li>' +
            '<li>Audience should remain attentive and minimize movement during speeches.</li>' +
            '<li>Time limits should be observed to keep the schedule on track.</li>' +
            '</ul>',
        },
        "competition-announcement": {
          eventId: "competition-announcement",
          title: "Announcement of Competition",
          venue: "Auditorium",
          registrationType: "none",
          mechanicsHtml:
            '<h5>Guidelines</h5>' +
            '<ul>' +
            '<li>Organizers will announce event flow, venue assignments, and call times.</li>' +
            '<li>Participants should confirm categories and proceed to assigned venues promptly.</li>' +
            '<li>Clarifications may be raised only during the designated Q&amp;A window.</li>' +
            '</ul>',
        },
        "hip-hop-competition": {
          eventId: "hip-hop-competition",
          title: "Hip-hop Competition",
          venue: "Main Stage",
          registrationType: "none",
          mechanicsHtml:
            '<h5>Guidelines</h5>' +
            '<ul>' +
            '<li>Performers must be prepared backstage before their scheduled call.</li>' +
            '<li>Use only approved music tracks and follow stage safety rules.</li>' +
            '<li>Judges\' decisions and organizer rulings are final.</li>' +
            '</ul>',
        },
        "computer-aided-design-ad": {
          eventId: "computer-aided-design-ad",
          title: "Computer Aided Design (A/D)",
          venue: "Computer Laboratory",
          registrationType: "none",
          mechanicsHtml:
            '<h5>Guidelines</h5>' +
            '<ul>' +
            '<li>Participants should follow the design brief and submission format provided by organizers.</li>' +
            '<li>Only authorized software and reference materials are allowed during the event.</li>' +
            '<li>Outputs must be submitted within the given time allotment.</li>' +
            '</ul>',
        },
        "ideathon-pitching": {
          eventId: "ideathon-pitching",
          title: "Ideathon Pitching",
          venue: "Presentation Hall",
          registrationType: "none",
          mechanicsHtml:
            '<h5>Guidelines</h5>' +
            '<ul>' +
            '<li>Teams must present within the allocated pitch time.</li>' +
            '<li>Evaluation is based on innovation, feasibility, and delivery.</li>' +
            '<li>All visual aids should be prepared before the pitch queue starts.</li>' +
            '</ul>',
        },
        "digital-arts": {
          eventId: "digital-arts",
          title: "Digital Arts",
          venue: "Digital Arts Room",
          registrationType: "none",
          mechanicsHtml:
            '<h5>Guidelines</h5>' +
            '<ul>' +
            '<li>Participants should follow the announced theme and output requirements.</li>' +
            '<li>Only original works created within the contest period are accepted.</li>' +
            '<li>Submissions beyond the deadline may be disqualified.</li>' +
            '</ul>',
        },
        "opening-proper-mainstage": {
          eventId: "opening-proper-mainstage",
          title: "Opening Proper",
          venue: "Main Stage",
          registrationType: "none",
          mechanicsHtml:
            '<h5>Guidelines</h5>' +
            '<ul>' +
            '<li>Program hosts and participants must follow the approved run sheet.</li>' +
            '<li>Stage transitions should be coordinated with the technical team.</li>' +
            '<li>Time management should be observed for all segments.</li>' +
            '</ul>',
        },
        "live-band": {
          eventId: "live-band",
          title: "Live Band",
          venue: "Main Stage",
          registrationType: "none",
          mechanicsHtml:
            '<h5>Guidelines</h5>' +
            '<ul>' +
            '<li>Band setup and sound checks must follow technical crew instructions.</li>' +
            '<li>Performances should stay within assigned set times.</li>' +
            '<li>Stage safety and equipment handling protocols must be observed.</li>' +
            '</ul>',
        },
        "same-day-edit": {
          eventId: "same-day-edit",
          title: "Same Day Edit",
          venue: "Main Stage",
          registrationType: "none",
          mechanicsHtml:
            '<h5>Guidelines</h5>' +
            '<ul>' +
            '<li>Production teams must submit cuts according to the announced timeline.</li>' +
            '<li>Only event-day captured materials are permitted.</li>' +
            '<li>Final outputs should follow the required format and duration limits.</li>' +
            '</ul>',
        },
        "teaser-showing": {
          eventId: "teaser-showing",
          title: "Teaser Showing",
          venue: "Main Stage",
          registrationType: "none",
          mechanicsHtml:
            '<h5>Guidelines</h5>' +
            '<ul>' +
            '<li>Teasers will be shown in the sequence approved by organizers.</li>' +
            '<li>All media files should be submitted to the technical team before screening.</li>' +
            '<li>Runtime and content policies must be strictly followed.</li>' +
            '</ul>',
        },
        "awarding-ceremony": {
          eventId: "awarding-ceremony",
          title: "Awarding",
          venue: "Main Stage",
          registrationType: "none",
          mechanicsHtml:
            '<h5>Guidelines</h5>' +
            '<ul>' +
            '<li>Awardees should proceed to the stage only when called.</li>' +
            '<li>Program marshals will direct lineup and stage movement.</li>' +
            '<li>Official photos and documentation follow organizer instructions.</li>' +
            '</ul>',
        },
        "it-quiz-bee": {
          eventId: "it-quiz-bee",
          title: "IT Quiz Bee Competition",
          venue: "BSIT 2-F2 ROOM",
          registrationType: "team",
          mechanicsHtml:
            '<h5>IT QUIZ BEE COMPETITION</h5>' +
            '<h5>Mechanics and Guidelines</h5>' +
            '<h5>AWARDS</h5>' +
            '<ul>' +
            '<li>GOLD - Champion</li>' +
            '<li>SILVER - 1st Runner-up</li>' +
            '<li>BRONZE - 2nd Runner-up</li>' +
            '</ul>' +
            '<h5>SUBJECT COVERAGE</h5>' +
            '<p>Questions will cover: CS/IT Concepts, Current Trends in CS/IT, Programming Languages, Web Design and Development, Mobile Application Development, Internet Applications, System Analysis and Design, Database Concepts and RDBMS, Logic Design and Switching, Computer Architecture and Organization, Software Engineering and Project Management, Operating System, Data Communication and Networks, IT Security, Data Structures and Algorithm, Automata, and Discrete Mathematics.</p>' +
            '<h5>PARTICIPANTS / REGISTRATION and WATCHERS</h5>' +
            '<ul>' +
            '<li>Each team shall consist of four (4) participants.</li>' +
            '<li>Participants must have exemplary knowledge in I.T. disciplines and applications.</li>' +
            '<li>Each team/family must provide one (1) watcher.</li>' +
            '<li>The assigned watcher will monitor an opposing team, not their own.</li>' +
            '<li>All participants and watcher must be officially registered at least one (1) week before the competition. Late registrations will not be accepted.</li>' +
            '<li>Changes to participants after registration are allowed only for serious reasons.</li>' +
            '</ul>' +
            '<h5>CHALLENGE FORMAT</h5>' +
            '<ul>' +
            '<li>The competition consists of three rounds: EASY, AVERAGE, and DIFFICULT.</li>' +
            '<li>Each round varies in difficulty, question type, time limit, and corresponding points.</li>' +
            '</ul>' +
            '<h5>MODE OF ANSWERING</h5>' +
            '<ul>' +
            '<li>EASY and AVERAGE Rounds: Teams will use printed answer cards (A, B, C, D).</li>' +
            '<li>Raise one card per question to indicate the final answer.</li>' +
            '<li>DIFFICULT Round: Teams will use blank sheets to write answers.</li>' +
            '<li>Answers must be clear; once the facilitator says "pens up," writing stops.</li>' +
            '<li>No erasures are allowed in the DIFFICULT round.</li>' +
            '</ul>' +
            '<h5>ROUND MECHANICS</h5>' +
            '<h6>EASY ROUND</h6>' +
            '<ul>' +
            '<li>Multiple-choice (A-D)</li>' +
            '<li>10 questions</li>' +
            '<li>10 seconds per question</li>' +
            '<li>2 points per correct answer</li>' +
            '</ul>' +
            '<h6>AVERAGE ROUND</h6>' +
            '<ul>' +
            '<li>Multiple-choice (A-D)</li>' +
            '<li>10 questions</li>' +
            '<li>15 seconds per question</li>' +
            '<li>3 points per correct answer</li>' +
            '</ul>' +
            '<h6>DIFFICULT ROUND</h6>' +
            '<ul>' +
            '<li>Identification-type questions</li>' +
            '<li>10 questions</li>' +
            '<li>Each team gets 10 blank sheets and pens</li>' +
            '<li>20 seconds per question</li>' +
            '<li>5 points per correct answer</li>' +
            '<li>No erasures allowed</li>' +
            '</ul>' +
            '<h5>TIE-BREAKER (CLINCHER ROUND)</h5>' +
            '<ul>' +
            '<li>3 questions per team</li>' +
            '<li>10 seconds per question</li>' +
            '<li>6 points per correct answer</li>' +
            '</ul>' +
            '<h5>DISQUALIFICATION RULES</h5>' +
            '<ul>' +
            '<li>Teams arriving 10 minutes late will be disqualified.</li>' +
            '<li>Switching answers after time is not allowed.</li>' +
            '<li>Cheating or prompting leads to disqualification.</li>' +
            '<li>Mobile phones, internet, or electronic devices are prohibited.</li>' +
            '<li>Not following facilitator instructions may result in disqualification.</li>' +
            '</ul>' +
            '<h5>Registration Format</h5>' +
            '<ul>' +
            '<li>Family: [Family Name]</li>' +
            '<li>Watcher: [Name of Watcher]</li>' +
            '<li>Participants (maximum of 4 per family):</li>' +
            '<li>1. [Participant 1]</li>' +
            '<li>2. [Participant 2]</li>' +
            '<li>3. [Participant 3]</li>' +
            '<li>4. [Participant 4]</li>' +
            '</ul>',
        },
        "assembling-and-disassembling-competition": {
          eventId: "assembling-and-disassembling-competition",
          title: "Assembling and Disassembling Competition",
          venue: "ELECTRONICS LAB / 2F3",
          registrationType: "individual",
          mechanicsHtml:
            '<h5>Participants</h5>' +
            '<ol>' +
            '<li>All IT Society members (MinSU Main Campus).</li>' +
            '<li>Maximum of one (1) participant per team/family.</li>' +
            '<li>Participants must be registered.</li>' +
            '</ol>' +
            '<h5>Format</h5>' +
            '<ol>' +
            '<li>Two rounds: Disassembling and Assembling.</li>' +
            '<li>Each participant uses their own timer.</li>' +
            '<li>Participants must finish disassembly before assembly.</li>' +
            '<li>In case of a tie, the most safely assembled PC wins.</li>' +
            '</ol>' +
            '<h5>Disassembly Round</h5>' +
            '<ul>' +
            '<li>Disassemble the system unit.</li>' +
            '<li>Same model is used for all participants.</li>' +
            '<li>Judged by speed and accuracy.</li>' +
            '<li>Participants must avoid damage.</li>' +
            '</ul>' +
            '<h5>Assembly Round</h5>' +
            '<ul>' +
            '<li>Reassemble the system.</li>' +
            '<li>System must be fully functional.</li>' +
            '<li>Judged by speed and accuracy.</li>' +
            '<li>Winner is based on the shortest combined time.</li>' +
            '</ul>' +
            '<h5>Rules</h5>' +
            '<ul>' +
            '<li>Follow safety protocols.</li>' +
            '<li>Use provided tools only.</li>' +
            '<li>No cheating or sabotage.</li>' +
            '<li>False pause incurs a +5 seconds penalty.</li>' +
            '<li>Judges\' decision is final.</li>' +
            '</ul>',
        },
        "crimping-competition": {
          eventId: "crimping-competition",
          title: "Crimping Competition",
          venue: "COM LABORATORY 1",
          registrationType: "individual",
          mechanicsHtml:
            '<h5>Guidelines</h5>' +
            '<ol>' +
            '<li>Each family shall have a maximum of two (2) participants.</li>' +
            '<li>Each participant is provided with RJ45 connectors, ethernet cables, crimping tools, and network testers.</li>' +
            '<li>The participants should correctly crimp RJ45 connectors onto Ethernet cables.</li>' +
            '<li>Participants must use provided tools only.</li>' +
            '<li>Must follow standard RJ45 specifications.</li>' +
            '<li>Judges inspect alignment, order, and attachment. Final decision is irrevocable.</li>' +
            '<li>Fastest correct output wins.</li>' +
            '<li>Late by 15 minutes results in disqualification.</li>' +
            '</ol>',
        },
        "fast-typing": {
          eventId: "fast-typing",
          title: "Fast Typing Competition",
          venue: "COM LABORATORY 1",
          registrationType: "individual",
          mechanicsHtml:
            '<h5>Challenge Format</h5>' +
            '<ol>' +
            '<li>The contest consists of 3 stages: Easy, Average, and Hard.</li>' +
            '<li>Easy stage includes 3-5 sentences to type.</li>' +
            '<li>Average stage includes 1 whole paragraph to type.</li>' +
            '<li>Hard stage includes a series of paragraphs to type.</li>' +
            '<li>Participants have 2 hours to complete the contest.</li>' +
            '</ol>' +
            '<h5>Participants</h5>' +
            '<ol>' +
            '<li>Each family can register up to two (2) participants.</li>' +
            '<li>The deadline for participant registration is 1 hour before the competition.</li>' +
            '<li>One (1) watcher from each team will monitor the entire competition.</li>' +
            '</ol>' +
            '<h5>Point System</h5>' +
            '<ol>' +
            '<li>Scores are determined by the official WPM and accuracy results displayed by typer.io at the end of each round.</li>' +
            '<li>The total score is a combination of all three rounds.</li>' +
            '</ol>' +
            '<ul>' +
            '<li>Round 1: First - 20, Second - 15, Third - 10</li>' +
            '<li>Round 2: First - 30, Second - 25, Third - 20</li>' +
            '<li>Round 3: First - 50, Second - 40, Third - 30</li>' +
            '</ul>' +
            '<ol start="3">' +
            '<li>The maximum possible score is 100 points.</li>' +
            '<li>In the case of a tie, a sudden death typing round will determine the winner.</li>' +
            '</ol>' +
            '<h5>Allowed</h5>' +
            '<ol>' +
            '<li>Participants must bring their own laptops, which will be checked by the facilitator.</li>' +
            '<li>Only the typer.io tab should remain open during the competition. Typing can only begin when instructed.</li>' +
            '</ol>' +
            '<h5>Disqualification</h5>' +
            '<ol>' +
            '<li>Switching tabs more than 2 times results in disqualification.</li>' +
            '<li>Using the internet or unrelated apps is prohibited.</li>' +
            '<li>Auto-typers/macros/scripts result in disqualification.</li>' +
            '<li>Using pre-written passages results in disqualification.</li>' +
            '</ol>',
        },
        "mobile-legends-tournament": {
          eventId: "mobile-legends-tournament",
          title: "Mobile Legends Tournament",
          venue: "Auditorium",
          registrationType: "team",
          mechanicsHtml:
            '<h5>IT Day Mobile Legends Tournament</h5>' +
            '<h5>1. Tournament Format</h5>' +
            '<p>The semi-finals will follow a Single Elimination format.</p>' +
            '<p>Each match in the semi-finals will follow a Best of 5 structure.</p>' +
            '<p>The winners of the semi-final matches will advance to the finals.</p>' +
            '<h5>2. Match Schedule</h5>' +
            '<p>The semi-final match schedule will be determined and shared with the teams prior to the tournament. Teams must adhere to the provided schedule.</p>' +
            '<p>Failure to appear within 15 minutes of the scheduled match will result in forfeit, advancing the opponent team to the next stage.</p>' +
            '<h5>3. Team Composition</h5>' +
            '<p>Players must continue to use their pre-registered in-game names (IGNs) for the semi-finals.</p>' +
            '<p>No substitutions or player swaps will be allowed during this stage of the tournament.</p>' +
            '<h5>4. Rules and Gameplay</h5>' +
            '<p>All matches will be played in Custom Lobby Mode with standard Draft Pick settings.</p>' +
            '<p>Winning teams of each match will advance to the finals.</p>' +
            '<h5>5. Match Procedures and Technical Rules</h5>' +
            '<p>Teams must arrive 15 minutes before their scheduled semi-final match.</p>' +
            '<p>All players must use their pre-registered IGNs during gameplay.</p>' +
            '<h5>Technical Rules</h5>' +
            '<p>The tournament organizer holds no accountability for loss of power, internet connection issues, or personal technical problems experienced during the match. Players are strongly advised to ensure stable power and internet connections before the game.</p>',
        },
        "chess-tournament": {
          eventId: "chess-tournament",
          title: "Chess Competition",
          venue: "Electronics Lab",
          registrationType: "team",
          mechanicsHtml:
            '<h5>CHESS COMPETITION</h5>' +
            '<h5>Mechanics and Guidelines</h5>' +
            '<p><strong>FORMAT:</strong> Round Robin</p>' +
            '<p><strong>TIME CONTROL:</strong> 10 minutes per player (no increment)</p>' +
            '<p><strong>DIVISIONS:</strong> Male & Female (separate tournaments)</p>' +
            '<p><strong>PARTICIPANTS:</strong> 8 players per division, 2 Male & 2 Female per team</p>' +
            '<h5>Divisions</h5>' +
            '<ul>' +
            '<li>Male Division - 8 male participants</li>' +
            '<li>Female Division - 8 female participants</li>' +
            '<li>Each division has its own bracket, standings, and awards.</li>' +
            '<li>Both divisions follow the same rules and format.</li>' +
            '</ul>' +
            '<h5>Tournament Format - Round Robin</h5>' +
            '<ul>' +
            '<li>Every player plays against every other player exactly once.</li>' +
            '<li>Total rounds: 7 rounds per player.</li>' +
            '<li>Games per round: 4 games played simultaneously.</li>' +
            '<li>Estimated duration: 3 to 4 hours per division.</li>' +
            '</ul>' +
            '<h5>Scoring</h5>' +
            '<ul>' +
            '<li>Win = 1 point</li>' +
            '<li>Draw = 0.5 point</li>' +
            '<li>Loss = 0 point</li>' +
            '</ul>' +
            '<p>The player with the most points at the end of all 7 rounds is declared the Champion.</p>' +
            '<h5>General Rules</h5>' +
            '<ol>' +
            '<li><strong>Time Control</strong><ul><li>Each player has 10 minutes on the clock. No increment.</li><li>If time runs out, the player loses unless the opponent does not have sufficient material to deliver checkmate.</li></ul></li>' +
            '<li><strong>Touch-Move Rule</strong><ul><li>Touch your piece: you must move it.</li><li>Touch opponent\'s piece: you must capture it (if legal).</li><li>To adjust a piece, announce "adjust" before touching.</li></ul></li>' +
            '<li><strong>Illegal Moves</strong><ul><li>First illegal move is corrected if caught before opponent\'s next move.</li><li>Second illegal move results in automatic loss.</li></ul></li>' +
            '<li><strong>Phones and Electronic Devices</strong><ul><li>All devices must be silenced or off.</li><li>Using a phone/device during a game results in immediate loss.</li></ul></li>' +
            '<li><strong>Late Arrival</strong><ul><li>Players must be at the board and ready at start time.</li><li>More than 10 minutes late results in game forfeiture.</li></ul></li>' +
            '<li><strong>Conduct</strong><ul><li>Treat opponents and arbiter with respect.</li><li>No coaching or distracting opponents.</li></ul></li>' +
            '<li><strong>Draw Claims</strong><ul><li>Draw by mutual agreement.</li><li>Draw by stalemate.</li><li>Draw by threefold repetition.</li><li>Draw by 50-move rule.</li><li>Draw by insufficient material.</li></ul></li>' +
            '<li><strong>Arbiter\'s Decision</strong><ul><li>Tournament Arbiter oversees all games.</li><li>Arbiter ruling is final.</li><li>Concerns must be raised calmly and before the next move.</li></ul></li>' +
            '</ol>' +
            '<h5>Tie-Breaking Rules</h5>' +
            '<p>If two or more players finish with the same score, tie-breakers are applied in this order:</p>' +
            '<ol>' +
            '<li>Direct Encounter</li>' +
            '<li>Buchholz Score</li>' +
            '<li>Sonneborn-Berger Score</li>' +
            '<li>Number of Wins</li>' +
            '<li>Armageddon Game (1st Place only): White 5 min, Black 4 min; draw means Black wins.</li>' +
            '</ol>' +
            '<h5>Registration Format</h5>' +
            '<ul>' +
            '<li>Family: [Family Name]</li>' +
            '<li>Male Participants (max 2 per family):</li>' +
            '<li>1. [Male Participant 1]</li>' +
            '<li>2. [Male Participant 2]</li>' +
            '<li>Female Participants (max 2 per family):</li>' +
            '<li>1. [Female Participant 1]</li>' +
            '<li>2. [Female Participant 2]</li>' +
            '</ul>',
        },
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
        "battle-of-the-bands": {
          eventId: "battle-of-the-bands",
          title: "Battle of the Bands",
          venue: "Main Stage",
          registrationType: "team",
          mechanicsHtml:
            '<h5>LIVE BAND COMPETITION</h5>' +
            '<h5>MECHANICS AND RULES</h5>' +
            '<ol>' +
            '<li>Each group must perform an unpublished arrangement of Original Pilipino Music (OPM) or English songs. Lyrics must not contain any obscene, lewd, or inappropriate language.</li>' +
            '<li>Each group must have a minimum of five (5) and a maximum of seven (7) members.</li>' +
            '<li>Each group is given a total of 12 minutes, which includes set-up time, a warm-up song, and the contest piece. Exceeding the time limit will result in a deduction of 5 points from each judge.</li>' +
            '<li>Each group must bring their own instruments, except for the drum set, which will be provided by the host institution. Changing cymbals is allowed. A minimum of four (4) amplifiers will also be provided (for lead guitar, rhythm guitar, bass guitar, and keyboard).</li>' +
            '<li>Band members may be all-male, all-female, or a mix of both.</li>' +
            '<li>The use of pyrotechnics, smoke effects, or any combustible materials as props is strictly prohibited.</li>' +
            '<li>Medley arrangements are not allowed. Only one song performance is permitted.</li>' +
            '<li>Coaches/trainers may assist only during the warm-up song. No coaching or interference is allowed during the actual contest performance.</li>' +
            '<li>The host institution must provide an official timekeeper. A visible timer should be displayed on or near the stage.</li>' +
            '<li>The decision of the judges is final and cannot be appealed.</li>' +
            '</ol>' +
            '<h5>CRITERIA FOR JUDGING</h5>' +
            '<table class="event-criteria-table">' +
            '<thead><tr><th>Criteria</th><th>Percentage</th></tr></thead>' +
            '<tbody>' +
            '<tr><td>Musicality (harmony, rhythm, sound quality)</td><td>50%</td></tr>' +
            '<tr><td>Performance (stage presence, style)</td><td>30%</td></tr>' +
            '<tr><td>Technical Skills (instrument handling)</td><td>10%</td></tr>' +
            '<tr><td>Overall Impact (including interpretation)</td><td>10%</td></tr>' +
            '</tbody>' +
            '<tfoot><tr><td><strong>Total</strong></td><td><strong>100%</strong></td></tr></tfoot>' +
            '</table>',
        },
        "mr-and-ms-it-2026": {
          eventId: "mr-and-ms-it-2026",
          title: "Mr. and Ms. IT 2026",
          venue: "Main Stage",
          registrationType: "team",
          mechanicsHtml:
            '<h5>MR. AND MS. IT 2026 OFFICIAL MECHANICS AND JUDGING CRITERIA</h5>' +
            '<h5>OVERVIEW</h5>' +
            '<p>This competition aims to recognize outstanding individuals who embody excellence in both technical knowledge and professional presence within the information technology sector. Participants represent designated AI Families, with each family fielding one Mr. IT and one Ms. IT candidate. The event showcases creativity, professionalism, talent, and critical thinking through five competitive segments.</p>' +
            '<h5>SEGMENT MECHANICS</h5>' +
            '<p><strong>1. PRODUCTION SEGMENT (COSPLAY) - 20% of Total Score</strong></p>' +
            '<p><strong>Theme:</strong> AI Family Identity</p>' +
            '<p><strong>Core Requirement:</strong> All cosplay costumes must be crafted primarily from recycled materials to promote sustainability alongside technological innovation.</p>' +
            '<ul>' +
            '<li><strong>Group Intermission Performance:</strong> All candidates (paired by AI Family) will perform a synchronized group intermission number on stage to introduce their family themes and set the tone for individual presentations.</li>' +
            '<li><strong>Costume Presentation:</strong> After the group performance, each AI Family\'s Mr. and Ms. IT representatives will take the stage together to showcase their custom cosplay costumes. All pairs will ramp simultaneously to highlight cohesive design language.</li>' +
            '<li><strong>Individual Introduction:</strong> Each candidate will deliver a 30-second individual introduction connecting their costume design to their AI Family\'s name, values, and relevance to modern information technology.</li>' +
            '<li><strong>Additional Guidelines:</strong> Costumes must be safe for stage movement, with no sharp or hazardous components. Any non-recycled materials used must not exceed 10% of total costume composition, as verified by organizers prior to competition.</li>' +
            '</ul>' +
            '<p><strong>2. IT CORPORATE ATTIRE SEGMENT - 15% of Total Score</strong></p>' +
            '<p><strong>Theme:</strong> Professionalism in the Digital Workplace</p>' +
            '<p><strong>Core Requirement:</strong> Attire must reflect contemporary standards for IT industry professionals, balancing formality, functionality, and personal style.</p>' +
            '<ul>' +
            '<li><strong>Paired Ramp:</strong> Candidates will first present IT corporate uniforms in designated AI Family pairs. Each pair has a 45-second presentation slot.</li>' +
            '<li><strong>Group Runway Showcase:</strong> After paired presentations, all candidates will emerge simultaneously for a full-group runway to assess overall presentation consistency.</li>' +
            '<li><strong>Attire Specifications:</strong> Corporate attire may include tailored blazers, collared shirts, trousers, skirts, or modern tech-friendly ensembles. Footwear must be professional, accessories minimal, and grooming aligned with IT workplace standards.</li>' +
            '</ul>' +
            '<p><strong>3. TALENT SEGMENT - 15% of Total Score</strong></p>' +
            '<p><strong>Theme:</strong> Innovation and Skill Demonstration</p>' +
            '<p><strong>Core Requirement:</strong> Performances must be presented exclusively by paired candidates. External backup participants are strictly prohibited.</p>' +
            '<ul>' +
            '<li><strong>Paired Performance:</strong> Each AI Family pair presents a pre-prepared talent piece with a maximum duration of 5 minutes. IT or AI themed acts are encouraged.</li>' +
            '<li><strong>Penalty for External Participants:</strong> If external backup participants are involved, a 25% deduction applies to the pair\'s total segment score. Unauthorized participation may result in disqualification from this segment.</li>' +
            '<li><strong>Performance Guidelines:</strong> Acts must be suitable for a professional audience and must not contain offensive content. Technical requirements (audio, lighting, props) must be submitted at least one week in advance for approval and planning.</li>' +
            '</ul>' +
            '<p><strong>4. LONG GOWN AND TUXEDO/SUIT SEGMENT - 20% of Total Score</strong></p>' +
            '<p><strong>Theme:</strong> Formal Elegance and Professional Grace</p>' +
            '<p><strong>Core Requirement:</strong> Attire must be formal, well-tailored, and appropriate for a high-level industry gala or awards ceremony.</p>' +
            '<ul>' +
            '<li><strong>Paired Ramp:</strong> Candidates begin by presenting formal attire in pairs, with 45 seconds per pair.</li>' +
            '<li><strong>Individual Solo Ramp:</strong> After the paired segment, each candidate returns for a 30-second solo ramp to assess fit, style, and personal poise.</li>' +
            '<li><strong>Attire Specifications:</strong> Ms. IT candidates must wear full-length long gowns. Mr. IT candidates must wear tuxedos or formal tailored suits. IT/AI-themed customizations are permitted if formal elegance is maintained. Grooming must be polished and black-tie appropriate.</li>' +
            '</ul>' +
            '<p><strong>5. QUESTION AND ANSWER SEGMENT - 30% of Total Score</strong></p>' +
            '<p><strong>Format:</strong> Random Judge Assignment</p>' +
            '<p><strong>Core Requirement:</strong> Candidates respond to questions related to IT, AI, industry trends, or professional development while in formal attire.</p>' +
            '<ul>' +
            '<li><strong>Question Assignment Process:</strong> Each candidate draws a slip from a designated bowl indicating the specific judge who will ask the question to ensure impartiality and equal opportunity.</li>' +
            '<li><strong>Time Allocation:</strong> Candidates receive 10 seconds to prepare after the question, followed by a 60-second response time. A warning bell sounds at 50 seconds, and speaking must stop at 60 seconds.</li>' +
            '<li><strong>Question Scope:</strong> Questions cover emerging technologies, IT ethics, career development in the digital age, and bridging technology gaps in communities. Candidates are encouraged to draw from personal experience and industry knowledge.</li>' +
            '<li><strong>Guidelines:</strong> Responses must be clear, concise, and respectful. Pre-written notes and external materials are not allowed during this segment.</li>' +
            '</ul>' +
            '<h5>CRITERIA FOR JUDGING</h5>' +
            '<table class="event-criteria-table">' +
            '<thead><tr><th>Segment</th><th>Percentage</th></tr></thead>' +
            '<tbody>' +
            '<tr><td>Production Segment (Cosplay)</td><td>20%</td></tr>' +
            '<tr><td>IT Corporate Attire Segment</td><td>15%</td></tr>' +
            '<tr><td>Talent Segment</td><td>15%</td></tr>' +
            '<tr><td>Long Gown and Tuxedo/Suit Segment</td><td>20%</td></tr>' +
            '<tr><td>Question and Answer Segment</td><td>30%</td></tr>' +
            '</tbody>' +
            '<tfoot><tr><td><strong>Total</strong></td><td><strong>100%</strong></td></tr></tfoot>' +
            '</table>',
        },
        "codm-tournament": {
          eventId: "codm-tournament",
          title: "Call of Duty: Mobile (CODM) Tournament",
          venue: "Auditorium",
          registrationType: "team",
          mechanicsHtml:
            '<ol>' +
            "<li><strong>Tournament Overview</strong><ul><li>Format: Squad Battle Royale</li><li>Total Families: 4</li><li>Squads per Family: up to 3</li><li>Players per Squad: 4</li><li>Total Squads: up to 12</li><li>Total Players: up to 48</li><li>Platform: Mobile only</li></ul></li>" +
            "<li><strong>Team Structure</strong><ul><li>Each family can field 1 to 3 squads.</li><li>Each squad must have exactly four players.</li><li>Players cannot switch squads once the tournament begins.</li></ul></li>" +
            "<li><strong>Match Format</strong><ul><li>Total Matches: 3</li><li>All squads play in the same lobby per match.</li><li>Custom Room will be used (Room ID and Password from organizer).</li><li>Map Rotation: Game 1: Isolated, Game 2: Blackout, Game 3: Isolated.</li><li>Perspective: TPP (Third-Person Perspective).</li></ul></li>" +
            "<li><strong>Scoring System</strong><ul><li>Placement Points: 1st Place = 7 Points, 2nd Place = 5 Points, 3rd Place = 3 Points, 4th–8th Place = 1 Point.</li><li>Kill Points: 1 Kill = 2 Points.</li><li>Total score per match = Placement points + Kill points.</li></ul></li>" +
            "<li><strong>Win Conditions</strong><ul><li>Squad Champion: highest total points after all matches.</li><li>Family Champion: combined points of all registered squads from the same family.</li></ul></li>" +
            "<li><strong>Tiebreakers</strong><ul><li>Higher total kills.</li><li>Most first-place finishes.</li><li>Better placement in the final match.</li></ul></li>" +
            "<li><strong>Game Rules</strong><ul><li>Play fairly, no external assistance.</li><li>Strictly prohibited: cheating, hacking, emulators, account sharing, intentional feeding, and leaving match.</li><li>No teaming between squads, even from the same family.</li><li>Restricted Items and Equipment: No Jackal, No Hoverbike, No Tank, No Ballistic Weapons, No Third-Party Tools, No Execute.</li></ul></li>" +
            "<li><strong>Match Procedure</strong><ul><li>Organizer provides Room ID and Password.</li><li>Players join on time.</li><li>After each match, screenshot results and submit to organizer.</li></ul></li>" +
            "<li><strong>Disconnection Rule</strong><ul><li>Match continues if a player disconnects.</li><li>Restart only for server-wide issues.</li></ul></li>" +
            "<li><strong>Sportsmanship</strong><ul><li>Respect players and organizers.</li><li>No toxic behavior, trash talk, or harassment.</li><li>Follow organizer instructions.</li></ul></li>" +
            "<li><strong>Final Authority</strong><ul><li>Organizer has final decision on all disputes.</li><li>Rules may be adjusted before tournament starts.</li></ul></li>" +
            "</ol>",
        },
        "basketball-half-court": {
          eventId: "basketball-half-court",
          title: "Basketball (Men's Half Court)",
          venue: "Basketball Court",
          registrationType: "team",
          mechanicsHtml:
            '<h5>IT DAY 3x3 BASKETBALL</h5>' +
            '<h5>OFFICIAL RULEBOOK</h5>' +
            '<h5>1. Court and Players</h5>' +
            '<ul>' +
            '<li>The game shall be played on a half-court (15m x 11m) with one (1) basket.</li>' +
            '<li>Each team shall consist of three (3) players on the court and one (1) substitute.</li>' +
            '</ul>' +
            '<h5>2. Game Duration</h5>' +
            '<ul>' +
            '<li>The game shall be played in a single ten (10)-minute period (running time).</li>' +
            '<li>The first team to reach twenty-one (21) points shall be declared the winner.</li>' +
            '<li>If no team reaches 21 points, the team with the higher score at the end of regulation time wins.</li>' +
            '</ul>' +
            '<h5>3. Overtime</h5>' +
            '<ul>' +
            '<li>If the score is tied at the end of regulation, an overtime period shall be played.</li>' +
            '<li>The first team to score two (2) points in overtime shall be declared the winner.</li>' +
            '</ul>' +
            '<h5>4. Scoring System</h5>' +
            '<ul>' +
            '<li>1 point – Field goal inside the arc</li>' +
            '<li>2 points – Field goal outside the arc</li>' +
            '<li>1 point – Free throw</li>' +
            '</ul>' +
            '<h5>5. Game Start and Possession</h5>' +
            '<ul>' +
            '<li>A coin toss shall be conducted before the game.</li>' +
            '<li>The winning team may choose to take initial possession OR defer possession to overtime.</li>' +
            '<li>The game shall begin with a check ball at the top of the arc.</li>' +
            '</ul>' +
            '<h5>6. Possession and Ball Movement</h5>' +
            '<ul>' +
            '<li>After a successful basket or free throw, play continues immediately.</li>' +
            '<li>The non-scoring team must clear the ball beyond the arc before attempting to score.</li>' +
            '</ul>' +
            '<h5>7. Clearing the Ball</h5>' +
            '<ul>' +
            '<li>After gaining possession (rebound or steal), the team must clear the ball beyond the arc before attempting a shot.</li>' +
            '</ul>' +
            '<h5>8. Shot Clock</h5>' +
            '<ul>' +
            '<li>A twelve (12) second shot clock shall be implemented.</li>' +
            '</ul>' +
            '<h5>9. Fouls and Penalties</h5>' +
            '<ul>' +
            '<li>Team fouls shall be counted cumulatively:</li>' +
            '<li>1–6 fouls: No free throws</li>' +
            '<li>7–9 fouls: Two (2) free throws</li>' +
            '<li>10th foul and above: Two (2) free throws plus ball possession</li>' +
            '</ul>' +
            '<h5>10. Substitutions</h5>' +
            '<ul>' +
            '<li>Substitutions shall only be allowed during dead-ball situations.</li>' +
            '</ul>' +
            '<h5>11. Time-outs</h5>' +
            '<ul>' +
            '<li>Each team is allowed one (1) time-out.</li>' +
            '<li>Time-out duration shall be thirty (30) seconds.</li>' +
            '</ul>' +
            '<h5>12. Violations</h5>' +
            '<ul>' +
            '<li>The following violations shall result in loss of possession:</li>' +
            '<li>Traveling</li>' +
            '<li>Double dribble</li>' +
            '<li>Shot clock violation</li>' +
            '<li>Failure to clear the ball</li>' +
            '<li>Out-of-bounds</li>' +
            '</ul>' +
            '<h5>13. No Jump Ball Rule</h5>' +
            '<ul>' +
            '<li>All jump ball situations shall result in possession being awarded to the defensive team.</li>' +
            '</ul>' +
            '<h5>14. No-Charge Semi-Circle</h5>' +
            '<ul>' +
            '<li>The no-charge semicircle shall be observed.</li>' +
            '<li>Charging fouls shall not be called inside this area.</li>' +
            '</ul>' +
            '<h5>15. Coaching</h5>' +
            '<ul>' +
            '<li>On-court coaching is not allowed during the game.</li>' +
            '</ul>' +
            '<h5>16. Officials and Decisions</h5>' +
            '<ul>' +
            '<li>Games shall be officiated by assigned referees and event staff.</li>' +
            '<li>All decisions made by officials and organizers are final and binding.</li>' +
            '</ul>' +
            '<h5>17. Player Conduct</h5>' +
            '<ul>' +
            '<li>Players must wear proper sports attire.</li>' +
            '<li>Any unsportsmanlike behavior may result in penalties or disqualification.</li>' +
            '</ul>',
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

      function getPrimaryMenuLinks() {
        if (!(primaryMenuPanel instanceof HTMLElement)) {
          return [];
        }

        return Array.from(primaryMenuPanel.querySelectorAll('a[role="menuitem"]'));
      }

      function setPrimaryMenuFocusable(isOpen) {
        const links = getPrimaryMenuLinks();
        links.forEach((link) => {
          if (link instanceof HTMLAnchorElement) {
            link.tabIndex = isOpen ? 0 : -1;
          }
        });
      }

      function openPrimaryMenu() {
        if (!(primaryMenuButton instanceof HTMLButtonElement) || !(primaryMenuPanel instanceof HTMLElement)) {
          return;
        }

        primaryMenuButton.classList.add("is-open");
        primaryMenuButton.setAttribute("aria-expanded", "true");
        primaryMenuButton.setAttribute("aria-label", "Close primary navigation menu");
        primaryMenuPanel.hidden = false;
        primaryMenuPanel.classList.add("is-open");
        primaryMenuPanel.setAttribute("aria-hidden", "false");
        setPrimaryMenuFocusable(true);

        const firstLink = getPrimaryMenuLinks()[0];
        if (firstLink instanceof HTMLAnchorElement) {
          firstLink.focus();
        }
      }

      function closePrimaryMenu(returnFocus) {
        if (!(primaryMenuButton instanceof HTMLButtonElement) || !(primaryMenuPanel instanceof HTMLElement)) {
          return;
        }

        primaryMenuButton.classList.remove("is-open");
        primaryMenuButton.setAttribute("aria-expanded", "false");
        primaryMenuButton.setAttribute("aria-label", "Open primary navigation menu");
        primaryMenuPanel.classList.remove("is-open");
        primaryMenuPanel.setAttribute("aria-hidden", "true");
        setPrimaryMenuFocusable(false);

        window.setTimeout(() => {
          if (!primaryMenuPanel.classList.contains("is-open")) {
            primaryMenuPanel.hidden = true;
          }
        }, 220);

        if (returnFocus) {
          primaryMenuButton.focus();
        }
      }

      function togglePrimaryMenu() {
        if (!(primaryMenuButton instanceof HTMLButtonElement) || !(primaryMenuPanel instanceof HTMLElement)) {
          return;
        }

        if (primaryMenuPanel.classList.contains("is-open")) {
          closePrimaryMenu(true);
        } else {
          openPrimaryMenu();
        }
      }

      if (primaryMenuButton instanceof HTMLButtonElement && primaryMenuPanel instanceof HTMLElement) {
        primaryMenuPanel.hidden = true;
        setPrimaryMenuFocusable(false);

        primaryMenuButton.addEventListener("click", () => {
          togglePrimaryMenu();
        });

        primaryMenuPanel.addEventListener("click", (event) => {
          const target = event.target;
          if (target instanceof HTMLAnchorElement) {
            closePrimaryMenu(false);
          }
        });
      }

      function triggerTapFeedback(target) {
        if (prefersReducedMotion || !(target instanceof HTMLElement)) {
          return;
        }

        target.classList.remove("is-tapped");
        // Force reflow so repeated taps replay the animation reliably.
        void target.offsetWidth;
        target.classList.add("is-tapped");

        window.setTimeout(() => {
          target.classList.remove("is-tapped");
        }, 210);
      }

      function setButtonPendingState(button, isPending, pendingLabel) {
        if (!(button instanceof HTMLButtonElement)) {
          return;
        }

        if (isPending) {
          if (!button.dataset.defaultLabel) {
            button.dataset.defaultLabel = button.textContent || "";
          }

          button.classList.add("is-pending");
          button.setAttribute("aria-busy", "true");
          if (pendingLabel) {
            button.textContent = pendingLabel;
          }
          return;
        }

        button.classList.remove("is-pending");
        button.setAttribute("aria-busy", "false");
        if (button.dataset.defaultLabel) {
          button.textContent = button.dataset.defaultLabel;
          delete button.dataset.defaultLabel;
        }
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

      function resolveApiBaseUrl(value) {
        const normalizedValue = typeof value === "string" ? value.trim() : "";
        if (!normalizedValue) {
          return "";
        }

        return normalizedValue.replace(/\/+$/, "");
      }

      function getApiPathname(apiUrl) {
        try {
          return new URL(apiUrl, window.location.origin).pathname;
        } catch (error) {
          return apiUrl;
        }
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

      function updateResponseStatusFeedback() {
        if (isResponseSubmissionPending) {
          setResponseStatusNotice("Submitting your response...", false);
          return;
        }

        if (hasSubmittedResponse) {
          setResponseStatusNotice(responseAlreadySubmittedMessage, false);
          return;
        }

        if (!isResponseBackendReady) {
          return;
        }

        setResponseStatusNotice("", false);
      }

      function syncResponseStateToOtherTabs(reason) {
        try {
          localStorage.setItem(
            responseSyncStorageKey,
            JSON.stringify({
              reason: reason || "sync",
              responseType: submittedResponseType,
              counts: responseCounts,
              updatedAt: Date.now(),
            })
          );
        } catch (error) {
          // Ignore cross-tab synchronization errors.
        }
      }

      function syncRegistrationStateToOtherTabs(reason, eventId, state) {
        const payload = {
          reason: reason || "sync",
          updatedAt: Date.now(),
        };

        if (eventId) {
          payload.eventId = eventId;
        }

        if (state && typeof state === "object") {
          payload.state = state;
        }

        try {
          localStorage.setItem(
            registrationSyncStorageKey,
            JSON.stringify(payload)
          );
        } catch (error) {
          // Ignore cross-tab synchronization errors.
        }
      }

      function normalizeRegistrationOwnerToken(value) {
        const normalizedValue = typeof value === "string" ? value.trim() : "";
        return /^[A-Za-z0-9_:-]{16,180}$/.test(normalizedValue) ? normalizedValue : "";
      }

      function normalizeSha256Hash(value) {
        const normalizedValue = typeof value === "string" ? value.trim().toLowerCase() : "";
        return /^[a-f0-9]{64}$/.test(normalizedValue) ? normalizedValue : "";
      }

      function getOrCreateRegistrationOwnerToken() {
        let existingToken = "";

        try {
          existingToken = normalizeRegistrationOwnerToken(localStorage.getItem(registrationOwnerTokenStorageKey));
        } catch (error) {
          existingToken = "";
        }

        if (existingToken) {
          return existingToken;
        }

        const generatedToken = window.crypto && typeof window.crypto.randomUUID === "function"
          ? "owner-" + window.crypto.randomUUID()
          : "owner-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);

        try {
          localStorage.setItem(registrationOwnerTokenStorageKey, generatedToken);
        } catch (error) {
          // Continue with in-memory generated token only.
        }

        return generatedToken;
      }

      async function getRegistrationOwnerTokenHash(ownerToken) {
        const normalizedOwnerToken = normalizeRegistrationOwnerToken(ownerToken);
        if (!normalizedOwnerToken) {
          return "";
        }

        if (
          registrationOwnerTokenHashCache
          && registrationOwnerTokenHashCacheToken
          && registrationOwnerTokenHashCacheToken === normalizedOwnerToken
        ) {
          return registrationOwnerTokenHashCache;
        }

        const nextHash = normalizeSha256Hash(await hashStringSha256(normalizedOwnerToken));
        if (!nextHash) {
          return "";
        }

        registrationOwnerTokenHashCacheToken = normalizedOwnerToken;
        registrationOwnerTokenHashCache = nextHash;
        return nextHash;
      }

      function loadOwnedRegistrationLookup() {
        try {
          const raw = localStorage.getItem(registrationOwnershipStorageKey);
          if (!raw) {
            return {};
          }

          const parsed = JSON.parse(raw);
          if (!parsed || typeof parsed !== "object") {
            return {};
          }

          return parsed;
        } catch (error) {
          return {};
        }
      }

      function persistOwnedRegistrationLookup() {
        try {
          localStorage.setItem(registrationOwnershipStorageKey, JSON.stringify(ownedRegistrationLookup));
        } catch (error) {
          // Ignore ownership persistence errors.
        }
      }

      function rememberOwnedRegistration(registration) {
        if (!registration || !registration.id) {
          return;
        }

        ownedRegistrationLookup[registration.id] = {
          eventId: registration.eventId || "",
          updatedAt: Date.now(),
        };

        persistOwnedRegistrationLookup();
      }

      function forgetOwnedRegistration(registrationId) {
        if (!registrationId || !ownedRegistrationLookup[registrationId]) {
          return;
        }

        delete ownedRegistrationLookup[registrationId];
        persistOwnedRegistrationLookup();
      }

      function isOwnedRegistration(registration) {
        if (!registration || !registration.id) {
          return false;
        }

        if (registration.canCancel === true) {
          return true;
        }

        return Boolean(ownedRegistrationLookup[registration.id]);
      }

      function buildDefaultRegistrationPerFamily() {
        return familyOptions.map((family) => ({
          family,
          count: 0,
          limit: 2,
          remaining: 2,
        }));
      }

      function buildEmptyRegistrationState(eventId, reason) {
        const isTeamEvent = eventId === "chess-tournament" || eventId === "it-quiz-bee" || eventId === "codm-tournament" || eventId === "mobile-legends-tournament" || eventId === "battle-of-the-bands" || eventId === "basketball-half-court";
        const stats = isTeamEvent
          ? {
            mode: "team",
            totalTeams: 0,
            maxTeams: 8,
            remainingTeams: 8,
            isClosed: false,
            perFamily: buildDefaultRegistrationPerFamily(),
            teams: [],
          }
          : {
            mode: "individual",
            totalParticipants: 0,
            maxParticipants: 8,
            remainingParticipants: 8,
            isClosed: false,
            perFamily: buildDefaultRegistrationPerFamily(),
            allFamiliesComplete: eventId === "sudoku-game-easy-level" ? false : null,
          };

        return {
          eventId,
          eventTitle: eventTitleMap[eventId] || humanizeEventId(eventId),
          registrations: [],
          stats,
          updatedAt: new Date().toISOString(),
          reason: reason || "reset",
        };
      }

      function resetCachedRegistrationState(reason) {
        const trackedEventIds = new Set(Object.keys(registrationStateByEventId));
        registrationEventIds.forEach((eventId) => {
          trackedEventIds.add(eventId);
        });

        trackedEventIds.forEach((eventId) => {
          registrationStateByEventId[eventId] = buildEmptyRegistrationState(eventId, reason || "reset");
        });

        refreshActiveEventRegistrationFormState();
      }

      function applySyncedResponseState(payload) {
        if (!payload || typeof payload !== "object") {
          return;
        }

        if (payload.counts && typeof payload.counts === "object") {
          renderResponseCounts(payload.counts);
        }

        if (Object.prototype.hasOwnProperty.call(payload, "responseType")) {
          const syncedResponseType = isValidResponseType(payload.responseType) ? payload.responseType : "";
          setResponseSelection(syncedResponseType, false);
        }
      }

      function onResponseStorageChange(event) {
        if (!event || typeof event.key !== "string") {
          return;
        }

        if (event.key === responseChoiceStorageKey) {
          setResponseSelection(getStoredResponseType(), false);
          return;
        }

        if (event.key === responseSyncStorageKey && event.newValue) {
          try {
            const payload = JSON.parse(event.newValue);
            applySyncedResponseState(payload);
          } catch (error) {
            // Ignore malformed cross-tab synchronization payloads.
          }

          return;
        }

        if (event.key === registrationSyncStorageKey && event.newValue) {
          try {
            const payload = JSON.parse(event.newValue);
            if (payload && payload.reason === "reset") {
              resetCachedRegistrationState("reset-sync");
            } else if (payload && payload.state && payload.eventId) {
              cacheRegistrationState(payload.state);
            }
          } catch (error) {
            // Ignore malformed cross-tab synchronization payloads.
          }

          return;
        }

        if (event.key === adminTokenLocalStorageKey) {
          if (canUseAdminControls()) {
            ensureAdminResetControls();
          } else {
            removeAdminResetControls();
          }

          return;
        }

        if (event.key === registrationOwnershipStorageKey) {
          ownedRegistrationLookup = loadOwnedRegistrationLookup();
          refreshActiveEventRegistrationFormState();
        }
      }

      function updateResponseButtonsState() {
        const shouldDisable = hasSubmittedResponse || isResponseSubmissionPending || !isResponseBackendReady;

        if (interestedButton) {
          interestedButton.disabled = shouldDisable;
          interestedButton.setAttribute("aria-busy", isResponseSubmissionPending ? "true" : "false");
          interestedButton.setAttribute("aria-pressed", submittedResponseType === "interested" ? "true" : "false");
          interestedButton.classList.toggle("is-response-selected", submittedResponseType === "interested");
          interestedButton.classList.toggle("is-response-inactive", shouldDisable);
          interestedButton.classList.toggle("is-pending", isResponseSubmissionPending);
        }

        if (excitedButton) {
          excitedButton.disabled = shouldDisable;
          excitedButton.setAttribute("aria-busy", isResponseSubmissionPending ? "true" : "false");
          excitedButton.setAttribute("aria-pressed", submittedResponseType === "excited" ? "true" : "false");
          excitedButton.classList.toggle("is-response-selected", submittedResponseType === "excited");
          excitedButton.classList.toggle("is-response-inactive", shouldDisable);
          excitedButton.classList.toggle("is-pending", isResponseSubmissionPending);
        }

        if (isResponseBackendReady) {
          updateResponseStatusFeedback();
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

      function hasAdminTokenHeader(requestHeaders) {
        if (!requestHeaders || typeof requestHeaders !== "object") {
          return false;
        }

        const headerKeys = Object.keys(requestHeaders);
        for (let i = 0; i < headerKeys.length; i += 1) {
          if (headerKeys[i].toLowerCase() === adminResetTokenHeader.toLowerCase()) {
            return typeof requestHeaders[headerKeys[i]] === "string" && requestHeaders[headerKeys[i]].trim().length > 0;
          }
        }

        return false;
      }

      function getRequestHeaderValue(requestHeaders, headerName) {
        if (!requestHeaders || typeof requestHeaders !== "object" || !headerName) {
          return "";
        }

        const expectedHeaderName = String(headerName).toLowerCase();
        const headerKeys = Object.keys(requestHeaders);
        for (let i = 0; i < headerKeys.length; i += 1) {
          if (headerKeys[i].toLowerCase() === expectedHeaderName) {
            const headerValue = requestHeaders[headerKeys[i]];
            return typeof headerValue === "string" ? headerValue.trim() : "";
          }
        }

        return "";
      }

      function normalizeAdminTokenHash(value) {
        const normalizedValue = typeof value === "string" ? value.trim().toLowerCase() : "";
        return /^[a-f0-9]{64}$/.test(normalizedValue) ? normalizedValue : "";
      }

      function getStoredAdminTokenHash() {
        let sessionTokenHash = "";

        try {
          sessionTokenHash = normalizeAdminTokenHash(sessionStorage.getItem(adminTokenSessionStorageKey));
        } catch (error) {
          sessionTokenHash = "";
        }

        if (sessionTokenHash) {
          return sessionTokenHash;
        }

        try {
          return normalizeAdminTokenHash(localStorage.getItem(adminTokenLocalStorageKey));
        } catch (error) {
          return "";
        }
      }

      function persistAdminTokenHash(tokenHash) {
        const normalizedTokenHash = normalizeAdminTokenHash(tokenHash);

        try {
          if (normalizedTokenHash) {
            sessionStorage.setItem(adminTokenSessionStorageKey, normalizedTokenHash);
          } else {
            sessionStorage.removeItem(adminTokenSessionStorageKey);
          }
        } catch (error) {
          // Ignore session storage errors.
        }

        try {
          if (normalizedTokenHash) {
            localStorage.setItem(adminTokenLocalStorageKey, normalizedTokenHash);
          } else {
            localStorage.removeItem(adminTokenLocalStorageKey);
          }
        } catch (error) {
          // Ignore local storage errors.
        }
      }

      function getActiveAdminTokenHash() {
        const inMemoryTokenHash = normalizeAdminTokenHash(adminTokenHash);
        if (inMemoryTokenHash) {
          return inMemoryTokenHash;
        }

        return getStoredAdminTokenHash();
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

      async function callBackendWithFallback(functionName, params, requestUrl, requestOptions, options) {
        const config = options && typeof options === "object" ? options : {};
        const allowForbiddenFallback = Boolean(config.allowForbiddenFallback);
        const allowInvalidEventFallback = Boolean(config.allowInvalidEventFallback);
        const rpcResult = await callBackendRpc(functionName, params || {});
        const rpcPayload = rpcResult && rpcResult.payload && typeof rpcResult.payload === "object" ? rpcResult.payload : {};
        const isInvalidEventResponse = rpcResult.status === 400 && rpcPayload.error === "invalid_event";
        if (
          rpcResult.ok ||
          (rpcResult.status === 400 && !(allowInvalidEventFallback && isInvalidEventResponse)) ||
          rpcResult.status === 409 ||
          (rpcResult.status === 403 && !allowForbiddenFallback)
        ) {
          return rpcResult;
        }

        const fallbackResult = await fetchFromHttpApi(requestUrl.toString(), requestOptions);
        if (fallbackResult.ok || fallbackResult.status === 400 || fallbackResult.status === 403 || fallbackResult.status === 409) {
          return fallbackResult;
        }

        if (fallbackResult.status === 404 || fallbackResult.status === 405) {
          return rpcResult;
        }

        if (rpcResult.status >= 500 && !fallbackResult.ok) {
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

        if (requestUrl.pathname === responseApiPathname && method === "GET") {
          return callBackendWithFallback("get_reaction_state", {}, requestUrl, requestOptions);
        }

        if (requestUrl.pathname === responseApiPathname + "/vote-status" && method === "GET") {
          return callBackendWithFallback("get_vote_status", {
            p_voter_id: requestUrl.searchParams.get("voterId") || "",
          }, requestUrl, requestOptions);
        }

        if (requestUrl.pathname === responseApiPathname && method === "POST") {
          return callBackendWithFallback("submit_vote", {
            p_voter_id: body && typeof body.voterId === "string" ? body.voterId : "",
            p_response_type: body && typeof body.responseType === "string" ? body.responseType : "",
          }, requestUrl, requestOptions);
        }

        if (requestUrl.pathname === responseApiPathname + "/reset" && method === "POST") {
          const requestAdminTokenHash = getRequestHeaderValue(requestOptions.headers, adminResetTokenHeader);
          const resetRpcFunctionName = requestAdminTokenHash ? "reset_reactions_with_token" : "reset_reactions";
          const resetRpcParams = requestAdminTokenHash
            ? { p_admin_token_hash: requestAdminTokenHash }
            : {};

          return callBackendWithFallback(resetRpcFunctionName, resetRpcParams, requestUrl, requestOptions, {
            allowForbiddenFallback: Boolean(requestAdminTokenHash),
          });
        }

        if (requestUrl.pathname === resetRegistrationsApiPathname && method === "POST") {
          const requestAdminTokenHash = getRequestHeaderValue(requestOptions.headers, adminResetTokenHeader);
          const resetRpcFunctionName = requestAdminTokenHash ? "reset_all_registrations_with_token" : "reset_all_registrations";
          const resetRpcParams = requestAdminTokenHash
            ? { p_admin_token_hash: requestAdminTokenHash }
            : {};

          return callBackendWithFallback(resetRpcFunctionName, resetRpcParams, requestUrl, requestOptions, {
            allowForbiddenFallback: Boolean(requestAdminTokenHash),
          });
        }

        if (requestUrl.pathname === eventRegistrationApiPathname && method === "GET") {
          const requestOwnerTokenHash = requestUrl.searchParams.get("ownerTokenHash") || "";
          const requestOwnerToken = requestUrl.searchParams.get("ownerToken") || "";
          return callBackendWithFallback("get_registration_state", {
            p_event_id: requestUrl.searchParams.get("eventId") || "",
            p_owner_token: requestOwnerTokenHash || requestOwnerToken,
          }, requestUrl, requestOptions, {
            allowInvalidEventFallback: true,
          });
        }

        if (requestUrl.pathname === eventRegistrationApiPathname && method === "POST") {
          const requestOwnerTokenHash = body && typeof body.ownerTokenHash === "string" ? body.ownerTokenHash : "";
          const requestOwnerToken = body && typeof body.ownerToken === "string" ? body.ownerToken : "";
          return callBackendWithFallback("submit_event_registration", {
            p_event_id: body && typeof body.eventId === "string" ? body.eventId : "",
            p_family: body && typeof body.family === "string" ? body.family : "",
            p_name: body && typeof body.name === "string" ? body.name : null,
            p_captain: body && typeof body.captain === "string" ? body.captain : null,
            p_members: body && Array.isArray(body.members) ? body.members : null,
            p_owner_token: requestOwnerTokenHash || requestOwnerToken,
          }, requestUrl, requestOptions, {
            allowInvalidEventFallback: true,
          });
        }

        if (requestUrl.pathname === eventRegistrationApiPathname + "/cancel" && method === "POST") {
          const requestOwnerTokenHash = body && typeof body.ownerTokenHash === "string" ? body.ownerTokenHash : "";
          const requestOwnerToken = body && typeof body.ownerToken === "string" ? body.ownerToken : "";
          return callBackendWithFallback("cancel_event_registration", {
            p_registration_id: body && typeof body.registrationId === "string" ? body.registrationId : "",
            p_event_id: body && typeof body.eventId === "string" ? body.eventId : "",
            p_owner_token: requestOwnerTokenHash || requestOwnerToken,
          }, requestUrl, requestOptions, {
            allowInvalidEventFallback: true,
          });
        }

        if (requestUrl.pathname === eventMechanicsApiPathname && method === "GET") {
          return callBackendWithFallback("get_event_mechanics", {
            p_event_id: requestUrl.searchParams.get("eventId") || "",
          }, requestUrl, requestOptions, {
            allowInvalidEventFallback: true,
          });
        }

        if (requestUrl.pathname === eventMechanicsApiPathname && method === "POST") {
          const requestAdminTokenHash = getRequestHeaderValue(requestOptions.headers, adminResetTokenHeader);

          return callBackendWithFallback("upsert_event_mechanics_with_token", {
            p_event_id: body && typeof body.eventId === "string" ? body.eventId : "",
            p_venue: body && typeof body.venue === "string" ? body.venue : "",
            p_sections: body && Array.isArray(body.sections) ? body.sections : [],
            p_admin_token_hash: requestAdminTokenHash,
          }, requestUrl, requestOptions, {
            allowForbiddenFallback: true,
          });
        }

        if (requestUrl.pathname === eventMechanicsApiPathname && method === "DELETE") {
          const requestAdminTokenHash = getRequestHeaderValue(requestOptions.headers, adminResetTokenHeader);

          return callBackendWithFallback("delete_event_mechanics_with_token", {
            p_event_id: requestUrl.searchParams.get("eventId") || "",
            p_admin_token_hash: requestAdminTokenHash,
          }, requestUrl, requestOptions, {
            allowForbiddenFallback: true,
          });
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
        isResetRequestPending = false;
        isRegistrationResetPending = false;

        if (resetCountsButton) {
          resetCountsButton.removeEventListener("click", onAdminResetClick);
          resetCountsButton = null;
        }

        if (resetRegistrationsButton) {
          resetRegistrationsButton.removeEventListener("click", onAdminResetRegistrationsClick);
          resetRegistrationsButton = null;
        }

        if (responseAdminActions) {
          responseAdminActions.remove();
          responseAdminActions = null;
        }
      }

      function canUseAdminControls() {
        return isAdminAuthorized || isAdminModeRequested || isAdminTokenAuthorized || Boolean(getActiveAdminTokenHash());
      }

      function isAdmin() {
        return isAdminAuthorized || Boolean(getActiveAdminTokenHash());
      }

      function ensureAdminResetControls() {
        const hasTokenAdminAccess = Boolean(getActiveAdminTokenHash());

        if (
          !responseSummary ||
          !canUseAdminControls()
        ) {
          return;
        }

        if (!responseAdminActions) {
          responseAdminActions = document.createElement("div");
          responseAdminActions.className = "response-admin-actions";
          responseAdminActions.id = "response-admin-actions";

          resetCountsButton = document.createElement("button");
          resetCountsButton.type = "button";
          resetCountsButton.className = "btn btn-secondary admin-reset-button";
          resetCountsButton.id = "reset-counts-button";
          resetCountsButton.textContent = "Reset Counts";
          resetCountsButton.addEventListener("click", onAdminResetClick);
          resetCountsButton.disabled = isResetRequestPending;
          resetCountsButton.setAttribute("aria-busy", isResetRequestPending ? "true" : "false");
          resetCountsButton.classList.toggle("is-pending", isResetRequestPending);

          responseAdminActions.appendChild(resetCountsButton);
          responseSummary.insertAdjacentElement("afterend", responseAdminActions);
        }

        if (hasTokenAdminAccess && !resetRegistrationsButton && responseAdminActions) {
          resetRegistrationsButton = document.createElement("button");
          resetRegistrationsButton.type = "button";
          resetRegistrationsButton.className = "btn btn-secondary admin-reset-button";
          resetRegistrationsButton.id = "reset-registrations-button";
          resetRegistrationsButton.textContent = "Reset Registrations";
          resetRegistrationsButton.addEventListener("click", onAdminResetRegistrationsClick);
          resetRegistrationsButton.disabled = isRegistrationResetPending;
          resetRegistrationsButton.setAttribute("aria-busy", isRegistrationResetPending ? "true" : "false");
          resetRegistrationsButton.classList.toggle("is-pending", isRegistrationResetPending);
          responseAdminActions.appendChild(resetRegistrationsButton);
        }

        if (!hasTokenAdminAccess && resetRegistrationsButton) {
          resetRegistrationsButton.removeEventListener("click", onAdminResetRegistrationsClick);
          resetRegistrationsButton.remove();
          resetRegistrationsButton = null;
        }
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
        isAdminTokenAuthorized = false;
        adminTokenHash = "";
        removeAdminResetControls();

        const params = new URLSearchParams(window.location.search);
        const adminModeValue = (params.get(adminModeParam) || "").toLowerCase();
        const adminTokenValue = (params.get(adminTokenParam) || "").trim();
        const hadAdminModeParam = params.has(adminModeParam);
        const hadAdminTokenParam = params.has(adminTokenParam);
        isAdminModeRequested = adminModeValue === "1" || adminModeValue === "true";

        const expectedAdminTokenHash = normalizeAdminTokenHash(responseAdminTokenHash);
        let validatedTokenHash = "";

        if (adminTokenValue) {
          const tokenHash = normalizeAdminTokenHash(await hashStringSha256(adminTokenValue));
          if (tokenHash && tokenHash === expectedAdminTokenHash) {
            validatedTokenHash = tokenHash;
          }
        } else {
          const storedTokenHash = getStoredAdminTokenHash();
          if (storedTokenHash && storedTokenHash === expectedAdminTokenHash) {
            validatedTokenHash = storedTokenHash;
          }
        }

        if (validatedTokenHash) {
          isAdminTokenAuthorized = true;
          adminTokenHash = validatedTokenHash;
          persistAdminTokenHash(validatedTokenHash);
        } else {
          persistAdminTokenHash("");
        }

        if (hadAdminModeParam) {
          params.delete(adminModeParam);
        }

        if (hadAdminTokenParam) {
          params.delete(adminTokenParam);
        }

        if (hadAdminModeParam || hadAdminTokenParam) {
          const nextQuery = params.toString();
          const nextUrl = window.location.pathname + (nextQuery ? "?" + nextQuery : "") + window.location.hash;
          window.history.replaceState({}, document.title, nextUrl);
        }

        await refreshAdminAuthorization();

        if (supabaseClient && !authStateSubscription) {
          const authListener = supabaseClient.auth.onAuthStateChange(() => {
            refreshAdminAuthorization().then(() => {
              if (canUseAdminControls()) {
                ensureAdminResetControls();
              } else {
                removeAdminResetControls();
              }
            });
          });

          authStateSubscription = authListener && authListener.data ? authListener.data.subscription : null;
        }

        if (canUseAdminControls()) {
          ensureAdminResetControls();
        }
      }

      async function hashStringSha256(value) {
        if (!value || !window.crypto || !window.crypto.subtle || typeof TextEncoder !== "function") {
          return "";
        }

        try {
          const encoded = new TextEncoder().encode(value);
          const digest = await window.crypto.subtle.digest("SHA-256", encoded);
          const hashBytes = new Uint8Array(digest);
          let hashHex = "";

          for (let i = 0; i < hashBytes.length; i += 1) {
            hashHex += hashBytes[i].toString(16).padStart(2, "0");
          }

          return hashHex;
        } catch (error) {
          console.error("[crypto] Unable to compute SHA-256 hash.", error);
          return "";
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
          setResponseStatusNotice(responseAlreadySubmittedMessage, false);
          showToast("You have already submitted your response.");
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
        setResponseSelection(responseType, false);
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
            syncResponseStateToOtherTabs("already-submitted");
            showToast("You have already submitted your response.");
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
          syncResponseStateToOtherTabs("vote");

          const total = responseCounts.interested + responseCounts.excited;
          showToast("Thanks for your response. Total reactions: " + total + ".");
        } catch (error) {
          console.error("[responses] Could not submit vote.", error);
          renderResponseCounts(previousCounts);
          setResponseSelection(previousSelection, false);

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

      function setResetButtonPendingState(isPending) {
        isResetRequestPending = Boolean(isPending);

        if (!resetCountsButton) {
          return;
        }

        resetCountsButton.disabled = isResetRequestPending;
        resetCountsButton.setAttribute("aria-busy", isResetRequestPending ? "true" : "false");
        resetCountsButton.classList.toggle("is-pending", isResetRequestPending);
      }

      function setResetRegistrationsButtonPendingState(isPending) {
        isRegistrationResetPending = Boolean(isPending);

        if (!resetRegistrationsButton) {
          return;
        }

        resetRegistrationsButton.disabled = isRegistrationResetPending;
        resetRegistrationsButton.setAttribute("aria-busy", isRegistrationResetPending ? "true" : "false");
        resetRegistrationsButton.classList.toggle("is-pending", isRegistrationResetPending);
      }

      async function resetResponseCounts(authorizationKey) {
        const adminRequiredMessage = "Admin access required.";
        const serverFailureMessage = "Unable to reset counts right now. Please try again later.";
        const activeAdminTokenHash = getActiveAdminTokenHash();
        const hasTokenAdminAccess = Boolean(activeAdminTokenHash);

        if (!isAdmin() || authorizationKey !== adminResetAuthorizationKey) {
          console.warn("[admin reset] Reset blocked because admin authorization is missing.", {
            isAdminAuthorized,
            hasTokenAdminAccess,
          });
          showToast(adminRequiredMessage);
          return;
        }

        if (isResetRequestPending) {
          return;
        }

        setResetButtonPendingState(true);

        try {
          const requestHeaders = {};
          if (hasTokenAdminAccess) {
            requestHeaders[adminResetTokenHeader] = activeAdminTokenHash;
          }

          const result = await fetchJson(responseApiBaseUrl + "/reset", {
            method: "POST",
            headers: requestHeaders,
            body: JSON.stringify({}),
          });

          if (!result.ok) {
            if (result.status === 403) {
              console.warn("[admin reset] Reset request was rejected with 403.", {
                hasTokenAdminAccess,
                payload: result.payload,
              });
              showToast(adminRequiredMessage);
              return;
            }

            console.error("[admin reset] Reset request failed.", {
              status: result.status,
              payload: result.payload,
              hasTokenAdminAccess,
            });
            showToast(serverFailureMessage);
            return;
          }

          renderResponseCounts(getResponseStatePayload(result.payload));
          setResponseSelection("", true);
          syncResponseStateToOtherTabs("reset");
          showToast("Counters have been reset successfully.");
        } catch (error) {
          console.error("[admin reset] Reset request threw an unexpected error.", error);
          showToast(serverFailureMessage);
        } finally {
          setResetButtonPendingState(false);
        }
      }

      async function onAdminResetClick() {
        if (isResetRequestPending) {
          return;
        }

        if (!isAdmin()) {
          const signedIn = await promptAdminSignIn();
          if (!signedIn) {
            showToast("Admin access required.");
            return;
          }
        }

        const approved = window.confirm("Reset all Interested and Excited counts?");
        if (!approved) {
          return;
        }

        await resetResponseCounts(adminResetAuthorizationKey);
      }

      async function resetAllRegistrations(authorizationKey) {
        const adminRequiredMessage = "Admin access required.";
        const serverFailureMessage = "Unable to reset registrations right now. Please try again.";
        const successMessage = "All registrations have been reset successfully.";
        const activeAdminTokenHash = getActiveAdminTokenHash();
        const hasTokenAdminAccess = Boolean(activeAdminTokenHash);

        if (!isAdmin() || authorizationKey !== adminResetAuthorizationKey) {
          console.warn("[admin reset] Registration reset blocked because admin authorization is missing.", {
            isAdminAuthorized,
            hasTokenAdminAccess,
          });
          showToast(adminRequiredMessage);
          return;
        }

        if (isRegistrationResetPending) {
          return;
        }

        setResetRegistrationsButtonPendingState(true);

        try {
          const requestHeaders = {};
          if (hasTokenAdminAccess) {
            requestHeaders[adminResetTokenHeader] = activeAdminTokenHash;
          }

          const result = await fetchJson(resetRegistrationsApiBaseUrl, {
            method: "POST",
            headers: requestHeaders,
            body: JSON.stringify({}),
          });

          if (!result.ok) {
            if (result.status === 403) {
              console.warn("[admin reset] Registration reset request was rejected with 403.", {
                hasTokenAdminAccess,
                payload: result.payload,
              });
              showToast(adminRequiredMessage);
              return;
            }

            console.error("[admin reset] Registration reset request failed.", {
              status: result.status,
              payload: result.payload,
              hasTokenAdminAccess,
            });
            showToast(serverFailureMessage);
            return;
          }

          resetCachedRegistrationState("reset");
          syncRegistrationStateToOtherTabs("reset");

          const activeEventId = getActiveEventId();
          if (activeEventId && isManagedRegistrationEvent(activeEventId)) {
            fetchEventRegistrationState(activeEventId).catch(() => {
              // Keep UI responsive while background refresh retries.
            });
          }

          showToast(successMessage);
        } catch (error) {
          console.error("[admin reset] Registration reset request threw an unexpected error.", error);
          showToast(serverFailureMessage);
        } finally {
          setResetRegistrationsButtonPendingState(false);
        }
      }

      async function onAdminResetRegistrationsClick() {
        if (isRegistrationResetPending) {
          return;
        }

        if (!isAdmin()) {
          const signedIn = await promptAdminSignIn();
          if (!signedIn) {
            showToast("Admin access required.");
            return;
          }
        }

        const approved = window.confirm("Are you sure you want to reset all registrations?");
        if (!approved) {
          return;
        }

        await resetAllRegistrations(adminResetAuthorizationKey);
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

        if (combined.includes("crimping")) {
          return "crimping-competition";
        }

        if (combined.includes("assembling") || combined.includes("disassembling")) {
          return "assembling-and-disassembling-competition";
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

        if (combined.includes("academic") || combined.includes("coding") || combined.includes("programming") || combined.includes("quiz") || combined.includes("typing") || combined.includes("crimp") || combined.includes("assembling") || combined.includes("disassembling")) {
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
        const baseDetails = eventCatalog[eventId]
          ? eventCatalog[eventId]
          : {
            eventId,
            title: eventTitleMap[eventId] || humanizeEventId(eventId),
            venue: "To be updated",
            registrationType: "coming-soon",
            mechanicsHtml: "<p>To be updated.</p>",
          };

        const override = mechanicsOverridesByEventId[eventId];
        if (!override || typeof override !== "object") {
          return baseDetails;
        }

        const normalizedSections = normalizeMechanicsSections(override.sections);
        const normalizedVenue = normalizeVenueText(override.venue || "");
        if (!normalizedSections.length && !normalizedVenue) {
          return baseDetails;
        }

        return {
          eventId: baseDetails.eventId,
          title: baseDetails.title,
          venue: normalizedVenue || normalizeVenueText(baseDetails.venue),
          registrationType: baseDetails.registrationType,
          mechanicsHtml: convertMechanicsSectionsToHtml(normalizedSections),
        };
      }

      function normalizeVenueText(value) {
        if (typeof value !== "string") {
          return "";
        }

        return value.replace(/\s+/g, " ").trim();
      }

      function normalizeSectionTitle(value, fallbackIndex) {
        const title = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
        return title || "Section " + String(fallbackIndex + 1);
      }

      function normalizeSectionContentHtml(value) {
        const rawValue = typeof value === "string" ? value.replace(/\r\n/g, "\n").trim() : "";
        if (!rawValue) {
          return "<p>To be updated.</p>";
        }

        if (/<\/?[a-z][\s\S]*>/i.test(rawValue)) {
          return rawValue;
        }

        const lines = rawValue.split("\n").map((line) => line.trim());
        const htmlParts = [];
        let listBuffer = [];

        function flushListBuffer() {
          if (!listBuffer.length) {
            return;
          }

          htmlParts.push("<ul>" + listBuffer.map((item) => "<li>" + escapeHtml(item) + "</li>").join("") + "</ul>");
          listBuffer = [];
        }

        for (let i = 0; i < lines.length; i += 1) {
          const line = lines[i];
          if (!line) {
            flushListBuffer();
            continue;
          }

          if (/^(-|\*|•)\s+/.test(line)) {
            listBuffer.push(line.replace(/^(-|\*|•)\s+/, "").trim());
            continue;
          }

          flushListBuffer();
          htmlParts.push("<p>" + escapeHtml(line) + "</p>");
        }

        flushListBuffer();
        return htmlParts.join("");
      }

      function normalizeMechanicsSection(section, index) {
        if (!section || typeof section !== "object") {
          return null;
        }

        const sectionIdValue = typeof section.id === "string" ? section.id.trim() : "";
        const sectionId = /^[A-Za-z0-9_-]{1,60}$/.test(sectionIdValue) ? sectionIdValue : "section-" + String(index + 1);
        const sectionTitle = normalizeSectionTitle(section.title, index);
        const contentHtml = typeof section.contentHtml === "string"
          ? normalizeSectionContentHtml(section.contentHtml)
          : normalizeSectionContentHtml(typeof section.content === "string" ? section.content : "");

        if (!contentHtml) {
          return null;
        }

        return {
          id: sectionId,
          title: sectionTitle,
          contentHtml,
        };
      }

      function normalizeMechanicsSections(sections) {
        if (!Array.isArray(sections)) {
          return [];
        }

        const normalizedSections = [];

        for (let i = 0; i < sections.length; i += 1) {
          const normalized = normalizeMechanicsSection(sections[i], i);
          if (normalized) {
            normalizedSections.push(normalized);
          }
        }

        return normalizedSections;
      }

      function parseMechanicsSectionsFromHtml(mechanicsHtml) {
        const html = typeof mechanicsHtml === "string" ? mechanicsHtml.trim() : "";
        if (!html) {
          return [];
        }

        const headingRegex = /<h5>([\s\S]*?)<\/h5>/gi;
        const matches = [];
        let match;

        while ((match = headingRegex.exec(html)) !== null) {
          matches.push({
            index: match.index,
            length: match[0].length,
            titleRaw: match[1],
          });
        }

        if (!matches.length) {
          return [
            {
              id: "section-1",
              title: "Section 1",
              contentHtml: html,
            },
          ];
        }

        const sections = [];
        for (let i = 0; i < matches.length; i += 1) {
          const currentMatch = matches[i];
          const nextMatch = matches[i + 1];
          const contentStart = currentMatch.index + currentMatch.length;
          const contentEnd = nextMatch ? nextMatch.index : html.length;
          const rawTitle = String(currentMatch.titleRaw || "").replace(/<[^>]+>/g, "").trim();
          const contentHtml = html.slice(contentStart, contentEnd).trim();

          sections.push({
            id: "section-" + String(i + 1),
            title: rawTitle || "Section " + String(i + 1),
            contentHtml,
          });
        }

        return normalizeMechanicsSections(sections);
      }

      function convertMechanicsSectionsToHtml(sections) {
        const normalizedSections = normalizeMechanicsSections(sections);
        if (!normalizedSections.length) {
          return "<p>To be updated.</p>";
        }

        return normalizedSections
          .map((section) => {
            const titleMarkup = section.title ? "<h5>" + escapeHtml(section.title) + "</h5>" : "";
            return titleMarkup + section.contentHtml;
          })
          .join("");
      }

      function getMechanicsSectionsForEvent(eventId) {
        const override = mechanicsOverridesByEventId[eventId];
        if (override && typeof override === "object") {
          return normalizeMechanicsSections(override.sections);
        }

        const details = eventCatalog[eventId];
        if (!details) {
          return [];
        }

        return parseMechanicsSectionsFromHtml(details.mechanicsHtml);
      }

      function getMechanicsVenueForEvent(eventId) {
        const override = mechanicsOverridesByEventId[eventId];
        if (override && typeof override.venue === "string") {
          return normalizeVenueText(override.venue);
        }

        const details = eventCatalog[eventId];
        if (!details) {
          return "";
        }

        return normalizeVenueText(details.venue || "");
      }

      function hasExistingMechanicsRecord(eventId) {
        const override = mechanicsOverridesByEventId[eventId];
        if (!override || typeof override !== "object") {
          return false;
        }

        const hasVenue = typeof override.venue === "string" && normalizeVenueText(override.venue).length > 0;
        const hasSections = Array.isArray(override.sections) && normalizeMechanicsSections(override.sections).length > 0;
        return hasVenue || hasSections;
      }

      function getMechanicsEditState(eventId) {
        return eventId ? mechanicsEditStateByEventId[eventId] || null : null;
      }

      function isMechanicsEditMode(eventId) {
        const editState = getMechanicsEditState(eventId);
        return Boolean(editState && editState.isEditing);
      }

      function setMechanicsEditState(eventId, nextState) {
        if (!eventId) {
          return;
        }

        if (!nextState) {
          delete mechanicsEditStateByEventId[eventId];
          return;
        }

        mechanicsEditStateByEventId[eventId] = nextState;
      }

      function beginMechanicsEdit(eventId) {
        if (!eventId) {
          return;
        }

        setMechanicsEditState(eventId, {
          isEditing: true,
          originalVenue: getMechanicsVenueForEvent(eventId),
          originalSections: normalizeMechanicsSections(getMechanicsSectionsForEvent(eventId)),
        });
      }

      function endMechanicsEdit(eventId) {
        setMechanicsEditState(eventId, null);
      }

      function buildMechanicsEditSectionsMarkup(eventId) {
        const editState = getMechanicsEditState(eventId);
        const sections = editState && Array.isArray(editState.originalSections)
          ? editState.originalSections
          : getMechanicsSectionsForEvent(eventId);

        return normalizeMechanicsSections(sections)
          .map((section) => {
            return (
              '<section data-mechanics-edit-section="true" data-section-id="' + escapeHtml(section.id) + '">' +
              '<h5 contenteditable="true" data-mechanics-edit-title="true">' + escapeHtml(section.title || "") + "</h5>" +
              '<div contenteditable="true" data-mechanics-edit-content="true">' + section.contentHtml + "</div>" +
              "</section>"
            );
          })
          .join("");
      }

      function renderMechanicsEditMode(eventId) {
        if (!teaserMechanics || !teaserVenue) {
          return;
        }

        teaserMechanics.innerHTML = buildMechanicsEditSectionsMarkup(eventId);
        teaserVenue.textContent = getMechanicsVenueForEvent(eventId);
        teaserVenue.setAttribute("contenteditable", "true");
        teaserVenue.setAttribute("data-mechanics-edit-venue", "true");
      }

      function renderMechanicsReadOnly(details) {
        if (!teaserMechanics || !teaserVenue) {
          return;
        }

        teaserMechanics.innerHTML = details.mechanicsHtml;
        teaserVenue.textContent = normalizeVenueText(details.venue || "");
        teaserVenue.removeAttribute("contenteditable");
        teaserVenue.removeAttribute("data-mechanics-edit-venue");
      }

      function collectMechanicsEditorState(eventId) {
        if (!teaserMechanics || !teaserVenue) {
          return {
            venue: getMechanicsVenueForEvent(eventId),
            sections: getMechanicsSectionsForEvent(eventId),
          };
        }

        const editableSections = Array.from(teaserMechanics.querySelectorAll("[data-mechanics-edit-section='true']"));
        const sections = editableSections
          .map((section, index) => {
            const titleNode = section.querySelector("[data-mechanics-edit-title='true']");
            const contentNode = section.querySelector("[data-mechanics-edit-content='true']");
            return {
              id: section.getAttribute("data-section-id") || "section-" + String(index + 1),
              title: titleNode ? titleNode.textContent || "" : "",
              contentHtml: contentNode ? contentNode.innerHTML || "" : "",
            };
          });

        return {
          venue: normalizeVenueText(teaserVenue.textContent || ""),
          sections: normalizeMechanicsSections(sections),
        };
      }

      function normalizeMechanicsPayload(payload) {
        const source = payload && typeof payload === "object" ? payload : {};
        const venue = normalizeVenueText(source.venue || "");
        let rawSections = source.sections;

        if (!Array.isArray(rawSections)) {
          rawSections = source.mechanicsAndGuidelines;
        }

        if (!Array.isArray(rawSections)) {
          rawSections = source.mechanics;
        }

        if (typeof rawSections === "string") {
          try {
            const parsedSections = JSON.parse(rawSections);
            rawSections = Array.isArray(parsedSections) ? parsedSections : [];
          } catch (error) {
            rawSections = [];
          }
        }

        return {
          venue,
          sections: normalizeMechanicsSections(Array.isArray(rawSections) ? rawSections : []),
          updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : "",
        };
      }

      async function fetchEventMechanics(eventId) {
        if (!eventId) {
          return null;
        }

        const requestUrl = eventMechanicsApiBaseUrl + "?eventId=" + encodeURIComponent(eventId);
        const result = await fetchJson(requestUrl, { cache: "no-store" });

        if (!result.ok) {
          if (result.status === 404) {
            delete mechanicsOverridesByEventId[eventId];
            return null;
          }

          throw new Error("Could not fetch event mechanics.");
        }

        const normalizedPayload = normalizeMechanicsPayload(result.payload);
        const sections = normalizedPayload.sections;
        const venue = normalizedPayload.venue;

        console.debug("[mechanics] fetched payload", {
          eventId,
          venue,
          sectionsCount: sections.length,
          updatedAt: normalizedPayload.updatedAt,
        });

        if (!sections.length && !venue) {
          delete mechanicsOverridesByEventId[eventId];
          return null;
        }

        const entry = {
          venue,
          sections,
          updatedAt: normalizedPayload.updatedAt,
        };

        mechanicsOverridesByEventId[eventId] = entry;
        return entry;
      }

      async function saveEventMechanics(eventId, sections, venue) {
        const activeAdminTokenHash = getActiveAdminTokenHash();
        if (!activeAdminTokenHash) {
          return buildResult(403, {
            error: "forbidden",
            message: "Admin token required.",
          });
        }

        const operation = hasExistingMechanicsRecord(eventId) ? "update" : "create";
        console.debug("[mechanics] save request", {
          eventId,
          operation,
          venue: normalizeVenueText(venue || ""),
          sectionsCount: normalizeMechanicsSections(sections).length,
        });

        return fetchJson(eventMechanicsApiBaseUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            [adminResetTokenHeader]: activeAdminTokenHash,
          },
          body: JSON.stringify({
            eventId,
            venue: normalizeVenueText(venue || ""),
            sections: normalizeMechanicsSections(sections),
          }),
        });
      }

      async function deleteEventMechanics(eventId) {
        const activeAdminTokenHash = getActiveAdminTokenHash();
        if (!activeAdminTokenHash) {
          return buildResult(403, {
            error: "forbidden",
            message: "Admin token required.",
          });
        }

        return fetchJson(eventMechanicsApiBaseUrl + "?eventId=" + encodeURIComponent(eventId), {
          method: "DELETE",
          headers: {
            [adminResetTokenHeader]: activeAdminTokenHash,
          },
        });
      }

      function canManageMechanics() {
        return Boolean(getActiveAdminTokenHash());
      }

      function buildMechanicsAdminControlsMarkup(eventId) {
        if (!canManageMechanics()) {
          return "";
        }

        if (!isMechanicsEditMode(eventId)) {
          return (
            '<div class="registration-actions event-form-actions" data-mechanics-admin-controls="true">' +
            '<button type="button" class="btn btn-secondary event-inline-button" data-mechanics-action="start-edit">Edit Mechanics</button>' +
            '<button type="button" class="btn btn-secondary event-inline-button" data-mechanics-action="delete-event">Delete Event Mechanics</button>' +
            "</div>"
          );
        }

        return (
          '<div class="registration-actions event-form-actions" data-mechanics-admin-controls="true">' +
          '<button type="button" class="btn btn-secondary event-inline-button" data-mechanics-action="add">Add Section</button>' +
          '<button type="button" class="btn btn-secondary event-inline-button" data-mechanics-action="move">Reorder Sections</button>' +
          '<button type="button" class="btn btn-secondary event-inline-button" data-mechanics-action="delete">Delete Section</button>' +
          '<button type="button" class="btn btn-secondary event-inline-button" data-mechanics-action="save">Save Changes</button>' +
          '<button type="button" class="btn btn-secondary event-inline-button" data-mechanics-action="cancel">Cancel</button>' +
          "</div>"
        );
      }

      function renderMechanicsAdminControls(eventId) {
        if (!teaserMechanics) {
          return;
        }

        const existingControls = teaserMechanics.querySelector("[data-mechanics-admin-controls='true']");
        if (existingControls) {
          existingControls.remove();
        }

        const controlsMarkup = buildMechanicsAdminControlsMarkup(eventId);
        if (!controlsMarkup) {
          return;
        }

        teaserMechanics.insertAdjacentHTML("beforeend", controlsMarkup);
      }

      function promptSectionIndex(sections, actionLabel) {
        if (!sections.length) {
          return -1;
        }

        const listText = sections
          .map((section, index) => String(index + 1) + ". " + (section.title || "Untitled Section"))
          .join("\n");
        const response = window.prompt(actionLabel + "\n\n" + listText + "\n\nEnter section number:");

        if (!response) {
          return -1;
        }

        const parsedValue = Number.parseInt(response, 10);
        if (!Number.isInteger(parsedValue) || parsedValue < 1 || parsedValue > sections.length) {
          return -1;
        }

        return parsedValue - 1;
      }

      async function handleMechanicsAction(action, eventId) {
        if (!canManageMechanics()) {
          showToast("Admin token required.");
          return;
        }

        if (action === "start-edit") {
          beginMechanicsEdit(eventId);
          renderMechanicsEditMode(eventId);
          renderMechanicsAdminControls(eventId);
          showToast("Edit mode enabled.");
          return;
        }

        if (action === "cancel") {
          endMechanicsEdit(eventId);
          await showSelectedEventDetails(eventId);
          showToast("Changes discarded.");
          return;
        }

        if (action === "delete-event") {
          const approved = window.confirm("Delete all custom mechanics for this event and restore defaults?");
          if (!approved) {
            return;
          }

          const deleteResult = await deleteEventMechanics(eventId);
          if (!deleteResult.ok) {
            const deleteMessage = deleteResult.payload && deleteResult.payload.message
              ? deleteResult.payload.message
              : "Unable to delete event mechanics right now.";
            showToast(deleteMessage);
            return;
          }

          delete mechanicsOverridesByEventId[eventId];
          endMechanicsEdit(eventId);
          await showSelectedEventDetails(eventId);
          showToast("Custom mechanics deleted. Defaults restored.");
          return;
        }

        if (!isMechanicsEditMode(eventId)) {
          showToast("Enable edit mode first.");
          return;
        }

        const editorState = collectMechanicsEditorState(eventId);
        let nextSections = editorState.sections.slice();
        let nextVenue = editorState.venue;

        if (action === "add") {
          nextSections.push({
            id: "section-" + String(Date.now()),
            title: "New Section",
            contentHtml: "<p>Update this section.</p>",
          });
        } else if (action === "move") {
          const fromIndex = promptSectionIndex(nextSections, "Select section to move");
          if (fromIndex < 0) {
            return;
          }

          const toPrompt = window.prompt("Enter new position (1-" + String(nextSections.length) + "):");
          if (!toPrompt) {
            return;
          }

          const toIndexRaw = Number.parseInt(toPrompt, 10);
          if (!Number.isInteger(toIndexRaw) || toIndexRaw < 1 || toIndexRaw > nextSections.length) {
            showToast("Invalid section position.");
            return;
          }

          const toIndex = toIndexRaw - 1;
          if (toIndex === fromIndex) {
            return;
          }

          const moving = nextSections[fromIndex];
          nextSections.splice(fromIndex, 1);
          nextSections.splice(toIndex, 0, moving);
        } else if (action === "delete") {
          const sectionIndex = promptSectionIndex(nextSections, "Select section to delete");
          if (sectionIndex < 0) {
            return;
          }

          const approved = window.confirm("Delete this section? This action cannot be undone.");
          if (!approved) {
            return;
          }

          nextSections.splice(sectionIndex, 1);
        } else if (action === "save") {
          const normalizedSections = normalizeMechanicsSections(nextSections);
          const normalizedVenue = normalizeVenueText(nextVenue || "");
          if (!normalizedSections.length && !normalizedVenue) {
            showToast("Please provide at least one section or a venue.");
            return;
          }

          const saveResult = await saveEventMechanics(eventId, normalizedSections, normalizedVenue);
          if (!saveResult.ok) {
            const message = saveResult.payload && saveResult.payload.message
              ? saveResult.payload.message
              : "Unable to update mechanics right now.";
            showToast(message);
            return;
          }

          const normalizedSavePayload = normalizeMechanicsPayload(saveResult.payload);
          mechanicsOverridesByEventId[eventId] = {
            venue: normalizeVenueText(normalizedSavePayload.venue || normalizedVenue || ""),
            sections: normalizedSavePayload.sections.length ? normalizedSavePayload.sections : normalizedSections,
            updatedAt: normalizedSavePayload.updatedAt || new Date().toISOString(),
          };

          console.debug("[mechanics] save result", {
            eventId,
            responseStatus: saveResult.status,
            responsePayload: saveResult.payload,
            normalizedVenue: mechanicsOverridesByEventId[eventId].venue,
            normalizedSectionsCount: mechanicsOverridesByEventId[eventId].sections.length,
          });

          let refreshedEntry = null;
          try {
            refreshedEntry = await fetchEventMechanics(eventId);
          } catch (error) {
            console.error("[mechanics] Refresh after save failed.", error);
          }

          if (!refreshedEntry) {
            mechanicsOverridesByEventId[eventId] = {
              venue: normalizeVenueText(nextVenue || ""),
              sections: normalizedSections,
              updatedAt: new Date().toISOString(),
            };
          }

          endMechanicsEdit(eventId);
          try {
            await showSelectedEventDetails(eventId, { skipMechanicsFetch: true });
          } catch (error) {
            console.error("[mechanics] Rendering after save failed.", error);
            const fallbackDetails = getEventDetailsById(eventId);
            renderMechanicsReadOnly(fallbackDetails);
          }
          showToast("Mechanics updated successfully.");
          return;
        } else {
          return;
        }

        nextSections = normalizeMechanicsSections(nextSections);
        if (!nextSections.length) {
          showToast("At least one section is required.");
          return;
        }

        setMechanicsEditState(eventId, {
          isEditing: true,
          originalVenue: nextVenue,
          originalSections: nextSections,
        });
        renderMechanicsEditMode(eventId);
        renderMechanicsAdminControls(eventId);
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
        const includesRegistrableEvent = selectionEvents.some((eventId) => {
          const details = getEventDetailsById(eventId);
          return details.registrationType !== "none";
        });
        teaserSelectionContext.textContent = includesRegistrableEvent
          ? "Category: " + groupLabel + ". Select one event to view details and registration."
          : "Category: " + groupLabel + ". Select one event to view details and guidelines.";

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
        if (eventId === "chess-tournament" || eventId === "codm-tournament" || eventId === "mobile-legends-tournament" || eventId === "battle-of-the-bands" || eventId === "basketball-half-court" || eventId === "it-quiz-bee" || eventId === "mr-and-ms-it-2026") {
          return "Registration is now closed. Maximum teams reached.";
        }

        return "Registration is now closed. Maximum participants reached.";
      }

      function getFamilyLimitValidationMessage(eventId) {
        if (eventId === "assembling-and-disassembling-competition") {
          return "Only one participant is allowed per family for this event.";
        }

        if (eventId === "sudoku-game-easy-level") {
          return "This family already has 2 participants registered.";
        }

        return "This family has reached the maximum number of participants.";
      }

      function getTeamLimitValidationMessage(eventId) {
        if (eventId === "battle-of-the-bands") {
          return "Only one (1) band registration is allowed per family.";
        }

        if (eventId === "mr-and-ms-it-2026") {
          return "Only one (1) Mr. and Ms. IT pair registration is allowed per family.";
        }

        if (eventId === "basketball-half-court") {
          return "Only one (1) team registration is allowed per family.";
        }

        if (eventId === "it-quiz-bee") {
          return "Only one (1) team registration is allowed per family.";
        }

        if (eventId === "chess-tournament") {
          return "Only one (1) team registration is allowed per family.";
        }

        return "This family has already registered the maximum number of teams.";
      }

      function getTeamRegistrationRules(eventId) {
        if (eventId === "codm-tournament") {
          return {
            maxMembers: 3,
            defaultMemberRows: 3,
            requireCompleteMemberFields: true,
            requiresExactMembers: true,
            exactMembers: 3,
            maxTotalParticipants: 4,
            sizeMessage: "Each team must have exactly 4 members including the Team Captain/Leader.",
            familyLabel: "Family",
            captainLabel: "Captain/Leader",
            membersHeading: "Members",
            memberLabels: ["Member 1", "Member 2", "Member 3"],
            fixedMemberFields: true,
            allowMemberControls: false,
          };
        }

        if (eventId === "mobile-legends-tournament") {
          return {
            maxMembers: 4,
            defaultMemberRows: 4,
            requireCompleteMemberFields: true,
            requiresExactMembers: true,
            exactMembers: 4,
            maxTotalParticipants: 5,
            sizeMessage: "Each team must have exactly 5 members including the Team Captain / Leader.",
            familyLabel: "Family",
            captainLabel: "Captain/Leader",
            membersHeading: "Members",
            memberLabels: ["Member 1", "Member 2", "Member 3", "Member 4"],
            fixedMemberFields: true,
            allowMemberControls: false,
          };
        }

        if (eventId === "battle-of-the-bands") {
          return {
            maxMembers: 6,
            minMembers: 4,
            defaultMemberRows: 4,
            requireCompleteMemberFields: true,
            requiresExactMembers: false,
            minTotalParticipants: 5,
            maxTotalParticipants: 7,
            sizeMessage: "Each band must have 5 to 7 members, including the Band Leader.",
            familyLabel: "Family",
            captainLabel: "Captain/Leader",
            membersHeading: "Members",
            memberLabels: [],
            fixedMemberFields: false,
            allowMemberControls: true,
          };
        }

        if (eventId === "basketball-half-court") {
          return {
            maxMembers: 3,
            minMembers: 2,
            defaultMemberRows: 2,
            requireCompleteMemberFields: false,
            requiresExactMembers: false,
            minTotalParticipants: 3,
            maxTotalParticipants: 4,
            sizeMessage: "Each team must have 3 to 4 players, including the Captain/Leader.",
            familyLabel: "Family",
            captainLabel: "Captain/Leader",
            membersHeading: "Members",
            memberLabels: [],
            fixedMemberFields: false,
            allowMemberControls: true,
          };
        }

        if (eventId === "it-quiz-bee") {
          return {
            maxMembers: 4,
            defaultMemberRows: 4,
            requireCompleteMemberFields: true,
            requiresExactMembers: true,
            exactMembers: 4,
            maxTotalParticipants: 5,
            sizeMessage: "Each team must include one (1) watcher and four (4) participants.",
            familyLabel: "Family",
            captainLabel: "Watcher",
            membersHeading: "Participants",
            memberLabels: ["Participant 1", "Participant 2", "Participant 3", "Participant 4"],
            fixedMemberFields: true,
            allowMemberControls: false,
          };
        }

        if (eventId === "chess-tournament") {
          return {
            maxMembers: 4,
            defaultMemberRows: 4,
            requireCompleteMemberFields: true,
            requiresExactMembers: true,
            exactMembers: 4,
            maxTotalParticipants: 4,
            sizeMessage: "Each team must include exactly two (2) male and two (2) female participants.",
            familyLabel: "Family",
            captainLabel: "Representative",
            membersHeading: "Participants",
            memberLabels: ["Male Participant 1", "Male Participant 2", "Female Participant 1", "Female Participant 2"],
            fixedMemberFields: true,
            allowMemberControls: false,
            hideCaptainField: true,
            captainDefaultValue: "Team Representative",
            excludeCaptainFromSize: true,
          };
        }

        if (eventId === "mr-and-ms-it-2026") {
          return {
            maxMembers: 1,
            defaultMemberRows: 1,
            requireCompleteMemberFields: true,
            requiresExactMembers: true,
            exactMembers: 1,
            maxTotalParticipants: 2,
            minTotalParticipants: 2,
            sizeMessage: "Each family must register exactly one (1) Mr. IT and one (1) Ms. IT candidate.",
            familyLabel: "Family",
            captainLabel: "Mr. IT",
            captainPlaceholder: "Enter Mr. IT candidate name",
            membersHeading: "Ms. IT",
            memberLabels: ["Ms. IT"],
            fixedMemberFields: true,
            allowMemberControls: false,
          };
        }

        return {
          maxMembers: 3,
          defaultMemberRows: 3,
          requireCompleteMemberFields: true,
          requiresExactMembers: true,
          exactMembers: 3,
          maxTotalParticipants: 4,
          sizeMessage: "Each team must have exactly 4 members including the Team Captain/Leader.",
          familyLabel: "Family",
          captainLabel: "Captain/Leader",
          membersHeading: "Members",
          memberLabels: [],
          fixedMemberFields: false,
          allowMemberControls: true,
        };
      }

      function getTeamSizeValidationMessage(eventId) {
        return getTeamRegistrationRules(eventId).sizeMessage;
      }

      function getTeamMinimumMembersValidationMessage(eventId) {
        if (eventId === "battle-of-the-bands") {
          return "At least 5 members are required, including the Band Leader.";
        }

        if (eventId === "basketball-half-court") {
          return "At least 3 players are required, including the Captain/Leader.";
        }

        return "Not enough team members were provided.";
      }

      function updateTeamMemberControls(form, eventId) {
        if (!(form instanceof HTMLFormElement) || (form.dataset.registrationType || "") !== "team") {
          return;
        }

        const teamRules = getTeamRegistrationRules(eventId);
        if (!teamRules.allowMemberControls) {
          return;
        }

        const membersList = form.querySelector(".event-members-list");
        if (!(membersList instanceof HTMLElement)) {
          return;
        }

        const rows = Array.from(membersList.querySelectorAll(".event-member-row"));
        const rowCount = rows.length;
        const minRows = eventId === "battle-of-the-bands" ? 4 : eventId === "basketball-half-court" ? 2 : 1;
        const canAdd = rowCount < teamRules.maxMembers;
        const canRemove = rowCount > minRows;

        const addMemberButton = form.querySelector("[data-add-member='true']");
        if (addMemberButton instanceof HTMLButtonElement) {
          addMemberButton.disabled = !canAdd;
          addMemberButton.hidden = !canAdd;
        }

        const removeButtons = membersList.querySelectorAll("[data-remove-member='true']");
        removeButtons.forEach((button) => {
          if (button instanceof HTMLButtonElement) {
            button.disabled = !canRemove;
            button.hidden = !canRemove;
          }
        });
      }

      async function fetchEventRegistrationState(eventId) {
        const ownerToken = getOrCreateRegistrationOwnerToken();
        const ownerTokenHash = await getRegistrationOwnerTokenHash(ownerToken);
        const requestUrl =
          eventRegistrationApiBaseUrl +
          "?eventId=" +
          encodeURIComponent(eventId) +
          "&ownerToken=" +
          encodeURIComponent(ownerToken) +
          "&ownerTokenHash=" +
          encodeURIComponent(ownerTokenHash);
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
          const teamRules = getTeamRegistrationRules(eventId);

          if (typeof stats.remainingTeams === "number" && typeof stats.maxTeams === "number") {
            lines.push("Total remaining team slots: " + stats.remainingTeams + " / " + stats.maxTeams + ".");
          }

          if (Array.isArray(stats.perFamily)) {
            stats.perFamily.forEach((entry) => {
              lines.push(entry.family + ": " + entry.count + "/" + entry.limit + " teams registered (remaining " + entry.remaining + ").");
            });
          }

          const teamState = getCurrentTeamMemberState(form);
          const currentTotal = (teamRules.excludeCaptainFromSize ? 0 : (teamState.captain ? 1 : 0)) + teamState.filledMembers.length;
          lines.push("Current team size entered: " + currentTotal + "/" + teamRules.maxTotalParticipants + ".");
          lines.push(getTeamSizeValidationMessage(eventId));

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

      function renderRegisteredParticipants(form, eventId, state) {
        const participantsPanel = form.querySelector("[data-registered-participants='true']");
        if (!participantsPanel) {
          return;
        }

        const registrations = state && Array.isArray(state.registrations) ? state.registrations : [];
        if (registrations.length === 0) {
          participantsPanel.innerHTML =
            '<h6 class="event-registered-title">Registered Participants</h6>' +
            '<p class="event-registration-soon">No registered participants yet.</p>';
          return;
        }

        const groupedByFamily = {};
        const orderedFamilyKeys = familyOptions.slice();

        registrations.forEach((registration) => {
          const family = registration && typeof registration.family === "string" ? registration.family : "";
          const familyKey = family || "Unassigned";

          if (!groupedByFamily[familyKey]) {
            groupedByFamily[familyKey] = [];
          }

          groupedByFamily[familyKey].push(registration);

          if (orderedFamilyKeys.indexOf(familyKey) === -1) {
            orderedFamilyKeys.push(familyKey);
          }
        });

        function buildCancelButtonMarkup(registration, fallbackEventId) {
          const registrationId = registration && typeof registration.id === "string" ? registration.id : "";
          const registrationEventId = registration && typeof registration.eventId === "string" ? registration.eventId : fallbackEventId;
          const canCancel = isOwnedRegistration(registration);
          const isPendingCancellation = registrationId && pendingRegistrationCancellationIds.has(registrationId);

          if (!canCancel || !registrationId) {
            return "";
          }

          return (
            '<button type="button" class="btn btn-secondary event-inline-button' +
            (isPendingCancellation ? " is-pending" : "") +
            '" data-cancel-registration="true" data-registration-id="' +
            escapeHtml(registrationId) +
            '" data-event-id="' +
            escapeHtml(registrationEventId || fallbackEventId) +
            '"' +
            (isPendingCancellation ? ' disabled aria-busy="true"' : "") +
            ">Cancel Registration</button>"
          );
        }

        const familySectionsMarkup = orderedFamilyKeys
          .map((familyKey) => {
            const familyRegistrations = groupedByFamily[familyKey] || [];
            if (familyRegistrations.length === 0) {
              return "";
            }

            const registrationType = familyRegistrations[0] && familyRegistrations[0].registrationType === "team"
              ? "team"
              : "individual";

            let entriesMarkup = "";

            if (registrationType === "team") {
              entriesMarkup = familyRegistrations
                .map((registration) => {
                  const captain = registration && typeof registration.captain === "string" ? registration.captain : "";
                  const members = registration && Array.isArray(registration.members)
                    ? registration.members.filter((member) => typeof member === "string")
                    : [];
                  const teamLabel = registration && typeof registration.teamLabel === "string" && registration.teamLabel.trim()
                    ? registration.teamLabel.trim()
                    : "Team";
                  const cancelButtonMarkup = buildCancelButtonMarkup(registration, eventId);
                  const teamRoster = eventId === "chess-tournament"
                    ? members.filter((member) => Boolean(member))
                    : [captain].concat(members).filter((member) => Boolean(member));
                  const teamRosterMarkup = teamRoster.length > 0
                    ? teamRoster
                      .map((member) => '<li class="event-registered-team-member">' + escapeHtml(member) + "</li>")
                      .join("")
                    : '<li class="event-registered-team-member">No members listed.</li>';

                  if (eventId === "mr-and-ms-it-2026") {
                    const msItName = members[0] && members[0].trim() ? members[0].trim() : "TBA";

                    return (
                      '<li class="event-registered-team">' +
                      '<div class="event-registered-team__header">' +
                      '<span class="event-registered-team__title">Mr. IT: ' + escapeHtml(captain || "TBA") + "</span>" +
                      (cancelButtonMarkup ? '<span class="event-registered-entry-actions">' + cancelButtonMarkup + "</span>" : "") +
                      "</div>" +
                      '<div class="event-registered-team__members event-registered-team__members--plain">' +
                      '<span class="event-registered-team__title">Ms. IT: ' + escapeHtml(msItName) + "</span>" +
                      "</div>" +
                      "</li>"
                    );
                  }

                  const teamTitle = eventId === "chess-tournament"
                    ? escapeHtml(teamLabel)
                    : escapeHtml(teamLabel) + " (Captain: " + escapeHtml(captain || "TBA") + ")";

                  return (
                    '<li class="event-registered-team">' +
                    '<div class="event-registered-team__header">' +
                    '<span class="event-registered-team__title">' +
                    teamTitle +
                    "</span>" +
                    (cancelButtonMarkup ? '<span class="event-registered-entry-actions">' + cancelButtonMarkup + "</span>" : "") +
                    "</div>" +
                    '<ul class="event-registered-team__members">' +
                    teamRosterMarkup +
                    "</ul>" +
                    "</li>"
                  );
                })
                .join("");

              return (
                '<section class="event-registered-family">' +
                '<h6 class="event-registered-family__title">' + escapeHtml(familyKey) + "</h6>" +
                '<ul class="event-registered-teams">' + entriesMarkup + "</ul>" +
                "</section>"
              );
            }

            entriesMarkup = familyRegistrations
              .map((registration) => {
                const participantName = registration && typeof registration.name === "string" && registration.name.trim()
                  ? registration.name.trim()
                  : "Unnamed participant";
                const cancelButtonMarkup = buildCancelButtonMarkup(registration, eventId);

                return (
                  '<li class="event-registered-person-row">' +
                  '<span class="event-registered-person-name">' + escapeHtml(participantName) + "</span>" +
                  (cancelButtonMarkup ? '<span class="event-registered-entry-actions">' + cancelButtonMarkup + "</span>" : "") +
                  "</li>"
                );
              })
              .join("");

            return (
              '<section class="event-registered-family">' +
              '<h6 class="event-registered-family__title">' + escapeHtml(familyKey) + "</h6>" +
              '<ul class="event-registered-people">' + entriesMarkup + "</ul>" +
              "</section>"
            );
          })
          .filter((sectionMarkup) => Boolean(sectionMarkup))
          .join("");

        participantsPanel.innerHTML =
          '<h6 class="event-registered-title">Registered Participants</h6>' +
          (familySectionsMarkup || '<p class="event-registration-soon">No participants yet.</p>');
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
        const controls = form.querySelectorAll("input, select, button[type='submit'], button[data-add-member='true'], button[data-remove-member='true'], button[data-cancel-registration='true']");
        controls.forEach((control) => {
          control.disabled = disabled;
        });
      }

      function setFormSubmittingState(form, isSubmitting) {
        const submitButton = form.querySelector('button[type="submit"]');
        setButtonPendingState(submitButton, isSubmitting, "Submitting...");
        setFormControlsDisabled(form, isSubmitting);
      }

      function updateIndividualSubmitAvailability(form, state) {
        const submitButton = form.querySelector('button[type="submit"]');
        if (!(submitButton instanceof HTMLButtonElement)) {
          return;
        }

        const stats = state && state.stats ? state.stats : null;
        if (stats && stats.isClosed) {
          submitButton.disabled = true;
          return;
        }

        if ((form.dataset.registrationType || "") !== "individual") {
          return;
        }

        const familySelect = form.elements.namedItem("family");
        if (!(familySelect instanceof HTMLSelectElement) || !familySelect.value) {
          submitButton.disabled = false;
          return;
        }

        const familyEntries = stats && Array.isArray(stats.perFamily) ? stats.perFamily : [];
        const familyEntry = familyEntries.find((entry) => entry.family === familySelect.value);
        submitButton.disabled = Boolean(familyEntry && familyEntry.count >= familyEntry.limit);
      }

      function updateTeamSubmitAvailability(form, state, eventId) {
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

        const familySelect = form.elements.namedItem("family");
        if (!(familySelect instanceof HTMLSelectElement) || !familySelect.value) {
          submitButton.disabled = true;
          return;
        }

        const familyEntries = stats && Array.isArray(stats.perFamily) ? stats.perFamily : [];
        const familyEntry = familyEntries.find((entry) => entry.family === familySelect.value);
        if (familyEntry && familyEntry.count >= familyEntry.limit) {
          submitButton.disabled = true;
          return;
        }

        const teamRules = getTeamRegistrationRules(eventId);
        const teamState = getCurrentTeamMemberState(form);
        const hasEmptyMemberSlot = teamState.members.some((member) => member.length === 0);

        if (teamRules.requireCompleteMemberFields && hasEmptyMemberSlot) {
          submitButton.disabled = true;
          return;
        }

        if (teamRules.requiresExactMembers) {
          submitButton.disabled = !teamState.captain || teamState.filledMembers.length !== teamRules.exactMembers;
          return;
        }

        if (typeof teamRules.minMembers === "number" && teamState.filledMembers.length < teamRules.minMembers) {
          submitButton.disabled = true;
          return;
        }

        submitButton.disabled = !teamState.captain || teamState.filledMembers.length > teamRules.maxMembers;
      }

      function refreshEventRegistrationFormState(form, eventId) {
        const state = getCachedEventRegistrationState(eventId);
        renderEventRegistrationStatus(form, eventId, state);
        renderRegisteredParticipants(form, eventId, state);
        updateTeamMemberControls(form, eventId);

        if (!state || !state.stats) {
          updateIndividualSubmitAvailability(form, null);
          updateTeamSubmitAvailability(form, null, eventId);
          return;
        }

        const stats = state.stats;
        const isClosed = Boolean(stats.isClosed);

        setFormControlsDisabled(form, isClosed);

        if (!isClosed) {
          applyFamilySlotAvailability(form, state);
        }

        updateIndividualSubmitAvailability(form, state);
        updateTeamSubmitAvailability(form, state, eventId);

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

      function setRegistrationStatusFallbackMessage(eventId, message) {
        const activeEventId = getActiveEventId();
        if (!message || activeEventId !== eventId) {
          return;
        }

        const form = getActiveEventRegistrationForm();
        if (!(form instanceof HTMLFormElement)) {
          return;
        }

        const statusPanel = form.querySelector("[data-registration-status='true']");
        if (!statusPanel) {
          return;
        }

        statusPanel.innerHTML = '<p class="event-registration-soon">' + escapeHtml(message) + "</p>";
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

        // Run an immediate silent fetch so users do not wait for the first interval tick.
        fetchEventRegistrationState(eventId).catch(() => {
          // Keep background polling silent.
        });

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

        if (!getCachedEventRegistrationState(eventId)) {
          setRegistrationStatusFallbackMessage(eventId, "Loading registration details...");
        }

        try {
          await fetchEventRegistrationState(eventId);
        } catch (error) {
          if (!getCachedEventRegistrationState(eventId)) {
            setRegistrationStatusFallbackMessage(eventId, "Registration details are loading. You can continue filling out the form.");
          }
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

      async function cancelEventRegistration(payload) {
        return fetchJson(eventRegistrationApiBaseUrl + "/cancel", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
      }

      async function cancelOwnedRegistration(form, eventId, registrationId) {
        if (!form || !eventId || !registrationId || pendingRegistrationCancellationIds.has(registrationId)) {
          return;
        }

        pendingRegistrationCancellationIds.add(registrationId);
        refreshEventRegistrationFormState(form, eventId);

        try {
          const ownerToken = getOrCreateRegistrationOwnerToken();
          const ownerTokenHash = await getRegistrationOwnerTokenHash(ownerToken);
          const result = await cancelEventRegistration({
            eventId,
            registrationId,
            ownerToken,
            ownerTokenHash,
          });

          if (!result.ok) {
            const isBackendFailure = result.status >= 500 || result.status <= 0;
            if (isBackendFailure) {
              console.error("[registration] Cancel registration failed.", {
                status: result.status,
                payload: result.payload,
              });
            }

            const message = isBackendFailure
              ? "Unable to cancel registration right now. Please try again."
              : result.payload && typeof result.payload.message === "string" && result.payload.message.trim()
                ? result.payload.message.trim()
                : "Unable to cancel registration right now. Please try again.";
            setEventFormFeedback(form, message, true);
            showToast(message);
            return;
          }

          const nextState = getRegistrationStatePayload(result.payload);
          if (nextState && nextState.eventId) {
            cacheRegistrationState(nextState);
            syncRegistrationStateToOtherTabs("registration-update", nextState.eventId, nextState);
          }

          forgetOwnedRegistration(registrationId);
          setEventFormFeedback(form, "Your registration has been canceled.", false);
          showToast("Your registration has been canceled.");
        } catch (error) {
          console.error("[registration] Could not cancel registration.", error);
          const message = "Unable to cancel registration right now. Please try again.";
          setEventFormFeedback(form, message, true);
          showToast(message);
        } finally {
          pendingRegistrationCancellationIds.delete(registrationId);
          refreshEventRegistrationFormState(form, eventId);
        }
      }

      async function showSelectedEventDetails(eventId, options) {
        const config = options && typeof options === "object" ? options : {};
        const skipMechanicsFetch = Boolean(config.skipMechanicsFetch);

        if (!skipMechanicsFetch) {
          try {
            await fetchEventMechanics(eventId);
          } catch (error) {
            console.error("[mechanics] Unable to fetch latest mechanics.", error);
            // Keep defaults when backend mechanics lookup is unavailable.
          }
        }

        let details = getEventDetailsById(eventId);
        if (!teaserTitle || !teaserVenue || !teaserMechanics) {
          return;
        }

        if (!details || typeof details !== "object") {
          details = {
            eventId,
            title: "Event Details",
            venue: "To be announced",
            registrationType: "none",
            mechanicsHtml: "<p>Mechanics will be announced soon.</p>",
          };
        }

        if (typeof details.mechanicsHtml !== "string" || !details.mechanicsHtml.trim()) {
          details.mechanicsHtml = convertMechanicsSectionsToHtml(getMechanicsSectionsForEvent(eventId));
        }

        console.debug("[mechanics] rendering details", {
          eventId,
          skipMechanicsFetch,
          venue: details.venue,
          mechanicsLength: details.mechanicsHtml.length,
          hasOverride: Boolean(mechanicsOverridesByEventId[eventId]),
        });

        teaserTitle.textContent = details.title;
        if (isMechanicsEditMode(eventId)) {
          renderMechanicsEditMode(eventId);
        } else {
          renderMechanicsReadOnly(details);
        }
        renderMechanicsAdminControls(eventId);
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

      function buildTeamMemberRowMarkup(isRequired, placeholder, showRemoveButton, label) {
        const requiredAttribute = isRequired ? " required" : "";
        const resolvedPlaceholder = placeholder || "Member name";
        const memberLabelMarkup = label ? '<label>' + escapeHtml(label) + '</label>' : "";
        const removeButtonMarkup = showRemoveButton
          ? '<button type="button" class="event-member-remove" data-remove-member="true" aria-label="Remove member">Remove</button>'
          : "";

        return (
          '<div class="event-member-row">' +
          memberLabelMarkup +
          '<input name="members[]" type="text" placeholder="' + escapeHtml(resolvedPlaceholder) + '"' + requiredAttribute + ' />' +
          removeButtonMarkup +
          "</div>"
        );
      }

      function buildTeamMemberRowsMarkup(count, isRequired) {
        let markup = "";

        for (let i = 0; i < count; i += 1) {
          markup += buildTeamMemberRowMarkup(isRequired, "Member name", true, "");
        }

        return markup;
      }

      function buildFixedTeamMemberRowsMarkup(memberLabels, isRequired) {
        let markup = "";
        const labels = Array.isArray(memberLabels) ? memberLabels : [];

        for (let i = 0; i < labels.length; i += 1) {
          const memberLabel = labels[i];
          markup += buildTeamMemberRowMarkup(isRequired, memberLabel, false, memberLabel + ":");
        }

        return markup;
      }

      function renderEventRegistration(details) {
        if (!teaserRegistration) {
          return;
        }

        const registrationBlock = teaserRegistration.closest(".event-detail-block");
        const isGuidelinesOnlyEvent = details.registrationType === "none";

        if (registrationBlock instanceof HTMLElement) {
          registrationBlock.hidden = isGuidelinesOnlyEvent;
        }

        if (isGuidelinesOnlyEvent) {
          teaserRegistration.innerHTML = "";
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
            '<label for="event-name">Participant Name</label>' +
            '<input id="event-name" name="name" type="text" autocomplete="name" placeholder="Enter participant name" required />' +
            "</div>" +
            "</div>" +
            '<div class="event-registration-status" data-registration-status="true" aria-live="polite"></div>' +
            '<div class="event-registered-participants" data-registered-participants="true" aria-live="polite"></div>' +
            '<p class="event-form-feedback" aria-live="polite"></p>' +
            '<div class="registration-actions event-form-actions">' +
            '<button type="submit" class="btn btn-primary">Submit Registration</button>' +
            "</div>" +
            "</form>";
          return;
        }

        if (details.eventId === "mr-and-ms-it-2026") {
          teaserRegistration.innerHTML =
            '<form class="event-registration-form" data-registration-type="team" novalidate>' +
            '<div class="event-form-grid">' +
            '<div class="event-form-field">' +
            '<label for="event-family">Family</label>' +
            '<select id="event-family" name="family" required><option value="">Select family</option>' +
            buildFamilyOptionsMarkup() +
            "</select>" +
            "</div>" +
            "</div>" +
            '<div class="event-form-field">' +
            '<label for="event-captain">Mr. IT</label>' +
            '<input id="event-captain" name="captain" type="text" autocomplete="name" placeholder="Enter Mr. IT candidate name" required />' +
            "</div>" +
            '<div class="event-form-field">' +
            '<label for="event-ms-it">Ms. IT</label>' +
            '<input id="event-ms-it" name="members[]" type="text" autocomplete="name" placeholder="Enter Ms. IT candidate name" required />' +
            "</div>" +
            '<div class="event-registration-status" data-registration-status="true" aria-live="polite"></div>' +
            '<div class="event-registered-participants" data-registered-participants="true" aria-live="polite"></div>' +
            '<p class="event-form-feedback" aria-live="polite"></p>' +
            '<div class="registration-actions event-form-actions">' +
            '<button type="submit" class="btn btn-primary">Submit Registration</button>' +
            "</div>" +
            "</form>";
          return;
        }

        const teamRules = getTeamRegistrationRules(details.eventId);
        const familyLabel = teamRules.familyLabel || "Family";
        const captainLabel = teamRules.captainLabel || "Team Captain";
        const captainPlaceholder = teamRules.captainPlaceholder || "Enter captain/leader name";
        const hideCaptainField = Boolean(teamRules.hideCaptainField);
        const defaultCaptainValue = teamRules.captainDefaultValue || "Team Representative";
        const membersHeading = teamRules.membersHeading || "Members";
        const membersListMarkup = teamRules.fixedMemberFields
          ? buildFixedTeamMemberRowsMarkup(teamRules.memberLabels, teamRules.requireCompleteMemberFields)
          : buildTeamMemberRowsMarkup(teamRules.defaultMemberRows, teamRules.requireCompleteMemberFields);
        const addMemberButtonMarkup = teamRules.allowMemberControls
          ? '<button type="button" class="btn btn-secondary event-inline-button" data-add-member="true">Add Member</button>'
          : "";
        const captainFieldMarkup = hideCaptainField
          ? '<input id="event-captain" name="captain" type="hidden" value="' + escapeHtml(defaultCaptainValue) + '" />'
          : '<div class="event-form-field">' +
            '<label for="event-captain">' + escapeHtml(captainLabel) + '</label>' +
            '<input id="event-captain" name="captain" type="text" autocomplete="name" placeholder="' + escapeHtml(captainPlaceholder) + '" required />' +
            '</div>';

        teaserRegistration.innerHTML =
          '<form class="event-registration-form" data-registration-type="team" novalidate>' +
          '<div class="event-form-grid">' +
          '<div class="event-form-field">' +
          '<label for="event-family">' + escapeHtml(familyLabel) + '</label>' +
          '<select id="event-family" name="family" required><option value="">Select family</option>' +
          buildFamilyOptionsMarkup() +
          "</select>" +
          "</div>" +
          captainFieldMarkup +
          "</div>" +
          '<div class="event-members-wrap">' +
          '<div class="event-members-header">' +
          "<strong>" + escapeHtml(membersHeading) + "</strong>" +
          addMemberButtonMarkup +
          "</div>" +
          '<div class="event-members-list">' + membersListMarkup + "</div>" +
          "</div>" +
          '<div class="event-registration-status" data-registration-status="true" aria-live="polite"></div>' +
          '<div class="event-registered-participants" data-registered-participants="true" aria-live="polite"></div>' +
          '<p class="event-form-feedback" aria-live="polite"></p>' +
          '<div class="registration-actions event-form-actions">' +
          '<button type="submit" class="btn btn-primary">Submit Registration</button>' +
          "</div>" +
          "</form>";

        const teamForm = teaserRegistration.querySelector(".event-registration-form");
        if (teamForm instanceof HTMLFormElement) {
          updateTeamMemberControls(teamForm, details.eventId);
        }
      }

      function addTeamMemberRow(membersList, isRequired) {
        const requiredAttribute = isRequired ? " required" : "";
        const memberRow = document.createElement("div");
        memberRow.className = "event-member-row";
        memberRow.innerHTML =
          '<input name="members[]" type="text" placeholder="Member name"' + requiredAttribute + ' />' +
          '<button type="button" class="event-member-remove" data-remove-member="true" aria-label="Remove member">Remove</button>';
        membersList.appendChild(memberRow);
      }

      function resetTeamMembers(membersList, teamRules) {
        if (!membersList || !teamRules) {
          return;
        }

        membersList.innerHTML = teamRules.fixedMemberFields
          ? buildFixedTeamMemberRowsMarkup(teamRules.memberLabels, teamRules.requireCompleteMemberFields)
          : buildTeamMemberRowsMarkup(teamRules.defaultMemberRows, teamRules.requireCompleteMemberFields);
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
      window.addEventListener("storage", onResponseStorageChange);

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
        window.removeEventListener("storage", onResponseStorageChange);

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
        teaserModal.addEventListener("click", async (event) => {
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
              await showSelectedEventDetails(selectedEventId);
            }
            return;
          }

          const mechanicsActionButton = target.closest("[data-mechanics-action]");
          if (mechanicsActionButton instanceof HTMLElement) {
            const action = mechanicsActionButton.dataset.mechanicsAction || "";
            const eventId = getActiveEventId();
            if (!eventId) {
              return;
            }

            await handleMechanicsAction(action, eventId);
            return;
          }

          const cancelRegistrationButton = target.closest("[data-cancel-registration='true']");
          if (cancelRegistrationButton instanceof HTMLElement) {
            const registrationId = cancelRegistrationButton.dataset.registrationId || "";
            const eventId = cancelRegistrationButton.dataset.eventId || getActiveEventId();
            const form = cancelRegistrationButton.closest(".event-registration-form");
            if (!(form instanceof HTMLFormElement) || !registrationId || !eventId) {
              return;
            }

            const approved = window.confirm("Are you sure you want to cancel your registration?");
            if (!approved) {
              return;
            }

            await cancelOwnedRegistration(form, eventId, registrationId);
            return;
          }

          const addMemberButton = target.closest("[data-add-member='true']");
          if (addMemberButton instanceof HTMLElement) {
            const form = addMemberButton.closest(".event-registration-form");
            const membersList = form ? form.querySelector(".event-members-list") : null;
            if (membersList) {
              const activeEventId = getActiveEventId();
              const teamRules = getTeamRegistrationRules(activeEventId);
              const rows = membersList.querySelectorAll(".event-member-row");
              if (rows.length >= teamRules.maxMembers) {
                if (form instanceof HTMLFormElement) {
                  setEventFormFeedback(form, getTeamSizeValidationMessage(activeEventId), true);
                  updateTeamMemberControls(form, activeEventId);
                }
                return;
              }

              addTeamMemberRow(membersList, teamRules.requireCompleteMemberFields);
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

            const form = membersList.closest(".event-registration-form");
            const activeEventId = getActiveEventId();
            const teamRules = getTeamRegistrationRules(activeEventId);
            const minRows = activeEventId === "battle-of-the-bands" ? 4 : activeEventId === "basketball-half-court" ? 2 : 1;

            const rows = membersList.querySelectorAll(".event-member-row");
            if (rows.length <= minRows) {
              if (form instanceof HTMLFormElement) {
                const feedbackMessage = activeEventId === "battle-of-the-bands" || activeEventId === "basketball-half-court"
                  ? getTeamMinimumMembersValidationMessage(activeEventId)
                  : getTeamSizeValidationMessage(activeEventId);
                setEventFormFeedback(form, feedbackMessage, true);
                updateTeamMemberControls(form, activeEventId);
              }
              return;
            }

            const row = removeMemberButton.closest(".event-member-row");
            if (row) {
              row.remove();
              if (form instanceof HTMLFormElement && activeEventId) {
                refreshEventRegistrationFormState(form, activeEventId);
                if (!teamRules.requiresExactMembers) {
                  setEventFormFeedback(form, "", false);
                }
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

            if (registrationType === "individual" && familyEntry && familyEntry.count >= (typeof familyEntry.limit === "number" ? familyEntry.limit : 2)) {
              setEventFormFeedback(form, getFamilyLimitValidationMessage(activeEventId), true);
              refreshEventRegistrationFormState(form, activeEventId);
              return;
            }

            if (registrationType === "team" && familyEntry && familyEntry.count >= (typeof familyEntry.limit === "number" ? familyEntry.limit : 2)) {
              setEventFormFeedback(form, getTeamLimitValidationMessage(activeEventId), true);
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

            form.dataset.isSubmitting = "true";
            setFormSubmittingState(form, true);

            try {
              const ownerToken = getOrCreateRegistrationOwnerToken();
              const ownerTokenHash = await getRegistrationOwnerTokenHash(ownerToken);
              const payload = {
                eventId: activeEventId,
                family: trimmedFamily,
                name: participantName,
                ownerToken,
                ownerTokenHash,
              };

              const result = await submitEventRegistration(payload);
              const nextState = getRegistrationStatePayload(result.payload);

              if (!result.ok) {
                if (nextState && nextState.eventId) {
                  cacheRegistrationState(nextState);
                }

                const message = result.payload && result.payload.message
                  ? result.payload.message
                  : "Unable to submit registration right now.";
                setEventFormFeedback(form, message, true);
                showToast(message);
                return;
              }

              if (nextState && nextState.eventId) {
                cacheRegistrationState(nextState);
                syncRegistrationStateToOtherTabs("registration-update", nextState.eventId, nextState);
              }

              if (result.payload && result.payload.registration) {
                rememberOwnedRegistration(result.payload.registration);
              }

              const successMessage = activeEventId === "fast-typing"
                ? "Registration successful."
                : "Registration submitted!";
              setEventFormFeedback(form, successMessage, false);
              showToast(successMessage);
              form.reset();
            } finally {
              form.dataset.isSubmitting = "false";
              setFormSubmittingState(form, false);
              refreshEventRegistrationFormState(form, activeEventId);
            }

            return;
          }

          if (registrationType === "team") {
            const teamState = getCurrentTeamMemberState(form);
            const teamRules = getTeamRegistrationRules(activeEventId);
            const captain = teamState.captain;
            const members = teamState.members;
            const filledMembers = teamState.filledMembers;

            if (!captain) {
              const captainMessage = activeEventId === "it-quiz-bee"
                ? "Please enter the watcher name."
                : activeEventId === "mr-and-ms-it-2026"
                  ? "Please enter the Mr. IT candidate name."
                : "Please enter the captain/leader name.";
              setEventFormFeedback(form, captainMessage, true);
              return;
            }

            if (teamRules.requireCompleteMemberFields && members.some((member) => member.length === 0)) {
              setEventFormFeedback(form, "Please complete all team member fields or remove extras.", true);
              return;
            }

            if (teamRules.requiresExactMembers && filledMembers.length !== teamRules.exactMembers) {
              setEventFormFeedback(form, getTeamSizeValidationMessage(activeEventId), true);
              return;
            }

            if (!teamRules.requiresExactMembers && typeof teamRules.minMembers === "number" && filledMembers.length < teamRules.minMembers) {
              setEventFormFeedback(form, getTeamMinimumMembersValidationMessage(activeEventId), true);
              return;
            }

            if (!teamRules.requiresExactMembers && filledMembers.length > teamRules.maxMembers) {
              setEventFormFeedback(form, getTeamSizeValidationMessage(activeEventId), true);
              return;
            }

            form.dataset.isSubmitting = "true";
            setFormSubmittingState(form, true);

            try {
              const ownerToken = getOrCreateRegistrationOwnerToken();
              const ownerTokenHash = await getRegistrationOwnerTokenHash(ownerToken);
              const payload = {
                eventId: activeEventId,
                family: trimmedFamily,
                captain,
                members: filledMembers,
                ownerToken,
                ownerTokenHash,
              };

              const result = await submitEventRegistration(payload);
              const nextState = getRegistrationStatePayload(result.payload);

              if (!result.ok) {
                if (nextState && nextState.eventId) {
                  cacheRegistrationState(nextState);
                }

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

              if (nextState && nextState.eventId) {
                cacheRegistrationState(nextState);
                syncRegistrationStateToOtherTabs("registration-update", nextState.eventId, nextState);
              }

              if (result.payload && result.payload.registration) {
                rememberOwnedRegistration(result.payload.registration);
              }

              const successMessage = activeEventId === "mobile-legends-tournament"
                ? "Team registered successfully."
                : "Registration submitted!";
              setEventFormFeedback(form, successMessage, false);
              showToast(activeEventId === "mobile-legends-tournament"
                ? successMessage
                : (teamLabel ? "Registration submitted! " + teamLabel + " is confirmed." : "Registration submitted!"));
              form.reset();
              const membersList = form.querySelector(".event-members-list");
              if (membersList) {
                resetTeamMembers(membersList, teamRules);
              }
            } finally {
              form.dataset.isSubmitting = "false";
              setFormSubmittingState(form, false);
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

      document.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) {
          return;
        }

        const feedbackTarget = target.closest(".btn, .event-selection-option, .event-member-remove, .registration-close, .interactive-event, nav a, .socials a, .brand, .primary-menu-toggle, .primary-menu-panel a");
        if (feedbackTarget instanceof HTMLElement) {
          triggerTapFeedback(feedbackTarget);
        }

        if (primaryMenuButton instanceof HTMLButtonElement && primaryMenuPanel instanceof HTMLElement) {
          const clickedInsideMenu = target.closest(".primary-menu");
          if (!clickedInsideMenu && primaryMenuPanel.classList.contains("is-open")) {
            closePrimaryMenu(false);
          }
        }
      });

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
          return;
        }

        if (event.key === "Escape" && primaryMenuPanel instanceof HTMLElement && primaryMenuPanel.classList.contains("is-open")) {
          closePrimaryMenu(true);
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
