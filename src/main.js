import * as THREE from "three";
import "./styles.css";
import { journeyConfig } from "./config.js";

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const smooth = (edge0, edge1, value) => {
  const x = clamp((value - edge0) / (edge1 - edge0));
  return x * x * (3 - 2 * x);
};
const ease = (value) => 1 - Math.pow(1 - clamp(value), 3);

const canvas = document.querySelector("#globe");
const scrollTrack = document.querySelector(".scroll-track");
const photoReveal = document.querySelector(".photo-reveal");
const photoImage = document.querySelector(".photo-image");
const photoNumber = document.querySelector(".photo-number");
const photoTitle = document.querySelector(".photo-title");
const photoWish = document.querySelector(".photo-wish");
const photoCredit = document.querySelector(".photo-credit");
const hudIndex = document.querySelector(".hud-index");
const hudPlace = document.querySelector(".hud-place");
const finale = document.querySelector(".finale");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const isCompact = matchMedia("(max-width: 720px)").matches;

const sections = journeyConfig.stops.map((stop, index) => {
  const section = document.createElement("section");
  section.className = "chapter";
  section.id = stop.id;
  section.dataset.index = String(index);
  section.innerHTML = `
    <div class="chapter-label">
      <span>${String(index + 1).padStart(2, "0")} · ${stop.country}</span>
      <strong>${stop.city}</strong>
    </div>`;
  scrollTrack.appendChild(section);
  return section;
});

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: !isCompact,
  alpha: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(devicePixelRatio, isCompact ? 1.25 : 1.8));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x050915, 0.038);
const camera = new THREE.PerspectiveCamera(isCompact ? 44 : 38, innerWidth / innerHeight, 0.1, 100);
camera.position.set(isCompact ? 0.28 : 0.48, 0, isCompact ? 3.45 : 3.05);

scene.add(new THREE.AmbientLight(0x8fa8ff, 1.15));
const sun = new THREE.DirectionalLight(0xffe4b3, 2.9);
sun.position.set(-2.8, 1.4, 3.5);
scene.add(sun);
const rim = new THREE.DirectionalLight(0x5b8cff, 2.2);
rim.position.set(3, -1, -2);
scene.add(rim);

const world = new THREE.Group();
scene.add(world);

const segments = isCompact ? 48 : 72;
const textureLoader = new THREE.TextureLoader();
const earthTexture = textureLoader.load(`${import.meta.env.BASE_URL}assets/earth-atmos.jpg`);
earthTexture.colorSpace = THREE.SRGBColorSpace;
const earth = new THREE.Mesh(
  new THREE.SphereGeometry(1, segments, segments),
  new THREE.MeshStandardMaterial({
    map: earthTexture,
    color: 0x92bde2,
    roughness: .82,
    metalness: .04,
  }),
);
world.add(earth);

const atmosphere = new THREE.Mesh(
  new THREE.SphereGeometry(1.055, segments, segments),
  new THREE.MeshBasicMaterial({
    color: 0x7da9ff,
    transparent: true,
    opacity: .11,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
  }),
);
world.add(atmosphere);

const glow = new THREE.Mesh(
  new THREE.SphereGeometry(1.02, segments, segments),
  new THREE.MeshBasicMaterial({ color: 0x6092ff, transparent: true, opacity: .035, blending: THREE.AdditiveBlending }),
);
world.add(glow);

const starCount = isCompact ? 520 : 950;
const starPositions = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i += 1) {
  const radius = 5 + Math.random() * 8;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
  starPositions[i * 3 + 1] = radius * Math.cos(phi);
  starPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
}
const starGeometry = new THREE.BufferGeometry();
starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xd9e5ff, size: isCompact ? .018 : .014, transparent: true, opacity: .72, sizeAttenuation: true }));
scene.add(stars);

function latLonVector(lat, lon, radius = 1) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function focusQuaternion(stop) {
  const vector = latLonVector(stop.lat, stop.lon).normalize();
  return new THREE.Quaternion().setFromUnitVectors(vector, new THREE.Vector3(0, 0, 1));
}

