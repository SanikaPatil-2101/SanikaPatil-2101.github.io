/**
 * @file main.js
 * @brief Core Portfolio UI interactions, Project Filtering & Modal Data
 * @author Sanika Patil
 */

// Project Detailed Specifications Database
const PROJECTS_DATA = {
  'ros2-arm': {
    title: '5-DOF Articulated Robotic Arm Digital Twin & Geared Gripper',
    category: 'Robotics & Control',
    badges: ['ROS 2 Humble', 'URDF / Xacro', 'Three.js 3D Web Twin', 'RViz2', 'Gazebo', 'Autodesk Fusion 360', 'Arduino Serial Bridge'],
    githubUrl: 'https://github.com/SanikaPatil-2101/6dof-robotic-arm-ros2',
    summary: 'An end-to-end industrial robotics digital twin and physical prototype. Designed parametrically in Autodesk Fusion 360 and exported with custom physical collision hulls, inertias, and geared 4-bar parallel gripper mimic joints.',
    highlights: [
      '<b>Complete Kinematic Stack</b>: Forward & Inverse Kinematics formulations (FK/IK) with analytical joint angle limits.',
      '<b>Interactive 3D Web Command Center</b>: Runs directly in browser at port 8080 using Three.js, featuring Cartesian jog controls, multi-color cube sorting (RGB), and Teach & Replay waypoint recording.',
      '<b>Hardware Serial Bridge</b>: Synchronizes virtual joint angles to physical Arduino/ESP32 driving high-torque MG996R and SG90 servos with 50 Hz PWM microsecond telemetry.',
      '<b>CAD Vault Included</b>: Complete 7.3 MB 3D STEP assembly (`DOF Robotic arm v2.step`) and 2D engineering PDF drawings.'
    ],
    metrics: [
      { label: 'Degrees of Freedom', val: '5-DOF + Gripper' },
      { label: 'Payload Capacity', val: '500g' },
      { label: 'Max Work Reach', val: '380 mm' },
      { label: 'Actuators', val: 'MG996R & SG90' }
    ]
  },
  'esp32-iot': {
    title: 'Industrial IoT Smart Relay & Energy Monitoring Controller',
    category: 'Embedded Systems & IoT',
    badges: ['ESP32 Dual-Core', 'FreeRTOS', 'PlatformIO', 'Blynk IoT 2.0', 'NVS Flash Preferences', 'Galvanic Isolation'],
    githubUrl: 'https://github.com/SanikaPatil-2101/esp32-industrial-iot-controller',
    summary: 'An industrial-grade IoT controller engineered on the ESP-WROOM-32 microcontroller for factory equipment power monitoring, remote switching, and continuous telemetry.',
    highlights: [
      '<b>NVS Flash Memory Protection</b>: Utilizes non-volatile flash partitions (`Preferences.h`) to periodically checkpoint accumulated kWh metrics, guarding against data loss during industrial power outages.',
      '<b>Asynchronous Energy Math</b>: Millisecond-accurate electrical energy accumulation engine streamed directly to cloud dashboards.',
      '<b>Cloud Telemetry & Mobile Sync</b>: Seamlessly connected to Blynk 2.0 with low-latency switching (<150 ms) and real-time power analytics.',
      '<b>Hardware Safety</b>: Optocoupler-isolated relay driving with status feedback LED and tactile manual override input.'
    ],
    metrics: [
      { label: 'Microcontroller', val: 'ESP32 (240MHz)' },
      { label: 'Wireless Protocol', val: 'Wi-Fi 802.11 b/g/n' },
      { label: 'Telemetry Cloud', val: 'Blynk IoT 2.0' },
      { label: 'Relay Rating', val: '10A @ 250VAC' }
    ]
  },
  'corexy-3d': {
    title: 'Precision DIY 3D Printer (CoreXY Architecture)',
    category: 'Mechanical Design & CAD',
    badges: ['CoreXY Kinematics', 'Marlin 2.0 Firmware', 'SolidWorks CAD', 'TMC Silent Steppers', 'FDM 3D Printing'],
    githubUrl: 'https://github.com/SanikaPatil-2101/Autonomous-mobile-robot-',
    summary: 'A precision desktop 3D printer engineered with CoreXY kinematics for high-speed, vibration-damped additive manufacturing.',
    highlights: [
      '<b>CoreXY Kinematic Design</b>: Dual-stationary motor setup drastically reduces gantry moving mass for sharp corners and high print acceleration.',
      '<b>Custom Mechanical Upgrades</b>: SolidWorks-designed custom hotend cooling duct, rigid aluminum extrusion brackets, and precision belt tensioners.',
      '<b>Firmware Optimization</b>: Configured Marlin firmware with PID thermal tuning, microstepping calibration, and linear advance.',
      '<b>Full Build Log</b>: Open-source CAD files, technical drawings, and comprehensive wiring schematics.'
    ],
    metrics: [
      { label: 'Kinematics', val: 'CoreXY Planar' },
      { label: 'Print Volume', val: '220 x 220 x 250 mm' },
      { label: 'Firmware', val: 'Marlin 2.0' },
      { label: 'CAD Software', val: 'SolidWorks' }
    ]
  }
};

