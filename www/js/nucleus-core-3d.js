import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const CORE_RADIUS = 1.55;

const LOBES = [
  { phi: 0.85, theta: 0.55, amp: 0.48, spread: 0.34 },
  { phi: 1.38, theta: 2.05, amp: 0.4, spread: 0.3 },
  { phi: 0.42, theta: 3.75, amp: 0.44, spread: 0.28 },
  { phi: 1.62, theta: 4.95, amp: 0.36, spread: 0.26 },
  { phi: 0.18, theta: 1.45, amp: 0.32, spread: 0.32 },
  { phi: 1.05, theta: 5.4, amp: 0.28, spread: 0.24 }
];

let scene = null;
let camera = null;
let renderer = null;
let labelRenderer = null;
let controls = null;
let coreGroup = null;
let pulseMesh = null;
let animId = 0;
let clock = null;
let mountEl = null;
let mounted = false;
let paused = true;
let activityLevel = 0.5;
let resizeObserver = null;

let fabScene = null;
let fabCamera = null;
let fabRenderer = null;
let fabGroup = null;
let fabAnimId = 0;
let fabClock = null;
let fabMounted = false;
let fabPaused = false;

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function irregularRadius(phi, theta, baseR) {
  const wave =
    Math.sin(phi * 5.4) * Math.cos(theta * 3.9) * 0.2 +
    Math.sin(theta * 6.8 + phi * 1.4) * 0.13 +
    Math.cos(phi * 3.1 - theta * 4.6) * 0.1 +
    Math.sin(phi * 11 + theta * 7) * 0.05;

  let lobe = 0;
  LOBES.forEach(l => {
    const dp = phi - l.phi;
    const dt = wrapAngle(theta - l.theta);
    const d2 = dp * dp + dt * dt;
    lobe += l.amp * Math.exp(-d2 / (l.spread * l.spread));
  });

  const squashY = 0.86 + 0.18 * Math.max(0, Math.cos(phi - 0.4));
  const bulgeX = 1 + 0.12 * Math.sin(theta * 2.3 + 0.8);
  return baseR * squashY * bulgeX * (1 + wave + lobe);
}

function spherePointIrregular(phi, theta, radiusScale = 1) {
  const r = irregularRadius(phi, theta, CORE_RADIUS * radiusScale);
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}

function spherePoint(phi, theta, r) {
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}

function irregularPointCloud(count, radiusScale, jitter = 0.06) {
  const pts = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i += 1) {
    const t = i / Math.max(1, count - 1);
    const phi = Math.acos(1 - t * 2);
    const theta = golden * i;
    const p = spherePointIrregular(phi, theta, radiusScale);
    p.x += (Math.random() - 0.5) * jitter;
    p.y += (Math.random() - 0.5) * jitter;
    p.z += (Math.random() - 0.5) * jitter;
    pts.push(p);
  }
  return pts;
}

function addLobeSpurs(points, baseR) {
  LOBES.forEach(l => {
    const tip = spherePointIrregular(l.phi, l.theta, (1 + l.amp * 0.85) * baseR / CORE_RADIUS);
    for (let k = 0; k < 28; k += 1) {
      const u = Math.random();
      const v = Math.random();
      const th = 2 * Math.PI * u;
      const ph = Math.acos(2 * v - 1);
      const spurR = 0.08 + Math.random() * 0.14;
      points.push(new THREE.Vector3(
        tip.x + spurR * Math.sin(ph) * Math.cos(th),
        tip.y + spurR * Math.sin(ph) * Math.sin(th),
        tip.z + spurR * Math.cos(ph)
      ));
    }
  });
}

function lineMat(opacity, color = 0xffffff) {
  return new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
}

