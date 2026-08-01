/* WebGL proof-graph for the landing: the decision APP-1042 as an ink diagram on paper.
   Flat unlit materials on purpose — the register is an archival technical drawing,
   not a glossy 3D scene. One InstancedMesh for nodes, one LineSegments for edges,
   one Points for the dust field: 3 draw calls plus the strike bars. */

import * as THREE from "three";

const INK = 0x232740;
const INK_FAINT = 0x8b8fa3;
const ACCENT = 0xc23247;
const OK = 0x2e7d5b;

const REASONS = ["C01", "C02", "C03", "C04", "C05"];
const DELETED = [1, 2, 3, 4]; // indices into REASONS: C02..C05

function buildGraph() {
  // Hand-placed archival diagram layout. Reasons on a front row, rules behind,
  // the decision node at the back, evidence atoms scattered as a loose cloud.
  const nodes = [];
  const edges = [];

  const reasonPos = REASONS.map((_, i) => new THREE.Vector3((i - 2) * 1.5, -1.2, 0));
  reasonPos.forEach((p, i) => nodes.push({ p, kind: "reason", r: 0.24 }));

  const rulePos = [
    new THREE.Vector3(-2.2, 0.6, -2.5),
    new THREE.Vector3(0, 0.9, -3.0),
    new THREE.Vector3(2.2, 0.6, -2.5),
  ];
  rulePos.forEach((p) => nodes.push({ p, kind: "rule", r: 0.15 }));

  const decisionPos = new THREE.Vector3(0, 2.2, -5.5);
  nodes.push({ p: decisionPos, kind: "decision", r: 0.32 });

  // evidence atoms: deterministic pseudo-random cloud (no Math.random — stable layout)
  const atoms = [];
  for (let i = 0; i < 36; i++) {
    const a = i * 2.39996; // golden angle
    const rad = 3.5 + ((i * 7919) % 40) / 10;
    const p = new THREE.Vector3(
      Math.cos(a) * rad,
      -2.5 + ((i * 104729) % 50) / 10,
      -1.5 - ((i * 15485863) % 60) / 10
    );
    atoms.push(p);
    nodes.push({ p, kind: "atom", r: 0.07 + ((i * 31) % 3) * 0.02 });
  }

  // edges: atoms -> their reason, reasons -> rules, rules -> decision
  atoms.forEach((p, i) => edges.push([p, reasonPos[i % 5]]));
  reasonPos.forEach((p, i) => edges.push([p, rulePos[i % 3]]));
  rulePos.forEach((p) => edges.push([p, decisionPos]));

  return { nodes, edges, reasonPos };
}

