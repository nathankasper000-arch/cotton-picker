// =====================
// GAME VARIABLES
// =====================
let cotton = 0;
let totalCottonEarned = 0;

let workers = 0;
let workerCost = 10;
const cottonPerWorker = 0.6;

let manors = 0;
const BASE_MANOR_COST = 60000;
let manorCost = BASE_MANOR_COST;
let manorIncome = 75; // can be doubled by manor upgrade

let fields = [];
const baseFieldCost = 7500;
let fieldCost = baseFieldCost;
let fieldIncome = 25; // multiplied by field upgrades

let clickMultiplier = 1;
let workerMultiplier = 1;

// Upgrade flags
let clickUpgrade1Bought  = false;
let clickUpgrade2Bought  = false;
let clickUpgrade3Bought  = false;
let workerUpgrade1Bought = false;
let workerUpgrade2Bought = false;
let workerUpgrade3Bought = false;
let fieldUpgrade1Bought  = false;
let fieldUpgrade2Bought  = false;
let fieldUpgrade3Bought  = false;
let manorUpgrade1Bought  = false;

// =====================
// CRATE VARIABLES
// =====================
const BASE_CRATE_COST = 500;
let crateOpens = 0;
// Cost formula: BASE * 1.5^opens, then 2x everything after 10 opens
function getCrateCost() {
    const base = Math.floor(BASE_CRATE_COST * Math.pow(1.5, crateOpens));
    return crateOpens >= 10 ? base * 2 : base;
}

let activeBuff     = null;
let buffInterval   = null;
let crateClickBonus  = 1;
let crateWorkerBonus = 1;

// Fast Fortune: ticks the passive interval at 0.5s instead of 1s
let fastFortuneActive = false;
let fastFortuneEnd    = 0;
let passiveInterval   = null; // ref so we can reschedule

const CRATE_REWARDS = [
    // GREY
    { id: 'prod_2x_1m',      rarity: 'grey',   label: '2x Production',   desc: '2x all production for 1 min',       weight: 22, apply: () => applyProductionBuff(2, 60) },
    { id: 'prod_1_5x_5m',    rarity: 'grey',   label: '1.5x Production', desc: '1.5x all production for 5 min',     weight: 20, apply: () => applyProductionBuff(1.5, 300) },
    // BLUE
    { id: 'prod_2x_5m',      rarity: 'blue',   label: '2x Production',   desc: '2x all production for 5 min',       weight: 16, apply: () => applyProductionBuff(2, 300) },
    { id: 'prod_3x_1m',      rarity: 'blue',   label: '3x Production',   desc: '3x all production for 1 min',       weight: 14, apply: () => applyProductionBuff(3, 60) },
    { id: 'click_2x_5m',     rarity: 'blue',   label: '2x Click Power',  desc: '2x click power for 5 min',          weight: 14, apply: () => applyClickBuff(2, 300) },
    // PURPLE
    { id: 'prod_2x_10m',     rarity: 'purple', label: '2x Production',   desc: '2x all production for 10 min',      weight: 7,  apply: () => applyProductionBuff(2, 600) },
    { id: 'free_upgrade',    rarity: 'purple', label: 'Free Upgrade',    desc: 'Unlock the cheapest upgrade free',  weight: 6,  apply: () => grantFreeUpgrade() },
    { id: 'prod_5x_1m',      rarity: 'purple', label: '5x Production',   desc: '5x all production for 1 min',       weight: 5,  apply: () => applyProductionBuff(5, 60) },
    // PINK
    { id: 'prod_3x_10m',     rarity: 'pink',   label: '3x Production',   desc: '3x all production for 10 min',      weight: 3,  apply: () => applyProductionBuff(3, 600) },
    { id: 'prod_2x_30m',     rarity: 'pink',   label: '2x Production',   desc: '2x all production for 30 min',      weight: 2,  apply: () => applyProductionBuff(2, 1800) },
    { id: 'random_upgrade',  rarity: 'pink',   label: 'Random Upgrade',  desc: 'Apply a random upgrade for free',   weight: 2,  apply: () => grantRandomUpgrade() },
    // GOLD
    { id: 'prod_5x_10m',     rarity: 'gold',   label: '5x Production',   desc: '5x all production for 10 min',      weight: 1,  apply: () => applyProductionBuff(5, 600) },
    { id: 'prod_10x_1m',     rarity: 'gold',   label: '10x Production',  desc: '10x all production for 1 min',      weight: 1,  apply: () => applyProductionBuff(10, 60) },
    { id: 'fast_fortune',    rarity: 'gold',   label: 'Fast Fortune',    desc: 'Production ticks every 0.5s for 45 min', weight: 1, apply: () => applyFastFortune() },
];