function connectNearby(points, maxDist, maxPerPoint) {
  const positions = [];
  for (let i = 0; i < points.length; i += 1) {
    const dists = [];
    for (let j = 0; j < points.length; j += 1) {
      if (i === j) continue;
      const d = points[i].distanceTo(points[j]);
      if (d <= maxDist) dists.push({ j, d });
    }
    dists.sort((a, b) => a.d - b.d);
    const links = Math.min(maxPerPoint, dists.length);
    for (let k = 0; k < links; k += 1) {
      const j = dists[k].j;
      if (j > i) {
        positions.push(
          points[i].x, points[i].y, points[i].z,
          points[j].x, points[j].y, points[j].z
        );
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geo;
}

function buildIrregularRing(scale, rotX, rotY, rotZ, opacity, rx = 1, ry = 0.82) {
  const pts = [];
  for (let i = 0; i <= 64; i += 1) {
    const a = (i / 64) * Math.PI * 2;
    const wobble = 1 + Math.sin(a * 5 + rotZ * 3) * 0.08;
    pts.push(new THREE.Vector3(
      Math.cos(a) * scale * rx * wobble,
      0,
      Math.sin(a) * scale * ry * wobble
    ));
  }
  const ring = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(pts),
    lineMat(opacity)
  );
  ring.rotation.set(rotX, rotY, rotZ);
  return ring;
}

function buildHologramCore(options = {}) {
  const detail = options.detail || 'full';
  const withSatellites = options.satellites !== false;
  const root = new THREE.Group();

  const shellN = detail === 'fab' ? 420 : 1200;
  const midN = detail === 'fab' ? 220 : 620;
  const coreN = detail === 'fab' ? 100 : 280;

  const shellPts = irregularPointCloud(shellN, 1, detail === 'fab' ? 0.04 : 0.06);
  const midPts = irregularPointCloud(midN, 0.74, 0.05);
  const corePts = irregularPointCloud(coreN, 0.36, 0.03);
  if (detail !== 'fab') addLobeSpurs(shellPts, 1);

  const shellGeo = connectNearby(shellPts, detail === 'fab' ? 0.26 : 0.24, 3);
  const midGeo = connectNearby(midPts, 0.2, 3);
  const coreGeo = connectNearby(corePts, 0.16, 4);

  root.add(new THREE.LineSegments(shellGeo, lineMat(detail === 'fab' ? 0.16 : 0.11)));
  root.add(new THREE.LineSegments(shellGeo.clone(), lineMat(0.05)));
  root.add(new THREE.LineSegments(midGeo, lineMat(0.2)));
  root.add(new THREE.LineSegments(coreGeo, lineMat(0.34)));

  const allPts = shellPts.concat(midPts, corePts);
  root.add(new THREE.Points(
    new THREE.BufferGeometry().setFromPoints(allPts),
    new THREE.PointsMaterial({
      color: 0xffffff,
      size: detail === 'fab' ? 0.055 : 0.028,
      transparent: true,
      opacity: 0.58,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true
    })
  ));

  root.add(new THREE.Points(
    new THREE.BufferGeometry().setFromPoints(corePts),
    new THREE.PointsMaterial({
      color: 0xffffff,
      size: detail === 'fab' ? 0.07 : 0.045,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true
    })
  ));

  const ringCount = detail === 'fab' ? 5 : 11;
  for (let i = 0; i < ringCount; i += 1) {
    const t = i / ringCount;
    root.add(buildIrregularRing(
      CORE_RADIUS * (0.5 + t * 0.58),
      t * 1.1 + 0.15,
      t * 1.55 + 0.3,
      t * 2.2,
      0.07 + (1 - t) * 0.14,
      0.92 + Math.sin(t * 4) * 0.12,
      0.78 + Math.cos(t * 3) * 0.1
    ));
  }

  if (detail !== 'fab') {
    for (let i = 0; i < 14; i += 1) {
      const theta = (i / 14) * Math.PI * 2 + 0.2;
      const arc = [];
      for (let s = 0; s <= 28; s += 1) {
        const phi = (s / 28) * Math.PI;
        arc.push(spherePointIrregular(phi, theta, 1.04));
      }
      root.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(arc),
        lineMat(0.06)
      ));
    }
  }

  const pulse = new THREE.Mesh(
    new THREE.SphereGeometry(CORE_RADIUS * 0.2, 16, 16),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.1,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  root.add(pulse);
  root.userData.pulseMesh = pulse;

  root.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(CORE_RADIUS * 0.26, 1)),
    lineMat(0.4)
  ));

  if (withSatellites && typeof NUCLEUS_SATELLITES !== 'undefined') {
    NUCLEUS_SATELLITES.forEach(sat => {
      const pos = spherePointIrregular(sat.phi, sat.theta, 1.08);
      root.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, 0),
          pos.clone().multiplyScalar(0.88)
        ]),
        lineMat(0.13)
      ));

      const anchor = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 8, 8),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.72,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      anchor.position.copy(pos);
      root.add(anchor);

      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'nucleus-satellite-label';
      el.setAttribute('aria-label', `${sat.label} — ${sat.sub}`);
      el.onclick = (e) => {
        e.stopPropagation();
        executeNucleusSatelliteAction(sat.action);
      };
      const label = new CSS2DObject(el);
      label.position.copy(pos.clone().multiplyScalar(1.12));
      root.add(label);
    });
  }

  return root;
}