function makeGlowTexture(color) {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const context = c.getContext("2d");
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(.16, color);
  gradient.addColorStop(.42, `${color}66`);
  gradient.addColorStop(1, `${color}00`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

const markerMeshes = [];
journeyConfig.stops.forEach((stop, index) => {
  const point = latLonVector(stop.lat, stop.lon, 1.025);
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(.024, 18, 18),
    new THREE.MeshBasicMaterial({ color: stop.color }),
  );
  marker.position.copy(point);
  marker.userData.stopIndex = index;
  world.add(marker);
  markerMeshes.push(marker);

  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture(stop.color),
    color: 0xffffff,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  halo.position.copy(point.clone().multiplyScalar(1.018));
  halo.scale.setScalar(.16);
  world.add(halo);
});

const routeCurves = [];
const routeLines = [];
for (let i = 0; i < journeyConfig.stops.length - 1; i += 1) {
  const from = latLonVector(journeyConfig.stops[i].lat, journeyConfig.stops[i].lon, 1.025);
  const to = latLonVector(journeyConfig.stops[i + 1].lat, journeyConfig.stops[i + 1].lon, 1.025);
  const midpoint = from.clone().add(to).normalize().multiplyScalar(1.22 + from.distanceTo(to) * .11);
  const curve = new THREE.QuadraticBezierCurve3(from, midpoint, to);
  routeCurves.push(curve);
  const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(70));
  const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xffd878, transparent: true, opacity: .26 }));
  world.add(line);
  routeLines.push(line);
}

const traveler = new THREE.Mesh(
  new THREE.SphereGeometry(.022, 18, 18),
  new THREE.MeshBasicMaterial({ color: 0xffe39b }),
);
traveler.add(new THREE.PointLight(0xffd878, .9, .6));
world.add(traveler);
traveler.visible = false;

const focusQuaternions = journeyConfig.stops.map(focusQuaternion);
const overviewQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(-.18, -.45, -.08));
let activeIndex = -1;
let activeProgress = 0;
let journeyStarted = false;
let currentPhoto = -1;
let dragStart = null;
let dragged = false;
const pointer = new THREE.Vector2();
const pointerParallax = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const projected = new THREE.Vector3();
const clock = new THREE.Clock();

function setPhoto(index) {
  if (currentPhoto === index) return;
  currentPhoto = index;
  const stop = journeyConfig.stops[index];
  photoImage.style.backgroundImage = `url("${stop.image}")`;
  photoNumber.textContent = `${String(index + 1).padStart(2, "0")} · ${stop.country}\n${stop.coordinates}`;
  photoTitle.textContent = stop.title;
  photoWish.textContent = stop.wish;
  photoCredit.textContent = stop.credit;
  photoCredit.href = stop.source;
}

function chapterState() {
  const center = scrollY + innerHeight * .52;
  activeIndex = -1;
  activeProgress = 0;
  sections.forEach((section, index) => {
    const progress = (center - section.offsetTop) / section.offsetHeight;
    const near = progress > -.12 && progress < 1.12;
    section.classList.toggle("is-near", near);
    if (progress >= 0 && progress <= 1 && activeIndex === -1) {
      activeIndex = index;
      activeProgress = progress;
    }
  });

  const trackStart = scrollTrack.offsetTop;
  const trackEnd = finale.offsetTop;
  const overall = clamp((center - trackStart) / Math.max(1, trackEnd - trackStart));
  document.documentElement.style.setProperty("--journey-progress", overall.toFixed(4));
  finale.classList.toggle("visible", finale.getBoundingClientRect().top < innerHeight * .72);
}

