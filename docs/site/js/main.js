/* Landing spine: one GSAP ticker drives Lenis, ScrollTrigger and the WebGL graph.
   Beats write camera targets into the shared graph state; §2 scrubs the deletion
   and the DOM strikes from a single progress value. Reduced motion and no-WebGL
   degrade to a static, complete page. */

import Lenis from "lenis";
import { createGraphScene } from "./graph-scene.js";

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const isNarrow = matchMedia("(max-width: 700px)").matches;
const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;

if (gsap && ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

/* ---- WebGL graph --------------------------------------------------------- */

let graph = null;
const canvas = document.getElementById("gl");
const webglOk = (() => {
  if (reduced) return false;
  try {
    const test = document.createElement("canvas");
    return !!(test.getContext("webgl2") || test.getContext("webgl"));
  } catch {
    return false;
  }
})();

if (webglOk && gsap) {
  try {
    graph = createGraphScene(canvas);
  } catch {
    graph = null;
  }
}
if (!graph) {
  canvas.style.display = "none";
} else {
  window.__reasonsmith = graph.state; // debug/audit handle
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    graph.dispose();
    canvas.style.display = "none";
  });
}

/* ---- scroll spine ---------------------------------------------------------- */

let lenis = null;
if (!reduced && gsap) {
  lenis = new Lenis({ autoRaf: false, duration: 1.1, smoothWheel: true, syncTouch: false });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  document.fonts.ready.then(() => ScrollTrigger.refresh());
}

/* ---- progress rail ---------------------------------------------------------- */

const railFill = document.getElementById("rail-fill");
if (railFill && gsap && ScrollTrigger) {
  ScrollTrigger.create({
    start: 0,
    end: () => document.documentElement.scrollHeight - innerHeight,
    onUpdate: (self) => {
      railFill.style.transform = `scaleY(${self.progress})`;
    },
  });
}

/* ---- reveals ------------------------------------------------------------------ */

const revealEls = document.querySelectorAll(
  ".beat-inner, .abstract, .panel, .colophon-grid > div"
);
if (!reduced && "IntersectionObserver" in window) {
  document.documentElement.classList.add("will-reveal");
  revealEls.forEach((el) => el.classList.add("reveal"));
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add("in");
        io.unobserve(en.target);
      });
    },
    { rootMargin: "0px 0px -10% 0px" }
  );
  revealEls.forEach((el, i) => {
    el.style.transitionDelay = (i % 4) * 60 + "ms";
    io.observe(el);
  });
}

/* ---- §2 the deletion: pinned scrub ---------------------------------------------- */

const deletedRows = document.querySelectorAll("#reason-audit .ra-deleted");

if (!reduced && gsap && ScrollTrigger) {
  ScrollTrigger.create({
    trigger: "#deletion",
    start: "top top",
    end: "+=250%",
    pin: true,
    scrub: 0.6,
    onUpdate: (self) => {
      const t = self.progress;
      if (graph) {
        // camera closes in on the reason row as the deletion proceeds
        const ct = Math.min(1, t * 1.6);
        graph.state.camPos.set(2.2 - 2.4 * ct, 0.2 - 1.1 * ct, 5.5 - 2.6 * ct);
        graph.state.lookAt.set(0, -1.1, 0);
        graph.state.deletion = t;
        graph.state.dim = 0;
      }
      deletedRows.forEach((li, i) => {
        const local = Math.min(1, Math.max(0, (t - 0.25 - i * 0.14) / 0.12));
        li.style.setProperty("--strike", local.toFixed(3));
      });
    },
  });
} else {
  // reduced motion / no spine: strikes are already static via CSS
  if (graph) graph.state.deletion = 1;
}

/* ---- §3 horizontal scrub (desktop only) -------------------------------------------- */

const track = document.getElementById("track");
if (!reduced && !isNarrow && gsap && ScrollTrigger && track) {
  track.closest(".track-wrap").classList.add("is-pinned");
  gsap.to(track, {
    x: () => -(track.scrollWidth - innerWidth),
    ease: "none",
    scrollTrigger: {
      trigger: "#regulations",
      start: "top top",
      end: () => "+=" + (track.scrollWidth - innerWidth),
      pin: true,
      scrub: 0.5,
      invalidateOnRefresh: true,
    },
  });
}

/* ---- camera beats -------------------------------------------------------------- */

if (graph && ScrollTrigger) {
  const V = (x, y, z) => ({ x, y, z });
  const beats = [
    { sel: "#case", pos: V(4.5, 1.4, 6.5), look: V(0, 0.4, -1.5) },
    { sel: "#regulations", pos: V(-5.5, 2.4, 10), look: V(0, 1, -3), dim: 0.5 },
    { sel: "#lattice", pos: V(0, 3.2, 15), look: V(0, 0.8, -3), dim: 0.75 },
    { sel: ".colophon", pos: V(0, 3.2, 15), look: V(0, 0.8, -3), dim: 1 },
  ];
  beats.forEach((b) => {
    ScrollTrigger.create({
      trigger: b.sel,
      start: "top 60%",
      end: "bottom 40%",
      onEnter: () => applyBeat(b),
      onEnterBack: () => applyBeat(b),
    });
  });
  function applyBeat(b) {
    graph.state.camPos.set(b.pos.x, b.pos.y, b.pos.z);
    graph.state.lookAt.set(b.look.x, b.look.y, b.look.z);
    if (b.dim !== undefined) graph.state.dim = b.dim;
  }
  // hero is the default pose; scrolling back up restores it
  ScrollTrigger.create({
    trigger: ".hero",
    start: "top 60%",
    onEnterBack: () => {
      graph.state.camPos.set(0, 0.3, 8);
      graph.state.lookAt.set(0, 0, -1);
      graph.state.dim = 0;
    },
  });
}


// Pin spacers shift every trigger created before them: recompute once everything
// exists (and again when all resources settle) so the camera beats fire where
// the sections actually are.
if (gsap && ScrollTrigger) {
  ScrollTrigger.refresh();
  addEventListener("load", () => ScrollTrigger.refresh());
}
