// ==================== GAME STATE ====================
const G = {
    cash: 500, agents: [], leads: 50, reputation: 75,
    day: 1, hour: 9, minute: 0, isRunning: true, speed: 1,
    dials: 0, contacts: 0, conversions: 0, revenue: 0, costs: 0,
    upgrades: {}, hasSupervisor: false, hasCoffee: false,
    totalRevenue: 0, totalSales: 0 // Lifetime stats
};

// ==================== SAVE/LOAD SYSTEM ====================
const SAVE_KEY = 'callcenter_tycoon_save';

function saveGame() {
    const saveData = {
        cash: G.cash,
        leads: G.leads,
        reputation: G.reputation,
        day: G.day,
        upgrades: G.upgrades,
        hasSupervisor: G.hasSupervisor,
        hasCoffee: G.hasCoffee,
        totalRevenue: G.totalRevenue,
        totalSales: G.totalSales,
        agentCount: G.agents.length
    };
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
    } catch (e) {
        console.warn('Save failed:', e);
    }
}

function loadGame() {
    try {
        const data = localStorage.getItem(SAVE_KEY);
        if (!data) return false;

        const save = JSON.parse(data);
        G.cash = save.cash || 500;
        G.leads = save.leads || 50;
        G.reputation = save.reputation || 75;
        G.day = save.day || 1;
        G.upgrades = save.upgrades || {};
        G.hasSupervisor = save.hasSupervisor || false;
        G.hasCoffee = save.hasCoffee || false;
        G.totalRevenue = save.totalRevenue || 0;
        G.totalSales = save.totalSales || 0;

        return save;
    } catch (e) {
        console.warn('Load failed:', e);
        return false;
    }
}

function resetGame() {
    localStorage.removeItem(SAVE_KEY);
    location.reload();
}

// Auto-save every 30 seconds
setInterval(saveGame, 30000);

// ==================== SOUND SYSTEM ====================
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let soundEnabled = true;
let musicEnabled = true;
let musicOsc = null;
let musicGain = null;

function playTone(freq, duration, type = 'sine', volume = 0.15) {
    if (!soundEnabled) return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.value = volume;
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch (e) { }
}

// Background music using royalty-free audio
let musicAudio = null;

function startMusic() {
    if (musicAudio) return;
    try {
        // Using a royalty-free lofi track from Mixkit
        musicAudio = new Audio('https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3');
        musicAudio.loop = true;
        musicAudio.volume = musicEnabled ? 0.15 : 0;
        musicAudio.play().catch(e => console.log('Music autoplay blocked'));
    } catch (e) { console.log('Music error:', e); }
}

function stopMusic() {
    if (musicAudio) {
        try {
            musicAudio.pause();
            musicAudio = null;
        } catch (e) { }
    }
}

function updateMusicVolume() {
    if (musicAudio) {
        musicAudio.volume = musicEnabled ? 0.15 : 0;
    }
}

function playCashSound() {
    playTone(880, 0.1, 'sine', 0.1);
    setTimeout(() => playTone(1100, 0.15, 'sine', 0.12), 80);
}

function playPurchaseSound() {
    playTone(440, 0.08, 'square', 0.08);
    setTimeout(() => playTone(660, 0.12, 'square', 0.1), 60);
}

function playErrorSound() {
    playTone(200, 0.15, 'sawtooth', 0.08);
}

function playWakeSound() {
    playTone(523, 0.1, 'sine', 0.1);
    setTimeout(() => playTone(659, 0.1, 'sine', 0.1), 100);
    setTimeout(() => playTone(784, 0.15, 'sine', 0.12), 200);
}

function playDayEndSound() {
    playTone(392, 0.2, 'sine', 0.1);
    setTimeout(() => playTone(523, 0.3, 'sine', 0.12), 200);
}

// ==================== START MENU ====================
let gameStarted = false;
let isNewGame = false;

function initStartMenu() {
    const hasSave = localStorage.getItem(SAVE_KEY) !== null;
    const continueBtn = document.getElementById('btn-continue');
    const newGameBtn = document.getElementById('btn-new-game');

    if (hasSave) {
        continueBtn.disabled = false;
        continueBtn.textContent = '▶️ Continue (Day ' + (JSON.parse(localStorage.getItem(SAVE_KEY)).day || 1) + ')';
    }

    continueBtn.addEventListener('click', () => {
        if (hasSave) {
            isNewGame = false;
            startGame();
        }
    });

    newGameBtn.addEventListener('click', () => {
        localStorage.removeItem(SAVE_KEY);
        isNewGame = true;
        startGame();
    });
}

function startGame() {
    document.getElementById('start-menu').classList.add('hidden');
    document.getElementById('loading-screen').classList.remove('hidden');
    startMusic();
    gameStarted = true;
    init();
}

// ==================== TUTORIAL SYSTEM ====================
const tutorial = {
    active: false,
    step: 0,
    stepCompleteTime: 0, // Delay between step completion and advance
    steps: [
        {
            message: '👋 Welcome to Call Center Tycoon!',
            hint: 'Use WASD to walk around the office',
            check: () => isWalking,
            delay: 0
        },
        {
            message: '👔 Walk to the glowing SUPERVISOR pad',
            hint: "It's FREE! Auto-wakes sleeping agents",
            check: () => currentPad && currentPad.userData.upgrade.id === 'super',
            delay: 0
        },
        {
            message: '👔 Press E to hire your FREE Supervisor!',
            hint: 'Supervisors auto-wake sleeping agents',
            check: () => G.hasSupervisor,
            delay: 1000
        },
        {
            message: '📋 Walk to the glowing LEADS pad',
            hint: 'Leads are customers to call - look for the pulsing pad!',
            check: () => currentPad && currentPad.userData.upgrade.id === 'leads_50',
            delay: 0
        },
        {
            message: '🛒 Press E to buy 50 leads!',
            hint: 'Leads cost $100 but are worth it',
            check: () => G.upgrades.leads_50 > 0,
            delay: 500
        },
        {
            message: '📞 Your agent is making calls!',
            hint: 'Watch the activity feed on the left',
            check: () => G.dials > 3,
            delay: 3000
        },
        {
            message: '💰 Nice! Agents convert calls into $$',
            hint: 'Watch the activity feed for sales',
            check: () => G.contacts > 0,
            delay: 1500
        },
        {
            message: '😴 Agents get TIRED over time',
            hint: 'They turn GREY when asleep - supervisor will wake them!',
            check: () => G.agents.some(a => a.state === 'tired' || a.state === 'sleeping'),
            delay: 0
        },
        {
            message: '💤 Watch the supervisor wake them!',
            hint: 'Purple supervisor walks over and wakes grey agents',
            check: () => G.totalWakes && G.totalWakes > 0,
            delay: 2000
        },
        {
            message: '👤 Hire more agents to scale up!',
            hint: 'Walk to the glowing HIRE pad and press E',
            check: () => G.agents.length > 1,
            delay: 500
        },
        {
            message: '🚀 Tutorial Complete!',
            hint: 'Explore all upgrade pads to grow your call center!',
            check: () => true,
            delay: 2000
        }
    ]
};

let tutorialTimer = 0;

function startTutorial() {
    tutorial.active = true;
    tutorial.step = 0;
    tutorial.stepCompleteTime = 0;
    tutorialTimer = 0;
    updateTutorialUI();
    document.getElementById('tutorial-overlay').classList.add('visible');
}

function updateTutorialUI() {
    if (!tutorial.active) return;
    const s = tutorial.steps[tutorial.step];
    document.getElementById('tutorial-step').textContent = `Step ${tutorial.step + 1} of ${tutorial.steps.length}`;
    document.getElementById('tutorial-message').textContent = s.message;
    document.getElementById('tutorial-hint').textContent = s.hint;
}

function checkTutorial() {
    if (!tutorial.active) return;

    // Highlight relevant pads based on current step
    if (tutorial.step === 1 || tutorial.step === 2) {
        // Highlight supervisor pad (steps 1-2)
        const superPad = pads.find(p => p.userData.upgrade.id === 'super');
        if (superPad) {
            const ring = superPad.userData.ring;
            const btn = superPad.userData.btn;
            if (ring) {
                ring.material.opacity = 0.6 + Math.sin(Date.now() * 0.008) * 0.3;
                ring.scale.setScalar(1.1 + Math.sin(Date.now() * 0.005) * 0.1);
            }
            if (btn) btn.material.emissiveIntensity = 0.5 + Math.sin(Date.now() * 0.006) * 0.3;
        }
    } else if (tutorial.step === 3 || tutorial.step === 4) {
        // Highlight leads_50 pad (steps 3-4)
        const leadsPad = pads.find(p => p.userData.upgrade.id === 'leads_50');
        if (leadsPad) {
            const ring = leadsPad.userData.ring;
            const btn = leadsPad.userData.btn;
            if (ring) {
                ring.material.opacity = 0.6 + Math.sin(Date.now() * 0.008) * 0.3;
                ring.scale.setScalar(1.1 + Math.sin(Date.now() * 0.005) * 0.1);
            }
            if (btn) btn.material.emissiveIntensity = 0.5 + Math.sin(Date.now() * 0.006) * 0.3;
        }
    } else if (tutorial.step === 9) {
        // Highlight hire pad (step 9)
        const hirePad = pads.find(p => p.userData.upgrade.id === 'hire');
        if (hirePad) {
            const ring = hirePad.userData.ring;
            const btn = hirePad.userData.btn;
            if (ring) {
                ring.material.opacity = 0.6 + Math.sin(Date.now() * 0.008) * 0.3;
                ring.scale.setScalar(1.1 + Math.sin(Date.now() * 0.005) * 0.1);
            }
            if (btn) btn.material.emissiveIntensity = 0.5 + Math.sin(Date.now() * 0.006) * 0.3;
        }
    }

    const s = tutorial.steps[tutorial.step];

    // Check if step is complete
    if (s.check()) {
        if (tutorial.stepCompleteTime === 0) {
            tutorial.stepCompleteTime = Date.now();
            playTone(600, 0.1, 'sine', 0.1);
        }
        // Wait for delay before advancing
        if (Date.now() - tutorial.stepCompleteTime > s.delay) {
            tutorial.step++;
            tutorial.stepCompleteTime = 0;
            if (tutorial.step >= tutorial.steps.length) {
                endTutorial();
            } else {
                updateTutorialUI();
            }
        }
    }
}

function endTutorial() {
    tutorial.active = false;
    document.getElementById('tutorial-overlay').classList.remove('visible');
    addActivity('🎓', 'Tutorial complete! You\'re ready to run a call center!', 'success');
}