// ── Weighted random (correct: pick BEFORE drawing the strip, pass winner in)
function weightedRandom(rewards) {
    const total = rewards.reduce((s, r) => s + r.weight, 0);
    let rand = Math.random() * total;
    for (const r of rewards) {
        rand -= r.weight;
        if (rand < 0) return r;
    }
    return rewards[rewards.length - 1];
}

// ── Buff helpers
function applyProductionBuff(mult, seconds) {
    clearExistingBuff();
    crateWorkerBonus = mult; crateClickBonus = mult;
    activeBuff = { label: `${mult}x Production`, endTime: Date.now() + seconds * 1000 };
    startBuffTimer();
}
function applyClickBuff(mult, seconds) {
    clearExistingBuff();
    crateClickBonus = mult;
    activeBuff = { label: `${mult}x Click Power`, endTime: Date.now() + seconds * 1000 };
    startBuffTimer();
}
function applyFastFortune() {
    // Don't clear other buffs — Fast Fortune is a separate interval boost
    fastFortuneActive = true;
    fastFortuneEnd = Date.now() + 45 * 60 * 1000;
    reschedulePassive(500);
    // Track remaining time in buff block as a secondary line
    startFastFortuneTimer();
}
function clearExistingBuff() {
    crateClickBonus = 1; crateWorkerBonus = 1; activeBuff = null;
    if (buffInterval) { clearInterval(buffInterval); buffInterval = null; }
    updateBuffDisplay();
}
function updateBuffDisplay() {
    const block = document.getElementById('crateBuffBlock');
    if (!block) return;
    const lines = [];
    if (activeBuff) lines.push('Active: ' + activeBuff.label);
    if (fastFortuneActive) {
        const rem = Math.max(0, Math.ceil((fastFortuneEnd - Date.now()) / 1000));
        const m = Math.floor(rem / 60), s = rem % 60;
        lines.push('Fast Fortune: ' + (m > 0 ? m + 'm ' + s + 's' : s + 's'));
    }
    if (lines.length === 0) {
        block.innerHTML = 'No active buff<div id="buffTimer"></div>';
    } else {
        block.innerHTML = lines.join('<br>') + '<div id="buffTimer"></div>';
    }
}
function startBuffTimer() {
    if (buffInterval) clearInterval(buffInterval);
    buffInterval = setInterval(() => {
        if (!activeBuff) { clearInterval(buffInterval); buffInterval = null; updateBuffDisplay(); return; }
        const remaining = Math.ceil((activeBuff.endTime - Date.now()) / 1000);
        if (remaining <= 0) { clearExistingBuff(); return; }
        const m = Math.floor(remaining / 60), s = remaining % 60;
        const block = document.getElementById('crateBuffBlock');
        if (block) {
            const ffLine = fastFortuneActive ? '<br>Fast Fortune active' : '';
            block.innerHTML = 'Active: ' + activeBuff.label + '<div id="buffTimer">' + (m > 0 ? m + 'm ' + s + 's' : s + 's') + ' left</div>' + ffLine;
        }
    }, 500);
}
let ffTimerInterval = null;
function startFastFortuneTimer() {
    if (ffTimerInterval) clearInterval(ffTimerInterval);
    ffTimerInterval = setInterval(() => {
        if (!fastFortuneActive) { clearInterval(ffTimerInterval); return; }
        const rem = Math.ceil((fastFortuneEnd - Date.now()) / 1000);
        if (rem <= 0) {
            fastFortuneActive = false;
            reschedulePassive(1000);
            clearInterval(ffTimerInterval);
        }
        updateBuffDisplay();
    }, 1000);
}