function updateJourney() {
  chapterState();
  if (!journeyStarted || activeIndex < 0) {
    photoReveal.classList.remove("visible");
    if (journeyStarted && finale.getBoundingClientRect().top < innerHeight) {
      world.quaternion.slerp(overviewQuaternion, .035);
      camera.position.z += ((isCompact ? 3.7 : 3.35) - camera.position.z) * .035;
      traveler.visible = false;
    }
    return;
  }

  const stop = journeyConfig.stops[activeIndex];
  setPhoto(activeIndex);
  hudIndex.textContent = String(activeIndex + 1).padStart(2, "0");
  hudPlace.textContent = `${stop.city} · ${stop.country}`;

  const fromQ = activeIndex === 0 ? overviewQuaternion : focusQuaternions[activeIndex - 1];
  const toQ = focusQuaternions[activeIndex];
  const travel = smooth(.02, .3, activeProgress);
  world.quaternion.slerpQuaternions(fromQ, toQ, travel);

  if (activeIndex > 0 && activeIndex - 1 < routeCurves.length && activeProgress < .34) {
    traveler.visible = true;
    traveler.position.copy(routeCurves[activeIndex - 1].getPoint(travel));
  } else {
    traveler.visible = false;
  }

  routeLines.forEach((line, index) => {
    line.material.opacity = index < activeIndex ? .62 : index === activeIndex ? .4 : .17;
  });

  const revealIn = smooth(.34, .53, activeProgress);
  const revealOut = 1 - smooth(.74, .93, activeProgress);
  const reveal = Math.min(revealIn, revealOut);
  const copyOpacity = Math.min(smooth(.48, .59, activeProgress), 1 - smooth(.72, .84, activeProgress));
  const radius = reducedMotion ? (reveal > .05 ? 150 : 0) : reveal * 150;

  const markerPosition = markerMeshes[activeIndex].getWorldPosition(projected).project(camera);
  const x = clamp((markerPosition.x * .5 + .5) * 100, 8, 92);
  const y = clamp((-markerPosition.y * .5 + .5) * 100, 8, 92);
  document.documentElement.style.setProperty("--photo-x", `${x}%`);
  document.documentElement.style.setProperty("--photo-y", `${y}%`);
  document.documentElement.style.setProperty("--photo-radius", `${radius}%`);
  photoReveal.style.setProperty("--copy-opacity", copyOpacity.toFixed(3));
  photoReveal.classList.toggle("visible", reveal > .001);

  const desiredZ = (isCompact ? 3.45 : 3.05) - smooth(.18, .45, activeProgress) * .46 + smooth(.75, .95, activeProgress) * .46;
  camera.position.z += (desiredZ - camera.position.z) * .08;
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), .04);
  stars.rotation.y += delta * .008;
  stars.rotation.x += delta * .002;
  if (!journeyStarted) world.rotateY(delta * .055);
  markerMeshes.forEach((marker, index) => {
    const pulse = 1 + Math.sin(performance.now() * .0025 + index) * .15;
    marker.scale.setScalar(pulse);
  });
  updateJourney();
  camera.position.x += ((isCompact ? .22 : .46) + pointerParallax.x * .055 - camera.position.x) * .045;
  camera.position.y += (-pointerParallax.y * .035 - camera.position.y) * .045;
  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
}

function beginJourney() {
  journeyStarted = true;
  document.body.classList.remove("locked");
  document.body.classList.add("started");
  document.querySelector(".intro").classList.add("departed");
  setTimeout(() => sections[0].scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" }), 350);
}

document.querySelector(".start").addEventListener("click", beginJourney);
document.querySelector(".replay").addEventListener("click", () => {
  window.scrollTo({ top: sections[0].offsetTop, behavior: reducedMotion ? "auto" : "smooth" });
});
document.querySelector(".next-cue").addEventListener("click", () => {
  const next = sections[Math.min(activeIndex + 1, sections.length - 1)];
  next?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
});

if (journeyConfig.audioSrc) {
  const audio = new Audio(journeyConfig.audioSrc);
  audio.loop = true;
  const sound = document.querySelector(".sound");
  sound.disabled = false;
  sound.lastElementChild.textContent = "音乐关闭";
  sound.addEventListener("click", async () => {
    if (audio.paused) {
      await audio.play();
      sound.lastElementChild.textContent = "音乐开启";
    } else {
      audio.pause();
      sound.lastElementChild.textContent = "音乐关闭";
    }
  });
}

canvas.addEventListener("pointerdown", (event) => {
  dragStart = { x: event.clientX, y: event.clientY };
  dragged = false;
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointermove", (event) => {
  pointerParallax.x = event.clientX / innerWidth * 2 - 1;
  pointerParallax.y = event.clientY / innerHeight * 2 - 1;
  photoReveal.style.setProperty("--parallax-x", `${pointerParallax.x * -1.2}%`);
  photoReveal.style.setProperty("--parallax-y", `${pointerParallax.y * -1.2}%`);
  if (!dragStart || journeyStarted) return;
  const dx = event.clientX - dragStart.x;
  const dy = event.clientY - dragStart.y;
  if (Math.abs(dx) + Math.abs(dy) > 4) dragged = true;
  world.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), dx * .0035);
  world.rotateX(dy * .0025);
  dragStart = { x: event.clientX, y: event.clientY };
});
canvas.addEventListener("pointerup", (event) => {
  dragStart = null;
  if (!journeyStarted || dragged) return;
  pointer.x = event.clientX / innerWidth * 2 - 1;
  pointer.y = -(event.clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(markerMeshes, false)[0];
  if (hit) sections[hit.object.userData.stopIndex].scrollIntoView({ behavior: "smooth", block: "start" });
});

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 720 ? 1.25 : 1.8));
  renderer.setSize(innerWidth, innerHeight);
});
addEventListener("scroll", chapterState, { passive: true });

chapterState();
animate();
