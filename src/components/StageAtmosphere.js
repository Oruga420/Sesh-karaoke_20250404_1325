import React, { useEffect, useRef } from 'react';
import './StageAtmosphere.css';

const MOTION = {
  subtle: { strength: 0.55, speed: 0.65, scale: 0.96, fps: 24 },
  balanced: { strength: 1, speed: 1, scale: 1, fps: 30 },
  intense: { strength: 1.5, speed: 1.65, scale: 1.14, fps: 30 },
};

/** Build original geometry only: no album artwork, audio data, or remote assets. */
function createSculpture(THREE, scene) {
  const sculpture = new THREE.Group();
  const record = new THREE.Group();
  const orbit = new THREE.Group();
  const particles = new THREE.Group();
  sculpture.add(record, orbit, particles);
  scene.add(sculpture);

  const graphite = new THREE.MeshStandardMaterial({ color: '#202020', metalness: 0.62, roughness: 0.29 });
  const edge = new THREE.MeshStandardMaterial({ color: '#3a3a3a', metalness: 0.78, roughness: 0.24 });
  const green = new THREE.MeshBasicMaterial({ color: '#1ed760', toneMapped: false });
  const label = new THREE.MeshStandardMaterial({
    color: '#1db954', roughness: 0.56, metalness: 0.12,
    emissive: '#1db954', emissiveIntensity: 0.12, side: THREE.DoubleSide,
  });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.095, 80), graphite);
  body.rotation.x = Math.PI / 2;
  record.add(body);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.397, 0.035, 8, 112), edge);
  const greenRim = new THREE.Mesh(new THREE.TorusGeometry(1.411, 0.012, 6, 112), green);
  greenRim.position.z = 0.028;
  record.add(rim, greenRim);

  // All 28 engraved grooves share one draw call.
  const groovePositions = [];
  for (let ring = 0; ring < 28; ring += 1) {
    const radius = 0.5 + ring * 0.031;
    for (let segment = 0; segment < 112; segment += 1) {
      const a = segment / 112 * Math.PI * 2;
      const b = (segment + 1) / 112 * Math.PI * 2;
      groovePositions.push(Math.cos(a) * radius, Math.sin(a) * radius, 0.051,
        Math.cos(b) * radius, Math.sin(b) * radius, 0.051);
    }
  }
  const grooves = new THREE.BufferGeometry();
  grooves.setAttribute('position', new THREE.Float32BufferAttribute(groovePositions, 3));
  record.add(new THREE.LineSegments(grooves,
    new THREE.LineBasicMaterial({ color: '#787878', transparent: true, opacity: 0.39 })));

  const centre = new THREE.Mesh(new THREE.RingGeometry(0.075, 0.435, 64), label);
  centre.position.z = 0.055;
  const spindle = new THREE.Mesh(new THREE.TorusGeometry(0.073, 0.014, 6, 32), edge);
  spindle.position.z = 0.061;
  record.add(centre, spindle);

  // Brushed highlights break the circular symmetry so the record's depth reads at rest.
  const highlight = new THREE.MeshBasicMaterial({
    color: '#ffffff', transparent: true, opacity: 0.09, side: THREE.DoubleSide, depthWrite: false,
  });
  [0.52, 3.66].forEach(angle => {
    const sheen = new THREE.Mesh(new THREE.RingGeometry(0.48, 1.37, 24, 1, angle, 0.34), highlight);
    sheen.position.z = 0.054;
    record.add(sheen);
  });
  const labelMark = new THREE.Mesh(new THREE.RingGeometry(0.29, 0.3, 32, 1, 0.2, 4.8),
    new THREE.MeshBasicMaterial({ color: '#101010', side: THREE.DoubleSide }));
  labelMark.position.z = 0.058;
  record.add(labelMark);

  const orbitMaterial = new THREE.MeshBasicMaterial({
    color: '#1ed760', transparent: true, opacity: 0.64, toneMapped: false,
  });
  const quietOrbitMaterial = new THREE.MeshBasicMaterial({
    color: '#1db954', transparent: true, opacity: 0.24, toneMapped: false,
  });
  const soundArc = new THREE.Mesh(new THREE.TorusGeometry(1.94, 0.018, 6, 104, Math.PI * 1.43), orbitMaterial);
  soundArc.rotation.z = 0.36;
  const echoArc = new THREE.Mesh(new THREE.TorusGeometry(2.16, 0.009, 5, 104, Math.PI * 1.3), quietOrbitMaterial);
  echoArc.rotation.z = 2.3;
  const outerArc = new THREE.Mesh(new THREE.TorusGeometry(2.34, 0.012, 6, 104, Math.PI * 0.83), quietOrbitMaterial);
  outerArc.rotation.set(0.31, -0.22, 4.1);
  outerArc.position.z = -0.22;
  orbit.add(soundArc, echoArc, outerArc);
  orbit.rotation.set(-0.49, 0.54, -0.25);
  orbit.position.z = -0.15;

  const satelliteGeometry = new THREE.SphereGeometry(0.052, 12, 8);
  [0.36, 2.68, 4.73].forEach((angle, index) => {
    const satellite = new THREE.Mesh(satelliteGeometry, green);
    const radius = index === 1 ? 2.16 : 1.94;
    satellite.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
    if (index === 2) satellite.scale.setScalar(0.6);
    orbit.add(satellite);
  });

  const dustPositions = [];
  for (let index = 0; index < 42; index += 1) {
    const angle = index * 2.399963;
    const radius = 1.7 + (index % 7) * 0.115;
    dustPositions.push(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.85,
      Math.sin(index * 1.7) * 0.65 - 0.25);
  }
  const dust = new THREE.BufferGeometry();
  dust.setAttribute('position', new THREE.Float32BufferAttribute(dustPositions, 3));
  particles.add(new THREE.Points(dust, new THREE.PointsMaterial({
    color: '#1ed760', size: 0.026, transparent: true, opacity: 0.56,
    depthWrite: false, toneMapped: false,
  })));

  scene.add(new THREE.HemisphereLight('#ffffff', '#111111', 1.55));
  const keyLight = new THREE.DirectionalLight('#ffffff', 3.5);
  keyLight.position.set(-2.5, 4, 5);
  const greenLight = new THREE.PointLight('#1ed760', 16, 10, 2);
  greenLight.position.set(3, -1.5, 3.5);
  scene.add(keyLight, greenLight);

  return { sculpture, record, orbit, particles, outerArc, orbitMaterial, quietOrbitMaterial };
}