// ── Passive interval management (Fast Fortune changes tick rate)
function reschedulePassive(ms) {
    if (passiveInterval) clearInterval(passiveInterval);
    passiveInterval = setInterval(passiveTick, ms);
}

// =====================
// UPGRADE GRANTS (crate rewards)
// =====================
const ALL_UPGRADE_IDS = ['click1','click2','click3','worker1','worker2','worker3','field1','field2','field3','manor1'];

function grantFreeUpgrade() {
    for (const id of ALL_UPGRADE_IDS) {
        if (tryGrantUpgrade(id)) { showFloatingMsg('Free upgrade applied!'); updateDisplay(); return; }
    }
    const bonus = Math.floor(cotton * 0.1) + 500;
    addCotton(bonus);
    showFloatingMsg('All upgrades bought. +' + bonus + ' cotton instead.');
    updateDisplay();
}
function grantRandomUpgrade() {
    const available = ALL_UPGRADE_IDS.filter(id => canGrantUpgrade(id));
    if (available.length === 0) {
        const bonus = Math.floor(cotton * 0.15) + 1000;
        addCotton(bonus);
        showFloatingMsg('All upgrades bought. +' + bonus + ' cotton.');
        return;
    }
    const pick = available[Math.floor(Math.random() * available.length)];
    if (tryGrantUpgrade(pick)) { showFloatingMsg('Random upgrade applied!'); updateDisplay(); }
}
function canGrantUpgrade(id) {
    if (id === 'click1')  return !clickUpgrade1Bought;
    if (id === 'click2')  return clickUpgrade1Bought  && !clickUpgrade2Bought;
    if (id === 'click3')  return clickUpgrade2Bought  && !clickUpgrade3Bought;
    if (id === 'worker1') return !workerUpgrade1Bought;
    if (id === 'worker2') return workerUpgrade1Bought && !workerUpgrade2Bought;
    if (id === 'worker3') return workerUpgrade2Bought && !workerUpgrade3Bought;
    if (id === 'field1')  return !fieldUpgrade1Bought;
    if (id === 'field2')  return fieldUpgrade1Bought  && !fieldUpgrade2Bought;
    if (id === 'field3')  return fieldUpgrade2Bought  && !fieldUpgrade3Bought;
    if (id === 'manor1')  return !manorUpgrade1Bought;
    return false;
}
function tryGrantUpgrade(id) {
    if (!canGrantUpgrade(id)) return false;
    applyUpgrade(id); return true;
}
function applyUpgrade(id) {
    if (id === 'click1')  { clickMultiplier  *= 2; clickUpgrade1Bought  = true; }
    if (id === 'click2')  { clickMultiplier  *= 2; clickUpgrade2Bought  = true; }
    if (id === 'click3')  { clickMultiplier  *= 2; clickUpgrade3Bought  = true; }
    if (id === 'worker1') { workerMultiplier *= 2; workerUpgrade1Bought = true; }
    if (id === 'worker2') { workerMultiplier *= 2; workerUpgrade2Bought = true; }
    if (id === 'worker3') { workerMultiplier *= 2; workerUpgrade3Bought = true; }
    if (id === 'field1')  { fieldIncome      *= 2; fieldUpgrade1Bought  = true; }
    if (id === 'field2')  { fieldIncome      *= 2; fieldUpgrade2Bought  = true; }
    if (id === 'field3')  { fieldIncome      *= 2; fieldUpgrade3Bought  = true; }
    if (id === 'manor1')  { manorIncome      *= 2; manorUpgrade1Bought  = true; }
    syncUpgradeButtons();
}

