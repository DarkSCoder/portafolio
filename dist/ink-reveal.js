(() => {
  const section = document.querySelector("[data-ink-story]");
  if (!section) return;

  const stage = section.querySelector(".ink-story__stage");
  const image = section.querySelector(".ink-story__background");
  const canvas = section.querySelector(".ink-story__canvas");
  const status = section.querySelector("[data-ink-status]");
  const journey = section.querySelector("[data-ink-journey]");
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const coarsePointerQuery = window.matchMedia("(pointer: coarse)");
  const viewportProbe = document.createElement("span");

  viewportProbe.className = "ink-story__viewport-probe";
  viewportProbe.style.cssText =
    "position:fixed;top:0;left:0;width:1px;height:100vh;height:100lvh;visibility:hidden;pointer-events:none";
  document.body.append(viewportProbe);

  let context = null;
  let intersectionObserver = null;
  let frameId = 0;
  let lastFrameTime = 0;
  let redrawUntil = 0;
  let animationTime = 0;
  let viewportHeight = window.innerHeight;
  let geometry = null;
  let state = { progress: 0, maximum: 1 };
  let initialized = false;
  let destroyed = false;
  let hasCleared = true;
  let phoneMode = isPhone();
  let canvasFailed = false;
  let staticMode = reducedMotionQuery.matches;

  section.classList.toggle("is-static", staticMode);
  section.classList.toggle("is-phone", phoneMode);

  function setStatus(message) {
    status.textContent = message;
    status.hidden = !message;
  }

  function getLocalizedMessage(key, fallback) {
    if (typeof window.getSiteTranslation === "function") {
      const message = window.getSiteTranslation(key);
      if (typeof message === "string") return message;
    }

    return fallback;
  }

  function readViewportHeight() {
    const height = viewportProbe.getBoundingClientRect().height;
    return height > 0 ? height : window.innerHeight;
  }

  function isPhone() {
    return (
      window.__INK_REVEAL_FORCE_MOBILE__ === true ||
      (coarsePointerQuery.matches &&
        Math.min(window.screen.width, window.screen.height) < 820)
    );
  }

  function measureGeometry() {
    const journeyRect = journey.getBoundingClientRect();
    const journeyTop = journeyRect.top + window.scrollY;

    if (journeyRect.height <= 0 || !Number.isFinite(journeyTop)) {
      throw new Error("No se pudo medir la geometría de la escena.");
    }

    return { journeyTop };
  }

  function smooth(start, end, value) {
    const amount = Math.max(0, Math.min(1, (value - start) / (end - start)));
    return amount * amount * (3 - 2 * amount);
  }

  function mixColor(from, to, amount) {
    const start = from.match(/[a-f\d]{2}/gi).map((part) => parseInt(part, 16));
    const end = to.match(/[a-f\d]{2}/gi).map((part) => parseInt(part, 16));
    const channels = start.map((value, index) =>
      Math.round(value + (end[index] - value) * amount),
    );
    return `rgb(${channels[0]} ${channels[1]} ${channels[2]})`;
  }

  function hashNoise(x, y) {
    const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return value - Math.floor(value);
  }

  function valueNoise(x, y, time) {
    const px = x + time * 0.13;
    const py = y - time * 0.09;
    const x0 = Math.floor(px);
    const y0 = Math.floor(py);
    const fx = px - x0;
    const fy = py - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const top = hashNoise(x0, y0) * (1 - sx) + hashNoise(x0 + 1, y0) * sx;
    const bottom =
      hashNoise(x0, y0 + 1) * (1 - sx) + hashNoise(x0 + 1, y0 + 1) * sx;

    return top * (1 - sy) + bottom * sy;
  }

  function fbm(x, y, time, seed) {
    let value = 0;
    let amplitude = 0.5;
    let frequency = 2.02;
    const normalization = 0.96875;

    for (let octave = 0; octave < 5; octave += 1) {
      value +=
        valueNoise(
          x * frequency + 11.3 + seed,
          y * frequency - 7.1 - seed,
          time,
        ) * amplitude;
      frequency *= 2.02;
      amplitude *= 0.5;
    }

    return value / normalization;
  }

  function drawRaggedCircle(radius, time, seed, color) {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const points = 240;

    context.beginPath();
    for (let index = 0; index <= points; index += 1) {
      const angle = (index / points) * Math.PI * 2;
      const noise = fbm(Math.cos(angle) * 2.7, Math.sin(angle) * 2.7, time, seed);
      const variedRadius = radius * (1 + (noise - 0.5) * 0.14);
      const x = centerX + Math.cos(angle) * variedRadius;
      const y = centerY + Math.sin(angle) * variedRadius;

      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.closePath();
    context.fillStyle = color;
    context.fill();
  }

  function drawInk(progress, time) {
    if (!context || canvas.width === 0 || canvas.height === 0) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    if (progress <= 0.001) {
      hasCleared = true;
      return;
    }

    const maximumRadius = Math.hypot(canvas.width / 2, canvas.height / 2) * 1.06;
    const radius = maximumRadius * Math.min(1, progress / state.maximum);
    const settle = smooth(0.5, 0.96, progress);

    drawRaggedCircle(radius, time, 0, mixColor("#26c8c4", "#006d70", settle));
    drawRaggedCircle(radius * 0.91, time, 13, "#006d70");
    drawRaggedCircle(radius * 0.79, time, 29, mixColor("#090b0d", "#006d70", settle));
    hasCleared = false;
  }

  function updateInkState(progress, maximum) {
    const fill = maximum > 0 ? Math.min(1, progress / maximum) : 0;
    section.style.setProperty("--ink-fill", String(fill));
    section.style.setProperty("--ink-finish", String(smooth(0.86, 1, fill)));
  }

  function queueFrame() {
    if (!frameId && !destroyed && !document.hidden) {
      frameId = window.requestAnimationFrame(renderFrame);
    }
  }

  function renderFrame(now) {
    frameId = 0;
    if (destroyed || document.hidden || staticMode || phoneMode || !context) return;

    const delta = lastFrameTime
      ? Math.min((now - lastFrameTime) / 1000, 0.05)
      : 0;
    lastFrameTime = now;
    const edgeIsMoving =
      state.progress > 0.001 &&
      state.progress < Math.min(0.999, state.maximum) - 0.002;

    if (edgeIsMoving) {
      animationTime += delta * 1.7;
      redrawUntil = now + 400;
    }

    if (state.progress > 0.001) {
      drawInk(state.progress, animationTime);
    } else if (!hasCleared) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      hasCleared = true;
    }

    if (edgeIsMoving || now < redrawUntil) queueFrame();
    else lastFrameTime = 0;
  }

  function updateProgress() {
    if (!initialized || staticMode || !geometry) return;

    const scroll = window.scrollY;
    const sp = (scroll - geometry.journeyTop) / viewportHeight;
    const scrollScale = phoneMode ? 0.25 : 0.5;
    const parallaxProgress = Math.max(
      0,
      Math.min(1, sp / (4.65 * scrollScale)),
    );
    section.style.setProperty(
      "--ink-background-y",
      `${((0.5 - parallaxProgress) * 64).toFixed(2)}px`,
    );
    const maximum = phoneMode ? 0.82 : 1;
    const threshold = (phoneMode ? 2 : 1.55) * scrollScale;
    const expansion = phoneMode
      ? smooth(2.05 * scrollScale, 2.65 * scrollScale, sp)
      : smooth(1.9 * scrollScale, 2.6 * scrollScale, sp);
    const progress =
      sp > threshold ? Math.min(maximum, expansion) : 0;
    const changed = Math.abs(progress - state.progress) > 1e-4;

    state = { progress, maximum, phone: phoneMode };
    if (changed) {
      redrawUntil = performance.now() + 400;
    }

    updateInkState(progress, maximum);
    if (!phoneMode && context) queueFrame();
  }

  function resizeCanvas() {
    if (!context || phoneMode || staticMode) return;

    const bounds = stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    const width = Math.max(1, Math.round(bounds.width * dpr));
    const height = Math.max(1, Math.round(bounds.height * dpr));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      hasCleared = true;
    }
  }

  function updateMode() {
    const nextStaticMode = reducedMotionQuery.matches;
    const nextPhoneMode = isPhone();
    const modeChanged =
      nextStaticMode !== staticMode || nextPhoneMode !== phoneMode;

    staticMode = nextStaticMode;
    phoneMode = nextPhoneMode;
    section.classList.toggle("is-static", staticMode);
    section.classList.toggle("is-phone", phoneMode);
    section.classList.toggle("is-css-fallback", phoneMode || canvasFailed);

    if (modeChanged && initialized) {
      if (staticMode) {
        if (frameId) window.cancelAnimationFrame(frameId);
        frameId = 0;
        section.style.setProperty("--ink-background-y", "0px");
        geometry = null;
        state = { progress: 0, maximum: 1 };
        updateInkState(0, 1);
        if (context) {
          context.clearRect(0, 0, canvas.width, canvas.height);
          hasCleared = true;
        }
      } else {
        viewportHeight = readViewportHeight();
        geometry = measureGeometry();
        if (!phoneMode && !context && !canvasFailed) {
          context = canvas.getContext("2d", { alpha: true });
          if (!context) canvasFailed = true;
        }
        section.classList.toggle("is-css-fallback", phoneMode || canvasFailed);
        resizeCanvas();
        updateProgress();
      }
    }
  }

  function onResize() {
    viewportHeight = readViewportHeight();
    if (!initialized || staticMode) return;

    try {
      const nextPhoneMode = isPhone();
      phoneMode = nextPhoneMode;
      section.classList.toggle("is-phone", phoneMode);
      geometry = measureGeometry();
      if (!phoneMode && !context && !canvasFailed) {
        context = canvas.getContext("2d", { alpha: true });
        if (!context) canvasFailed = true;
      }
      section.classList.toggle("is-css-fallback", phoneMode || canvasFailed);
      resizeCanvas();
      updateProgress();
    } catch (error) {
      showUnavailable(error);
    }
  }

  function showUnavailable(error) {
    section.classList.add("is-unavailable");
    setStatus(getLocalizedMessage("animation.unavailable", "The scene is temporarily unavailable."));
    console.error("The scroll-driven scene could not be initialized.", error);
  }

  async function prepareScene() {
    if (initialized || destroyed) return;

    setStatus(getLocalizedMessage("animation.preparing", "Preparing the scene…"));
    try {
      await Promise.all([
        document.fonts ? document.fonts.ready : Promise.resolve(),
        image.decode(),
      ]);
      if (destroyed) return;

      viewportHeight = readViewportHeight();
      staticMode = reducedMotionQuery.matches;
      phoneMode = isPhone();
      section.classList.toggle("is-static", staticMode);
      section.classList.toggle("is-phone", phoneMode);

      if (staticMode) {
        geometry = null;
      } else {
        geometry = measureGeometry();
      }

      if (!phoneMode && !staticMode) {
        context = canvas.getContext("2d", { alpha: true });
        if (!context) canvasFailed = true;
      }

      section.classList.toggle("is-css-fallback", phoneMode || canvasFailed);
      resizeCanvas();
      initialized = true;
      setStatus("");
      updateProgress();
    } catch (error) {
      showUnavailable(error);
    }
  }

  function onVisibilityChange() {
    if (document.hidden) {
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = 0;
      lastFrameTime = 0;
    } else if (state.progress > 0.001) {
      redrawUntil = performance.now() + 400;
      queueFrame();
    }
  }

  function onContextLost(event) {
    event.preventDefault();
    if (context) context.clearRect(0, 0, canvas.width, canvas.height);
    context = null;
    canvasFailed = true;
    section.classList.add("is-css-fallback");
    updateInkState(state.progress, state.maximum);
  }

  function onReducedMotionChange() {
    updateMode();
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    if (frameId) window.cancelAnimationFrame(frameId);
    frameId = 0;
    if (intersectionObserver) intersectionObserver.disconnect();
    window.removeEventListener("scroll", updateProgress);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("orientationchange", onResize);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    canvas.removeEventListener("contextlost", onContextLost);
    reducedMotionQuery.removeEventListener?.("change", onReducedMotionChange);
    coarsePointerQuery.removeEventListener?.("change", onResize);
    if (context) context.clearRect(0, 0, canvas.width, canvas.height);
    canvas.width = 0;
    canvas.height = 0;
    viewportProbe.remove();
  }

  section.classList.toggle("is-static", staticMode);
  section.classList.toggle("is-css-fallback", phoneMode);
  window.addEventListener("scroll", updateProgress, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });
  window.addEventListener("orientationchange", onResize, { passive: true });
  document.addEventListener("visibilitychange", onVisibilityChange);
  canvas.addEventListener("contextlost", onContextLost);
  reducedMotionQuery.addEventListener?.("change", onReducedMotionChange);
  coarsePointerQuery.addEventListener?.("change", onResize);
  window.addEventListener("pagehide", destroy, { once: true });

  if ("IntersectionObserver" in window) {
    intersectionObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) prepareScene();
      },
      { rootMargin: "100% 0px" },
    );
    intersectionObserver.observe(section);
  } else {
    prepareScene();
  }
})();