/**
 * @typedef {Object} StageAtmosphereProps
 * @property {boolean} [enabled=true] Mount the decorative scene only when effects are enabled.
 * @property {boolean} [playing=false] Gently vary motion; this is not audio analysis.
 * @property {boolean} [reading=false] Subdue the ornament behind the lyrics reader.
 * @property {'subtle'|'balanced'|'intense'} [intensity='balanced'] Decorative motion strength.
 */

/** @param {StageAtmosphereProps} props */
export default function StageAtmosphere({ enabled = true, playing = false, reading = false, intensity = 'balanced' }) {
  const surfaceRef = useRef(null);
  const viewportRef = useRef(null);
  const controlsRef = useRef(null);
  const optionsRef = useRef({ playing, reading, intensity });

  useEffect(() => {
    optionsRef.current = { playing, reading, intensity };
    controlsRef.current?.refresh();
  }, [playing, reading, intensity]);

  useEffect(() => {
    const surface = surfaceRef.current;
    const viewport = viewportRef.current;
    if (!enabled || !surface || !viewport) return undefined;
    const doc = surface.ownerDocument;
    const win = doc.defaultView;
    const parent = surface.parentElement;
    if (!win || !parent || typeof win.WebGL2RenderingContext === 'undefined') return undefined;

    let disposed = false;
    let failed = false;
    let renderer;
    let context;
    let scene;
    let camera;
    let objects;
    let animationId = 0;
    let previousTime = 0;
    let elapsed = 0;
    let frames = 0;
    let drawable = false;
    const bounds = parent.getBoundingClientRect();
    let visible = bounds.bottom > 0 && bounds.top < win.innerHeight && bounds.right > 0 && bounds.left < win.innerWidth;
    const motionQuery = win.matchMedia?.('(prefers-reduced-motion: reduce)');
    let reducedMotion = Boolean(motionQuery?.matches);
    const pointer = { x: 0, y: 0, easedX: 0, easedY: 0 };
    const cleanups = [];
    const canvas = doc.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');

    function stop() {
      if (animationId) win.cancelAnimationFrame(animationId);
      animationId = 0;
      previousTime = 0;
      surface.dataset.motion = 'paused';
    }

    function releaseGpu() {
      canvas.removeEventListener('webglcontextlost', onContextLost);
      if (scene) {
        const resources = new Set();
        scene.traverse(object => {
          if (object.geometry) resources.add(object.geometry);
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.filter(Boolean).forEach(material => resources.add(material));
        });
        resources.forEach(resource => resource.dispose());
        scene.clear();
        scene = undefined;
      }
      if (renderer) {
        renderer.dispose();
        if (!context?.isContextLost()) renderer.forceContextLoss();
        renderer = undefined;
      } else if (context && !context.isContextLost()) {
        context.getExtension('WEBGL_lose_context')?.loseContext();
      }
      context = undefined;
      canvas.remove();
    }

    function fallback() {
      failed = true;
      stop();
      surface.dataset.renderer = 'fallback';
      releaseGpu();
    }

    function onContextLost(event) {
      event.preventDefault();
      fallback();
    }

    function draw() {
      if (!renderer || failed || disposed || !drawable || !visible || doc.hidden) return;
      const options = optionsRef.current;
      const profile = MOTION[options.intensity] || MOTION.balanced;
      const strength = profile.strength * (options.reading ? 0.18 : 1);
      pointer.easedX += (pointer.x - pointer.easedX) * 0.055;
      pointer.easedY += (pointer.y - pointer.easedY) * 0.055;
      const x = reducedMotion ? 0 : pointer.easedX * strength;
      const y = reducedMotion ? 0 : pointer.easedY * strength;
      const time = reducedMotion ? 0 : elapsed;
      objects.sculpture.scale.setScalar(profile.scale);
      objects.sculpture.rotation.set(0.35 + Math.sin(time * 0.21) * 0.04 * strength + y * 0.08,
        -0.48 + Math.sin(time * 0.16) * 0.045 * strength + x * 0.13,
        -0.15 + Math.sin(time * 0.17) * 0.035 * strength);
      objects.sculpture.position.y = Math.sin(time * 0.32) * 0.06 * strength;
      objects.record.rotation.z = time * 0.15;
      objects.orbit.rotation.z = -0.25 + time * 0.12;
      objects.particles.rotation.z = time * -0.036;
      objects.outerArc.visible = options.intensity === 'intense';
      objects.orbitMaterial.opacity = options.intensity === 'intense' ? 0.92 : 0.64;
      objects.quietOrbitMaterial.opacity = options.intensity === 'intense' ? 0.44 : 0.24;
      camera.position.x = x * 0.12;
      camera.position.y = y * 0.09;
      camera.lookAt(0, 0, 0);
      try {
        renderer.render(scene, camera);
        frames += 1;
        surface.dataset.frames = String(frames);
        surface.dataset.renderer = 'webgl';
      } catch {
        fallback();
      }
    }

    function tick(now) {
      animationId = 0;
      if (!renderer || failed || disposed || reducedMotion || !drawable || !visible || doc.hidden) {
        stop();
        return;
      }
      const options = optionsRef.current;
      const interval = 1000 / (options.reading ? 20 : (MOTION[options.intensity] || MOTION.balanced).fps);
      if (!previousTime) previousTime = now;
      const delta = now - previousTime;
      if (delta >= interval) {
        elapsed += Math.min(delta, 80) / 1000 * (options.playing ? 1.3 : 0.9)
          * (MOTION[options.intensity] || MOTION.balanced).speed * (options.reading ? 0.22 : 1);
        previousTime = now - delta % interval;
        draw();
      }
      if (!failed) animationId = win.requestAnimationFrame(tick);
    }

    function refresh() {
      if (!renderer || failed || disposed || !drawable || !visible || doc.hidden) {
        stop();
        return;
      }
      if (reducedMotion) {
        stop();
        draw();
      } else if (!animationId) {
        surface.dataset.motion = 'running';
        animationId = win.requestAnimationFrame(tick);
      }
    }

    function resize() {
      if (!renderer || disposed || failed) return;
      const rect = viewport.getBoundingClientRect();
      drawable = rect.width > 0 && rect.height > 0;
      if (drawable) {
        const width = Math.max(1, Math.round(rect.width));
        const height = Math.max(1, Math.round(rect.height));
        // Bound both resolution and drawing-buffer area on large/high-density screens.
        const pixelRatio = Math.min(win.devicePixelRatio || 1, 1.5, Math.sqrt(1100000 / (width * height)));
        try {
          renderer.setPixelRatio(pixelRatio);
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.position.z = 7.4 / Math.min(1, camera.aspect * 0.95);
          camera.updateProjectionMatrix();
          if (!reducedMotion) draw();
        } catch {
          fallback();
        }
      }
      refresh();
    }

    function onPointerMove(event) {
      if (reducedMotion || !visible || doc.hidden || event.pointerType === 'touch') return;
      const rect = parent.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      pointer.x = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1));
      pointer.y = Math.max(-1, Math.min(1, 1 - (event.clientY - rect.top) / rect.height * 2));
    }

    function onPointerLeave() {
      pointer.x = 0;
      pointer.y = 0;
    }

    function onMotionChange(event) {
      reducedMotion = event.matches;
      onPointerLeave();
      refresh();
    }

    async function initialize() {
      try {
        context = canvas.getContext('webgl2', { alpha: true, antialias: true, powerPreference: 'low-power', stencil: false });
        if (!context) return;
        const THREE = await import('three');
        if (disposed) return;
        renderer = new THREE.WebGLRenderer({ canvas, context, alpha: true, antialias: true, powerPreference: 'low-power' });
        renderer.setClearColor('#000000', 0);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(36, 1, 0.1, 30);
        objects = createSculpture(THREE, scene);
        canvas.addEventListener('webglcontextlost', onContextLost);
        viewport.appendChild(canvas);
        resize();
      } catch {
        if (!disposed) fallback();
      }
    }

    controlsRef.current = { refresh };
    parent.addEventListener('pointermove', onPointerMove, { passive: true });
    parent.addEventListener('pointerleave', onPointerLeave, { passive: true });
    doc.addEventListener('visibilitychange', refresh);
    cleanups.push(() => parent.removeEventListener('pointermove', onPointerMove),
      () => parent.removeEventListener('pointerleave', onPointerLeave),
      () => doc.removeEventListener('visibilitychange', refresh));
    if (motionQuery?.addEventListener) {
      motionQuery.addEventListener('change', onMotionChange);
      cleanups.push(() => motionQuery.removeEventListener('change', onMotionChange));
    } else if (motionQuery?.addListener) {
      motionQuery.addListener(onMotionChange);
      cleanups.push(() => motionQuery.removeListener(onMotionChange));
    }
    if (win.ResizeObserver) {
      const observer = new win.ResizeObserver(resize);
      observer.observe(viewport);
      cleanups.push(() => observer.disconnect());
    } else {
      win.addEventListener('resize', resize, { passive: true });
      cleanups.push(() => win.removeEventListener('resize', resize));
    }
    if (win.IntersectionObserver) {
      const observer = new win.IntersectionObserver(entries => {
        visible = Boolean(entries[0]?.isIntersecting);
        refresh();
      }, { threshold: 0 });
      observer.observe(parent);
      cleanups.push(() => observer.disconnect());
    }
    initialize();

    return () => {
      disposed = true;
      controlsRef.current = null;
      stop();
      cleanups.forEach(cleanup => cleanup());
      releaseGpu();
    };
  }, [enabled]);

  if (!enabled) return null;
  return <div ref={surfaceRef} className={`stage-atmosphere${reading ? ' stage-atmosphere--reading' : ''}${intensity === 'intense' ? ' stage-atmosphere--intense' : ''}`}
    aria-hidden="true" data-renderer="fallback" data-frames="0" data-motion="paused">
    <div className="stage-atmosphere__halo" />
    <div ref={viewportRef} className="stage-atmosphere__viewport">
      <div className="stage-atmosphere__fallback"><span /></div>
    </div>
  </div>;
}