function animateHub() {
  if (paused || !renderer) return;
  animId = requestAnimationFrame(animateHub);
  const t = clock.getElapsedTime();
  if (coreGroup) {
    coreGroup.rotation.y = t * 0.07;
    coreGroup.rotation.x = Math.sin(t * 0.14) * 0.08;
    coreGroup.rotation.z = Math.sin(t * 0.09) * 0.03;
  }
  if (pulseMesh) {
    const pulse = 1 + Math.sin(t * 1.7) * 0.1 * (0.5 + activityLevel);
    pulseMesh.scale.setScalar(pulse);
    pulseMesh.material.opacity = 0.07 + activityLevel * 0.14 + Math.sin(t * 2.1) * 0.05;
  }
  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}

function animateFab() {
  if (fabPaused || !fabRenderer) return;
  fabAnimId = requestAnimationFrame(animateFab);
  const t = fabClock.getElapsedTime();
  if (fabGroup) {
    fabGroup.rotation.y = t * 0.35;
    fabGroup.rotation.x = Math.sin(t * 0.55) * 0.18;
    fabGroup.rotation.z = Math.cos(t * 0.4) * 0.08;
    const pulse = fabGroup.userData.pulseMesh;
    if (pulse) {
      pulse.scale.setScalar(1 + Math.sin(t * 2.4) * 0.12);
      pulse.material.opacity = 0.08 + Math.sin(t * 2.8) * 0.05;
    }
  }
  fabRenderer.render(fabScene, fabCamera);
}

function resizeCoreView() {
  if (!mountEl || !camera || !renderer || !labelRenderer) return;
  const w = mountEl.clientWidth;
  const h = mountEl.clientHeight;
  if (w < 1 || h < 1) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  labelRenderer.setSize(w, h);
}

function fitCoreCameraToGroup(padding = 1.28) {
  if (!camera || !coreGroup || !controls || !mountEl) return;

  const box = new THREE.Box3().setFromObject(coreGroup);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const center = sphere.center.clone();
  const radius = Math.max(sphere.radius, CORE_RADIUS * 0.85);

  controls.target.copy(center);

  const aspect = mountEl.clientWidth / Math.max(1, mountEl.clientHeight);
  const vFov = (camera.fov * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
  const distV = radius / Math.sin(vFov / 2);
  const distH = radius / Math.sin(hFov / 2);
  const distance = Math.max(distV, distH) * padding;

  const dir = new THREE.Vector3(0.14, 0.1, 1).normalize();
  camera.position.copy(center).add(dir.multiplyScalar(distance));
  camera.near = 0.1;
  camera.far = Math.max(50, distance * 4);
  camera.updateProjectionMatrix();
  camera.lookAt(center);

  controls.minDistance = radius * 0.45;
  controls.maxDistance = distance * 2.4;
  controls.update();
}

window.resetNucleusCoreCamera = fitCoreCameraToGroup;

function resizeFabView() {
  const canvas = document.getElementById('nucleus-fab-canvas');
  if (!canvas || !fabCamera || !fabRenderer) return;
  const size = canvas.clientWidth || 44;
  fabCamera.aspect = 1;
  fabCamera.updateProjectionMatrix();
  fabRenderer.setSize(size, size, false);
}

window.setNucleusCoreActivity = function setNucleusCoreActivity(level) {
  activityLevel = Math.min(1, Math.max(0.15, level || 0.5));
};

window.mountNucleusFabPreview = function mountNucleusFabPreview() {
  const canvas = document.getElementById('nucleus-fab-canvas');
  if (!canvas || fabMounted) return;

  fabScene = new THREE.Scene();
  fabClock = new THREE.Clock();
  fabCamera = new THREE.PerspectiveCamera(42, 1, 0.1, 20);
  fabCamera.position.set(0.15, 0.12, 3.2);

  fabRenderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true
  });
  fabRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  fabRenderer.setClearColor(0x000000, 0);

  fabGroup = buildHologramCore({ detail: 'fab', satellites: false });
  fabScene.add(fabGroup);

  fabMounted = true;
  fabPaused = false;
  resizeFabView();
  animateFab();
};