function skipTutorial() {
    endTutorial();
}


// ==================== SMART RECOMMENDATION ====================
// getRecommendedUpgrade function kept for potential internal use

function getRecommendedUpgrade() {
    const agents = G.agents.length;
    const leads = G.leads;
    const cash = G.cash;
    const sleepingCount = G.agents.filter(a => a.state === 'sleeping').length;
    const leadsPerAgent = agents > 0 ? leads / agents : leads;

    // Helper to check affordability
    const canAfford = (id) => {
        const u = UPGRADES.find(x => x.id === id);
        if (!u) return false;
        const lvl = G.upgrades[u.id] || 0;
        if (u.max && lvl >= u.max) return false;
        const cost = Math.floor(u.cost * Math.pow(u.mult || 1, lvl));
        return cash >= cost;
    };

    const getUpgrade = (id) => UPGRADES.find(x => x.id === id);

    // === CRITICAL: SURVIVAL ===
    if (leads < 10) {
        if (canAfford('leads_200')) return getUpgrade('leads_200');
        if (canAfford('leads_50')) return getUpgrade('leads_50');
    }

    // === URGENT: SLEEPING AGENTS ===
    if (sleepingCount > 0) {
        if (!G.hasSupervisor && canAfford('super')) return getUpgrade('super');
        if (!G.hasCoffee && canAfford('coffee')) return getUpgrade('coffee');
    }

    // === LOW LEADS WARNING ===
    if (leadsPerAgent < 25) {
        if (canAfford('leads_200')) return getUpgrade('leads_200');
        if (canAfford('leads_50')) return getUpgrade('leads_50');
    }

    // === EARLY GAME: GROW ===
    if (agents < 3 && canAfford('hire')) {
        return getUpgrade('hire');
    }

    // === MID GAME: EFFICIENCY ===
    if (!(G.upgrades.power) && canAfford('power')) {
        return getUpgrade('power');
    }

    if ((G.upgrades.script || 0) < 3 && canAfford('script')) {
        return getUpgrade('script');
    }

    if ((G.upgrades.local || 0) < 2 && canAfford('local')) {
        return getUpgrade('local');
    }

    // === SCALE: MORE AGENTS ===
    if (leadsPerAgent > 40 && canAfford('hire')) {
        return getUpgrade('hire');
    }

    // === LATE GAME ===
    if (!(G.upgrades.predict) && canAfford('predict')) {
        return getUpgrade('predict');
    }

    if ((G.upgrades.qa || 0) < 2 && canAfford('qa')) {
        return getUpgrade('qa');
    }

    // === DEFAULT: LEADS ===
    if (canAfford('leads_200')) return getUpgrade('leads_200');
    if (canAfford('leads_50')) return getUpgrade('leads_50');

    // Can't afford anything, point to cheapest
    return getUpgrade('leads_50');
}

// Arrow removed - keeping getRecommendedUpgrade for internal use if needed

// ==================== COFFEE MACHINE ====================
function spawnCoffeeMachine() {
    G.hasCoffee = true;

    // Create visible coffee machine near water cooler
    const machine = new THREE.Group();

    // Body
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 1.4, 0.6),
        new THREE.MeshStandardMaterial({ color: 0x2d2d2d, metalness: 0.5, roughness: 0.3 })
    );
    body.position.y = 0.7;
    machine.add(body);

    // Coffee pot
    const pot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.18, 0.4, 12),
        new THREE.MeshPhysicalMaterial({ color: 0x4a3c31, transparent: true, opacity: 0.8 })
    );
    pot.position.set(0.1, 0.5, 0.35);
    machine.add(pot);

    // Accent strip
    const accent = new THREE.Mesh(
        new THREE.BoxGeometry(0.82, 0.1, 0.62),
        new THREE.MeshStandardMaterial({ color: 0xec4899, emissive: 0xec4899, emissiveIntensity: 0.3 })
    );
    accent.position.y = 1.2;
    machine.add(accent);

    machine.position.set(16, 0, -15);
    machine.castShadow = true;
    scene.add(machine);

    addActivity('☕', 'Coffee machine installed!', 'success');
}

// ==================== ERGO CHAIRS UPGRADE ====================
function upgradeChairs() {
    // Change all desk chairs to premium green color
    desks.forEach(d => {
        if (d.userData.chair) {
            d.userData.chair.material.color.setHex(0x22c55e);
            d.userData.chair.material.emissive = new THREE.Color(0x22c55e);
            d.userData.chair.material.emissiveIntensity = 0.15;
        }
    });
    addActivity('🪑', 'Ergonomic chairs installed!', 'success');
}

// ==================== BREAK ROOM ====================
function spawnBreakRoom() {
    const room = new THREE.Group();

    // Couch
    const couchBase = new THREE.Mesh(
        new THREE.BoxGeometry(3, 0.6, 1.2),
        new THREE.MeshStandardMaterial({ color: 0x6366f1, roughness: 0.8 })
    );
    couchBase.position.y = 0.3;
    room.add(couchBase);

    // Couch back
    const couchBack = new THREE.Mesh(
        new THREE.BoxGeometry(3, 1, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x4f46e5, roughness: 0.8 })
    );
    couchBack.position.set(0, 0.8, -0.45);
    room.add(couchBack);

    // Couch armrests
    [-1.4, 1.4].forEach(x => {
        const arm = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 0.8, 1.2),
            new THREE.MeshStandardMaterial({ color: 0x4f46e5, roughness: 0.8 })
        );
        arm.position.set(x, 0.5, 0);
        room.add(arm);
    });

    // Cushions
    [-0.7, 0, 0.7].forEach(x => {
        const cushion = new THREE.Mesh(
            new THREE.BoxGeometry(0.6, 0.15, 0.8),
            new THREE.MeshStandardMaterial({ color: 0x818cf8, roughness: 0.9 })
        );
        cushion.position.set(x, 0.65, 0.05);
        room.add(cushion);
    });

    // Coffee table
    const table = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 0.08, 0.8),
        new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.4, metalness: 0.1 })
    );
    table.position.set(0, 0.45, 1.2);
    room.add(table);

    // Table legs
    [[-0.6, 0.75], [0.6, 0.75], [-0.6, 1.65], [0.6, 1.65]].forEach(([x, z]) => {
        const leg = new THREE.Mesh(
            new THREE.CylinderGeometry(0.04, 0.04, 0.45, 8),
            new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.5 })
        );
        leg.position.set(x, 0.22, z);
        room.add(leg);
    });

    // Magazine on table
    const mag = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.02, 0.4),
        new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.6 })
    );
    mag.position.set(0.2, 0.5, 1.2);
    mag.rotation.y = 0.3;
    room.add(mag);

    // Small plant
    const pot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.12, 0.25, 12),
        new THREE.MeshStandardMaterial({ color: 0x92400e })
    );
    pot.position.set(-0.4, 0.55, 1.2);
    room.add(pot);

    const leaves = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0x22c55e })
    );
    leaves.position.set(-0.4, 0.82, 1.2);
    room.add(leaves);

    room.position.set(16, 0, -10);

    // Bounce-in animation
    room.scale.set(0, 0, 0);
    scene.add(room);
    const startTime = Date.now();
    function animateIn() {
        const elapsed = (Date.now() - startTime) / 600;
        if (elapsed < 1) {
            // Elastic ease out
            const t = elapsed;
            const s = 1 - Math.pow(1 - t, 3) * Math.cos(t * Math.PI * 2.5);
            room.scale.set(s, s, s);
            requestAnimationFrame(animateIn);
        } else {
            room.scale.set(1, 1, 1);
        }
    }
    animateIn();

    addActivity('🛋️', 'Break room installed! Agents recover faster.', 'success');
}

// ==================== SNACK BAR ====================
function spawnSnackBar() {
    const bar = new THREE.Group();

    // Counter/bar top
    const counter = new THREE.Mesh(
        new THREE.BoxGeometry(2.5, 1.1, 0.8),
        new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3, metalness: 0.2 })
    );
    counter.position.y = 0.55;
    bar.add(counter);

    // Counter top surface
    const surface = new THREE.Mesh(
        new THREE.BoxGeometry(2.7, 0.08, 1.0),
        new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.2, metalness: 0.3 })
    );
    surface.position.y = 1.15;
    bar.add(surface);

    // Glass sneeze guard
    const guard = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.8, 0.05),
        new THREE.MeshPhysicalMaterial({ color: 0xadd8e6, transparent: true, opacity: 0.25, roughness: 0.05 })
    );
    guard.position.set(0, 1.55, -0.3);
    bar.add(guard);

    // Food items on counter
    const foodColors = [0xef4444, 0x22c55e, 0xf59e0b, 0x8b5cf6, 0xec4899];
    for (let i = 0; i < 5; i++) {
        const food = new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 8, 8),
            new THREE.MeshStandardMaterial({ color: foodColors[i] })
        );
        food.position.set(-0.8 + i * 0.4, 1.25, 0);
        bar.add(food);
    }

    // Mini fridge
    const fridge = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 1.0, 0.5),
        new THREE.MeshStandardMaterial({ color: 0xe5e7eb, metalness: 0.6, roughness: 0.2 })
    );
    fridge.position.set(1.8, 0.5, 0);
    bar.add(fridge);

    // Fridge handle
    const handle = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.4, 0.04),
        new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.8 })
    );
    handle.position.set(1.52, 0.6, 0.26);
    bar.add(handle);

    // Fridge accent light
    const fridgeLight = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.05, 0.4),
        new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x3b82f6, emissiveIntensity: 0.4 })
    );
    fridgeLight.position.set(1.8, 1.03, 0);
    bar.add(fridgeLight);

    bar.position.set(16, -5, -14); // Start below floor

    scene.add(bar);

    // Slide up animation
    const startTime = Date.now();
    function animateIn() {
        const elapsed = (Date.now() - startTime) / 800;
        if (elapsed < 1) {
            const t = 1 - Math.pow(1 - elapsed, 4); // ease out quart
            bar.position.y = -5 + 5 * t;
            requestAnimationFrame(animateIn);
        } else {
            bar.position.y = 0;
        }
    }
    animateIn();

    addActivity('🍕', 'Snack bar opened! Agents stay fueled.', 'success');
}

