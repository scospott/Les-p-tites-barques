"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { destinationList, type DestinationId } from "@/lib/destinations";

/* ============================================================
   GlobeSelector — portage React (client) du prototype Three.js vanilla
   design-refs/Globe_Selecteur.html.

   Globe vectoriel net (océan #EAEEF1 / terres sable / contours encre), 2
   marqueurs (Saint-Malo + Guadeloupe) avec titres permanents, terre cuite
   #A8603C, rotation auto, pulse « sonar » des marqueurs, fallback
   prefers-reduced-motion.

   Le clic sur un marqueur ne fait plus qu'AMORCER le voyage : léger zoom
   vers la destination puis `onDestination(id)` — c'est le parent
   (GlobeSelectorClient) qui enchaîne en fondu sur la carte 2D
   (DestinationMap). Les anciens pins screen-space ont disparu avec lui.

   La scène Three.js vanilla est montée dans un useEffect avec teardown complet
   (cancelAnimationFrame, removeEventListener, dispose géométries/matériaux/
   textures, controls.dispose, renderer.dispose, abort du fetch GeoJSON).

   Données de côtes Natural Earth vendorées en local (public/geo/*) pour éviter
   toute dépendance réseau au runtime.
   ============================================================ */

/** Pilotage impératif depuis le parent (retour au globe, mise en pause). */
export interface GlobeHandle {
  /** Replace la caméra sur le globe entier, sans animation. */
  reset: () => void;
  /** Suspend la boucle de rendu quand le globe est masqué par la carte. */
  setPaused: (paused: boolean) => void;
}

interface Props {
  /** Clic sur un marqueur — le parent bascule sur la carte de la destination. */
  onDestination?: (id: DestinationId) => void;
  /** Indice affiché dans le canvas (par défaut FR). */
  hint?: string;
  /** Rempli par le composant : commandes impératives (reset, pause). */
  handleRef?: React.RefObject<GlobeHandle | null>;
  className?: string;
}

interface MarkerEntry {
  group: THREE.Group;
  core: THREE.Mesh;
  ring: THREE.Mesh;
  /** Sphère invisible, seule cible du raycast — bien plus large que le point. */
  hit: THREE.Mesh;
  label: HTMLDivElement;
  faded: boolean;
}