window.pauseNucleusFabPreview = function pauseNucleusFabPreview() {
  fabPaused = true;
  if (fabAnimId) cancelAnimationFrame(fabAnimId);
  fabAnimId = 0;
};

window.resumeNucleusFabPreview = function resumeNucleusFabPreview() {
  if (!fabMounted) {
    window.mountNucleusFabPreview();
    return;
  }
  if (!fabPaused) return;
  fabPaused = false;
  animateFab();
};

window.mountNucleusCore = function mountNucleusCore() {
  mountEl = document.getElementById('nucleus-core-mount');
  if (!mountEl) return;
  if (mounted) {
    resizeCoreView();
    fitCoreCameraToGroup();
    if (controls) controls.enabled = true;
    return;
  }

  scene = new THREE.Scene();
  clock = new THREE.Clock();

  camera = new THREE.PerspectiveCamera(36, 1, 0.1, 50);
  camera.position.set(0, 0, 6);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  mountEl.appendChild(renderer.domElement);

  labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.className = 'nucleus-core-label-layer';
  labelRenderer.domElement.style.pointerEvents = 'none';
  mountEl.appendChild(labelRenderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.85;
  controls.minDistance = 1.2;
  controls.maxDistance = 14;
  controls.update();

  window.setNucleusHubControlsEnabled = function setNucleusHubControlsEnabled(enabled) {
    if (controls) controls.enabled = enabled;
  };

  coreGroup = buildHologramCore({ detail: 'full', satellites: true });
  pulseMesh = coreGroup.userData.pulseMesh;
  scene.add(coreGroup);

  resizeCoreView();
  fitCoreCameraToGroup();
  if (!resizeObserver) resizeObserver = new ResizeObserver(resizeCoreView);
  resizeObserver.observe(mountEl);

  mounted = true;
  paused = false;
  mountEl.style.cursor = 'grab';
  if (controls) controls.enabled = true;
  animateHub();
};

window.unmountNucleusCore = function unmountNucleusCore() {
  paused = true;
  if (animId) cancelAnimationFrame(animId);
  animId = 0;
  if (resizeObserver && mountEl) resizeObserver.unobserve(mountEl);
  if (controls) controls.dispose();
  window.setNucleusHubControlsEnabled = null;
  if (renderer) {
    renderer.dispose();
    renderer.domElement.remove();
  }
  if (labelRenderer) labelRenderer.domElement.remove();
  if (coreGroup) {
    coreGroup.traverse(disposeObject);
  }
  scene = null;
  camera = null;
  renderer = null;
  labelRenderer = null;
  controls = null;
  coreGroup = null;
  pulseMesh = null;
  mounted = false;
  mountEl = null;
};

function disposeObject(obj) {
  if (obj.geometry) obj.geometry.dispose();
  if (obj.material) {
    if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
    else obj.material.dispose();
  }
}

window.pauseNucleusCore = function pauseNucleusCore() {
  paused = true;
  if (animId) cancelAnimationFrame(animId);
  animId = 0;
};

window.resumeNucleusCore = function resumeNucleusCore() {
  if (!mounted) {
    window.mountNucleusCore();
    return;
  }
  if (!paused) return;
  paused = false;
  animateHub();
};

window.resizeNucleusCore = resizeCoreView;
window.resizeNucleusFabPreview = resizeFabView;

if (document.getElementById('nucleus-fab-canvas')) {
  requestAnimationFrame(() => window.mountNucleusFabPreview());
}