// ==================== NOISE CANCELLING PANELS ====================
function spawnNoisePanels() {
    const panelColor = 0x374151;
    const accentColor = 0xec4899;
    const level = (G.upgrades.noise || 0) + 1;

    // Place panels on the nearest wall (right side since facilities are on the right)
    const wallX = 34.5;
    const panelCount = 4;
    const startZ = -18 - (level - 1) * 8;

    for (let i = 0; i < panelCount; i++) {
        const panel = new THREE.Group();

        // Main acoustic panel
        const foam = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 2.5, 2.5),
            new THREE.MeshStandardMaterial({ color: panelColor, roughness: 0.95 })
        );
        panel.add(foam);

        // Acoustic texture — grid of small bumps
        for (let row = -3; row <= 3; row++) {
            for (let col = -3; col <= 3; col++) {
                const bump = new THREE.Mesh(
                    new THREE.BoxGeometry(0.1, 0.25, 0.25),
                    new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.98 })
                );
                bump.position.set(0.18, row * 0.35, col * 0.35);
                panel.add(bump);
            }
        }

        // Accent border
        const border = new THREE.Mesh(
            new THREE.BoxGeometry(0.05, 2.7, 2.7),
            new THREE.MeshStandardMaterial({ color: accentColor, emissive: accentColor, emissiveIntensity: 0.2 })
        );
        border.position.x = 0.18;
        panel.add(border);

        const targetZ = startZ + i * 3;
        panel.position.set(wallX + 10, 5, targetZ); // Start off-screen right

        scene.add(panel);

        // Fly-in animation with stagger
        const delay = i * 200;
        const startTime = Date.now() + delay;
        (function animatePanel() {
            const elapsed = (Date.now() - startTime) / 600;
            if (elapsed < 0) {
                requestAnimationFrame(animatePanel);
                return;
            }
            if (elapsed < 1) {
                const t = 1 - Math.pow(1 - elapsed, 3); // ease out cubic
                panel.position.x = (wallX + 10) - 10 * t;
                // Slight rotation during flight
                panel.rotation.y = (1 - t) * 0.5;
                requestAnimationFrame(animatePanel);
            } else {
                panel.position.x = wallX;
                panel.rotation.y = 0;
            }
        })();
    }

    addActivity('🔇', `Noise cancelling panels installed (level ${level})!`, 'success');
}

function webinarLeads() {
    G.leads += 200;
    addActivity('🎓', '+200 immediate leads from webinar!', 'success');
}

// ==================== UPGRADES ====================
const UPGRADES = [
    // FRONT CENTER (z=-6): First purchase - FREE
    { id: 'super', name: 'Supervisor', icon: '👔', desc: 'FREE! Auto-wakes agents', long: 'Hire a floor supervisor who patrols and automatically wakes tired agents. FREE to get you started!', cost: 0, cat: 'mgmt', max: 1, fn: spawnSupervisor, pos: { x: 0, z: -3 } },

    // ROW 1 (z=-8): LEADS & HIRING — center spread
    { id: 'leads_50', name: '50 Leads', icon: '📋', desc: '+50 warm leads', long: 'Warm leads have 17% contact rate vs 5% cold calling!', cost: 100, cat: 'leads', fn: () => G.leads += 50, repeat: true, pos: { x: -12, z: -8 } },
    { id: 'leads_200', name: '200 Leads', icon: '📦', desc: '+200 warm leads', long: 'Bulk buy! 3x better contact rates than cold calling.', cost: 350, cat: 'leads', fn: () => G.leads += 200, repeat: true, pos: { x: -6, z: -8 } },
    { id: 'leads_500', name: '500 Leads', icon: '📊', desc: '+500 premium leads', long: 'Mega pack! Premium leads have 20% contact rate.', cost: 800, cat: 'leads', fn: () => G.leads += 500, repeat: true, pos: { x: 0, z: -8 } },
    { id: 'vip', name: 'VIP Leads', icon: '⭐', desc: '+100 VIP leads', long: 'Pre-qualified and ready to buy. 25% contact rate!', cost: 600, cat: 'leads', fn: () => G.leads += 100, repeat: true, pos: { x: 6, z: -8 } },
    { id: 'hire', name: 'Hire Agent', icon: '👤', desc: 'Recruit new rep', long: 'More agents = more calls = more sales! Each costs $40/day wages.', cost: 200, cat: 'hire', fn: hireAgent, repeat: true, mult: 1.4, pos: { x: 12, z: -8 } },

    // ROW 2 (z=-14): TRAINING & TECH — center spread
    { id: 'script', name: 'Script Training', icon: '📝', desc: '+5% conversion', long: 'Better scripts = more closes. Each level +5%.', cost: 150, cat: 'train', max: 5, mult: 1.7, pos: { x: -12, z: -14 } },
    { id: 'local', name: 'Local Presence', icon: '📍', desc: '+8% answer rate', long: 'Local area codes get answered more!', cost: 300, cat: 'rep', max: 3, mult: 1.8, pos: { x: -6, z: -14 } },
    { id: 'power', name: 'Power Dialer', icon: '⚡', desc: '2x dial speed', long: 'Auto-dial next lead. Doubles your speed!', cost: 500, cat: 'tech', max: 1, pos: { x: 0, z: -14 } },
    { id: 'predict', name: 'Predictive Dialer', icon: '🤖', desc: 'AI dialing +40%', long: 'AI pre-dials leads. +40% efficiency!', cost: 1500, cat: 'tech', max: 1, pos: { x: 6, z: -14 } },
    { id: 'crm', name: 'CRM System', icon: '💻', desc: '+15% conversion', long: 'Track prospects for better follow-ups.', cost: 1000, cat: 'tech', max: 3, mult: 1.5, pos: { x: 12, z: -14 } },

    // RIGHT SIDE — FACILITIES (vertical column x=20)
    { id: 'coffee', name: 'Coffee Machine', icon: '☕', desc: 'Slower energy drain', long: 'Caffeine keeps agents working longer!', cost: 300, cat: 'fac', max: 1, fn: spawnCoffeeMachine, pos: { x: 20, z: -18 } },
    { id: 'ergo', name: 'Ergo Chairs', icon: '🪑', desc: '-20% energy drain', long: 'Comfortable chairs = happier agents.', cost: 400, cat: 'fac', max: 2, mult: 1.6, fn: upgradeChairs, pos: { x: 20, z: -22 } },
    { id: 'break', name: 'Break Room', icon: '🛋️', desc: '+25% energy regen', long: 'Agents recover faster during breaks.', cost: 500, cat: 'fac', max: 2, mult: 1.6, fn: spawnBreakRoom, pos: { x: 20, z: -26 } },
    { id: 'snack', name: 'Snack Bar', icon: '🍕', desc: 'Agent perk', long: 'Free snacks keep agents fueled and focused!', cost: 400, cat: 'fac', max: 3, mult: 1.4, fn: spawnSnackBar, pos: { x: 24, z: -18 } },
    { id: 'noise', name: 'Noise Cancelling', icon: '🔇', desc: '-15% energy drain', long: 'Noise-cancelling headsets reduce stress and fatigue.', cost: 600, cat: 'fac', max: 2, mult: 1.5, fn: spawnNoisePanels, pos: { x: 24, z: -22 } },

    // LEFT SIDE — MANAGEMENT & COMPLIANCE (vertical column x=-20)
    { id: 'qa', name: 'QA Team', icon: '🎧', desc: '+10 reputation', long: 'Monitors calls. +10 rep per level.', cost: 800, cat: 'comp', max: 2, mult: 1.8, fn: () => G.reputation = Math.min(100, G.reputation + 10), pos: { x: -20, z: -18 } },
    { id: 'bonus', name: 'Bonus System', icon: '💰', desc: '+10% sale value', long: 'Commissions motivate bigger closes and happier agents.', cost: 750, cat: 'mgmt', max: 3, mult: 1.7, pos: { x: -20, z: -22 } },
    { id: 'teamlead', name: 'Team Lead', icon: '👨‍💼', desc: '+10% agent speed', long: 'Team leads coach agents to work 10% faster per level.', cost: 1500, cat: 'mgmt', max: 3, mult: 1.8, pos: { x: -20, z: -26 } },
    { id: 'overtime', name: 'Overtime Pay', icon: '⏰', desc: '+30min workday', long: 'Pay agents overtime to extend their shifts by 30 min per level.', cost: 800, cat: 'mgmt', max: 2, mult: 1.6, pos: { x: -24, z: -18 } },
    { id: 'compliance', name: 'Compliance Suite', icon: '📜', desc: 'Prevent rep loss', long: 'Completely prevents reputation decay!', cost: 2000, cat: 'comp', max: 1, pos: { x: -24, z: -22 } },

    // RIGHT SIDE DEEPER — MARKETING (x=20-24, z=-28 to -32)
    { id: 'billboard', name: 'Billboard', icon: '🪧', desc: '+3 leads/day', long: 'Passive outdoor advertising generates 3 leads per day.', cost: 2000, cat: 'mkt', max: 1, pos: { x: 20, z: -30 } },
    { id: 'social', name: 'Social Media', icon: '📱', desc: 'Rep-based leads/day', long: 'Your reputation generates leads! More rep = more leads each day.', cost: 1500, cat: 'mkt', max: 3, mult: 1.8, pos: { x: 24, z: -26 } },
    { id: 'emailcamp', name: 'Email Campaign', icon: '📧', desc: 'Agent-based leads/day', long: 'Each agent generates 2 extra leads per day per level.', cost: 800, cat: 'mkt', max: 3, mult: 1.5, pos: { x: 24, z: -30 } },
    { id: 'webinar', name: 'Webinar', icon: '🎓', desc: '+200 leads + 5/day', long: 'Host a webinar: get 200 leads NOW + 5 passive leads per day.', cost: 2500, cat: 'mkt', max: 2, mult: 2.0, fn: webinarLeads, pos: { x: 28, z: -26 } },
    { id: 'referral', name: 'Referral Program', icon: '🤝', desc: '+5 leads/day', long: 'Happy customers refer friends. +5 auto leads per day per level.', cost: 1200, cat: 'mkt', max: 3, mult: 1.8, pos: { x: 28, z: -30 } },

    // LEFT SIDE DEEPER — EXPANSION (x=-20 to -24, z=-28 to -32)
    { id: 'nightshift', name: 'Night Shift', icon: '🌙', desc: 'Work til 10pm!', long: 'Unlock night shift operations. Extends workday by 4 hours! Massive revenue boost.', cost: 5000, cat: 'mgmt', max: 1, pos: { x: -20, z: -30 } },
    { id: 'autodialer', name: 'Auto-Dialer', icon: '🔄', desc: '3x dial speed', long: 'Fully automated dialing system. Triples your dial speed!', cost: 2500, cat: 'tech', max: 1, pos: { x: -24, z: -26 } },
    { id: 'analytics', name: 'Analytics', icon: '📈', desc: '+reputation/day', long: 'Data-driven insights improve your reputation over time. +2 rep per day.', cost: 600, cat: 'tech', max: 2, mult: 1.7, pos: { x: -24, z: -30 } }
];

