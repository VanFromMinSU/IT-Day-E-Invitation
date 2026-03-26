(function () {
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const registerButton = document.getElementById("register-button");
      const registrationModal = document.getElementById("registration-modal");
      const registrationForm = document.getElementById("registration-form");
      const registrationFeedback = document.getElementById("registration-feedback");
      const fullNameField = document.getElementById("full-name");
      const emailField = document.getElementById("email");
      const courseField = document.getElementById("course");
      const yearLevelField = document.getElementById("year-level");
      const teaserModal = document.getElementById("teaser-modal");
      const teaserTitle = document.getElementById("teaser-title");
      const teaserText = document.getElementById("teaser-text");
      const teaserRegisterButton = document.getElementById("teaser-register-button");
      const appToast = document.getElementById("app-toast");
      const countdownChip = document.getElementById("countdown-chip");
      const registrationStorageKey = "itDayRegistrations";
      let toastTimer;

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

      function setFieldError(fieldId, message) {
        const errorEl = document.getElementById(fieldId + "-error");
        if (errorEl) {
          errorEl.textContent = message;
        }
      }

      function clearFieldErrors() {
        ["full-name", "email", "course", "year-level"].forEach((fieldId) => setFieldError(fieldId, ""));
      }

      function setFormFeedback(message, isError) {
        if (!registrationFeedback) {
          return;
        }

        registrationFeedback.textContent = message;
        registrationFeedback.classList.toggle("error", Boolean(isError));
      }

      function openRegistrationModal() {
        if (!registrationModal) {
          return;
        }

        registrationModal.classList.add("is-open");
        registrationModal.setAttribute("aria-hidden", "false");
        document.body.classList.add("modal-open");
        clearFieldErrors();
        setFormFeedback("", false);

        if (fullNameField) {
          fullNameField.focus();
        }
      }

      function closeRegistrationModal() {
        if (!registrationModal) {
          return;
        }

        registrationModal.classList.remove("is-open");
        registrationModal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("modal-open");
      }

      function openTeaserModal(title, text) {
        if (!teaserModal || !teaserTitle || !teaserText) {
          return;
        }

        teaserTitle.textContent = title;
        teaserText.textContent = text;
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

        if (!registrationModal || !registrationModal.classList.contains("is-open")) {
          document.body.classList.remove("modal-open");
        }
      }

      function validateRegistrationData(data) {
        const errors = {};

        if (!data.fullName || data.fullName.length < 2) {
          errors.fullName = "Please enter your full name.";
        }

        if (!data.email) {
          errors.email = "Email is required.";
        } else {
          const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailPattern.test(data.email)) {
            errors.email = "Please enter a valid email address.";
          }
        }

        if (!data.course) {
          errors.course = "Please select your course.";
        }

        if (!data.yearLevel) {
          errors.yearLevel = "Please select your year level.";
        }

        return errors;
      }

      function saveRegistration(payload) {
        const raw = localStorage.getItem(registrationStorageKey);
        let existing = [];

        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              existing = parsed;
            }
          } catch (error) {
            existing = [];
          }
        }

        existing.push(payload);
        localStorage.setItem(registrationStorageKey, JSON.stringify(existing));
      }

      if (registerButton) {
        registerButton.addEventListener("click", (event) => {
          event.preventDefault();
          openRegistrationModal();
          showToast("Great choice. Complete your registration to secure your slot.");
        });
      }

      if (registrationModal) {
        registrationModal.addEventListener("click", (event) => {
          const target = event.target;
          if (target instanceof HTMLElement && target.dataset.modalClose === "true") {
            closeRegistrationModal();
          }
        });
      }

      if (teaserModal) {
        teaserModal.addEventListener("click", (event) => {
          const target = event.target;
          if (target instanceof HTMLElement && target.dataset.teaserClose === "true") {
            closeTeaserModal();
          }
        });
      }

      const teaserTargets = document.querySelectorAll(".interactive-event[data-teaser-title]");
      teaserTargets.forEach((target) => {
        target.addEventListener("click", () => {
          const teaserTitleText = target.getAttribute("data-teaser-title") || "Event Sneak Peek";
          const teaserBodyText = target.getAttribute("data-teaser-text") || "Stay tuned for more details.";
          openTeaserModal(teaserTitleText, teaserBodyText);
        });

        target.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            const teaserTitleText = target.getAttribute("data-teaser-title") || "Event Sneak Peek";
            const teaserBodyText = target.getAttribute("data-teaser-text") || "Stay tuned for more details.";
            openTeaserModal(teaserTitleText, teaserBodyText);
          }
        });
      });

      if (teaserRegisterButton) {
        teaserRegisterButton.addEventListener("click", () => {
          closeTeaserModal();
          openRegistrationModal();
          showToast("You are one step away. Finish the form to confirm attendance.");
        });
      }

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && teaserModal && teaserModal.classList.contains("is-open")) {
          closeTeaserModal();
          return;
        }

        if (event.key === "Escape" && registrationModal && registrationModal.classList.contains("is-open")) {
          closeRegistrationModal();
        }
      });

      if (registrationForm) {
        registrationForm.addEventListener("submit", (event) => {
          event.preventDefault();
          clearFieldErrors();
          setFormFeedback("", false);

          const payload = {
            fullName: fullNameField ? fullNameField.value.trim() : "",
            email: emailField ? emailField.value.trim() : "",
            course: courseField ? courseField.value : "",
            yearLevel: yearLevelField ? yearLevelField.value : "",
            submittedAt: new Date().toISOString(),
          };

          const errors = validateRegistrationData(payload);
          if (errors.fullName) setFieldError("full-name", errors.fullName);
          if (errors.email) setFieldError("email", errors.email);
          if (errors.course) setFieldError("course", errors.course);
          if (errors.yearLevel) setFieldError("year-level", errors.yearLevel);

          if (Object.keys(errors).length > 0) {
            setFormFeedback("Please correct the highlighted fields and submit again.", true);
            return;
          }

          try {
            saveRegistration(payload);
            registrationForm.reset();
            setFormFeedback("Registration submitted successfully. See you at IT Day 2026!", false);
            showToast("Registration confirmed. See you at IT Day 2026.");
          } catch (error) {
            setFormFeedback("Registration was captured, but local saving is unavailable on this browser.", true);
            showToast("Submitted. Storage is limited on this browser.");
          }
        });
      }

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
