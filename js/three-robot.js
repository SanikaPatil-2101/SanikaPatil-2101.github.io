/**
 * @file three-robot.js
 * @brief Interactive 3D WebGL Digital Twin of Vivek's 5-DOF Robotic Arm
 * @author Vivek Bharat Toradmal
 *
 * Renders authentic Autodesk Fusion 360 CAD meshes (Base, Shoulder, Elbow,
 * Arm, Wrist, Gripper) matching ROS 2 Humble / RViz kinematic tree, revolute axes,
 * and real-time interactive actuator controls.
 */

(function () {
  const container = document.getElementById('threeContainer');
  if (!container) return;

  let scene, camera, renderer, controls;
  let jointNodes = {};
  let gripperMesh = null;
  let isGripperOpen = true;

  // Joint angle state (degrees) matching robot-sim.js & URDF limits
  let angles = {
    j1: 0,   // Base Yaw (Revolute 1 - Z axis rotation: -90° to +90°)
    j2: 35,  // Shoulder Pitch (Revolute 2 - Z axis rotation: -10° to +105°)
    j3: -30, // Elbow Pitch (Revolute 3 - Z axis rotation: -90° to +90°)
    j4: 0,   // Wrist Roll (Revolute 4 - X axis rotation: -90° to +90°)
    j5: 0    // End-Effector Pitch (Revolute 5 - X axis rotation: -60° to +60°)
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

  /**
   * Sets URDF Transform with intrinsic ZYX rotation order.
   */
  function setURDFTransform(obj, xyz, rpyArr) {
    obj.position.set(xyz[0], xyz[1], xyz[2]);
    obj.rotation.order = 'ZYX';
    obj.rotation.set(rpyArr[0], rpyArr[1], rpyArr[2]);
  }

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
    // 1. Set Robotic Coordinate Frame: Z is UP (matching ROS 2 / Autodesk Fusion 360)
    THREE.Object3D.DefaultUp.set(0, 0, 1);

    // 2. Scene Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d);
    scene.fog = new THREE.FogExp2(0x0a0f1d, 0.45);

    // 3. Camera Setup (Meter scale: ~0.5m viewing distance)
    const width = container.clientWidth || 540;
    const height = container.clientHeight || 400;
    const aspect = width / height;
    camera = new THREE.PerspectiveCamera(45, aspect, 0.01, 20.0);
    camera.position.set(-0.45, -0.55, 0.38);

    // 4. Renderer Setup
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 5. Orbit Controls (Targeting Center of Robot Kinematics)
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.04; // Restrict camera from sinking beneath floor
    controls.minDistance = 0.15;
    controls.maxDistance = 1.8;
    controls.target.set(-0.08, -0.06, 0.12);
    controls.update();

    // 6. Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.25);
    keyLight.position.set(1.0, -1.0, 2.0);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 0.1;
    keyLight.shadow.camera.far = 4.0;
    keyLight.shadow.bias = -0.001;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.65);
    fillLight.position.set(-1.0, 1.0, 1.2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x818cf8, 0.45);
    rimLight.position.set(0.5, 1.5, 0.6);
    scene.add(rimLight);

    // 7. Ground Grid (Lies in XY plane at Z=0 ground elevation)
    const grid = new THREE.GridHelper(0.9, 18, 0x38bdf8, 0x1e293b);
    grid.rotation.x = Math.PI / 2;
    grid.position.set(-0.08, 0, 0);
    grid.receiveShadow = true;
    scene.add(grid);

    // 8. Assemble Robot Model from Authentic CAD STLs
    buildRobotArm();

    // 9. Event Listeners & Input Sync
    window.addEventListener('resize', onWindowResize);
    setupSliderListeners();

    // 10. Start Animation Render Loop
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
   * Builds the authentic CAD assembly using Vivek's exact Fusion 360 / ROS 2 URDF tree.
   */
  function assembleCadRobot(loader) {
    const stl = window.ROBOT_STL_DATA;

    // --- Kinematic Hierarchy (Exact URDF Frame Offsets in Meters) ---
    const worldNode = new THREE.Group();
    scene.add(worldNode);

    // Joint 1: Base Turntable Yaw ([-0.10, 0, 0.07], axis: [0, 0, 1])
    const j1 = new THREE.Group();
    setURDFTransform(j1, [-0.10, 0, 0.07], [0, 0, 0]);
    worldNode.add(j1);
    const j1_rot = new THREE.Group();
    j1.add(j1_rot);

    // Joint 2: Shoulder Pitch ([0.00906, -0.01413, 0.03490], rpy: [1.5708, 0, -1.5708], axis: [0, 0, 1])
    const j2 = new THREE.Group();
    setURDFTransform(j2, [0.00906, -0.01413, 0.03490], [1.5708, 0, -1.5708]);
    j1_rot.add(j2);
    const j2_rot = new THREE.Group();
    j2.add(j2_rot);

    // Joint 3: Elbow Pitch ([0.1115, 0, 0], rpy: [3.1416, 0, 1.5708], axis: [0, 0, 1])
    const j3 = new THREE.Group();
    setURDFTransform(j3, [0.1115, 0, 0], [3.1416, 0, 1.5708]);
    j2_rot.add(j3);
    const j3_rot = new THREE.Group();
    j3.add(j3_rot);

    // Joint 4: Wrist Roll ([0.1035, -0.008, 0.01825], rpy: [3.14159, 0, 0], axis: [1, 0, 0])
    const j4 = new THREE.Group();
    setURDFTransform(j4, [0.1035, -0.008, 0.01825], [3.14159, 0, 0]);
    j3_rot.add(j4);
    const j4_rot = new THREE.Group();
    j4.add(j4_rot);

    // Joint 5: Gripper Pitch ([0.021, 0, -0.0165], rpy: [3.14159, -1.5708, 0], axis: [1, 0, 0])
    const j5 = new THREE.Group();
    setURDFTransform(j5, [0.021, 0, -0.0165], [3.14159, -1.5708, 0]);
    j4_rot.add(j5);
    const j5_rot = new THREE.Group();
    j5.add(j5_rot);

    jointNodes = { j1_rot, j2_rot, j3_rot, j4_rot, j5_rot };

    // --- Mesh Offsets (Exact URDF Visual Tag Offsets) ---
    const linkConfigs = [
      { key: 'Base', parent: worldNode, offset: [0, 0, 0], mat: baseMat },
      { key: 'Shoulder', parent: j1_rot, offset: [0, 0, 0], mat: shoulderMat },
      { key: 'Elbow', parent: j2_rot, offset: [0, 0, 0], mat: elbowMat },
      { key: 'arm', parent: j3_rot, offset: [0, 0, 0], mat: armMat },
      { key: 'Wrist', parent: j4_rot, offset: [0, 0.015, -0.0125], mat: wristMat },
      { key: 'Gripper', parent: j5_rot, offset: [-0.013936, 0.020, 0.015], mat: gripperMat }
    ];

    linkConfigs.forEach(({ key, parent, offset, mat }) => {
      if (stl[key]) {
        const buf = base64ToArrayBuffer(stl[key]);
        const geom = loader.parse(buf);
        geom.computeVertexNormals();
        const mesh = new THREE.Mesh(geom, mat);
        // Scale millimeter CAD coordinates into meters
        mesh.scale.set(0.001, 0.001, 0.001);
        mesh.position.set(offset[0], offset[1], offset[2]);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        parent.add(mesh);

        if (key === 'Gripper') {
          gripperMesh = mesh;
        }
      }
    });
  }

  /**
   * Procedural fallback if CAD STL binary data is unavailable.
   */
  function buildProceduralFallback() {
    const worldNode = new THREE.Group();
    scene.add(worldNode);

    const baseCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 0.07, 32), baseMat);
    baseCyl.rotation.x = Math.PI / 2;
    baseCyl.position.set(-0.10, 0, 0.035);
    worldNode.add(baseCyl);

    const j1 = new THREE.Group();
    setURDFTransform(j1, [-0.10, 0, 0.07], [0, 0, 0]);
    worldNode.add(j1);
    const j1_rot = new THREE.Group();
    j1.add(j1_rot);

    const shTurret = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.05, 32), shoulderMat);
    shTurret.rotation.x = Math.PI / 2;
    shTurret.position.set(0, 0, 0.025);
    j1_rot.add(shTurret);

    const j2 = new THREE.Group();
    setURDFTransform(j2, [0.00906, -0.01413, 0.03490], [1.5708, 0, -1.5708]);
    j1_rot.add(j2);
    const j2_rot = new THREE.Group();
    j2.add(j2_rot);

    const arm1Beam = new THREE.Mesh(new THREE.BoxGeometry(0.111, 0.016, 0.02), elbowMat);
    arm1Beam.position.set(0.055, 0, 0);
    j2_rot.add(arm1Beam);

    const j3 = new THREE.Group();
    setURDFTransform(j3, [0.1115, 0, 0], [3.1416, 0, 1.5708]);
    j2_rot.add(j3);
    const j3_rot = new THREE.Group();
    j3.add(j3_rot);

    const arm2Beam = new THREE.Mesh(new THREE.BoxGeometry(0.103, 0.014, 0.018), armMat);
    arm2Beam.position.set(0.051, 0, 0);
    j3_rot.add(arm2Beam);

    const j4 = new THREE.Group();
    setURDFTransform(j4, [0.1035, -0.008, 0.01825], [3.14159, 0, 0]);
    j3_rot.add(j4);
    const j4_rot = new THREE.Group();
    j4.add(j4_rot);

    const wristCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.025, 16), wristMat);
    wristCyl.position.set(0.01, 0, 0);
    j4_rot.add(wristCyl);

    const j5 = new THREE.Group();
    setURDFTransform(j5, [0.021, 0, -0.0165], [3.14159, -1.5708, 0]);
    j4_rot.add(j5);
    const j5_rot = new THREE.Group();
    j5.add(j5_rot);

    const gripMesh = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.02, 0.025), gripperMat);
    gripMesh.position.set(0, 0.02, 0);
    j5_rot.add(gripMesh);

    jointNodes = { j1_rot, j2_rot, j3_rot, j4_rot, j5_rot };
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

    if (gripperMesh) {
      // Subtle visual clamp motion on end-effector
      gripperMesh.scale.x = open ? 0.001 : 0.00092;
      gripperMesh.scale.z = open ? 0.001 : 0.00088;
    }
  }

  /**
   * Applies the exact joint kinematics matching ROS 2 Humble revolute axes.
   */
  function updateJoints() {
    // Joint 1: Base Yaw (Around local Z-axis)
    if (jointNodes.j1_rot) {
      jointNodes.j1_rot.rotation.z = THREE.MathUtils.degToRad(angles.j1);
    }
    // Joint 2: Shoulder Pitch (Around local Z-axis, safe mechanical limits: -10° to +105°)
    if (jointNodes.j2_rot) {
      const clampedJ2 = Math.min(Math.max(angles.j2, -10), 105);
      jointNodes.j2_rot.rotation.z = THREE.MathUtils.degToRad(clampedJ2);
    }
    // Joint 3: Elbow Pitch (Around local Z-axis)
    if (jointNodes.j3_rot) {
      jointNodes.j3_rot.rotation.z = THREE.MathUtils.degToRad(angles.j3);
    }
    // Joint 4: Wrist Roll (Around local X-axis)
    if (jointNodes.j4_rot) {
      jointNodes.j4_rot.rotation.x = THREE.MathUtils.degToRad(angles.j4);
    }
    // Joint 5: End-Effector Pitch (Around local X-axis)
    if (jointNodes.j5_rot) {
      jointNodes.j5_rot.rotation.x = THREE.MathUtils.degToRad(angles.j5);
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

    if (btnGrip) {
      btnGrip.addEventListener('click', () => {
        setGripperState(!isGripperOpen);
      });
    }

    if (btnReset) {
      btnReset.addEventListener('click', () => {
        angles.j1 = 0;
        angles.j2 = 35;
        angles.j3 = -30;
        angles.j4 = 0;
        angles.j5 = 0;
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

  // Public Camera Reset
  window.resetThreeCamera = function () {
    if (controls && camera) {
      camera.position.set(-0.45, -0.55, 0.38);
      controls.target.set(-0.08, -0.06, 0.12);
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