const COLORS = { leads: 0xf59e0b, hire: 0x3b82f6, train: 0x22c55e, rep: 0xa855f7, tech: 0x00e5c7, fac: 0xec4899, mgmt: 0x6366f1, comp: 0x8b5cf6, mkt: 0xff6b35 };


// ==================== THREE.JS SETUP ====================
let scene, camera, renderer, player, playerLight;
const pads = [], desks = [], labels = [];
let supervisor = null, sleepingAgent = null, currentPad = null;

function init() {
    updateLoading(10, 'Starting...');

    const canvas = document.getElementById('canvas');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue for windows
    scene.fog = new THREE.Fog(0xf0f4f8, 50, 120); // Light fog, further distance

    camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 500);
    camera.position.set(0, 20, 30);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(devicePixelRatio); // Full pixel ratio for sharpness
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    updateLoading(25, 'Lighting...');
    createLights();

    updateLoading(40, 'Environment...');
    createEnvironment();

    updateLoading(55, 'Player...');
    createPlayer();

    updateLoading(70, 'Upgrade pads...');
    createPads();

    updateLoading(85, 'Loading save...');
    const save = loadGame();

    // Create agents based on saved count or default to 1
    const agentCount = save ? (save.agentCount || 1) : 1;
    for (let i = 0; i < agentCount; i++) {
        const idx = desks.length;
        const row = Math.floor(idx / 5);
        const col = idx % 5 - 2;
        const desk = createDesk(col * 4, 5 + row * 4);
        const agent = createAgent(desk);
        G.agents.push(agent);
    }

    // Recreate supervisor if saved
    if (G.hasSupervisor && !supervisor) {
        spawnSupervisor();
    }

    // Update pad labels to reflect loaded upgrades
    pads.forEach(p => {
        const u = p.userData.upgrade;
        if (u.max && G.upgrades[u.id]) {
            updatePadLabel(p, u);
        }
    });

    if (save) {
        addActivity('💾', `Welcome back! Day ${G.day}`, 'success');
    }

    updateLoading(100, 'Ready!');
    setTimeout(() => {
        document.getElementById('loading-screen').classList.add('hidden');
        animate(0);
        startWatchdog(); // Monitor for game freezes
        updateHUD();

        // Start tutorial on new game
        if (isNewGame) {
            startTutorial();
        }
    }, 400);
}

function updateLoading(p, msg) {
    const bar = document.getElementById('loading-progress');
    if (bar) bar.style.width = p + '%';
}

// ==================== LIGHTS ====================
function createLights() {
    // Bright office ambient light
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));

    // Sunlight through windows
    const dir = new THREE.DirectionalLight(0xfff5e0, 1.0);
    dir.position.set(15, 40, 20);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.camera.near = 1;
    dir.shadow.camera.far = 100;
    dir.shadow.camera.left = dir.shadow.camera.bottom = -40;
    dir.shadow.camera.right = dir.shadow.camera.top = 40;
    dir.shadow.bias = -0.001;
    scene.add(dir);

    // Soft fill light from ceiling
    scene.add(new THREE.HemisphereLight(0xffffff, 0xe0e5eb, 0.5));
}

// ==================== ENVIRONMENT ====================
function createEnvironment() {
    // Modern office floor - dark polished wood
    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(90, 90),
        new THREE.MeshStandardMaterial({ color: 0x1e1e2e, roughness: 0.6, metalness: 0.05 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Premium herringbone-style floor tiles
    const tileGeo = new THREE.PlaneGeometry(3.8, 3.8);
    const tileDark = new THREE.MeshStandardMaterial({ color: 0x2a2a3e, roughness: 0.55, metalness: 0.05 });
    const tileMid = new THREE.MeshStandardMaterial({ color: 0x32324a, roughness: 0.55, metalness: 0.05 });
    const tileLight = new THREE.MeshStandardMaterial({ color: 0x3a3a52, roughness: 0.50, metalness: 0.08 });
    const tileMats = [tileDark, tileMid, tileLight];
    for (let x = -32; x <= 32; x += 4) {
        for (let z = -34; z <= 18; z += 4) {
            const idx = (Math.abs(x) + Math.abs(z)) % 3;
            const tile = new THREE.Mesh(tileGeo, tileMats[idx]);
            tile.rotation.x = -Math.PI / 2;
            tile.position.set(x, 0.01, z);
            scene.add(tile);
        }
    }

    // Accent floor strips (walkway markers)
    const stripMat = new THREE.MeshStandardMaterial({ color: 0x00e5c7, emissive: 0x00e5c7, emissiveIntensity: 0.08, roughness: 0.4 });
    // Center aisle
    const centerStrip = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 50), stripMat);
    centerStrip.rotation.x = -Math.PI / 2;
    centerStrip.position.set(0, 0.015, -5);
    scene.add(centerStrip);
    // Side aisles to facility/management zones
    [-15, 15].forEach(x => {
        const sideStrip = new THREE.Mesh(new THREE.PlaneGeometry(20, 0.8), stripMat);
        sideStrip.rotation.x = -Math.PI / 2;
        sideStrip.position.set(x, 0.015, -20);
        scene.add(sideStrip);
    });

    // Ceiling
    const ceiling = new THREE.Mesh(
        new THREE.PlaneGeometry(80, 80),
        new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.9 })
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 12;
    scene.add(ceiling);

    // Walls - light office color
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf3f4f6, roughness: 0.7 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0x00e5c7, roughness: 0.5 });

    // Back wall with accent stripe
    const back = new THREE.Mesh(new THREE.BoxGeometry(80, 12, 0.5), wallMat);
    back.position.set(0, 6, -36);
    back.castShadow = back.receiveShadow = true;
    scene.add(back);

    const accentStripe = new THREE.Mesh(new THREE.BoxGeometry(80, 0.8, 0.1), accentMat);
    accentStripe.position.set(0, 10, -35.6);
    scene.add(accentStripe);

    // Side walls
    [-35, 35].forEach(x => {
        const side = new THREE.Mesh(new THREE.BoxGeometry(0.5, 12, 80), wallMat);
        side.position.set(x, 6, -8);
        side.castShadow = side.receiveShadow = true;
        scene.add(side);
    });

    // Large windows on back wall
    const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0xadd8e6,
        transparent: true,
        opacity: 0.3,
        roughness: 0.1,
        metalness: 0.1
    });
    for (let i = -2; i <= 2; i++) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), glassMat);
        win.position.set(i * 11, 6, -35.7);
        scene.add(win);

        // Window frame
        const frameMat = new THREE.MeshStandardMaterial({ color: 0x374151 });
        const frameH = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.2, 0.15), frameMat);
        frameH.position.set(i * 11, 10, -35.6);
        scene.add(frameH);
        const frameH2 = frameH.clone();
        frameH2.position.y = 2;
        scene.add(frameH2);
    }

    // Company logo/sign
    const logoMat = new THREE.MeshStandardMaterial({ color: 0x00e5c7, emissive: 0x00e5c7, emissiveIntensity: 0.4 });
    const logo = new THREE.Mesh(new THREE.BoxGeometry(12, 1.5, 0.3), logoMat);
    logo.position.set(0, 11, -27.3);
    scene.add(logo);

    // Cubicle partitions (low walls between desk areas)
    const partitionMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.8 });
    const partitionGeo = new THREE.BoxGeometry(0.15, 1.5, 3.5);

    // Create partition walls between desk rows
    for (let row = 0; row < 3; row++) {
        for (let col = -2; col <= 2; col++) {
            if (col !== 0) { // Leave middle open
                const partition = new THREE.Mesh(partitionGeo, partitionMat);
                partition.position.set(col * 4 + 2, 0.75, 5 + row * 5);
                partition.castShadow = true;
                scene.add(partition);
            }
        }
    }

    // Motivational posters on walls
    const posterMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6 });
    const poster1 = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 0.1), posterMat);
    poster1.position.set(-20, 6, -27.5);
    scene.add(poster1);

    const poster2 = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 0.1),
        new THREE.MeshStandardMaterial({ color: 0x22c55e }));
    poster2.position.set(20, 6, -27.5);
    scene.add(poster2);

    // Whiteboard
    const whiteboard = new THREE.Mesh(
        new THREE.BoxGeometry(6, 3, 0.1),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
    );
    whiteboard.position.set(-15, 6, -27.5);
    scene.add(whiteboard);

    const wbFrame = new THREE.Mesh(
        new THREE.BoxGeometry(6.3, 3.3, 0.05),
        new THREE.MeshStandardMaterial({ color: 0x94a3b8 })
    );
    wbFrame.position.set(-15, 6, -27.55);
    scene.add(wbFrame);

    // Office plants — placed against walls, away from pads
    const plantMat = new THREE.MeshStandardMaterial({ color: 0x22c55e });
    const potMat = new THREE.MeshStandardMaterial({ color: 0x78350f });
    [[-32, 15], [32, 15], [-32, -32], [32, -32], [-32, -10], [32, -10]].forEach(([x, z]) => {
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 0.8, 16), potMat);
        pot.position.set(x, 0.4, z);
        pot.castShadow = true;
        scene.add(pot);

        const plant = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 16), plantMat);
        plant.position.set(x, 1.4, z);
        plant.scale.y = 1.3;
        scene.add(plant);
    });

    // Water cooler — far right near entrance, away from pads
    const coolerBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.4, 1.2, 16),
        new THREE.MeshStandardMaterial({ color: 0x60a5fa })
    );
    coolerBody.position.set(30, 0.6, -2);
    scene.add(coolerBody);

    const coolerTop = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.25, 0.6, 16),
        new THREE.MeshPhysicalMaterial({ color: 0xbfdbfe, transparent: true, opacity: 0.6 })
    );
    coolerTop.position.set(30, 1.5, -2);
    scene.add(coolerTop);

    // Ceiling lights — extended to cover wider office
    for (let x = -28; x <= 28; x += 12) {
        for (let z = -30; z <= 15; z += 10) {
            // Thin recessed light panel
            const lightPanel = new THREE.Mesh(
                new THREE.PlaneGeometry(4, 1.5),
                new THREE.MeshBasicMaterial({ color: 0xfffef0 })
            );
            lightPanel.rotation.x = Math.PI / 2;
            lightPanel.position.set(x, 11.99, z);
            scene.add(lightPanel);

            // Point light for illumination
            const pLight = new THREE.PointLight(0xfff5e6, 0.3, 20);
            pLight.position.set(x, 11.5, z);
            scene.add(pLight);
        }
    }

    // Entrance area markers
    const entranceMat = new THREE.MeshStandardMaterial({ color: 0x00e5c7, roughness: 0.6 });
    const entrance = new THREE.Mesh(new THREE.BoxGeometry(6, 0.05, 3), entranceMat);
    entrance.position.set(0, 0.02, 20);
    scene.add(entrance);

    // Add category signs above upgrade rows
    createCategorySigns();
}