document.addEventListener('DOMContentLoaded', () => {
  // 1. Mobile Menu Toggle
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mobileMenu = document.getElementById('mobileMenu');
  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener('click', () => {
      mobileMenu.classList.toggle('hidden');
    });
  }

  // 2. Project Filtering
  const filterBtns = document.querySelectorAll('.filter-btn');
  const projectCards = document.querySelectorAll('.project-card');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => {
        b.classList.remove('bg-sky-500', 'text-white');
        b.classList.add('bg-slate-800', 'text-slate-300');
      });
      btn.classList.remove('bg-slate-800', 'text-slate-300');
      btn.classList.add('bg-sky-500', 'text-white');

      const filter = btn.getAttribute('data-filter');
      projectCards.forEach(card => {
        if (filter === 'all' || card.getAttribute('data-category') === filter) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });

  // 3. Project Details Modal
  const modal = document.getElementById('projectModal');
  const modalContent = document.getElementById('modalContent');
  const modalClose = document.getElementById('modalClose');

  function openProjectModal(projectId) {
    const data = PROJECTS_DATA[projectId];
    if (!data || !modal || !modalContent) return;

    modalContent.innerHTML = `
      <div class="mb-4">
        <span class="text-xs font-semibold px-2.5 py-1 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">${data.category}</span>
        <h2 class="text-2xl font-bold text-white mt-2">${data.title}</h2>
      </div>

      <p class="text-slate-300 text-sm leading-relaxed mb-6">${data.summary}</p>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 bg-slate-900/60 p-4 rounded-xl border border-white/5">
        ${data.metrics.map(m => `
          <div>
            <div class="text-[11px] text-slate-400 uppercase tracking-wider">${m.label}</div>
            <div class="text-sm font-semibold text-white mt-0.5">${m.val}</div>
          </div>
        `).join('')}
      </div>

      <div class="mb-6">
        <h4 class="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <i class="fa-solid fa-microchip text-sky-400"></i> Key Technical Highlights
        </h4>
        <ul class="space-y-2 text-xs sm:text-sm text-slate-300">
          ${data.highlights.map(h => `
            <li class="flex items-start gap-2.5">
              <i class="fa-solid fa-check text-emerald-400 mt-1 flex-shrink-0"></i>
              <span>${h}</span>
            </li>
          `).join('')}
        </ul>
      </div>

      <div class="mb-6">
        <h4 class="text-sm font-semibold text-slate-200 mb-2">Technologies Used</h4>
        <div class="flex flex-wrap gap-1.5">
          ${data.badges.map(b => `<span class="tech-pill">${b}</span>`).join('')}
        </div>
      </div>

      <div class="flex items-center justify-between pt-4 border-t border-white/10 mt-6">
        <a href="${data.githubUrl}" target="_blank" rel="noopener noreferrer" 
           class="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-medium text-sm transition">
          <i class="fa-brands fa-github text-base"></i> View on GitHub
        </a>
        <button onclick="document.getElementById('projectModal').classList.add('hidden')" 
                class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition">
          Close
        </button>
      </div>
    `;

    modal.classList.remove('hidden');
  }

  window.openProjectModal = openProjectModal;

  if (modalClose) {
    modalClose.addEventListener('click', () => {
      modal.classList.add('hidden');
    });
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
      }
    });
  }

  // 4. Copy Email & Quick Contact
  window.copyEmail = function () {
    const email = 'sanikapatil2101@gmail.com';
    navigator.clipboard.writeText(email).then(() => {
      const toast = document.getElementById('copyToast');
      if (toast) {
        toast.classList.remove('opacity-0', 'pointer-events-none');
        setTimeout(() => toast.classList.add('opacity-0', 'pointer-events-none'), 2500);
      }
    });
  };

  // 5. Active Nav Highlight on Scroll
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link');

  window.addEventListener('scroll', () => {
    let current = '';
    const scrollY = window.pageYOffset;

    sections.forEach(sec => {
      const secHeight = sec.offsetHeight;
      const secTop = sec.offsetTop - 120;
      if (scrollY > secTop && scrollY <= secTop + secHeight) {
        current = sec.getAttribute('id');
      }
    });

    navLinks.forEach(link => {
      link.classList.remove('text-sky-400');
      if (link.getAttribute('href') === `#${current}`) {
        link.classList.add('text-sky-400');
      }
    });
  });
});
