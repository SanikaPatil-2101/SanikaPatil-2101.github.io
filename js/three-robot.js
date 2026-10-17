/**
 * @file three-robot.js
 * @brief Interactive 3D WebGL Digital Twin of Sanika's 5-DOF Robotic Arm
 * @author Sanika Patil
 *
 * Renders the authentic Autodesk Fusion 360 CAD meshes (Base, Shoulder, Elbow,
 * Arm, Wrist, Gripper) matching ROS 2 / RViz kinematic axes, revolute joints,
 * and real-time interactive actuator controls.
 */

(function () {
  const container = document.getElementById('threeContainer');
  if (!container) return;

  let scene, camera, renderer, controls;
  let robotBase, shoulderGroup, arm1Group, arm2Group, wristGroup, gripperGroup;
  let leftFinger, rightFinger;
  let isGripperOpen = true;

  // Joint angle state (degrees) matching robot-sim.js
  let angles = {
    j1: 0,   // Base Yaw (Revolute 1 - Y axis rotation)
    j2: 35,  // Shoulder Pitch (Joint 2 - Z axis rotation, safe upright range: -10 to 105)
    j3: -30, // Elbow Pitch (Joint 3 - Z axis rotation)
    j4: 0    // Wrist Pitch (Joint 4 - Z axis rotation)
  };

  // Industrial Materials (Authentic PBR finishes matching RViz / Industrial CAD)
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b, // Gunmetal / Dark Slate
    metalness: 0.85,
    roughness: 0.28
  });

  const shoulderMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7, // ROS 2 Industrial Sky-Blue
    metalness: 0.75,
    roughness: 0.25
  });

  const elbowMat = new THREE.MeshStandardMaterial({
    color: 0x4f46e5, // Aerospace Indigo
    metalness: 0.70,
    roughness: 0.30
  });

  const armMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7, // Precision Blue
    metalness: 0.75,
    roughness: 0.25
  });

  const wristMat = new THREE.MeshStandardMaterial({
    color: 0x334155, // Titanium Slate
    metalness: 0.90,
    roughness: 0.20
  });

  const gripperMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b, // Safety Amber / Industrial Gold
    metalness: 0.85,
    roughness: 0.20
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    metalness: 0.95,
    roughness: 0.10
  });

  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.90,
    roughness: 0.35
  });

  const ledGlowMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8
  });

  /**
   * Decodes Base64 binary string to an ArrayBuffer in memory (Zero CORS, 100% offline).
   */
  function base64ToArrayBuffer(base64) {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  function init() {
    // 1. Scene Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d);
    scene.fog = new THREE.FogExp2(0x0a0f1d, 0.0014);

    // 2. Camera Setup
    const width = container.clientWidth || 540;
    const height = container.clientHeight || 400;
    const aspect = width / height;
    camera = new THREE.PerspectiveCamera(45, aspect, 1, 2500);
    camera.position.set(280, 200, 260);

    // 3. Renderer Setup
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
    container.appendChild(renderer.domElement);

    // 4. Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.02; // Prevent camera sinking under ground
    controls.minDistance = 60;
    controls.maxDistance = 900;
    controls.target.set(30, 90, 0);

    // 5. Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x0f172a, 0.6);
    hemiLight.position.set(0, 300, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    keyLight.position.set(160, 320, 220);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.8);
    fillLight.position.set(-200, 150, -180);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x818cf8, 0.5);
    rimLight.position.set(0, -50, 200);
    scene.add(rimLight);

    // 6. Ground Grid & Pedestal
    const grid = new THREE.GridHelper(600, 30, 0x38bdf8, 0x1e293b);
    grid.position.y = 0;
    scene.add(grid);

    // Mounting Base Plinth
    const plinthGeo = new THREE.CylinderGeometry(75, 80, 8, 36);
    const plinth = new THREE.Mesh(plinthGeo, baseMat);
    plinth.position.y = 4;
    plinth.receiveShadow = true;
    scene.add(plinth);

    // Cyan Status Ring
    const statusRing = new THREE.Mesh(new THREE.TorusGeometry(72, 1.2, 16, 48), ledGlowMat);
    statusRing.position.y = 8;
    statusRing.rotation.x = Math.PI / 2;
    scene.add(statusRing);

    // 7. Load / Assemble Robot Model
    buildRobotArm();

    // 8. Event Listeners
    window.addEventListener('resize', onWindowResize);
    setupSliderListeners();

    // 9. Start Render Loop
    animate();
  }

  /**
   * Assembles the 5-DOF Robotic Arm from Authentic CAD STLs matching RViz Kinematics.
   */
  function buildRobotArm() {
    const loadingElem = document.getElementById('threeLoading');
    const loader = (typeof THREE !== 'undefined' && THREE.STLLoader) ? new THREE.STLLoader() : null;

    if (loader && window.ROBOT_STL_DATA && window.ROBOT_STL_DATA.Base) {
      try {
        assembleCadRobot(loader);
      } catch (err) {
        console.warn('CAD assembly fallback to procedural:', err);
        buildProceduralFallback();
      }
    } else {
      buildProceduralFallback();
    }

    updateJoints();

    if (loadingElem) {
      loadingElem.style.display = 'none';
    }
  }

  /**
   * Builds the authentic CAD assembly using Sanika's Fusion 360 models.
   */
  function assembleCadRobot(loader) {
    const stl = window.ROBOT_STL_DATA;

    // --- 1. BASE LINK (Fixed Base on Ground) ---
    robotBase = new THREE.Group();
    scene.add(robotBase);

    const baseBuffer = base64ToArrayBuffer(stl.Base);
    const baseGeo = loader.parse(baseBuffer);
    // Align Base CAD coordinates: CAD +Z is UP, Turntable center at X = -100
    const basePos = baseGeo.attributes.position;
    for (let i = 0; i < basePos.count; i++) {
      const x = basePos.getX(i);
      const y = basePos.getY(i);
      const z = basePos.getZ(i);
      // CAD (x, y, z) -> Three.js (x + 100, z, -y)
      basePos.setXYZ(i, x + 100, z, -y);
    }
    baseGeo.computeVertexNormals();

    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    robotBase.add(baseMesh);

    // --- 2. SHOULDER GROUP (Joint 1: Base Yaw / Revolute 1) ---
    // Turntable center sits at Y = 70 mm above ground
    shoulderGroup = new THREE.Group();
    shoulderGroup.position.set(0, 70, 0);
    robotBase.add(shoulderGroup);

    const shoulderBuffer = base64ToArrayBuffer(stl.Shoulder);
    const shoulderGeo = loader.parse(shoulderBuffer);
    const shPos = shoulderGeo.attributes.position;
    for (let i = 0; i < shPos.count; i++) {
      const x = shPos.getX(i);
      const y = shPos.getY(i);
      const z = shPos.getZ(i);
      // CAD (x, y, z) -> Three.js (x, z, -y)
      shPos.setXYZ(i, x, z, -y);
    }
    shoulderGeo.computeVertexNormals();

    const shoulderMesh = new THREE.Mesh(shoulderGeo, shoulderMat);
    shoulderMesh.castShadow = true;
    shoulderMesh.receiveShadow = true;
    shoulderGroup.add(shoulderMesh);

    // Decorative bearing / servo ring
    const shoulderBearing = new THREE.Mesh(new THREE.CylinderGeometry(49, 49, 4, 32), chromeMat);
    shoulderBearing.position.set(0, 2, 0);
    shoulderGroup.add(shoulderBearing);

    // --- 3. LOWER ARM GROUP (Joint 2: Shoulder Pitch) ---
    // Pivot at top bracket of shoulder: X = 14, Y = 48.8, Z = 23.5 mm
    arm1Group = new THREE.Group();
    arm1Group.position.set(14, 48.8, 23.5);
    shoulderGroup.add(arm1Group);

    // Shoulder Joint Pin Axle
    const pin1 = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 26, 24), chromeMat);
    pin1.rotation.x = Math.PI / 2;
    pin1.castShadow = true;
    arm1Group.add(pin1);

    const elbowBuffer = base64ToArrayBuffer(stl.Elbow);
    const elbowGeo = loader.parse(elbowBuffer);
    const elPos = elbowGeo.attributes.position;
    for (let i = 0; i < elPos.count; i++) {
      const x = elPos.getX(i);
      const y = elPos.getY(i);
      const z = elPos.getZ(i);
      // Center 20mm thickness on pivot plane (z - 10)
      elPos.setXYZ(i, x, y, z - 10);
    }
    elbowGeo.computeVertexNormals();

    const elbowMesh = new THREE.Mesh(elbowGeo, elbowMat);
    elbowMesh.castShadow = true;
    elbowMesh.receiveShadow = true;
    arm1Group.add(elbowMesh);

    // --- 4. FOREARM GROUP (Joint 3: Elbow Pitch) ---
    // Hole-to-hole distance on Elbow link = 111.46 mm
    arm2Group = new THREE.Group();
    arm2Group.position.set(111.46, 0, 0);
    arm1Group.add(arm2Group);

    // Elbow Joint Pin Axle
    const pin2 = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 36, 24), chromeMat);
    pin2.rotation.x = Math.PI / 2;
    pin2.castShadow = true;
    arm2Group.add(pin2);

    const armBuffer = base64ToArrayBuffer(stl.arm);
    const armGeo = loader.parse(armBuffer);
    const armPos = armGeo.attributes.position;
    for (let i = 0; i < armPos.count; i++) {
      const x = armPos.getX(i);
      const y = armPos.getY(i);
      const z = armPos.getZ(i);
      // Center 30mm thickness on pivot plane (z - 15)
      armPos.setXYZ(i, x, y, z - 15);
    }
    armGeo.computeVertexNormals();

    const armMesh = new THREE.Mesh(armGeo, armMat);
    armMesh.castShadow = true;
    armMesh.receiveShadow = true;
    arm2Group.add(armMesh);

    // --- 5. WRIST GROUP (Joint 4: Wrist Pitch) ---
    // Arm link length = 85 mm
    wristGroup = new THREE.Group();
    wristGroup.position.set(85, 0, 0);
    arm2Group.add(wristGroup);

    // Wrist Joint Pin Axle
    const pin3 = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 30, 20), chromeMat);
    pin3.rotation.x = Math.PI / 2;
    wristGroup.add(pin3);

    const wristBuffer = base64ToArrayBuffer(stl.Wrist);
    const wristGeo = loader.parse(wristBuffer);
    const wrPos = wristGeo.attributes.position;
    for (let i = 0; i < wrPos.count; i++) {
      const x = wrPos.getX(i);
      const y = wrPos.getY(i);
      const z = wrPos.getZ(i);
      wrPos.setXYZ(i, x, y + 15, z - 12.5);
    }
    wristGeo.computeVertexNormals();

    const wristMesh = new THREE.Mesh(wristGeo, wristMat);
    wristMesh.castShadow = true;
    wristMesh.receiveShadow = true;
    wristGroup.add(wristMesh);

    // --- 6. GRIPPER END-EFFECTOR ---
    gripperGroup = new THREE.Group();
    gripperGroup.position.set(45, 0, 0);
    wristGroup.add(gripperGroup);

    const gripBuffer = base64ToArrayBuffer(stl.Gripper);
    const gripGeo = loader.parse(gripBuffer);
    const grPos = gripGeo.attributes.position;
    for (let i = 0; i < grPos.count; i++) {
      const x = grPos.getX(i);
      const y = grPos.getY(i);
      const z = grPos.getZ(i);
      // Orient CAD gripper: CAD +Y forward -> Three.js +X, CAD -Z -> Three.js +Y
      grPos.setXYZ(i, y - 35, -(z + 12), x);
    }
    gripGeo.computeVertexNormals();

    const gripperMesh = new THREE.Mesh(gripGeo, gripperMat);
    gripperMesh.castShadow = true;
    gripperMesh.receiveShadow = true;
    gripperGroup.add(gripperMesh);

    // Functional Articulated Jaw Fingers (Animated open/close)
    buildGripperFingers(gripperGroup);
  }

  /**
   * Adds precision animated fingers at the gripper tip for dynamic grab response.
   */
  function buildGripperFingers(parent) {
    const fingerGeo = new THREE.BoxGeometry(22, 5, 8);
    const padGeo = new THREE.BoxGeometry(10, 7, 7);

    leftFinger = new THREE.Group();
    leftFinger.position.set(90, 0, 12);
    parent.add(leftFinger);

    const leftBlade = new THREE.Mesh(fingerGeo, chromeMat);
    leftBlade.position.set(10, 0, 0);
    leftBlade.castShadow = true;
    leftFinger.add(leftBlade);

    const leftPad = new THREE.Mesh(padGeo, darkMetalMat);
    leftPad.position.set(18, 0, -2);
    leftFinger.add(leftPad);

    rightFinger = new THREE.Group();
    rightFinger.position.set(90, 0, -12);
    parent.add(rightFinger);

    const rightBlade = new THREE.Mesh(fingerGeo, chromeMat);
    rightBlade.position.set(10, 0, 0);
    rightBlade.castShadow = true;
    rightFinger.add(rightBlade);

    const rightPad = new THREE.Mesh(padGeo, darkMetalMat);
    rightPad.position.set(18, 0, 2);
    rightFinger.add(rightPad);
  }

  /**
   * Procedural fallback if CAD STL binary data is unavailable.
   */
  function buildProceduralFallback() {
    robotBase = new THREE.Group();
    scene.add(robotBase);

    const baseCyl = new THREE.Mesh(new THREE.CylinderGeometry(45, 52, 28, 32), baseMat);
    baseCyl.position.y = 14;
    baseCyl.castShadow = true;
    robotBase.add(baseCyl);

    shoulderGroup = new THREE.Group();
    shoulderGroup.position.set(0, 32, 0);
    robotBase.add(shoulderGroup);

    const shTurret = new THREE.Mesh(new THREE.CylinderGeometry(38, 42, 20, 32), shoulderMat);
    shTurret.position.y = 10;
    shTurret.castShadow = true;
    shoulderGroup.add(shTurret);

    arm1Group = new THREE.Group();
    arm1Group.position.set(0, 20, 0);
    shoulderGroup.add(arm1Group);

    const arm1Beam = new THREE.Mesh(new THREE.BoxGeometry(105, 14, 18), elbowMat);
    arm1Beam.position.set(50, 0, 0);
    arm1Beam.castShadow = true;
    arm1Group.add(arm1Beam);

    arm2Group = new THREE.Group();
    arm2Group.position.set(105, 0, 0);
    arm1Group.add(arm2Group);

    const arm2Beam = new THREE.Mesh(new THREE.BoxGeometry(85, 12, 16), armMat);
    arm2Beam.position.set(40, 0, 0);
    arm2Beam.castShadow = true;
    arm2Group.add(arm2Beam);

    wristGroup = new THREE.Group();
    wristGroup.position.set(85, 0, 0);
    arm2Group.add(wristGroup);

    const wristMesh = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 16, 16), wristMat);
    wristMesh.rotation.x = Math.PI / 2;
    wristGroup.add(wristMesh);

    gripperGroup = new THREE.Group();
    gripperGroup.position.set(20, 0, 0);
    wristGroup.add(gripperGroup);

    const gripMesh = new THREE.Mesh(new THREE.BoxGeometry(25, 16, 20), gripperMat);
    gripMesh.position.set(12, 0, 0);
    gripperGroup.add(gripMesh);

    buildGripperFingers(gripperGroup);
  }

  function setGripperState(open) {
    isGripperOpen = open;
    const btnGrip = document.getElementById('btnGripper');
    if (btnGrip) {
      btnGrip.innerHTML = open
        ? '<i class="fa-solid fa-hand-fist text-[10px]"></i> Gripper: Open'
        : '<i class="fa-solid fa-hand text-[10px]"></i> Gripper: Closed';
      if (!open) {
        btnGrip.classList.add('bg-amber-500/20', 'border-amber-500/40', 'text-amber-300');
      } else {
        btnGrip.classList.remove('bg-amber-500/20', 'border-amber-500/40', 'text-amber-300');
      }
    }

    if (leftFinger && rightFinger) {
      const spread = open ? 12 : 3;
      leftFinger.position.z = spread;
      rightFinger.position.z = -spread;
    }
  }

  /**
   * Applies the exact joint kinematics matching RViz revolute axes.
   */
  function updateJoints() {
    // Joint 1: Base Turntable Yaw (Around Three.js Y-axis)
    if (shoulderGroup) {
      shoulderGroup.rotation.y = THREE.MathUtils.degToRad(angles.j1);
    }
    // Joint 2: Shoulder Pitch (Around Three.js Z-axis, safe mechanical limits: -10° to +105°)
    if (arm1Group) {
      const clampedJ2 = Math.min(Math.max(angles.j2, -10), 105);
      arm1Group.rotation.z = THREE.MathUtils.degToRad(clampedJ2);
    }
    // Joint 3: Elbow Pitch (Around Three.js Z-axis)
    if (arm2Group) {
      arm2Group.rotation.z = THREE.MathUtils.degToRad(angles.j3);
    }
    // Joint 4: Wrist Pitch (Around Three.js Z-axis)
    if (wristGroup) {
      wristGroup.rotation.z = THREE.MathUtils.degToRad(angles.j4);
    }
  }

  function setupSliderListeners() {
    const s1 = document.getElementById('sliderQ1');
    const s2 = document.getElementById('sliderQ2');
    const s3 = document.getElementById('sliderQ3');
    const btnGrip = document.getElementById('btnGripper');
    const btnReset = document.getElementById('btnReset');

    if (s1) {
      s1.addEventListener('input', (e) => {
        angles.j1 = parseFloat(e.target.value);
        updateJoints();
      });
    }
    if (s2) {
      s2.addEventListener('input', (e) => {
        angles.j2 = parseFloat(e.target.value);
        updateJoints();
      });
    }
    if (s3) {
      s3.addEventListener('input', (e) => {
        angles.j3 = parseFloat(e.target.value);
        updateJoints();
      });
    }

    if (btnReset) {
      btnReset.addEventListener('click', () => {
        angles.j1 = 0;
        angles.j2 = 35;
        angles.j3 = -30;
        angles.j4 = 0;
        updateJoints();
        setGripperState(true);
      });
    }

    // Two-way synchronization with robot-sim.js wave animation
    window.addEventListener('threeSyncAngles', (e) => {
      if (e.detail) {
        angles.j1 = e.detail.q1;
        angles.j2 = e.detail.q2;
        angles.j3 = e.detail.q3;
        updateJoints();
      }
    });

    window.addEventListener('threeToggleGripper', (e) => {
      if (e.detail && e.detail.open !== undefined) {
        setGripperState(e.detail.open);
      }
    });
  }

  function onWindowResize() {
    if (!container || !renderer || !camera) return;
    const width = container.clientWidth || 540;
    const height = container.clientHeight || 400;
    if (width <= 0 || height <= 0) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  function animate() {
    requestAnimationFrame(animate);
    if (controls) controls.update();
    if (renderer && scene && camera) renderer.render(scene, camera);
  }

  // Public camera reset
  window.resetThreeCamera = function () {
    if (controls && camera) {
      camera.position.set(280, 200, 260);
      controls.target.set(30, 90, 0);
      controls.update();
    }
  };

  window.onWindowResizeThree = onWindowResize;

  // DOM Bootstrap
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 30);
  }
})();