// ==================== PLAYER ====================
let playerLegs = { left: null, right: null };
let isWalking = false;

function createPlayer() {
    const g = new THREE.Group();

    // Body (torso)
    const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.28, 0.6, 8, 16),
        new THREE.MeshStandardMaterial({ color: 0x00e5c7, emissive: 0x00e5c7, emissiveIntensity: 0.35, roughness: 0.3, metalness: 0.5 })
    );
    body.position.y = 1.1;
    body.castShadow = true;
    g.add(body);

    // Head
    const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 16, 16),
        new THREE.MeshStandardMaterial({ color: 0xf0f6fc, emissive: 0xffffff, emissiveIntensity: 0.15 })
    );
    head.position.y = 1.7;
    g.add(head);

    // Arms
    const armMat = new THREE.MeshStandardMaterial({ color: 0x00b8a0, roughness: 0.4 });
    const leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.4, 6, 8), armMat);
    leftArm.position.set(-0.38, 1.05, 0);
    leftArm.rotation.z = 0.2;
    g.add(leftArm);

    const rightArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.4, 6, 8), armMat);
    rightArm.position.set(0.38, 1.05, 0);
    rightArm.rotation.z = -0.2;
    g.add(rightArm);

    // Legs
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1a1f2a, roughness: 0.5 });
    const leftLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.45, 6, 8), legMat);
    leftLeg.position.set(-0.15, 0.35, 0);
    leftLeg.castShadow = true;
    g.add(leftLeg);
    playerLegs.left = leftLeg;

    const rightLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.45, 6, 8), legMat);
    rightLeg.position.set(0.15, 0.35, 0);
    rightLeg.castShadow = true;
    g.add(rightLeg);
    playerLegs.right = rightLeg;

    playerLight = new THREE.PointLight(0x00e5c7, 0.8, 6);
    playerLight.position.y = 1;
    g.add(playerLight);

    g.position.set(0, 0, 18);
    scene.add(g);
    player = g;
}

// ==================== UPGRADE PADS ====================
function createPads() {
    UPGRADES.forEach(u => createPad(u));
}

function createPad(u) {
    const g = new THREE.Group();
    g.position.set(u.pos.x, 0, u.pos.z);

    const col = COLORS[u.cat] || 0x22c55e;

    // Base
    const base = new THREE.Mesh(
        new THREE.CylinderGeometry(1.4, 1.6, 0.3, 32),
        new THREE.MeshStandardMaterial({ color: 0x252a35, roughness: 0.5, metalness: 0.4 })
    );
    base.position.y = 0.15;
    base.receiveShadow = base.castShadow = true;
    g.add(base);

    // Button
    const btn = new THREE.Mesh(
        new THREE.CylinderGeometry(1.1, 1.1, 0.2, 32),
        new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.2, roughness: 0.25, metalness: 0.65 })
    );
    btn.position.y = 0.4;
    btn.castShadow = true;
    g.add(btn);

    // Ring
    const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.3, 0.04, 8, 48),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.35;
    g.add(ring);

    // Label
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(13,17,23,0.85)';
    ctx.roundRect(0, 20, 256, 88, 12);
    ctx.fill();
    ctx.strokeStyle = '#' + col.toString(16).padStart(6, '0');
    ctx.lineWidth = 3;
    ctx.roundRect(0, 20, 256, 88, 12);
    ctx.stroke();
    ctx.font = 'bold 28px Inter, sans-serif';
    ctx.fillStyle = '#f0f6fc';
    ctx.textAlign = 'center';
    ctx.fillText(u.icon + ' ' + u.name, 128, 58);
    ctx.font = '20px JetBrains Mono, monospace';
    ctx.fillStyle = '#22c55e';
    ctx.fillText('$' + u.cost, 128, 90);

    const tex = new THREE.CanvasTexture(canvas);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    label.scale.set(3, 1.5, 1);
    label.position.y = 2.8;
    g.add(label);

    g.userData = { upgrade: u, btn, ring, origY: 0.4, pressed: false, col };
    scene.add(g);
    pads.push(g);
}

// ==================== AGENTS ====================
function createInitialAgent() {
    const desk = createDesk(0, 5);
    const agent = createAgent(desk);
    G.agents.push(agent);
}

function hireAgent() {
    const idx = desks.length;
    const row = Math.floor(idx / 5);
    const col = idx % 5 - 2;
    const desk = createDesk(col * 4, 5 + row * 4);
    const agent = createAgent(desk);
    agent.state = 'entering';
    agent.mesh.position.set(0, 0, 20);
    G.agents.push(agent);
    addActivity('👤', `Agent #${G.agents.length} hired!`, 'success');
}

function createDesk(x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);

    // Desk
    const desk = new THREE.Mesh(
        new THREE.BoxGeometry(2, 0.8, 1.2),
        new THREE.MeshStandardMaterial({ color: 0x303540, roughness: 0.6 })
    );
    desk.position.y = 0.4;
    desk.castShadow = desk.receiveShadow = true;
    g.add(desk);

    // Monitor
    const mon = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.55, 0.05),
        new THREE.MeshStandardMaterial({ color: 0x161b22, emissive: 0x3b82f6, emissiveIntensity: 0.4 })
    );
    mon.position.set(0, 1.1, -0.35);
    g.add(mon);

    // Chair
    const chair = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.75, 0.55),
        new THREE.MeshStandardMaterial({ color: 0x00e5c7, roughness: 0.4 })
    );
    chair.position.set(0, 0.375, 0.75);
    chair.castShadow = true;
    g.add(chair);

    // Phone
    const phone = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.08, 0.35),
        new THREE.MeshStandardMaterial({ color: 0x1a1f2a })
    );
    phone.position.set(0.6, 0.84, -0.2);
    g.add(phone);

    // Save chair reference for ergo upgrade
    g.userData.chair = chair;

    scene.add(g);
    desks.push(g);
    return g;
}

function createAgent(desk) {
    const g = new THREE.Group();

    // Body
    const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.2, 0.45, 8, 12),
        new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5 })
    );
    body.position.y = 1;
    g.add(body);

    // Head
    const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 12, 12),
        new THREE.MeshStandardMaterial({ color: 0xfcd9b6 })
    );
    head.position.y = 1.4;
    g.add(head);

    // === HEADSET ===
    const headsetMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.3 });

    // Headband (curved bar over head)
    const headband = new THREE.Mesh(
        new THREE.TorusGeometry(0.12, 0.015, 8, 16, Math.PI),
        headsetMat
    );
    headband.position.y = 1.52;
    headband.rotation.x = Math.PI / 2;
    headband.rotation.z = Math.PI / 2;
    g.add(headband);

    // Left ear cup
    const earL = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 0.04, 12),
        headsetMat
    );
    earL.position.set(-0.14, 1.4, 0);
    earL.rotation.z = Math.PI / 2;
    g.add(earL);

    // Right ear cup
    const earR = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 0.04, 12),
        headsetMat
    );
    earR.position.set(0.14, 1.4, 0);
    earR.rotation.z = Math.PI / 2;
    g.add(earR);

    // Microphone boom (from left ear)
    const boom = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.008, 0.12, 8),
        headsetMat
    );
    boom.position.set(-0.18, 1.35, 0.05);
    boom.rotation.z = -Math.PI / 4;
    boom.rotation.x = Math.PI / 6;
    g.add(boom);

    // Microphone tip
    const mic = new THREE.Mesh(
        new THREE.SphereGeometry(0.02, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0x222222 })
    );
    mic.position.set(-0.22, 1.28, 0.08);
    g.add(mic);

    // Zzz indicator (hidden by default)
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.font = 'bold 48px sans-serif';
    ctx.fillStyle = '#3b82f6';
    ctx.fillText('💤', 8, 48);
    const zzz = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true }));
    zzz.scale.set(0.5, 0.5, 1);
    zzz.position.y = 1.8;
    zzz.visible = false;
    g.add(zzz);

    // === ENERGY BAR ===
    const barBg = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 0.08),
        new THREE.MeshBasicMaterial({ color: 0x333333 })
    );
    barBg.position.set(0, 1.95, 0);
    barBg.lookAt(camera.position);
    g.add(barBg);

    const barFill = new THREE.Mesh(
        new THREE.PlaneGeometry(0.48, 0.06),
        new THREE.MeshBasicMaterial({ color: 0x22c55e })
    );
    barFill.position.set(0, 1.95, 0.01);
    g.add(barFill);

    g.position.copy(desk.position);
    g.position.z += 0.75;
    scene.add(g);

    return {
        mesh: g,
        desk,
        state: 'working', // entering, working, tired, sleeping, idle
        energy: 50 + Math.random() * 50,
        drainRate: 0.7 + Math.random() * 0.6,
        zzz,
        body,
        barFill,
        barBg
    };
}

// ==================== SUPERVISOR ====================
function spawnSupervisor() {
    if (supervisor) return;
    G.hasSupervisor = true;

    const g = new THREE.Group();

    const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.22, 0.5, 8, 12),
        new THREE.MeshStandardMaterial({ color: 0x6366f1, roughness: 0.4 })
    );
    body.position.y = 1.05;
    g.add(body);

    const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 12, 12),
        new THREE.MeshStandardMaterial({ color: 0xfcd9b6 })
    );
    head.position.y = 1.5;
    g.add(head);

    // Clipboard (supervisors carry clipboards)
    const clipboard = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.2, 0.02),
        new THREE.MeshStandardMaterial({ color: 0x8b4513 })
    );
    clipboard.position.set(0.3, 1.0, 0.1);
    g.add(clipboard);

    // Name tag sprite
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(99,102,241,0.9)';
    ctx.roundRect(0, 0, 256, 64, 10);
    ctx.fill();
    ctx.font = 'bold 28px Inter, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('👔 SUPERVISOR', 128, 42);
    const nameTag = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true }));
    nameTag.scale.set(1.5, 0.4, 1);
    nameTag.position.y = 2;
    g.add(nameTag);

    // Start at desk area (negative z)
    g.position.set(-6, 0, -10);
    scene.add(g);

    supervisor = { mesh: g, targetIdx: 0, moving: true, nameTag };
    addActivity('👔', 'Supervisor hired!', 'success');
}

