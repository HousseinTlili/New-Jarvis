import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { useJarvisStore, OrbState } from "../store";

export const NeuralOrb: React.FC<{ size?: "small" | "large" }> = ({ size = "large" }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const orbState = useJarvisStore((state) => state.orbState);
  const recordingVolume = useJarvisStore((state) => state.recordingVolume);
  const audioAnalyser = useJarvisStore((state) => state.audioAnalyser);



  // Sync state values to a ref so the animate closure always reads latest values
  const voiceStateRef = useRef({
    orbState,
    recordingVolume,
    audioAnalyser
  });

  useEffect(() => {
    voiceStateRef.current = {
      orbState,
      recordingVolume,
      audioAnalyser
    };
  }, [orbState, recordingVolume, audioAnalyser]);

  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const container = containerRef.current;
    const canvas = canvasRef.current;
    
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Create Scene, Camera, and WebGLRenderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.z = 10; // slightly pushed back to fit rings

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Particle Sphere Setup
    const particleCount = 2200;
    const radius = 3.2;

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const originalPositions = new Float32Array(particleCount * 3);

    // Generate coordinate distribution with shell thickness
    for (let i = 0; i < particleCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = radius + (Math.random() - 0.5) * 0.35; // shell thickness

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      originalPositions[i * 3] = x;
      originalPositions[i * 3 + 1] = y;
      originalPositions[i * 3 + 2] = z;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    // Custom Canvas Texture for perfectly round, soft particle points (removes square borders)
    const createCircularTexture = () => {
      const canvasTex = document.createElement("canvas");
      canvasTex.width = 16;
      canvasTex.height = 16;
      const ctx = canvasTex.getContext("2d");
      if (ctx) {
        const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
        grad.addColorStop(0, "rgba(255,255,255,1)");
        grad.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 16, 16);
      }
      return new THREE.CanvasTexture(canvasTex);
    };

    const particleMat = new THREE.PointsMaterial({
      color: 0x00f0ff,
      size: 0.12,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      map: createCircularTexture()
    });

    const particles = new THREE.Points(geometry, particleMat);
    scene.add(particles);

    // Inner wireframe core (IcosahedronGeometry)
    const coreGeo = new THREE.IcosahedronGeometry(1.6, 2);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    scene.add(coreMesh);

    // Double concentric outer ring meshes
    const ringGeo1 = new THREE.RingGeometry(3.75, 3.80, 64);
    const ringMat1 = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.25,
      blending: THREE.AdditiveBlending
    });
    const ringMesh1 = new THREE.Mesh(ringGeo1, ringMat1);
    ringMesh1.rotation.x = Math.PI / 3;
    ringMesh1.rotation.y = Math.PI / 4;
    scene.add(ringMesh1);

    const ringGeo2 = new THREE.RingGeometry(4.30, 4.33, 64);
    const ringMat2 = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending
    });
    const ringMesh2 = new THREE.Mesh(ringGeo2, ringMat2);
    ringMesh2.rotation.x = -Math.PI / 4;
    ringMesh2.rotation.z = Math.PI / 6;
    scene.add(ringMesh2);

    // Mouse drag rotation with inertia decay
    let isMouseDown = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let targetRotationX = 0;
    let targetRotationY = 0;

    const onMouseDown = (e: MouseEvent) => {
      isMouseDown = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isMouseDown) return;
      const deltaX = e.clientX - prevMouseX;
      const deltaY = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;

      targetRotationY += deltaX * 0.005;
      targetRotationX += deltaY * 0.005;
    };

    const onMouseUp = () => {
      isMouseDown = false;
    };

    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    // Initialize animation properties
    const targetColor = new THREE.Color("#00f0ff");
    const currentColor = new THREE.Color("#00f0ff");
    let targetRotationSpeed = 0.003;
    let currentRotationSpeed = 0.003;
    let targetNoiseScale = 0.5;
    let currentNoiseScale = 0.5;

    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      const time = clock.getElapsedTime();
      const { orbState: state, recordingVolume: volume, audioAnalyser: analyser } = voiceStateRef.current;

      // Color mapping matching reference portal states
      let modeColorStr = "#00f0ff";
      switch (state) {
        case "listening":
          modeColorStr = "#bc13fe"; // Purple
          targetRotationSpeed = 0.008;
          targetNoiseScale = 2.2;
          break;
        case "thinking":
          modeColorStr = "#ffe600"; // Gold
          targetRotationSpeed = 0.024;
          targetNoiseScale = 1.6;
          break;
        case "speaking":
          modeColorStr = "#39ff14"; // Teal
          targetRotationSpeed = 0.006;
          targetNoiseScale = 2.8;
          break;
        case "executing":
          modeColorStr = "#ff2d78"; // Crimson Red
          targetRotationSpeed = 0.035;
          targetNoiseScale = 3.5;
          break;
        case "idle":
        default:
          modeColorStr = "#00f0ff"; // Cyan
          targetRotationSpeed = 0.003;
          targetNoiseScale = 0.5;
          break;
      }

      targetColor.set(modeColorStr);

      // Interpolate color values smoothly
      currentColor.lerp(targetColor, 0.08);
      particleMat.color.copy(currentColor);
      coreMat.color.copy(currentColor);
      ringMat1.color.copy(currentColor);
      ringMat2.color.copy(currentColor);

      // Interpolate physics values
      currentRotationSpeed = THREE.MathUtils.lerp(currentRotationSpeed, targetRotationSpeed, 0.08);
      currentNoiseScale = THREE.MathUtils.lerp(currentNoiseScale, targetNoiseScale, 0.08);

      // Apply orbital rotations
      particles.rotation.y += currentRotationSpeed;
      particles.rotation.x += currentRotationSpeed * 0.2;
      coreMesh.rotation.y -= currentRotationSpeed * 1.5;
      coreMesh.rotation.z += currentRotationSpeed;

      ringMesh1.rotation.z += currentRotationSpeed * 0.8;
      ringMesh2.rotation.z -= currentRotationSpeed * 1.2;

      // Apply mouse-drag inertia to the root scene rotations
      scene.rotation.y = THREE.MathUtils.lerp(scene.rotation.y, targetRotationY, 0.1);
      scene.rotation.x = THREE.MathUtils.lerp(scene.rotation.x, targetRotationX, 0.1);

      // Handle Audio Modulations
      let normalizedFreq = 0;
      if (state === "speaking" && analyser) {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let j = 0; j < bufferLength; j++) {
          sum += dataArray[j];
        }
        normalizedFreq = sum / bufferLength / 255.0; // scale 0 to 1
      }

      // Modulate overall system pulse scale
      const listeningPulse = 1.0 + volume * 1.5;
      const speakingPulse = analyser 
        ? 1.0 + normalizedFreq * 0.3
        : 1.0 + Math.sin(time * 12) * 0.08 + Math.cos(time * 7) * 0.03;

      const finalScale = state === "listening" 
        ? listeningPulse 
        : (state === "speaking" ? speakingPulse : 1.0);

      particles.scale.set(finalScale, finalScale, finalScale);
      coreMesh.scale.set(finalScale, finalScale, finalScale);

      // Sculpt sphere particles dynamically using spatial noise deformation equations
      const posAttr = geometry.attributes.position;
      const posArr = posAttr.array as Float32Array;

      for (let i = 0; i < particleCount; i++) {
        const xIdx = i * 3;
        const yIdx = i * 3 + 1;
        const zIdx = i * 3 + 2;

        const ox = originalPositions[xIdx];
        const oy = originalPositions[yIdx];
        const oz = originalPositions[zIdx];

        let waveFactor = 1.0;
        if (state === "listening") {
          const listeningNoise = currentNoiseScale * (1.0 + volume * 2.0);
          waveFactor = 1.0 + Math.sin(ox * 0.06 + time * 8.0) * 0.08 * listeningNoise;
        } else if (state === "thinking") {
          waveFactor = 1.0 + Math.cos(oy * 0.12 + time * 12.0) * 0.05 * currentNoiseScale;
        } else if (state === "speaking") {
          const speakingNoise = currentNoiseScale * (0.4 + normalizedFreq * 1.6);
          waveFactor = 1.0 + Math.sin(oz * 0.05 + time * 6.0) * 0.12 * speakingNoise;
        } else if (state === "executing") {
          waveFactor = 1.0 + Math.sin((ox + oy + oz) * 0.08 + time * 18.0) * 0.15 * currentNoiseScale;
        } else {
          // Idle state - calm, subtle breathing cycle
          waveFactor = 1.0 + Math.sin(time * 1.8 + i) * 0.015;
        }

        posArr[xIdx] = ox * waveFactor;
        posArr[yIdx] = oy * waveFactor;
        posArr[zIdx] = oz * waveFactor;
      }

      posAttr.needsUpdate = true;
      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    // Resize handler
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;

      camera.aspect = w / h;
      camera.updateProjectionMatrix();

      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(container);

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      geometry.dispose();
      particleMat.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      ringGeo1.dispose();
      ringMat1.dispose();
      ringGeo2.dispose();
      ringMat2.dispose();
      renderer.dispose();
    };
  }, []);

  // Scientific HUD parameters & styling definitions
  const stateColors: Record<OrbState, { hex: string; glow: string; label: string }> = {
    idle: { hex: "#00f0ff", glow: "rgba(0, 240, 255, 0.08)", label: "SYS_STANDBY" },
    listening: { hex: "#bc13fe", glow: "rgba(188, 19, 254, 0.08)", label: "CAPTURE_FREQ" },
    thinking: { hex: "#ffe600", glow: "rgba(255, 230, 0, 0.08)", label: "COGNITIVE_PARSE" },
    speaking: { hex: "#39ff14", glow: "rgba(57, 255, 20, 0.08)", label: "WAVEFORM_GEN" },
    executing: { hex: "#ff2d78", glow: "rgba(255, 45, 120, 0.12)", label: "KERNEL_EXEC" },
  };

  const activeColor = stateColors[orbState] || stateColors.idle;

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center relative select-none pointer-events-none">
      {/* Ambient back-glow synced to active color */}
      <div 
        className="absolute w-44 h-44 rounded-full blur-[80px] transition-all duration-700 pointer-events-none scale-110" 
        style={{ backgroundColor: activeColor.glow }}
      />

      {/* Background Rotating Rings HUD (only for large display) */}
      {size === "large" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden opacity-30">
          <svg className="w-full h-full max-w-[130%] max-h-[130%] absolute" viewBox="0 0 200 200" fill="none">
            {/* Outer dashed ring rotating slowly */}
            <circle 
              cx="100" 
              cy="100" 
              r="92" 
              stroke={activeColor.hex} 
              strokeWidth="0.4" 
              strokeDasharray="4 8" 
              className="animate-[spin_60s_linear_infinite] origin-center opacity-40 transition-all duration-500" 
            />
            {/* Inner tick ring rotating opposite */}
            <circle 
              cx="100" 
              cy="100" 
              r="82" 
              stroke={activeColor.hex} 
              strokeWidth="0.25" 
              strokeDasharray="1 3" 
              className="animate-[spin_35s_linear_infinite_reverse] origin-center opacity-30 transition-all duration-500" 
            />
            {/* Fine solid circle */}
            <circle 
              cx="100" 
              cy="100" 
              r="76" 
              stroke={activeColor.hex} 
              strokeWidth="0.3" 
              className="opacity-15 transition-all duration-500" 
            />
          </svg>
        </div>
      )}



      <canvas ref={canvasRef} className="w-full h-full block pointer-events-auto cursor-grab active:cursor-grabbing" />
    </div>
  );
};