export function createGraphScene(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
    stencil: false,
  });
  const isMobile = matchMedia("(max-width: 700px)").matches;
  renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.5 : 2));
  renderer.setSize(innerWidth, innerHeight);

  const scene = new THREE.Scene();
  const wide = innerWidth > 900;
  scene.position.x = wide ? 1.9 : 0;
  scene.position.y = innerWidth <= 700 ? -2.2 : 0;
  const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 100);
  camera.position.set(0, 0.3, 8);

  const { nodes, edges, reasonPos } = buildGraph();

  // nodes as one InstancedMesh
  const sphere = new THREE.IcosahedronGeometry(1, 1);
  const nodeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const mesh = new THREE.InstancedMesh(sphere, nodeMat, nodes.length);
  const m = new THREE.Matrix4();
  const reasonBaseColor = new THREE.Color(INK);
  nodes.forEach((n, i) => {
    m.makeScale(n.r, n.r, n.r);
    m.setPosition(n.p);
    mesh.setMatrixAt(i, m);
    const c =
      n.kind === "reason"
        ? reasonBaseColor
        : n.kind === "decision"
          ? new THREE.Color(INK)
          : new THREE.Color(INK_FAINT);
    mesh.setColorAt(i, c);
  });
  scene.add(mesh);

  // edges as one LineSegments
  const linePos = new Float32Array(edges.length * 6);
  edges.forEach(([a, b], i) => {
    linePos.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
  });
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute("position", new THREE.BufferAttribute(linePos, 3));
  const lines = new THREE.LineSegments(
    lineGeo,
    new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.45 })
  );
  scene.add(lines);

  // dust field
  const dustCount = isMobile ? 250 : 600;
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    const a = i * 2.39996;
    const rad = 4 + ((i * 7919) % 90) / 10;
    dustPos.set(
      [Math.cos(a) * rad, -4 + ((i * 104729) % 80) / 10, 2 - ((i * 15485863) % 140) / 10],
      i * 3
    );
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({ color: INK_FAINT, size: 0.05, transparent: true, opacity: 0.6 })
  );
  scene.add(dust);

  // strike bars over the deleted reasons (scale.x driven by scroll)
  const strikes = DELETED.map((ri) => {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 0.07, 0.07),
      new THREE.MeshBasicMaterial({ color: ACCENT })
    );
    bar.position.copy(reasonPos[ri]);
    bar.scale.x = 0.0001;
    scene.add(bar);
    return bar;
  });

  // ---- state: one value per source, applied once per frame -----------------
  const state = {
    // camera targets per beat; main.js drives these from ScrollTrigger progress
    camPos: new THREE.Vector3(0, 0.3, 8),
    lookAt: new THREE.Vector3(0, 0, -1),
    deletion: 0, // 0..1 scrub of §2
    dim: 0,      // 0..1 fade of the whole graph (later beats)
    intro: 0,    // 0..1 on load
  };

  const curPos = camera.position.clone();
  const curLook = state.lookAt.clone();
  const clock = new THREE.Clock();
  let running = true;
  let raf = 0;

  const accent = new THREE.Color(ACCENT);
  const ok = new THREE.Color(OK);
  const tmp = new THREE.Color();

  function applyDeletion(t) {
    // C01 goes green at the start; C02..C05 turn red and get struck in sequence
    mesh.setColorAt(0, tmp.copy(reasonBaseColor).lerp(ok, Math.min(1, t * 3)));
    DELETED.forEach((ri, k) => {
      const local = THREE.MathUtils.clamp((t - 0.25 - k * 0.14) / 0.12, 0, 1);
      mesh.setColorAt(ri, tmp.copy(reasonBaseColor).lerp(accent, local));
      strikes[k].scale.x = Math.max(0.0001, local * 1.0);
    });
    mesh.instanceColor.needsUpdate = true;
  }

  function frame() {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 1 / 30);
    const k = 1 - Math.pow(0.001, dt); // frame-rate independent lerp

    state.intro = Math.min(1, state.intro + dt * 0.5);
    curPos.lerp(state.camPos, k);
    curLook.lerp(state.lookAt, k);
    camera.position.copy(curPos);
    // gentle drift so the diagram breathes (<=2% amplitude)
    camera.position.y += Math.sin(clock.elapsedTime * 0.4) * 0.05;
    camera.lookAt(curLook);

    dust.rotation.y += dt * 0.01;
    applyDeletion(state.deletion);

    const fade = 1 - state.dim * 0.85;
    lines.material.opacity = 0.45 * fade * state.intro;
    dust.material.opacity = 0.6 * fade * state.intro;
    mesh.material.transparent = true;
    mesh.material.opacity = fade * state.intro;
    strikes.forEach((b) => (b.material.transparent = true, (b.material.opacity = fade)));

    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }

  function resize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  }
  addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
    if (running) {
      clock.getDelta();
      raf = requestAnimationFrame(frame);
    } else {
      cancelAnimationFrame(raf);
    }
  });

  // warm up shaders, then go
  renderer.compile(scene, camera);
  raf = requestAnimationFrame(frame);

  return {
    state,
    renderOnce() {
      state.intro = 1;
      applyDeletion(state.deletion);
      renderer.render(scene, camera);
    },
    dispose() {
      cancelAnimationFrame(raf);
      removeEventListener("resize", resize);
      renderer.dispose();
    },
  };
}