// ==================== INPUT ====================
const keys = { w: false, a: false, s: false, d: false };

document.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k in keys) keys[k] = true;
    if (k === 'e' && currentPad) purchaseUpgrade(currentPad.userData.upgrade);
    if (k === 'f') wakeNearbyAgent();
    if (k >= '1' && k <= '4') setSpeed([1, 2, 5, 10][+k - 1]);
    if (e.code === 'Space') { e.preventDefault(); togglePause(); }
    if (k === 'h') toggleHelp();
    if (e.code === 'Escape') {
        const help = document.getElementById('help-overlay');
        if (help?.classList.contains('visible')) help.classList.remove('visible');
        if (tutorial.active) skipTutorial();
    }
});

document.addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if (k in keys) keys[k] = false;
});

document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.addEventListener('click', () => setSpeed(+btn.dataset.speed));
});

function setSpeed(s) {
    G.speed = s;
    document.querySelectorAll('.speed-btn').forEach(b => b.classList.toggle('active', +b.dataset.speed === s));
}

function togglePause() {
    G.isRunning = !G.isRunning;
    updateHUD();
}

// ==================== GAME LOGIC ====================
function purchaseUpgrade(u) {
    const lvl = G.upgrades[u.id] || 0;
    const cost = Math.floor(u.cost * Math.pow(u.mult || 1, lvl));

    if (u.max && lvl >= u.max) {
        playErrorSound();
        return addActivity('⚠️', u.name + ' maxed!', 'warning');
    }
    if (G.cash < cost) {
        playErrorSound();
        return addActivity('❌', 'Need $' + cost, 'error');
    }

    G.cash -= cost;
    G.upgrades[u.id] = lvl + 1;
    if (u.fn) u.fn();

    playPurchaseSound();
    addActivity('✅', 'Bought ' + u.name + '!', 'success');
    updateHUD();
    saveGame(); // Save after purchase

    // Update label for upgrades with changing prices
    const pad = pads.find(p => p.userData.upgrade.id === u.id);
    if (pad && (u.max || (u.repeat && u.mult))) updatePadLabel(pad, u);
}

function updatePadLabel(pad, u) {
    const lvl = G.upgrades[u.id] || 0;
    const cost = Math.floor(u.cost * Math.pow(u.mult || 1, lvl));
    const label = pad.children.find(c => c.isSprite);
    if (!label) return;

    const col = pad.userData.col;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(13,17,23,0.85)';
    ctx.roundRect(0, 10, 256, 105, 12);
    ctx.fill();
    ctx.strokeStyle = '#' + col.toString(16).padStart(6, '0');
    ctx.lineWidth = 3;
    ctx.roundRect(0, 10, 256, 105, 12);
    ctx.stroke();
    ctx.font = 'bold 26px Inter, sans-serif';
    ctx.fillStyle = '#f0f6fc';
    ctx.textAlign = 'center';
    ctx.fillText(u.icon + ' ' + u.name, 128, 48);

    if (u.max && lvl >= u.max) {
        ctx.font = 'bold 22px JetBrains Mono, monospace';
        ctx.fillStyle = '#00e5c7';
        ctx.fillText('MAXED', 128, 80);
    } else if (u.repeat) {
        // Repeat upgrades: show cost and count
        ctx.font = '18px JetBrains Mono, monospace';
        ctx.fillStyle = '#22c55e';
        ctx.fillText('$' + cost, 128, 75);
        ctx.font = '14px Inter, sans-serif';
        ctx.fillStyle = '#8b949e';
        ctx.fillText('Purchased: ' + lvl + 'x', 128, 100);
    } else {
        ctx.font = '18px JetBrains Mono, monospace';
        ctx.fillStyle = '#22c55e';
        ctx.fillText('$' + cost, 128, 75);
        ctx.font = '14px Inter, sans-serif';
        ctx.fillStyle = '#8b949e';
        ctx.fillText('Level ' + lvl + '/' + u.max, 128, 100);
    }

    label.material.map.dispose();
    label.material.map = new THREE.CanvasTexture(canvas);
    label.material.needsUpdate = true;
}

function wakeNearbyAgent() {
    if (!sleepingAgent) return;

    const dist = player.position.distanceTo(sleepingAgent.mesh.position);
    if (dist < 3) {
        sleepingAgent.state = 'working';
        sleepingAgent.energy = 100;
        sleepingAgent.zzz.visible = false;
        sleepingAgent.body.material.color.setHex(0xf59e0b);
        playWakeSound();
        addActivity('⏰', 'Woke up agent!', 'success');
        sleepingAgent = null;
    }
}

// ==================== SIMULATION ====================
let lastSim = 0;
const MS_PER_MIN = 180;

function simulate(dt) {
    if (!G.isRunning) return;

    try {
        lastSim += dt * G.speed;
        let loopCount = 0;
        while (lastSim >= MS_PER_MIN && loopCount < 10) { // Limit iterations to prevent infinite loop
            lastSim -= MS_PER_MIN;
            loopCount++;
            try { simMinute(); } catch (e) { console.error('simMinute error:', e); }
        }

        // Update agents with error handling
        G.agents.forEach(a => {
            try { updateAgent(a, dt); } catch (e) { console.error('updateAgent error:', e); }
        });

        // Update supervisor with error handling
        if (supervisor) {
            try { updateSupervisor(dt); } catch (e) { console.error('updateSupervisor error:', e); }
        }
    } catch (e) {
        console.error('simulate error:', e);
    }
}

function simMinute() {
    G.minute++;
    if (G.minute >= 60) {
        G.minute = 0;
        G.hour++;
        // Workday ends at 18 (6pm) by default, extended by overtime (+30min each) and nightshift (+4hrs)
        let endHour = 18;
        const overtimeLvl = G.upgrades.overtime || 0;
        // Each overtime level adds 30 min, but we track in hours
        endHour += overtimeLvl * 0.5;
        if (G.upgrades.nightshift) endHour = 22; // Night shift overrides to 10pm
        // endDay when we hit the end hour (account for fractional hours via minute check)
        if (G.hour >= Math.ceil(endHour)) endDay();
    }

    // Work hours: 9am to end of shift
    let endHour = 18 + (G.upgrades.overtime || 0) * 0.5;
    if (G.upgrades.nightshift) endHour = 22;
    if (G.hour >= 9 && G.hour < Math.ceil(endHour)) {
        simCalls();
    }

    updateHUD();
}

function simCalls() {
    const dialerMult = G.upgrades.power ? 2 : 1;
    const predMult = G.upgrades.predict ? 1.4 : 1;
    const teamLeadMult = 1 + (G.upgrades.teamlead || 0) * 0.1; // +10% speed per team lead level

    G.agents.forEach(a => {
        if (a.state !== 'working' && a.state !== 'tired') return;

        // Determine if using warm leads or cold calling
        const hasLeads = G.leads > 0;

        const prodMult = a.state === 'tired' ? 0.6 : 1;
        const calls = 0.35 * dialerMult * predMult * prodMult * teamLeadMult;

        for (let i = 0; i < calls; i++) {
            if (hasLeads && G.leads > 0) {
                G.leads--;
            }
            G.dials++;
            G.costs += hasLeads ? 0.04 : 0.02;

            // Contact rate
            const baseContactRate = hasLeads ? 0.17 : 0.05;
            const localBonus = (G.upgrades.local || 0) * 0.08;
            const repBonus = (G.reputation - 50) / 250;

            if (Math.random() < baseContactRate + localBonus + repBonus) {
                G.contacts++;

                // Conversion rate with CRM bonus
                const baseConversion = hasLeads ? 0.07 : 0.03;
                const scriptBonus = (G.upgrades.script || 0) * 0.05;
                const crmBonus = (G.upgrades.crm || 0) * 0.03; // +3% per CRM level

                if (Math.random() < baseConversion + scriptBonus + crmBonus) {
                    const baseSale = hasLeads ? (70 + Math.random() * 80) : (40 + Math.random() * 50);
                    const bonusMult = 1 + (G.upgrades.bonus || 0) * 0.1; // +10% per bonus level
                    const sale = baseSale * bonusMult;
                    G.cash += sale;
                    G.conversions++;
                    G.revenue += sale;
                    G.totalRevenue += sale;
                    G.totalSales++;
                    // Rep gain from sales
                    if (Math.random() < 0.05) {
                        G.reputation = Math.min(100, G.reputation + 1);
                    }
                    if (Math.random() < 0.25) {
                        playCashSound();
                        addActivity('💰', '+$' + Math.round(sale) + (hasLeads ? '' : ' (cold)'), 'success');
                        showMoneyPopup(sale);
                    }
                }
            }
        }

        // Energy drain with noise cancelling
        const coffeeBonus = G.hasCoffee ? 0.7 : 1;
        const ergoBonus = 1 - (G.upgrades.ergo || 0) * 0.1;
        const noiseBonus = 1 - (G.upgrades.noise || 0) * 0.15; // -15% per noise cancelling level
        const coldPenalty = hasLeads ? 1 : 1.3;
        const agentDrain = a.drainRate || 1;
        a.energy -= 0.4 * coffeeBonus * ergoBonus * noiseBonus * coldPenalty * agentDrain;

        if (a.energy <= 30 && a.state === 'working') {
            a.state = 'tired';
            if (a.body) a.body.material.color.setHex(0xef8f00);
        }
        if (a.energy <= 0) {
            a.state = 'sleeping';
            a.energy = 0;
            if (a.zzz) a.zzz.visible = true;
            if (a.body) a.body.material.color.setHex(0x6b7280);
            if (!sleepingAgent) sleepingAgent = a;
            addActivity('💤', 'Agent fell asleep!', 'warning');
        }
    });
}

