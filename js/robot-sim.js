/**
 * @file robot-sim.js
 * @brief Interactive 3-Link Planar Kinematic Robot Arm Simulator
 * @author Sanika Patil
 *
 * Implements real-time Forward Kinematics (FK) & Inverse Kinematics (IK)
 * with HTML5 Canvas rendering, coordinate telemetry, and trajectory playback.
 */

(function () {
  const canvas = document.getElementById('robotCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Robot Physical Specifications (in mm scale)
  const L1 = 120; // Base to Shoulder/Upper Arm
  const L2 = 100; // Upper Arm to Forearm
  const L3 = 60;  // Forearm to Gripper Tool Center Point (TCP)

  // Joint Angles (in degrees)
  let q1 = 0;    // J1 Base Turntable
  let q2 = 35;   // J2 Shoulder Pitch (safe range: -10 to 105)
  let q3 = -30;  // J3 Elbow Pitch
  let gripperOpen = true;

  // Animation State
  let isAutoRunning = false;
  let autoTimer = 0;

  // Elements
  const sliderQ1 = document.getElementById('sliderQ1');
  const sliderQ2 = document.getElementById('sliderQ2');
  const sliderQ3 = document.getElementById('sliderQ3');
  const valQ1 = document.getElementById('valQ1');
  const valQ2 = document.getElementById('valQ2');
  const valQ3 = document.getElementById('valQ3');
  const valX = document.getElementById('valX');
  const valY = document.getElementById('valY');
  const btnWave = document.getElementById('btnWave');
  const btnGripper = document.getElementById('btnGripper');
  const btnReset = document.getElementById('btnReset');

  function resizeCanvas() {
    const parent = canvas.parentElement;
    const rect = canvas.getBoundingClientRect();
    let w = rect.width;
    let h = rect.height;

    if (!w || !h || w < 20 || h < 20) {
      if (parent) {
        const pRect = parent.getBoundingClientRect();
        w = pRect.width;
        h = pRect.height;
      }
    }
    if (!w || !h || w < 20 || h < 20) {
      w = 540;
      h = 405;
    }

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    drawArm(w, h);
  }

  window.addEventListener('resize', resizeCanvas);

  function degToRad(deg) {
    return (deg * Math.PI) / 180;
  }

  function radToDeg(rad) {
    return (rad * 180) / Math.PI;
  }

  function updateTelemetry(x, y) {
    if (valQ1) valQ1.textContent = `${Math.round(q1)}°`;
    if (valQ2) valQ2.textContent = `${Math.round(q2)}°`;
    if (valQ3) valQ3.textContent = `${Math.round(q3)}°`;
    if (valX) valX.textContent = `${Math.round(x)} mm`;
    if (valY) valY.textContent = `${Math.round(y)} mm`;

    if (sliderQ1 && !isAutoRunning) sliderQ1.value = q1;
    if (sliderQ2 && !isAutoRunning) sliderQ2.value = q2;
    if (sliderQ3 && !isAutoRunning) sliderQ3.value = q3;
  }

  function drawGrid(w, h, originX, originY) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;

    const step = 30;
    for (let x = 0; x < w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Work envelope boundary (Reach circle L1+L2+L3)
    const maxReach = L1 + L2 + L3;
    ctx.beginPath();
    ctx.arc(originX, originY, maxReach, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Base pedestal
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(originX - 40, originY, 80, 20, [4, 4, 0, 0]);
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawLink(x1, y1, x2, y2, color, width) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  function drawJoint(x, y, radius, label) {
    ctx.save();
    // Joint outer ring
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Center pin
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.4, 0, Math.PI * 2);
    ctx.fill();

    if (label) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px monospace';
      ctx.fillText(label, x + 12, y - 8);
    }
    ctx.restore();
  }

  function drawGripper(x, y, angle, isOpen) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.fillStyle = '#f59e0b';
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 8;

    // Gripper mount
    ctx.fillRect(-6, -4, 12, 8);

    // Finger offset based on open/closed
    const spread = isOpen ? 12 : 4;

    // Upper finger
    ctx.beginPath();
    ctx.moveTo(0, -spread);
    ctx.lineTo(16, -spread);
    ctx.lineTo(20, -spread + 4);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Lower finger
    ctx.beginPath();
    ctx.moveTo(0, spread);
    ctx.lineTo(16, spread);
    ctx.lineTo(20, spread - 4);
    ctx.stroke();

    // TCP indicator dot
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(20, 0, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawArm(forceW, forceH) {
    const dpr = window.devicePixelRatio || 1;
    let w = forceW || canvas.getBoundingClientRect().width || (canvas.width / dpr);
    let h = forceH || canvas.getBoundingClientRect().height || (canvas.height / dpr);

    if (!w || !h || w < 20 || h < 20) {
      w = 540;
      h = 405;
    }

    ctx.clearRect(0, 0, w, h);

    // Base origin point in canvas space
    const originX = w * 0.35;
    const originY = h * 0.72;

    drawGrid(w, h, originX, originY);

    // Forward Kinematics Trigonometry:
    // a1 = Shoulder Pitch (q2)
    // a2 = a1 + Elbow Pitch (q3)
    // a3 = a2 (Wrist / Tool orientation)
    const a1 = degToRad(q2);
    const a2 = a1 + degToRad(q3);
    const a3 = a2;

    // Joint 1 (Base / Shoulder)
    const j0_x = originX;
    const j0_y = originY;

    // Joint 2 (Elbow)
    const j1_x = j0_x + L1 * Math.cos(a1);
    const j1_y = j0_y - L1 * Math.sin(a1);

    // Joint 3 (Wrist)
    const j2_x = j1_x + L2 * Math.cos(a2);
    const j2_y = j1_y - L2 * Math.sin(a2);

    // End-Effector / Tool Center Point (TCP)
    const tcp_x = j2_x + L3 * Math.cos(a3);
    const tcp_y = j2_y - L3 * Math.sin(a3);

    // Render Links
    drawLink(j0_x, j0_y, j1_x, j1_y, '#38bdf8', 10); // Shoulder link (Cyan)
    drawLink(j1_x, j1_y, j2_x, j2_y, '#6366f1', 8);  // Elbow link (Indigo)
    drawLink(j2_x, j2_y, tcp_x, tcp_y, '#a855f7', 6); // Forearm link (Purple)

    // Render Joints
    drawJoint(j0_x, j0_y, 9, 'J1 (Base)');
    drawJoint(j1_x, j1_y, 8, 'J2 (Shoulder)');
    drawJoint(j2_x, j2_y, 7, 'J3 (Elbow)');

    // Render Gripper End-Effector
    drawGripper(tcp_x, tcp_y, -a3, gripperOpen);

    // Compute relative mm from robot base
    const relativeX = (tcp_x - originX);
    const relativeY = (originY - tcp_y);
    updateTelemetry(relativeX, relativeY);
  }

  // Animation Loop for Demo Wave
  function animate() {
    if (isAutoRunning) {
      autoTimer += 0.035;
      q1 = 25 * Math.sin(autoTimer * 0.7);
      q2 = 35 + 18 * Math.sin(autoTimer);
      q3 = -30 + 15 * Math.sin(autoTimer * 1.3);
      drawArm();

      // Synchronize 3D model if active
      window.dispatchEvent(new CustomEvent('threeSyncAngles', {
        detail: { q1, q2, q3 }
      }));

      requestAnimationFrame(animate);
    }
  }

  // Event Listeners
  if (sliderQ1) {
    sliderQ1.addEventListener('input', (e) => {
      isAutoRunning = false;
      if (btnWave) btnWave.classList.remove('bg-sky-500', 'text-white');
      q1 = parseFloat(e.target.value);
      drawArm();
    });
  }

  if (sliderQ2) {
    sliderQ2.addEventListener('input', (e) => {
      isAutoRunning = false;
      if (btnWave) btnWave.classList.remove('bg-sky-500', 'text-white');
      q2 = parseFloat(e.target.value);
      drawArm();
    });
  }

  if (sliderQ3) {
    sliderQ3.addEventListener('input', (e) => {
      isAutoRunning = false;
      if (btnWave) btnWave.classList.remove('bg-sky-500', 'text-white');
      q3 = parseFloat(e.target.value);
      drawArm();
    });
  }

  if (btnWave) {
    btnWave.addEventListener('click', () => {
      isAutoRunning = !isAutoRunning;
      if (isAutoRunning) {
        btnWave.classList.add('bg-sky-500', 'text-white');
        animate();
      } else {
        btnWave.classList.remove('bg-sky-500', 'text-white');
      }
    });
  }

  if (btnGripper) {
    btnGripper.addEventListener('click', () => {
      gripperOpen = !gripperOpen;
      btnGripper.textContent = gripperOpen ? 'Gripper: Open' : 'Gripper: Closed';
      drawArm();
      window.dispatchEvent(new CustomEvent('threeToggleGripper', {
        detail: { open: gripperOpen }
      }));
    });
  }

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      isAutoRunning = false;
      if (btnWave) btnWave.classList.remove('bg-sky-500', 'text-white');
      q1 = 0;
      q2 = 35;
      q3 = -30;
      gripperOpen = true;
      if (btnGripper) btnGripper.textContent = 'Gripper: Open';
      drawArm();
      window.dispatchEvent(new CustomEvent('threeToggleGripper', {
        detail: { open: true }
      }));
    });
  }

  window.resizeRobotSim = resizeCanvas;
  window.drawRobotArm = drawArm;

  // Initialize Canvas
  setTimeout(resizeCanvas, 50);
  setTimeout(resizeCanvas, 250);
})();