export default function GlobeSelector({
  onDestination,
  hint = "Choisissez votre destination",
  handleRef,
  className = "",
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  // Ref vers le dernier callback (évite de re-monter la scène à chaque rendu).
  const onDestinationRef = useRef(onDestination);
  onDestinationRef.current = onDestination;

  useEffect(() => {
    const app = mountRef.current;
    if (!app) return;

    /* =================== données =================== */
    const CORAL = 0xb0573e,
      CORAL_HOT = 0xc9694c;
    const R = 1.6;
    const TEX_LON_OFFSET = 0;

    const LOCATIONS = Object.fromEntries(
      destinationList.map((d) => [d.id, { lat: d.lat, lng: d.lng, label: d.label.toUpperCase() }]),
    ) as Record<string, { lat: number; lng: number; label: string }>;

    const select = (id: string) => onDestinationRef.current?.(id as DestinationId);

    /* =================== chrome DOM =================== */
    const shadowEl = document.createElement("div");
    shadowEl.className = "gs-shadow";
    const labelLayer = document.createElement("div");
    labelLayer.className = "gs-labels";
    const hintEl = document.createElement("div");
    hintEl.className = "gs-hint";
    hintEl.textContent = hint;
    const fallbackEl = document.createElement("div");
    fallbackEl.className = "gs-fallback";
    app.append(shadowEl, labelLayer, hintEl, fallbackEl);

    let disposed = false;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const after = (fn: () => void, ms: number) => {
      const id = setTimeout(() => {
        timers.delete(id);
        if (!disposed) fn();
      }, ms);
      timers.add(id);
    };

    /* =================== reduced motion =================== */
    const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (REDUCED) {
      // Pas de scène 3D : liste des deux destinations, qui ouvre la même
      // carte 2D que le globe (bascule directe, sans animation).
      fallbackEl.classList.add("show");
      hintEl.style.display = "none";
      const h3 = document.createElement("h3");
      h3.textContent = "NOS DESTINATIONS";
      const ul = document.createElement("ul");
      destinationList.forEach((d) => {
        const li = document.createElement("li");
        const b = document.createElement("button");
        b.type = "button";
        b.innerHTML = `<span class="n">${d.label}</span><span class="l">VOIR LA CARTE</span>`;
        b.onclick = () => select(d.id);
        li.appendChild(b);
        ul.appendChild(li);
      });
      fallbackEl.append(h3, ul);
      if (handleRef) handleRef.current = { reset: () => {}, setPaused: () => {} };
      // Pas de scène 3D en reduced-motion : teardown minimal.
      return () => {
        disposed = true;
        timers.forEach(clearTimeout);
        if (handleRef) handleRef.current = null;
        shadowEl.remove();
        labelLayer.remove();
        hintEl.remove();
        fallbackEl.remove();
      };
    }

    /* =================== helpers =================== */
    const latLngToVec3 = (lat: number, lng: number, radius = R) => {
      const phi = ((90 - lat) * Math.PI) / 180,
        theta = ((lng + TEX_LON_OFFSET + 180) * Math.PI) / 180;
      return new THREE.Vector3(
        -radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta),
      );
    };
    const sizeW = () => app.clientWidth || window.innerWidth;
    const sizeH = () => app.clientHeight || window.innerHeight;

    /* =================== scène =================== */
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, sizeW() / sizeH(), 0.1, 100);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0xffffff, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    app.appendChild(renderer.domElement);

    /* ---- Cadrage : le globe doit tenir DANS LES DEUX DIMENSIONS ----
       La distance caméra était figée à z = 6, réglée pour un cadre paysage.
       Le `fov` d'une PerspectiveCamera est VERTICAL : dès que le conteneur
       devient plus haut que large (fenêtre étroite, tablette en portrait), le
       champ horizontal se rétrécit et la sphère débordait des deux côtés —
       le globe apparaissait tronqué. On calcule donc la distance nécessaire
       pour chaque axe et on garde la plus grande.
       Rayon cadré = R × 1.3, la marge du réglage d'origine (halo + libellés). */
    const FIT_R = R * 1.3;
    const HOME_DIR = new THREE.Vector3(0, 0.05, 1).normalize();
    const HOME_POS = new THREE.Vector3();
    const HOME_TGT = new THREE.Vector3(0, 0, 0);
    /** Passe à true une fois `mode`/`animT`/`controls` initialisés. */
    let framingReady = false;

    const fitDistance = () => {
      const vFov = (camera.fov * Math.PI) / 180;
      const dV = FIT_R / Math.tan(vFov / 2);
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
      const dH = FIT_R / Math.tan(hFov / 2);
      return Math.max(dV, dH);
    };

    const applyFit = () => {
      const d = fitDistance();
      HOME_POS.copy(HOME_DIR).multiplyScalar(d);
      if (!framingReady) {
        camera.position.copy(HOME_POS);
        return;
      }
      // On ne recadre qu'au repos, et en gardant la DIRECTION courante :
      // une rotation faite par le visiteur ne doit pas être annulée.
      if (mode === "globe" && animT >= 1) {
        camera.position.setLength(d);
        controls.update();
      }
    };

    const resize = () => {
      const w = sizeW(),
        h = sizeH();
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      applyFit();
    };
    resize();

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.rotateSpeed = 0.45;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minPolarAngle = Math.PI * 0.18;
    controls.maxPolarAngle = Math.PI * 0.82;
    /* Pointeur grossier : la rotation au doigt est coupée (elle piégerait le
       scroll vertical de la page) et `touch-action: pan-y` laisse le geste de
       défilement passer au navigateur ; seuls la rotation auto et le tap
       restent. En pratique le globe n'est plus monté sous 768 px (cf.
       DestinationPicker), mais la garde reste juste pour les grands écrans
       tactiles. */
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (coarse) {
      controls.enableRotate = false;
      renderer.domElement.style.touchAction = "pan-y";
    }

    scene.add(new THREE.AmbientLight(0xffffff, 1.0));

    const globe = new THREE.Group();
    globe.rotation.y = -1.03; // Atlantique face caméra
    scene.add(globe);

    /* ---- Terre VECTORIELLE ---- */
    const GEO_URLS = ["/geo/ne_50m_land.json", "/geo/ne_110m_land.json"];
    const OCEAN_COL = "#EAEEF1",
      LAND_COL = "#E7DFCE",
      COAST_COL = 0x161514;
    const cv = document.createElement("canvas");
    cv.width = 2048;
    cv.height = 1024;
    const oceanCtx = cv.getContext("2d")!;
    oceanCtx.fillStyle = OCEAN_COL;
    oceanCtx.fillRect(0, 0, 2048, 1024);
    const oceanTex = new THREE.CanvasTexture(cv);
    oceanTex.colorSpace = THREE.SRGBColorSpace;
    oceanTex.anisotropy = 4;
    globe.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(R, 96, 96),
        new THREE.MeshBasicMaterial({ map: oceanTex }),
      ),
    );

    const projX = (lng: number) => ((lng + TEX_LON_OFFSET + 180) / 360) * 2048;
    const projY = (lat: number) => ((90 - lat) / 180) * 1024;
    type Ring = number[][];
    const eachRing = (
      geo: { features?: { geometry?: { type: string; coordinates: unknown } }[] },
      cb: (ring: Ring, outer: boolean) => void,
    ) => {
      for (const f of geo.features || []) {
        const g = f.geometry;
        if (!g) continue;
        const polys =
          g.type === "Polygon"
            ? [g.coordinates as Ring[]]
            : g.type === "MultiPolygon"
              ? (g.coordinates as Ring[][])
              : [];
        for (const poly of polys) for (let r = 0; r < poly.length; r++) cb(poly[r], r === 0);
      }
    };
    const drawLandFill = (geo: Parameters<typeof eachRing>[0]) => {
      oceanCtx.fillStyle = LAND_COL;
      oceanCtx.beginPath();
      eachRing(geo, (ring, outer) => {
        if (!outer) return;
        ring.forEach((p, k) => {
          const x = projX(p[0]),
            y = projY(p[1]);
          k ? oceanCtx.lineTo(x, y) : oceanCtx.moveTo(x, y);
        });
        oceanCtx.closePath();
      });
      oceanCtx.fill();
      oceanTex.needsUpdate = true;
    };
    let coastLines: THREE.LineSegments | null = null;
    const buildCoastlines = (geo: Parameters<typeof eachRing>[0]) => {
      const pts: THREE.Vector3[] = [];
      eachRing(geo, (ring) => {
        for (let k = 0; k < ring.length - 1; k++) {
          const a = ring[k],
            b = ring[k + 1];
          if (Math.abs(a[0]) > 179 && Math.abs(b[0]) > 179) continue;
          pts.push(latLngToVec3(a[1], a[0], R * 1.004), latLngToVec3(b[1], b[0], R * 1.004));
        }
      });
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      const m = new THREE.LineBasicMaterial({ color: COAST_COL, transparent: true, opacity: 0.5 });
      coastLines = new THREE.LineSegments(g, m);
      globe.add(coastLines);
    };

    const ac = new AbortController();
    const loadGeo = (i: number) => {
      if (i >= GEO_URLS.length || disposed) return;
      fetch(GEO_URLS[i], { signal: ac.signal })
        .then((r) => {
          if (!r.ok) throw 0;
          return r.json();
        })
        .then((geo) => {
          if (disposed) return;
          drawLandFill(geo);
          buildCoastlines(geo);
        })
        .catch(() => {
          if (!disposed) loadGeo(i + 1);
        });
    };
    loadGeo(0);

    /* ---- relief doux (assombrissement du limbe) ---- */
    const limbMat = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.FrontSide,
      depthWrite: false,
      uniforms: { uColor: { value: new THREE.Color(0x2f4048) } },
      vertexShader: `varying vec3 vN;varying vec3 vP;void main(){
        vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);
        vP=mv.xyz;gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `varying vec3 vN;varying vec3 vP;uniform vec3 uColor;void main(){
        vec3 V=normalize(-vP);float d=1.0-max(dot(vN,V),0.0);
        gl_FragColor=vec4(uColor, pow(d,3.0)*0.33);}`,
    });
    globe.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.002, 96, 96), limbMat));

    /* ---- fin liseré d'atmosphère ---- */
    const rimMat = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { uColor: { value: new THREE.Color(0x9db8c8) } },
      vertexShader: `varying vec3 vN;void main(){vN=normalize(normalMatrix*normal);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec3 vN;uniform vec3 uColor;void main(){
        float i=pow(clamp(0.74-dot(vN,vec3(0.,0.,1.)),0.,1.),3.2);
        gl_FragColor=vec4(uColor, i*0.9);}`,
    });
    const rim = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 64), rimMat);
    rim.scale.setScalar(1.04);
    scene.add(rim);

    /* ---- marqueurs ---- */
    const markers: Record<string, MarkerEntry> = {};
    for (const [id, l] of Object.entries(LOCATIONS)) {
      const pos = latLngToVec3(l.lat, l.lng, R * 1.01);
      const q = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        pos.clone().normalize(),
      );
      const grp = new THREE.Group();
      grp.position.copy(pos);
      grp.quaternion.copy(q);

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.045, 0.075, 40),
        new THREE.MeshBasicMaterial({ color: CORAL, transparent: true, side: THREE.DoubleSide, depthWrite: false }),
      );
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 18, 18),
        new THREE.MeshBasicMaterial({ color: CORAL, transparent: true }),
      );
      core.userData = { type: "marker", id };

      // Cible de pointage nettement plus large que le point visible (0.035) :
      // viser un marqueur de 12 px à la souris — et a fortiori au doigt —
      // était une loterie. Invisible, donc aucun impact sur le rendu.
      const hit = new THREE.Mesh(
        new THREE.SphereGeometry(coarse ? 0.2 : 0.11, 12, 12),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      hit.userData = { type: "marker", id };

      grp.add(ring, core, hit);
      globe.add(grp);

      const label = document.createElement("div");
      label.className = "mlabel";
      label.textContent = l.label;
      labelLayer.appendChild(label);

      markers[id] = { group: grp, core, ring, hit, label, faded: false };
    }

    /* =================== interaction =================== */
    let mode: "globe" | "zoom" = "globe";
    const ray = new THREE.Raycaster(),
      pointer = new THREE.Vector2();
    let hovered: THREE.Object3D | null = null,
      idleSpin = true;

    const pickables = () =>
      Object.values(markers)
        .filter((m) => m.group.visible)
        .map((m) => m.hit);

    const dom = renderer.domElement;

    /** Raycast à partir d'un point écran — renvoie l'id du marqueur touché. */
    const pickAt = (clientX: number, clientY: number): string | null => {
      const r = dom.getBoundingClientRect();
      pointer.x = ((clientX - r.left) / r.width) * 2 - 1;
      pointer.y = -((clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(pointer, camera);
      const hits = ray.intersectObjects(pickables(), false);
      const ud = hits.length ? hits[0].object.userData : null;
      return ud && ud.type === "marker" ? (ud.id as string) : null;
    };

    let down: { x: number; y: number } | null = null;
    const onPointerMove = (e: PointerEvent) => {
      // Survol : souris uniquement. Sur tactile il n'existe pas, d'où le
      // raycast refait au relâchement (cf. onPointerUp).
      if (e.pointerType === "touch") return;
      const id = pickAt(e.clientX, e.clientY);
      const next = id ? markers[id].hit : null;
      if (next !== hovered) {
        hovered = next;
        document.body.style.cursor = hovered ? "pointer" : "default";
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
      idleSpin = false;
    };
    const onPointerUp = (e: PointerEvent) => {
      // Seuil de déplacement : distingue le tap du glissé (rotation) et du
      // scroll de page amorcé sur le canvas.
      const moved =
        !!down && Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) > 10;
      down = null;

      if (!moved) {
        /* On raycaste ICI, à la position réelle du relâchement, au lieu de se
           fier à `hovered`. C'était LE bug tactile : sans survol, `hovered`
           restait null sur un téléphone et aucun tap ne sélectionnait jamais
           de marqueur. */
        const id = pickAt(e.clientX, e.clientY);
        if (id) {
          zoomTo(id);
          select(id);
        }
      }
      after(() => {
        if (mode === "globe") idleSpin = true;
      }, 2500);
    };
    const onPointerCancel = () => {
      down = null;
    };
    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerdown", onPointerDown);
    dom.addEventListener("pointerup", onPointerUp);
    dom.addEventListener("pointercancel", onPointerCancel);

    /* ---- zoom caméra ---- */
    const camFrom = new THREE.Vector3(),
      camTo = new THREE.Vector3(),
      tgtFrom = new THREE.Vector3(),
      tgtTo = new THREE.Vector3();
    let animT = 1;
    // Amorce courte : le fondu vers la carte 2D prend le relais.
    const animDur = 0.9;
    const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    // Le cadrage peut désormais consulter `mode`/`animT`/`controls`.
    framingReady = true;
    applyFit();

    /** Léger plongé vers la destination — le parent enchaîne sur la carte. */
    function zoomTo(id: string) {
      mode = "zoom";
      idleSpin = false;
      const loc = LOCATIONS[id];
      const surf = latLngToVec3(loc.lat, loc.lng, R).applyQuaternion(globe.quaternion);
      camFrom.copy(camera.position);
      tgtFrom.copy(controls.target);
      camTo.copy(surf).normalize().multiplyScalar(R + 1.5);
      tgtTo.copy(surf).normalize().multiplyScalar(R);
      animT = 0;
      controls.enabled = false;
      hintEl.style.opacity = "0";
      for (const [mid, m] of Object.entries(markers)) m.faded = mid !== id;
    }

    /** Retour au globe : remise à zéro immédiate (le globe est masqué). */
    const resetGlobe = () => {
      mode = "globe";
      animT = 1;
      camera.position.copy(HOME_POS);
      controls.target.copy(HOME_TGT);
      controls.enabled = true;
      controls.update();
      hintEl.style.opacity = "1";
      for (const m of Object.values(markers)) {
        m.faded = false;
        m.group.visible = true;
        (m.core.material as THREE.MeshBasicMaterial).opacity = 1;
      }
      idleSpin = true;
    };

    /* =================== boucle =================== */
    const _v = new THREE.Vector3(),
      _wp = new THREE.Vector3();
    const _sb = new THREE.Vector3(),
      _sc = new THREE.Vector3(),
      _se = new THREE.Vector3();

    const positionLabel = (el: HTMLElement, obj: THREE.Object3D, yOff: number) => {
      obj.getWorldPosition(_v);
      _v.add(_v.clone().normalize().multiplyScalar(yOff));
      const facing = _v.clone().normalize().dot(camera.position.clone().normalize());
      _v.project(camera);
      el.style.left = (_v.x * 0.5 + 0.5) * sizeW() + "px";
      el.style.top = (-_v.y * 0.5 + 0.5) * sizeH() + "px";
      el.style.display = _v.z > 1 || facing < -0.15 ? "none" : "block";
    };
    const updateShadow = () => {
      _sb.set(0, -R, 0).project(camera);
      _sc.set(0, 0, 0).project(camera);
      _se.set(R, 0, 0).project(camera);
      const by = (-_sb.y * 0.5 + 0.5) * sizeH();
      const cx = (_sc.x * 0.5 + 0.5) * sizeW();
      const ex = (_se.x * 0.5 + 0.5) * sizeW();
      const rad = Math.abs(ex - cx);
      const w = rad * 1.9,
        h = rad * 0.42;
      shadowEl.style.width = w + "px";
      shadowEl.style.height = h + "px";
      shadowEl.style.left = cx + "px";
      shadowEl.style.top = by + h * 0.22 + "px";
      shadowEl.style.opacity =
        mode === "globe" && animT >= 1 ? "1" : mode === "globe" ? "0.6" : "0";
    };

    let last = performance.now();
    let raf = 0;
    let paused = false;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      // Globe masqué par la carte : on garde la boucle vivante mais on ne
      // consomme ni calcul ni GPU.
      if (paused) {
        last = performance.now();
        return;
      }
      const now = performance.now(),
        dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;

      if (mode === "globe" && idleSpin) globe.rotation.y += dt * 0.06;

      if (animT < 1) {
        animT = Math.min(1, animT + dt / animDur);
        const e = easeInOut(animT);
        camera.position.lerpVectors(camFrom, camTo, e);
        const lift = Math.sin(e * Math.PI) * 0.5;
        camera.position.multiplyScalar(1 + (lift * 0.06) / camera.position.length());
        controls.target.lerpVectors(tgtFrom, tgtTo, e);
        if (animT >= 1) controls.enabled = true;
      }

      for (const m of Object.values(markers)) {
        const ringMat = m.ring.material as THREE.MeshBasicMaterial;
        const coreMat = m.core.material as THREE.MeshBasicMaterial;
        if (!m.group.visible) {
          m.label.style.opacity = "0";
          continue;
        }
        const pulse = 1 + Math.sin(t * 2.2) * 0.35;
        const isH = hovered === m.hit;
        m.ring.scale.setScalar(pulse * (isH ? 1.5 : 1));
        ringMat.opacity = (m.faded ? 0.12 : 0.5) * (1.4 - pulse) * 1.4;
        m.core.scale.setScalar(THREE.MathUtils.lerp(m.core.scale.x, isH ? 1.7 : 1, 0.2));
        coreMat.opacity = THREE.MathUtils.lerp(coreMat.opacity, m.faded ? 0.22 : 1, 0.1);
        coreMat.color.set(isH ? CORAL_HOT : CORAL);
        positionLabel(m.label, m.core, 0.16);
        m.core.getWorldPosition(_wp);
        const facing = _wp.normalize().dot(camera.position.clone().normalize());
        m.label.style.opacity = !m.faded && facing > 0.15 ? "1" : "0";
      }

      controls.update();
      updateShadow();
      renderer.render(scene, camera);
    };
    animate();

    if (handleRef)
      handleRef.current = {
        reset: resetGlobe,
        setPaused: (p: boolean) => {
          paused = p;
        },
      };

    const ro = new ResizeObserver(() => resize());
    ro.observe(app);

    /* =================== teardown =================== */
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      ac.abort();
      ro.disconnect();
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerdown", onPointerDown);
      dom.removeEventListener("pointerup", onPointerUp);
      dom.removeEventListener("pointercancel", onPointerCancel);
      controls.dispose();

      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh & { geometry?: THREE.BufferGeometry; material?: THREE.Material | THREE.Material[] };
        mesh.geometry?.dispose?.();
        const mat = mesh.material;
        const list = Array.isArray(mat) ? mat : mat ? [mat] : [];
        for (const m of list) {
          const anyMat = m as unknown as Record<string, unknown>;
          for (const k in anyMat) {
            const val = anyMat[k] as { isTexture?: boolean; dispose?: () => void };
            if (val && val.isTexture) val.dispose?.();
          }
          m.dispose();
        }
      });
      oceanTex.dispose();
      renderer.dispose();
      renderer.domElement.remove();

      document.body.style.cursor = "default";
      if (handleRef) handleRef.current = null;
      shadowEl.remove();
      labelLayer.remove();
      hintEl.remove();
      fallbackEl.remove();
    };
    // Monté une seule fois ; onDestination est lu via onDestinationRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hint]);

  return <div ref={mountRef} className={`globe-selector ${className}`} />;
}