function endDay() {
    const profit = G.revenue - G.costs;
    playDayEndSound();
    addActivity('🌙', `Day ${G.day} done! $${Math.round(profit)} profit`, profit > 0 ? 'success' : 'warning');

    const wages = G.agents.length * 40;
    G.cash -= wages;
    G.costs += wages;

    // === AUTO-LEAD GENERATION ===
    let autoLeads = 0;
    // Referral program: +5 leads per level
    const referralLeads = (G.upgrades.referral || 0) * 5;
    if (referralLeads > 0) autoLeads += referralLeads;
    // Billboard: +3 leads
    if (G.upgrades.billboard) autoLeads += 3;
    // Social media: rep/20 per level
    const socialLeads = Math.floor((G.upgrades.social || 0) * (G.reputation / 20));
    if (socialLeads > 0) autoLeads += socialLeads;
    // Email campaign: agents * 2 per level
    const emailLeads = (G.upgrades.emailcamp || 0) * G.agents.length * 2;
    if (emailLeads > 0) autoLeads += emailLeads;
    // Webinar ongoing: +5 per level
    const webinarLeadsDaily = (G.upgrades.webinar || 0) * 5;
    if (webinarLeadsDaily > 0) autoLeads += webinarLeadsDaily;

    if (autoLeads > 0) {
        G.leads += autoLeads;
        addActivity('📨', `+${autoLeads} auto-leads from marketing!`, 'success');
    }

    // Reset agents energy overnight
    G.agents.forEach(a => {
        a.energy = 100;
        a.state = 'working';
        a.zzz.visible = false;
        a.body.material.color.setHex(0xf59e0b);
    });
    sleepingAgent = null;

    G.day++;
    G.hour = 9;
    G.dials = G.contacts = G.conversions = G.revenue = G.costs = 0;

    if (!G.upgrades.qa && !G.upgrades.compliance) {
        G.reputation = Math.max(50, G.reputation - 1);
        addActivity('⚠️', 'Reputation dropped! Get QA Team or Compliance to prevent this.', 'warning');
    }

    // Milestone achievements
    checkMilestones();

    saveGame(); // Save at end of each day
}

function checkMilestones() {
    // Day 10 + $2000
    if (G.day === 10 && G.cash >= 2000 && !G.milestones?.bronze) {
        G.milestones = G.milestones || {};
        G.milestones.bronze = true;
        showMilestone('🥉 Bronze Achievement!', 'Day 10 with $2,000+ cash!', 'Keep growing your call center!');
    }
    // Day 20 + $5000
    if (G.day === 20 && G.cash >= 5000 && !G.milestones?.silver) {
        G.milestones = G.milestones || {};
        G.milestones.silver = true;
        showMilestone('🥈 Silver Achievement!', 'Day 20 with $5,000+ cash!', 'Amazing progress!');
    }
    // Day 30 + $10000
    if (G.day === 30 && G.cash >= 10000 && !G.milestones?.gold) {
        G.milestones = G.milestones || {};
        G.milestones.gold = true;
        showMilestone('🥇 GOLD VICTORY!', 'Day 30 with $10,000+ cash!', '🎉 You are a Call Center Tycoon! 🎉');
    }
}

function showMilestone(title, subtitle, message) {
    const popup = document.createElement('div');
    popup.className = 'milestone-popup';
    popup.innerHTML = `
        <div class="milestone-icon">🏆</div>
        <div class="milestone-title">${title}</div>
        <div class="milestone-subtitle">${subtitle}</div>
        <div class="milestone-message">${message}</div>
        <button class="milestone-close" onclick="this.parentElement.remove()">Continue</button>
    `;
    document.body.appendChild(popup);
    setTimeout(() => popup.classList.add('visible'), 50);
}

function updateAgent(a, dt) {
    if (a.state === 'entering') {
        const target = a.desk.position.clone();
        target.z += 0.75;
        a.mesh.position.lerp(target, 0.03);
        if (a.mesh.position.distanceTo(target) < 0.1) {
            a.state = 'working';
            a.mesh.position.copy(target);
        }
    }

    // Bobbing when working
    if (a.state === 'working' || a.state === 'tired') {
        a.mesh.children[0].position.y = 1 + Math.sin(Date.now() * 0.008) * 0.02;
    }

    // Zzz float
    if (a.state === 'sleeping') {
        a.zzz.position.y = 1.8 + Math.sin(Date.now() * 0.003) * 0.1;
    }

    // Update energy bar
    if (a.barFill) {
        const pct = Math.max(0, Math.min(1, a.energy / 100));
        a.barFill.scale.x = pct;
        a.barFill.position.x = -0.24 * (1 - pct);
        const r = pct < 0.5 ? 1 : 1 - (pct - 0.5) * 2;
        const g = pct > 0.5 ? 1 : pct * 2;
        a.barFill.material.color.setRGB(r, g, 0.2);
        a.barBg.quaternion.copy(camera.quaternion);
        a.barFill.quaternion.copy(camera.quaternion);
    }
}

function updateSupervisor(dt) {
    if (!supervisor || !supervisor.mesh) return;

    // Find sleeping agents to wake
    const sleeping = G.agents.find(a => a.state === 'sleeping');
    if (sleeping && sleeping.mesh) {
        const target = sleeping.mesh.position.clone();
        target.y = 0;
        supervisor.mesh.position.lerp(target, 0.03);

        if (supervisor.mesh.position.distanceTo(target) < 1.8) {
            sleeping.state = 'working';
            sleeping.energy = 80;
            if (sleeping.zzz) sleeping.zzz.visible = false;
            if (sleeping.body) sleeping.body.material.color.setHex(0xf59e0b);
            if (sleepingAgent === sleeping) sleepingAgent = null;
            G.totalWakes = (G.totalWakes || 0) + 1; // Track for tutorial
            addActivity('👔', 'Supervisor woke agent!', 'success');
        }
    } else {
        // Patrol around the desk area (negative z values where desks are)
        const patrolPts = [
            { x: -6, z: -10 },
            { x: 6, z: -10 },
            { x: 6, z: -18 },
            { x: -6, z: -18 }
        ];
        const target = patrolPts[supervisor.targetIdx];
        const tgt = new THREE.Vector3(target.x, 0, target.z);
        supervisor.mesh.position.lerp(tgt, 0.02);

        // Face movement direction
        const dir = tgt.clone().sub(supervisor.mesh.position);
        if (dir.length() > 0.1) {
            supervisor.mesh.rotation.y = Math.atan2(dir.x, dir.z);
        }

        if (supervisor.mesh.position.distanceTo(tgt) < 0.5) {
            supervisor.targetIdx = (supervisor.targetIdx + 1) % patrolPts.length;
        }
    }

    // Bobbing animation
    supervisor.mesh.position.y = Math.sin(Date.now() * 0.006) * 0.05;
}

// ==================== UPDATE ====================
function updatePlayer() {
    if (!player) return;

    const dir = new THREE.Vector3();
    if (keys.w) dir.z -= 1;
    if (keys.s) dir.z += 1;
    if (keys.a) dir.x -= 1;
    if (keys.d) dir.x += 1;

    isWalking = dir.length() > 0;

    if (isWalking) {
        dir.normalize().multiplyScalar(0.16);
        player.position.add(dir);
        player.position.x = Math.max(-30, Math.min(30, player.position.x));
        player.position.z = Math.max(-33, Math.min(22, player.position.z));

        // Face movement direction
        player.rotation.y = Math.atan2(dir.x, dir.z);

        // Leg animation
        const t = Date.now() * 0.015;
        if (playerLegs.left && playerLegs.right) {
            playerLegs.left.rotation.x = Math.sin(t) * 0.6;
            playerLegs.right.rotation.x = Math.sin(t + Math.PI) * 0.6;
            playerLegs.left.position.z = Math.sin(t) * 0.1;
            playerLegs.right.position.z = Math.sin(t + Math.PI) * 0.1;
        }

        // Bobbing while walking
        player.position.y = Math.abs(Math.sin(t * 0.7)) * 0.08;
    } else {
        // Reset legs when standing
        if (playerLegs.left && playerLegs.right) {
            playerLegs.left.rotation.x *= 0.85;
            playerLegs.right.rotation.x *= 0.85;
            playerLegs.left.position.z *= 0.85;
            playerLegs.right.position.z *= 0.85;
        }
        // Slight idle bob
        player.position.y = Math.sin(Date.now() * 0.003) * 0.03;
    }
}

function checkPads() {
    if (!player) return;

    let nearest = null, nearDist = 2;

    pads.forEach(p => {
        const d = player.position.distanceTo(p.position);
        if (d < nearDist) { nearDist = d; nearest = p; }

        const on = d < 1.8;
        const { btn, ring, origY } = p.userData;

        if (on && !p.userData.pressed) {
            p.userData.pressed = true;
            btn.position.y = 0.25;
            ring.material.opacity = 0.7;
            btn.material.emissiveIntensity = 0.5;
        } else if (!on && p.userData.pressed) {
            p.userData.pressed = false;
            btn.position.y = origY;
            ring.material.opacity = 0.35;
            btn.material.emissiveIntensity = 0.2;
        }
    });

    currentPad = nearest;
    updatePrompt(nearest);
}

function updatePrompt(pad) {
    const el = document.getElementById('interaction-prompt');

    // Check for nearby sleeping agent
    sleepingAgent = G.agents.find(a => a.state === 'sleeping' && player.position.distanceTo(a.mesh.position) < 3);

    if (sleepingAgent && !pad) {
        document.getElementById('prompt-icon').textContent = '💤';
        document.getElementById('prompt-title').textContent = 'Sleeping Agent';
        document.getElementById('prompt-desc').textContent = 'This agent needs to be woken up!';
        document.getElementById('prompt-long').textContent = 'Tired agents fall asleep and stop making calls. Wake them up to get them back on the phones!';
        document.getElementById('prompt-cost').textContent = 'FREE';
        document.getElementById('prompt-level').textContent = '';
        document.getElementById('prompt-key').textContent = 'Press F to Wake';
        el.classList.remove('cant-afford');
        el.classList.add('wake', 'visible');
        return;
    }

    el.classList.remove('wake');

    if (pad) {
        const u = pad.userData.upgrade;
        const lvl = G.upgrades[u.id] || 0;
        const cost = Math.floor(u.cost * Math.pow(u.mult || 1, lvl));
        const afford = G.cash >= cost;
        const maxed = u.max && lvl >= u.max;

        document.getElementById('prompt-icon').textContent = u.icon;
        document.getElementById('prompt-title').textContent = u.name;
        document.getElementById('prompt-desc').textContent = u.desc;
        document.getElementById('prompt-long').textContent = u.long || u.desc;
        document.getElementById('prompt-cost').textContent = maxed ? 'MAXED' : '$' + cost;
        document.getElementById('prompt-level').textContent = u.max ? `Level ${lvl}/${u.max}` : '';
        document.getElementById('prompt-key').textContent = maxed ? 'Fully Upgraded' : 'Press E to Buy';

        el.classList.toggle('cant-afford', !afford || maxed);
        el.classList.add('visible');
    } else {
        el.classList.remove('visible');
    }
}