function showFloatingMsg(msg) {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;top:28%;left:50%;transform:translateX(-50%);background:#2a4a1a;color:#f0ead8;padding:10px 20px;font-size:15px;font-family:"Courier New",monospace;font-weight:bold;z-index:9999;pointer-events:none;animation:fadeInOut 3s forwards;';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}

// =====================
// CRATE MODAL — FIXED SPINNER
// The bug: targetX was calculated from a hardcoded 300 (half of old 600px track)
// but the track is actually 620px wide, so centre = 310. Also the transition was
// being set before the initial position was painted, meaning the browser would
// sometimes skip straight to the end without animating, landing on the wrong item.
// Fix: reset transition to 'none', force reflow, THEN set the transition + targetX.
// =====================
let crateSpinning = false;

function openCrateModal() {
    if (crateSpinning) return;
    const cost = getCrateCost();
    if (cotton < cost) {
        showFloatingMsg('Need ' + cost.toLocaleString() + ' cotton to open.');
        return;
    }

    // Deduct cost and advance counter BEFORE drawing winner
    cotton -= cost;
    crateOpens++;
    updateDisplay();

    // ── Draw winner ONCE, then build strip around it
    const winner = weightedRandom(CRATE_REWARDS);

    const STRIP_COUNT = 52;
    const WINNER_POS  = 42;   // zero-based index where the winner sits
    const ITEM_W      = 122;  // px per card (116px + 3px margin each side)

    const strip = [];
    for (let i = 0; i < STRIP_COUNT; i++) {
        strip.push(i === WINNER_POS ? winner : weightedRandom(CRATE_REWARDS));
    }

    // Build DOM
    const inner = document.getElementById('spinnerInner');
    inner.style.transition = 'none';          // kill any leftover transition first
    inner.style.transform  = 'translateX(0)'; // snap back to start
    inner.innerHTML = '';

    strip.forEach(r => {
        const el = document.createElement('div');
        el.className = `spinItem rarity-${r.rarity}`;
        el.innerHTML = `<div class="spin-rarity">${r.rarity}</div><div class="spin-main">${r.label}</div>`;
        inner.appendChild(el);
    });

    // Reset result UI
    const result = document.getElementById('spinResult');
    result.style.display = 'none'; result.className = '';
    document.getElementById('closeModalBtn').style.display = 'none';
    document.getElementById('crateModalTitle').textContent = 'Opening Crate';
    document.getElementById('crateModal').classList.add('open');
    crateSpinning = true;

    // ── Calculate exact stop position
    // Track visible width = 620px (from CSS). Centre of track = 310px.
    // We want the CENTRE of the winner card to land exactly on the centre line.
    // Winner card centre (in strip coordinates) = WINNER_POS * ITEM_W + ITEM_W/2
    // translateX needed = -(winnerCentre - trackCentre)
    // Add a small jitter so it doesn't always stop at the dead centre of the card.
    const TRACK_CENTRE = 310;
    const winnerCentre = WINNER_POS * ITEM_W + ITEM_W / 2;
    const jitter = (Math.random() - 0.5) * (ITEM_W * 0.35); // ±35% of card width
    const targetX = -(winnerCentre - TRACK_CENTRE - jitter);

    const SPIN_MS = 5000;

    // Force a reflow so the browser registers the snap-back BEFORE we animate
    void inner.offsetWidth;

    // NOW set the transition and trigger the animation
    inner.style.transition = `transform ${SPIN_MS}ms cubic-bezier(0.04, 0.80, 0.20, 1)`;
    inner.style.transform  = `translateX(${targetX}px)`;

    setTimeout(() => {
        crateSpinning = false;

        // Show result card
        result.className = `spinResult rarity-${winner.rarity}`;
        result.innerHTML =
            `<span class="result-rarity">${winner.rarity}</span>` +
            `<span class="result-name">${winner.label}</span>` +
            `<span class="result-desc">${winner.desc}</span>`;
        result.style.display = 'block';
        document.getElementById('crateModalTitle').textContent = 'You got...';
        document.getElementById('closeModalBtn').style.display = 'inline-block';

        // Apply the reward AFTER the spin resolves
        winner.apply();
        saveGame();
    }, SPIN_MS + 300);
}

function closeCrateModal() {
    document.getElementById('crateModal').classList.remove('open');
    updateDisplay();
}

// =====================
// ACHIEVEMENTS
// =====================
const achievementDefs = [
    { id: 'cotton_1',         label: 'First Pick',        desc: 'Collect 1 cotton',           goal: 1,         badge: '1' },
    { id: 'cotton_100',       label: 'Getting Started',   desc: 'Collect 100 cotton',         goal: 100,       badge: '100' },
    { id: 'cotton_1k',        label: 'Cotton Farmer',     desc: 'Collect 1,000 cotton',       goal: 1000,      badge: '1K' },
    { id: 'cotton_10k',       label: 'Field Hand',        desc: 'Collect 10,000 cotton',      goal: 10000,     badge: '10K' },
    { id: 'cotton_100k',      label: 'Field Boss',        desc: 'Collect 100,000 cotton',     goal: 100000,    badge: '100K' },
    { id: 'cotton_500k',      label: 'Cotton Baron',      desc: 'Collect 500,000 cotton',     goal: 500000,    badge: '500K' },
    { id: 'cotton_1m',        label: 'Cotton Tycoon',     desc: 'Collect 1,000,000 cotton',   goal: 1000000,   badge: '1M' },
    { id: 'cotton_5m',        label: 'The Landowner',     desc: 'Collect 5,000,000 cotton',   goal: 5000000,   badge: '5M' },
    { id: 'cotton_25m',       label: 'Manor Lord',        desc: 'Collect 25,000,000 cotton',  goal: 25000000,  badge: '25M' },
    { id: 'cotton_100m',      label: 'Cotton Empire',     desc: 'Collect 100,000,000 cotton', goal: 100000000, badge: '100M' },
    { id: 'cotton_250m',      label: 'The Harvest King',  desc: 'Collect 250,000,000 cotton', goal: 250000000, badge: '250M' },
    { id: 'cotton_500m',      label: 'Half a Billion',    desc: 'Collect 500,000,000 cotton', goal: 500000000, badge: '500M' },
    { id: 'cotton_1b',        label: 'Cotton God',        desc: 'Collect 1,000,000,000 cotton',goal:1000000000,badge: '1B' },
];
let unlockedAchievements = new Set();

function addCotton(amount) {
    cotton += amount;
    totalCottonEarned += amount;
    checkAchievements();
}
function checkAchievements() {
    let changed = false;
    achievementDefs.forEach(a => {
        if (!unlockedAchievements.has(a.id) && totalCottonEarned >= a.goal) {
            unlockedAchievements.add(a.id);
            showAchievementToast(a);
            changed = true;
        }
    });
    if (changed) renderAchievements();
}
function showAchievementToast(a) {
    const t = document.getElementById('achievementToast');
    t.textContent = 'Achievement Unlocked: ' + a.label;
    t.style.display = 'block';
    t.style.animation = 'none'; void t.offsetWidth;
    t.style.animation = 'fadeInOut 3s forwards';
    setTimeout(() => { t.style.display = 'none'; }, 3000);
}
function renderAchievements() {
    const list = document.getElementById('achievementList');
    if (!list) return;
    list.innerHTML = '';
    achievementDefs.forEach(a => {
        const unlocked = unlockedAchievements.has(a.id);
        const div = document.createElement('div');
        div.className = 'ach-item' + (unlocked ? ' unlocked' : '');
        div.innerHTML = `<div class="ach-badge">${unlocked ? a.badge : '?'}</div><div><span class="ach-name">${a.label}</span><span class="ach-desc">${a.desc}</span></div>`;
        list.appendChild(div);
    });
    document.getElementById('achCount').textContent =
        unlockedAchievements.size + ' / ' + achievementDefs.length + ' unlocked';
}

// =====================
// DOM
// =====================
const cottonDisplay = document.getElementById('cottonCount');
const cpsDisplay    = document.getElementById('cps');
const gameArea      = document.getElementById('gameArea');

// =====================
// UPGRADE BUTTONS
// =====================
function syncUpgradeButtons() {
    const set = (id, bought, locked) => {
        const b = document.getElementById(id);
        if (!b) return;
        if (bought) { b.classList.add('bought'); b.disabled = true; b.classList.remove('locked'); }
        else if (locked) { b.classList.add('locked'); b.disabled = false; }
        else { b.classList.remove('locked'); b.disabled = false; }
    };
    set('clickUpgrade1Btn',  clickUpgrade1Bought,  false);
    set('clickUpgrade2Btn',  clickUpgrade2Bought,  !clickUpgrade1Bought);
    set('clickUpgrade3Btn',  clickUpgrade3Bought,  !clickUpgrade2Bought);
    set('workerUpgrade1Btn', workerUpgrade1Bought, false);
    set('workerUpgrade2Btn', workerUpgrade2Bought, !workerUpgrade1Bought);
    set('workerUpgrade3Btn', workerUpgrade3Bought, !workerUpgrade2Bought);
    set('fieldUpgrade1Btn',  fieldUpgrade1Bought,  false);
    set('fieldUpgrade2Btn',  fieldUpgrade2Bought,  !fieldUpgrade1Bought);
    set('fieldUpgrade3Btn',  fieldUpgrade3Bought,  !fieldUpgrade2Bought);
    set('manorUpgrade1Btn',  manorUpgrade1Bought,  false);
}

function attachUpgradeHandlers() {
    const buy = (btnId, flag, cost, upgradeId) => {
        document.getElementById(btnId).onclick = function() {
            if (!flag() && !this.classList.contains('locked') && cotton >= cost) {
                cotton -= cost; applyUpgrade(upgradeId); updateDisplay();
            }
        };
    };
    buy('clickUpgrade1Btn',  () => clickUpgrade1Bought,  150,    'click1');
    buy('clickUpgrade2Btn',  () => clickUpgrade2Bought,  1000,   'click2');
    buy('clickUpgrade3Btn',  () => clickUpgrade3Bought,  2500,   'click3');
    buy('workerUpgrade1Btn', () => workerUpgrade1Bought, 1000,   'worker1');
    buy('workerUpgrade2Btn', () => workerUpgrade2Bought, 3000,   'worker2');
    buy('workerUpgrade3Btn', () => workerUpgrade3Bought, 5000,   'worker3');
    buy('fieldUpgrade1Btn',  () => fieldUpgrade1Bought,  42000,  'field1');
    buy('fieldUpgrade2Btn',  () => fieldUpgrade2Bought,  150000, 'field2');
    buy('fieldUpgrade3Btn',  () => fieldUpgrade3Bought,  320000, 'field3');
    buy('manorUpgrade1Btn',  () => manorUpgrade1Bought,  400000, 'manor1');
}
attachUpgradeHandlers();

// =====================
// CLICK COTTON
// =====================
document.getElementById('cottonButton').onclick = function(e) {
    const gained = 1 * clickMultiplier * crateClickBonus;
    addCotton(gained);
    showPopNumber(e.clientX, e.clientY, Math.floor(gained));
    this.classList.remove('clicked'); void this.offsetWidth; this.classList.add('clicked');
    updateDisplay();
};

function showPopNumber(x, y, value) {
    const pop = document.createElement('div');
    pop.className = 'popNumber';
    pop.style.left = (x - 10) + 'px';
    pop.style.top  = (y - 30) + 'px';
    pop.textContent = '+' + value;
    document.body.appendChild(pop);
    setTimeout(() => pop.remove(), 1000);
}

// =====================
// BUY WORKER
// =====================
document.getElementById('buyWorker').onclick = function() {
    if (cotton >= workerCost) {
        cotton -= workerCost; workers++;
        spawnWorker();
        workerCost = Math.floor(workerCost * 1.2);
        updateDisplay();
    }
};
function spawnWorker() {
    const w = document.createElement('img');
    w.src = 'images/worker.png'; w.className = 'worker';
    const btn = document.getElementById('cottonButton');
    const bR  = btn.getBoundingClientRect();
    const gR  = gameArea.getBoundingClientRect();
    let x, y, safe = false;
    while (!safe) {
        x = Math.random() * (gR.width  - 80);
        y = Math.random() * (gR.height - 80);
        const ox = x + 80 > (bR.left - gR.left) && x < (bR.right  - gR.left);
        const oy = y + 80 > (bR.top  - gR.top)  && y < (bR.bottom - gR.top);
        if (!(ox && oy)) safe = true;
    }
    w.style.left = x + 'px'; w.style.top = y + 'px';
    gameArea.appendChild(w);
}

// =====================
// BUY FIELD
// =====================
document.getElementById('buyField').onclick = function() {
    if (cotton >= fieldCost) {
        cotton -= fieldCost;
        spawnField(fields.length);
        fields.push(true);
        fieldCost = Math.floor(fieldCost * 1.4);
        updateDisplay();
    }
};
function spawnField(index) {
    const field = document.createElement('img');
    field.src = 'images/field.png'; field.className = 'field';
    field.style.cssText = 'position:absolute;pointer-events:none;width:200px;';
    const gR = gameArea.getBoundingClientRect();
    field.style.left = (gR.right + 20) + 'px';
    field.style.top  = (gR.top + 50 + 110 * index) + 'px';
    document.body.appendChild(field);
}

// =====================
// BUY MANOR
// =====================
document.getElementById('buyManor').onclick = function() {
    if (cotton >= manorCost) {
        cotton -= manorCost; manors++;
        spawnManor(manors - 1);
        manorCost = Math.floor(BASE_MANOR_COST * Math.pow(1.3, manors));
        updateDisplay();
    }
};
function spawnManor(index) {
    const m = document.createElement('img');
    m.src = 'images/manor.png'; m.className = 'manor';
    const gR = gameArea.getBoundingClientRect();
    m.style.position = 'fixed';
    m.style.left = Math.max(0, gR.left - 210) + 'px';
    m.style.top  = (gR.top + 10 + 175 * index) + 'px';
    m.style.width = '195px'; // 1.5x original 130px
    m.style.pointerEvents = 'none';
    document.body.appendChild(m);
}

// =====================
// UPDATE DISPLAY
// =====================
function updateDisplay() {
    cottonDisplay.textContent = Math.floor(cotton).toLocaleString();

    const workerCps = workers * cottonPerWorker * workerMultiplier * crateWorkerBonus;
    const fieldCps  = fields.length * fieldIncome * crateWorkerBonus;
    const manorCps  = manors * manorIncome * crateWorkerBonus;
    // If fast fortune is ticking at 0.5s, effective CPS doubles
    const ffMult    = (fastFortuneActive && Date.now() < fastFortuneEnd) ? 2 : 1;
    cpsDisplay.textContent = ((workerCps + fieldCps + manorCps) * ffMult).toFixed(2);

    document.getElementById('buyWorker').textContent = 'Hire Worker (' + workerCost.toLocaleString() + ' cotton)';
    document.getElementById('buyField').textContent  = 'Buy Field (' + Math.floor(fieldCost).toLocaleString() + ' cotton)';
    document.getElementById('buyManor').textContent  = 'Build Manor (' + Math.floor(manorCost).toLocaleString() + ' cotton)';

    const cost = getCrateCost();
    document.getElementById('crateCostVal').textContent  = cost.toLocaleString();
    document.getElementById('crateOpensVal').textContent = crateOpens;
    document.getElementById('openCrateBtn').disabled = cotton < cost;

    // Show 2x warning when approaching 10 opens
    const scaleLine = document.getElementById('crateScaleLine');
    if (scaleLine) scaleLine.style.display = crateOpens < 10 ? 'block' : 'none';

    syncUpgradeButtons();
}

// =====================
// PASSIVE INCOME TICK
// =====================
function passiveTick() {
    // If fast fortune expired mid-tick, revert interval
    if (fastFortuneActive && Date.now() >= fastFortuneEnd) {
        fastFortuneActive = false;
        reschedulePassive(1000);
        updateBuffDisplay();
        updateDisplay();
    }

    const workerCps = workers * cottonPerWorker * workerMultiplier * crateWorkerBonus;
    const fieldCps  = fields.length * fieldIncome * crateWorkerBonus;
    const manorCps  = manors * manorIncome * crateWorkerBonus;
    addCotton(workerCps + fieldCps + manorCps);
    updateDisplay();
}

// Start passive at 1s (Fast Fortune will change this)
reschedulePassive(1000);

// =====================
// RESET
// =====================
function resetGame() {
    if (!confirm('Reset everything?')) return;
    localStorage.removeItem('cottonPickerSave');
    location.reload();
}

// =====================
// SAVE / LOAD
// =====================
function saveGame() {
    localStorage.setItem('cottonPickerSave', JSON.stringify({
        cotton, totalCottonEarned,
        workers, workerCost,
        manors, manorCost, manorIncome,
        fields: fields.length, fieldCost, fieldIncome,
        clickMultiplier, workerMultiplier,
        clickUpgrade1Bought, clickUpgrade2Bought, clickUpgrade3Bought,
        workerUpgrade1Bought, workerUpgrade2Bought, workerUpgrade3Bought,
        fieldUpgrade1Bought, fieldUpgrade2Bought, fieldUpgrade3Bought,
        manorUpgrade1Bought,
        unlockedAchievements: [...unlockedAchievements],
        crateOpens,
        activeBuff: activeBuff ? { label: activeBuff.label, endTime: activeBuff.endTime } : null,
        fastFortuneActive, fastFortuneEnd,
        crateClickBonus, crateWorkerBonus,
    }));
}

function loadGame() {
    const s = JSON.parse(localStorage.getItem('cottonPickerSave'));
    if (!s) { renderAchievements(); syncUpgradeButtons(); updateDisplay(); return; }

    cotton            = s.cotton || 0;
    totalCottonEarned = s.totalCottonEarned || s.cotton || 0;
    workers           = s.workers || 0;
    workerCost        = s.workerCost || 10;
    manors            = s.manors || 0;
    manorCost         = s.manorCost || BASE_MANOR_COST;
    manorIncome       = s.manorIncome || 75;
    fields            = Array(s.fields || 0).fill(true);
    fieldCost         = s.fieldCost || baseFieldCost;
    fieldIncome       = s.fieldIncome || 25;
    clickMultiplier   = s.clickMultiplier || 1;
    workerMultiplier  = s.workerMultiplier || 1;

    clickUpgrade1Bought  = s.clickUpgrade1Bought  || false;
    clickUpgrade2Bought  = s.clickUpgrade2Bought  || false;
    clickUpgrade3Bought  = s.clickUpgrade3Bought  || false;
    workerUpgrade1Bought = s.workerUpgrade1Bought || false;
    workerUpgrade2Bought = s.workerUpgrade2Bought || false;
    workerUpgrade3Bought = s.workerUpgrade3Bought || false;
    fieldUpgrade1Bought  = s.fieldUpgrade1Bought  || false;
    fieldUpgrade2Bought  = s.fieldUpgrade2Bought  || false;
    fieldUpgrade3Bought  = s.fieldUpgrade3Bought  || false;
    manorUpgrade1Bought  = s.manorUpgrade1Bought  || false;

    crateOpens       = s.crateOpens       || 0;
    crateClickBonus  = s.crateClickBonus  || 1;
    crateWorkerBonus = s.crateWorkerBonus || 1;

    if (s.unlockedAchievements) unlockedAchievements = new Set(s.unlockedAchievements);

    if (s.activeBuff && s.activeBuff.endTime > Date.now()) {
        activeBuff = s.activeBuff; startBuffTimer();
    }
    if (s.fastFortuneActive && s.fastFortuneEnd > Date.now()) {
        fastFortuneActive = true;
        fastFortuneEnd    = s.fastFortuneEnd;
        reschedulePassive(500);
        startFastFortuneTimer();
    }

    for (let i = 0; i < workers; i++) spawnWorker();
    for (let i = 0; i < fields.length; i++) spawnField(i);
    for (let i = 0; i < manors; i++) spawnManor(i);

    syncUpgradeButtons();
    renderAchievements();
    updateDisplay();
}

loadGame();
setInterval(saveGame, 5000);
