const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const navToggle = document.querySelector(".nav-toggle");
const primaryNavigation = document.querySelector("#navegacion-principal");
const parallaxElements = document.querySelectorAll("[data-parallax]");
const revealElements = document.querySelectorAll("[data-reveal]");
const protectedContactLinks = document.querySelectorAll("[data-protected-contact]");
const serviceTerms = document.querySelector("[data-service-terms]");
const whatsappTermsNotice = document.querySelector("[data-whatsapp-terms-notice]");
const protectedContacts = {
  email: "bHVjaWFubG9wZXo0OUBnbWFpbC5jb20=",
  whatsapp: "NTM1ODUzMTA5MQ==",
};

document.body.classList.add("js-enabled");

window.openProtectedWhatsApp = (message = "") => {
  const phone = window.atob(protectedContacts.whatsapp);
  const destination = new URL(`https://wa.me/${phone}`);
  if (message) destination.searchParams.set("text", message);
  return window.open(destination.href, "_blank", "noopener,noreferrer");
};

protectedContactLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    const contactType = link.dataset.protectedContact;
    if (contactType !== "email" && contactType !== "whatsapp") return;

    if (contactType === "whatsapp" && serviceTerms && !serviceTerms.checked) {
      event.preventDefault();
      if (whatsappTermsNotice) whatsappTermsNotice.hidden = false;
      serviceTerms.focus();
      return;
    }

    if (contactType === "whatsapp" && whatsappTermsNotice) {
      whatsappTermsNotice.hidden = true;
    }

    if (contactType === "email") {
      link.href = `mailto:${window.atob(protectedContacts.email)}`;
      return;
    }

    event.preventDefault();
    window.openProtectedWhatsApp();
  });
});

serviceTerms?.addEventListener("change", () => {
  if (serviceTerms.checked && whatsappTermsNotice) whatsappTermsNotice.hidden = true;
});

function closeNavigation() {
  if (!navToggle || !primaryNavigation) return;

  navToggle.setAttribute("aria-expanded", "false");
  primaryNavigation.classList.remove("is-open");
}

if (navToggle && primaryNavigation) {
  navToggle.addEventListener("click", () => {
    const isExpanded = navToggle.getAttribute("aria-expanded") === "true";
    navToggle.setAttribute("aria-expanded", String(!isExpanded));
    primaryNavigation.classList.toggle("is-open", !isExpanded);
  });

  primaryNavigation.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("a")) {
      closeNavigation();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeNavigation();
  });
}

if (reducedMotion.matches || !("IntersectionObserver" in window)) {
  revealElements.forEach((element) => element.classList.add("is-visible"));
} else {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -24px 0px" },
  );

  revealElements.forEach((element) => revealObserver.observe(element));
}

const parallaxItems = Array.from(parallaxElements, (element) => {
  const depth = Number(element.dataset.parallaxDepth);
  const limit = Number(element.dataset.parallaxLimit);

  return {
    element,
    depth: Number.isFinite(depth) ? depth : 0.18,
    limit: Number.isFinite(limit) && limit > 0 ? limit : 72,
    centerY: 0,
  };
});

let parallaxFrame = 0;

function measureParallaxOrigins() {
  parallaxItems.forEach((item) => {
    const bounds = item.element.getBoundingClientRect();
    const currentOffset =
      Number.parseFloat(item.element.style.getPropertyValue("--parallax-y")) || 0;

    item.centerY =
      bounds.top + window.scrollY + bounds.height / 2 - currentOffset;
  });
}

function updateParallax() {
  parallaxFrame = 0;
  if (reducedMotion.matches) return;

  const centerY = window.innerHeight / 2;
  parallaxItems.forEach((item) => {
    const distance = window.scrollY - (item.centerY - centerY);
    const offset = Math.max(
      -item.limit,
      Math.min(item.limit, distance * item.depth),
    );

    item.element.style.setProperty("--parallax-y", `${offset.toFixed(2)}px`);
  });
}

function scheduleParallaxUpdate() {
  if (!parallaxFrame && !reducedMotion.matches) {
    parallaxFrame = window.requestAnimationFrame(updateParallax);
  }
}

function handleReducedMotionChange(event) {
  if (event.matches) {
    if (parallaxFrame) window.cancelAnimationFrame(parallaxFrame);
    parallaxFrame = 0;
    parallaxItems.forEach((item) =>
      item.element.style.removeProperty("--parallax-y"),
    );
    revealElements.forEach((element) => element.classList.add("is-visible"));
    return;
  }

  measureParallaxOrigins();
  scheduleParallaxUpdate();
}

if (parallaxItems.length > 0) {
  measureParallaxOrigins();
  scheduleParallaxUpdate();
  window.addEventListener("scroll", scheduleParallaxUpdate, { passive: true });
  window.addEventListener("resize", measureParallaxOrigins, { passive: true });
  window.addEventListener("resize", scheduleParallaxUpdate, { passive: true });
  window.addEventListener("orientationchange", measureParallaxOrigins, {
    passive: true,
  });
  window.addEventListener("orientationchange", scheduleParallaxUpdate, {
    passive: true,
  });
}

reducedMotion.addEventListener?.("change", handleReducedMotionChange);