function updateHUD() {
    document.getElementById('hud-day-num').textContent = G.day;
    document.getElementById('hud-cash').textContent = '$' + Math.round(G.cash).toLocaleString();
    document.getElementById('hud-agents').textContent = G.agents.length;
    document.getElementById('hud-leads').textContent = G.leads;
    document.getElementById('hud-rep').textContent = G.reputation;
    document.getElementById('hud-sales').textContent = G.conversions;
    document.getElementById('hud-revenue').textContent = '$' + Math.round(G.revenue);

    document.getElementById('hud-time').textContent = String(G.hour).padStart(2, '0') + ':' + String(G.minute).padStart(2, '0');
    document.getElementById('hud-day').innerHTML = `Day ${G.day} • <span class="${G.isRunning ? 'status' : 'status paused'}">${G.isRunning ? 'Active' : 'PAUSED'}</span>`;

    document.getElementById('metric-dials').textContent = G.dials;
    document.getElementById('metric-contacts').textContent = G.contacts;
    document.getElementById('metric-contact-rate').textContent = G.dials ? (G.contacts / G.dials * 100).toFixed(1) + '%' : '0%';
    document.getElementById('metric-close-rate').textContent = G.contacts ? (G.conversions / G.contacts * 100).toFixed(1) + '%' : '0%';
    document.getElementById('metric-profit').textContent = '$' + Math.round(G.revenue - G.costs);

    // Lifetime stats
    const totalSalesEl = document.getElementById('metric-total-sales');
    const totalRevenueEl = document.getElementById('metric-total-revenue');
    if (totalSalesEl) totalSalesEl.textContent = (G.totalSales || 0).toLocaleString();
    if (totalRevenueEl) totalRevenueEl.textContent = '$' + Math.round(G.totalRevenue || 0).toLocaleString();

    // Active upgrades display
    const upgradesList = document.getElementById('upgrades-list');
    if (upgradesList) {
        const activeUpgrades = UPGRADES.filter(u => G.upgrades[u.id] > 0);
        if (activeUpgrades.length === 0) {
            upgradesList.innerHTML = '<span class="upgrade-badge inactive">None yet</span>';
        } else {
            upgradesList.innerHTML = activeUpgrades.map(u => {
                const lvl = G.upgrades[u.id];
                const lvlText = u.max && u.max > 1 ? ` ×${lvl}` : '';
                return `<span class="upgrade-badge" title="${u.long}">${u.icon}${lvlText}</span>`;
            }).join('');
        }
    }
}

function addActivity(icon, text, type = '') {
    const list = document.getElementById('activity-list');
    const item = document.createElement('div');
    item.className = 'activity-item';
    item.innerHTML = `<span class="activity-icon">${icon}</span><span class="activity-text ${type}">${text}</span>`;
    list.insertBefore(item, list.firstChild);
    while (list.children.length > 10) list.removeChild(list.lastChild);
}

function showMoneyPopup(amount) {
    const popup = document.createElement('div');
    popup.className = 'money-popup';
    popup.textContent = '+$' + Math.round(amount);
    popup.style.left = (innerWidth / 2 + (Math.random() - 0.5) * 200) + 'px';
    popup.style.top = (innerHeight / 2 + (Math.random() - 0.5) * 100) + 'px';
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 1500);
}

// ==================== CAMERA & ZOOM ====================
let cameraZoom = 25; // Default zoom distance
const ZOOM_MIN = 12;
const ZOOM_MAX = 45;

function updateCamera() {
    if (!player || !camera) return;

    // Smooth camera follow with zoom
    const targetX = player.position.x;
    const targetZ = player.position.z + cameraZoom * 0.6;
    const targetY = cameraZoom * 0.8;

    camera.position.x += (targetX - camera.position.x) * 0.08;
    camera.position.z += (targetZ - camera.position.z) * 0.08;
    camera.position.y += (targetY - camera.position.y) * 0.08;

    camera.lookAt(player.position.x, 1, player.position.z - 5);
}

// Scroll zoom
document.addEventListener('wheel', e => {
    cameraZoom += e.deltaY * 0.02;
    cameraZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, cameraZoom));
}, { passive: true });

// ==================== ANIMATION ====================
let lastTime = 0;

// ==================== FREEZE RECOVERY ====================
let lastAnimateTime = Date.now();
let watchdogInterval = null;
let errorCount = 0;

function startWatchdog() {
    if (watchdogInterval) return;
    watchdogInterval = setInterval(() => {
        const timeSinceAnimate = Date.now() - lastAnimateTime;
        // If more than 2 seconds since last animate, game is frozen
        if (timeSinceAnimate > 2000 && gameStarted) {
            console.error('🔧 Watchdog: Game freeze detected! Attempting recovery...');
            errorCount++;
            addActivity('⚠️', 'Game hiccup detected - recovering...', 'warning');

            // Try to restart the animation loop
            try {
                requestAnimationFrame(animate);
            } catch (e) {
                console.error('Recovery failed:', e);
            }
        }
    }, 1000);
}

function animate(t) {
    lastAnimateTime = Date.now();

    try {
        requestAnimationFrame(animate);

        const dt = Math.min(t - lastTime, 100); // Cap dt to prevent huge jumps
        lastTime = t;

        try { updatePlayer(); } catch (e) { console.error('updatePlayer error:', e); }
        try { checkPads(); } catch (e) { console.error('checkPads error:', e); }
        try { updateCamera(); } catch (e) { console.error('updateCamera error:', e); }
        try { simulate(dt); } catch (e) { console.error('simulate error:', e); }
        try { checkTutorial(); } catch (e) { console.error('checkTutorial error:', e); }

        pads.forEach((p, i) => {
            try {
                if (p && p.userData && p.userData.ring) {
                    p.userData.ring.rotation.z = t * 0.0007 + i * 0.4;
                }
            } catch (e) { }
        });

        if (playerLight) playerLight.intensity = 0.7 + Math.sin(t * 0.003) * 0.25;

        renderer.render(scene, camera);
    } catch (e) {
        console.error('Animation loop error:', e);
        // Try to continue anyway
        try { requestAnimationFrame(animate); } catch (e2) { }
    }
}

// ==================== RESIZE ====================
window.addEventListener('resize', () => {
    if (!camera || !renderer) return;
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
});

// ==================== START ====================
window.addEventListener('load', () => {
    if (typeof THREE === 'undefined') {
        alert('Failed to load Three.js');
        return;
    }
    initStartMenu();
});

// Tutorial skip button and ESC key
document.addEventListener('keydown', e => {
    if (e.code === 'Escape' && tutorial.active) {
        skipTutorial();
    }
});

document.getElementById('tutorial-skip')?.addEventListener('click', skipTutorial);

// Settings dropdown toggle
document.getElementById('settings-btn')?.addEventListener('click', () => {
    document.getElementById('settings-dropdown')?.classList.toggle('visible');
});

// Sound toggle checkbox
document.getElementById('toggle-sound')?.addEventListener('change', e => {
    soundEnabled = e.target.checked;
});

// Music toggle checkbox
document.getElementById('toggle-music')?.addEventListener('change', e => {
    musicEnabled = e.target.checked;
    updateMusicVolume();
});

// Close dropdown when clicking outside
document.addEventListener('click', e => {
    const container = document.getElementById('settings-container');
    const btn = document.getElementById('settings-btn');
    const dropdown = document.getElementById('settings-dropdown');
    if (dropdown && !btn?.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.remove('visible');
    }
});

// Respawn button handler
document.getElementById('btn-respawn')?.addEventListener('click', () => {
    if (player) {
        player.position.set(0, 0, 18);
        addActivity('🔄', 'Respawned at center!', 'success');
        document.getElementById('settings-dropdown')?.classList.remove('visible');
    }
});

// ==================== HELP OVERLAY ====================
function toggleHelp() {
    const help = document.getElementById('help-overlay');
    if (help) help.classList.toggle('visible');
}

document.getElementById('help-close')?.addEventListener('click', () => {
    document.getElementById('help-overlay')?.classList.remove('visible');
});

// ==================== AUTO-PAUSE ON FOCUS LOSS ====================
document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.isRunning) {
        G.isRunning = false;
        updateHUD();
        addActivity('⏸️', 'Game paused (tab unfocused)', 'warning');
    }
});

function createCategorySigns() {
    const signs = [
        { text: '📋 LEADS & HIRING', x: 0, z: -8, color: 0xf59e0b },
        { text: '⚡ TRAINING & TECH', x: 0, z: -14, color: 0x00e5c7 },
        { text: '🛋️ FACILITIES', x: 22, z: -17, color: 0xec4899 },
        { text: '🎧 MANAGEMENT', x: -22, z: -17, color: 0x8b5cf6 },
        { text: '📱 MARKETING', x: 24, z: -27, color: 0xff6b35 },
        { text: '🚀 EXPANSION', x: -22, z: -27, color: 0x10b981 }
    ];

    signs.forEach(s => {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 80;
        const ctx = canvas.getContext('2d');
        ctx.font = 'bold 36px Inter, sans-serif';
        ctx.fillStyle = '#' + s.color.toString(16).padStart(6, '0');
        ctx.textAlign = 'center';
        ctx.fillText(s.text, 256, 55);

        const texture = new THREE.CanvasTexture(canvas);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
        sprite.scale.set(8, 1.2, 1);
        sprite.position.set(s.x, 3.5, s.z + 2);
        scene.add(sprite);
    });
}

// ==================== DAY/NIGHT LIGHTING CYCLE ====================
let ambientLight = null;
function updateDayNightLighting() {
    if (!ambientLight) {
        scene.traverse(obj => {
            if (obj.isAmbientLight) ambientLight = obj;
        });
    }
    if (!ambientLight) return;

    // Morning (9-12): warm, Afternoon (12-15): bright, Evening (15-18): cooler
    const hour = G.hour;
    let r = 1, g = 1, b = 1;
    if (hour < 12) {
        // Morning: warm orange tint
        r = 1; g = 0.95; b = 0.85;
    } else if (hour < 15) {
        // Afternoon: bright white
        r = 1; g = 1; b = 1;
    } else {
        // Evening: cooler blue tint
        r = 0.9; g = 0.92; b = 1;
    }
    ambientLight.color.setRGB(r, g, b);
}
