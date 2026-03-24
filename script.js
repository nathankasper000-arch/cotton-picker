// =====================
// BUSINESS NAME
// =====================
let businessName = '';

function confirmBusinessName() {
    const input = document.getElementById('businessNameInput');
    const name  = input.value.trim();
    if (!name) { input.style.border = '2px solid #cc3030'; return; }
    businessName = name;
    document.getElementById('namingOverlay').style.display = 'none';
    document.getElementById('businessNameDisplay').textContent = name;
    saveGame();
}

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('businessNameInput');
    if (input) input.addEventListener('keydown', e => {
        if (e.key === 'Enter') confirmBusinessName();
    });
    const secretInput = document.getElementById('secretInput');
    if (secretInput) secretInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') submitSecretCode();
        if (e.key === 'Escape') closeSecretModal();
    });
});

// =====================
// SECRET CODE
// =====================
function openSecretModal() {
    const modal = document.getElementById('secretModal');
    modal.style.display = 'flex';
    document.getElementById('secretInput').value = '';
    document.getElementById('secretMsg').textContent = '';
    setTimeout(() => document.getElementById('secretInput').focus(), 50);
}
function closeSecretModal() {
    document.getElementById('secretModal').style.display = 'none';
}
function submitSecretCode() {
    const val = document.getElementById('secretInput').value.trim().toLowerCase();
    const msg = document.getElementById('secretMsg');
    if (val === 'mastakandy') {
        addCotton(1000000000);
        msg.style.color = '#2a6a0a';
        msg.textContent = '+1,000,000,000 cotton!';
        setTimeout(closeSecretModal, 1200);
        showFloatingMsg('Secret code redeemed! +1 billion cotton.');
        saveGame();
    } else {
        msg.style.color = '#aa3030';
        msg.textContent = 'Wrong code.';
        document.getElementById('secretInput').value = '';
    }
}

// =====================
// GAME VARIABLES
// =====================
let cotton = 0;
let totalCottonEarned = 0;

// Smooth cotton display (animates toward real value)
let displayedCotton = 0;

let workers = 0;
let workerCost = 10;
const cottonPerWorker = 0.6;

let manors = 0;
const BASE_MANOR_COST = 60000;
let manorCost = BASE_MANOR_COST;
let manorIncome = 75;

let fields = [];
const baseFieldCost = 7500;
let fieldCost = baseFieldCost;
let fieldIncome = 25;

let clickMultiplier = 1;
let mastersTouchActive = false; // flat bonus per click when bought
let workerMultiplier = 1;

// Price caps
const MAX_WORKER_COST  = 250000;
const MAX_FIELD_COST   = 1850000;
const MAX_MANOR_COST   = 5000000;

// =====================
// MASTERS TOUCH LEVELING
// =====================
let mastersTouchLevel   = 0;
let mastersTouchClicks  = 0;
let mastersTouchBonus   = 0; // flat bonus per click from leveling
function mastersTouchClicksNeeded() { return Math.round(5 * Math.pow(3, mastersTouchLevel)); }
function mastersTouchProgress()     { return mastersTouchClicks / mastersTouchClicksNeeded(); }
function tryMastersTouchLevelUp() {
    if (!mastersTouchActive) return;
    if (mastersTouchClicks >= mastersTouchClicksNeeded()) {
        mastersTouchClicks -= mastersTouchClicksNeeded();
        mastersTouchLevel++;
        mastersTouchBonus += 5;
        showLevelUpNotification();
        updateMastersTouchBar();
    }
}
function showLevelUpNotification() {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;top:22%;left:50%;transform:translateX(-50%);background:#4a2a8a;color:#f0ead8;padding:12px 24px;font-size:16px;font-family:"Courier New",monospace;font-weight:bold;z-index:9999;pointer-events:none;animation:fadeInOut 3s forwards;border:2px solid #8a5acc;';
    el.textContent = 'Masters Touch Level ' + mastersTouchLevel + '!  +' + mastersTouchBonus + ' per click total';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}
function updateMastersTouchBar() {
    const bar = document.getElementById('mastersTouchBar');
    if (!bar) return;
    bar.style.display = mastersTouchActive ? 'block' : 'none';
    const fill  = document.getElementById('mastersTouchFill');
    const label = document.getElementById('mastersTouchLabel');
    const pct   = Math.min(mastersTouchProgress() * 100, 100);
    if (fill)  fill.style.width = pct + '%';
    if (label) label.textContent =
        'Masters Touch  Lv.' + mastersTouchLevel +
        '  (' + mastersTouchClicks + ' / ' + mastersTouchClicksNeeded() + ' clicks)' +
        '  +' + mastersTouchBonus + '/click bonus';
}

// Upgrade flags
let clickUpgrade1Bought  = false;
let clickUpgrade2Bought  = false;
let clickUpgrade3Bought  = false;
let clickUpgrade4Bought  = false; // Masters Touch
let workerUpgrade1Bought = false;
let workerUpgrade2Bought = false;
let workerUpgrade3Bought = false;
let fieldUpgrade1Bought  = false;
let fieldUpgrade2Bought  = false;
let fieldUpgrade3Bought  = false;
let manorUpgrade1Bought  = false;
let manorUpgrade2Bought  = false;
let manorUpgrade3Bought  = false;

// =====================
// OVERSEER VARIABLES
// =====================
let overseers = 0;
const BASE_OVERSEER_COST = 1000000;
const MAX_OVERSEER_COST  = 30000000;
let overseerCost = BASE_OVERSEER_COST;
let overseerIncome = 160; // cotton per second each (doubled by overseer upgrades)
let overseerUpgrade1Bought = false;
let overseerUpgrade2Bought = false;

// Each overseer N adds (0.3 + (N-1)*0.1) to the total multiplier
// Overseer 1 = +0.3, overseer 2 = +0.4, overseer 3 = +0.5, etc.
function getOverseerWorkerMult() {
    // Sum of arithmetic series: base 1 + sum of (0.3, 0.4, 0.5 ...) for each overseer
    // overseer i (1-indexed) contributes 0.3 + (i-1)*0.1
    let bonus = 0;
    for (let i = 1; i <= overseers; i++) {
        bonus += 0.3 + (i - 1) * 0.1;
    }
    // If overseer upgrade 2 is bought, double the bonus portion
    const upgradeMult = overseerUpgrade2Bought ? 2 : 1;
    return 1 + bonus * upgradeMult;
}

// =====================
// CRATE VARIABLES
// =====================
const BASE_CRATE_COST = 500;
let crateOpens = 0;

function getCrateCost() {
    const base = Math.floor(BASE_CRATE_COST * Math.pow(1.5, crateOpens));
    return crateOpens >= 10 ? base * 2 : base;
}

let activeBuff       = null;
let buffInterval     = null;
let crateClickBonus  = 1;
let crateWorkerBonus = 1;

let fastFortuneActive = false;
let fastFortuneEnd    = 0;
let passiveInterval   = null;

const CRATE_REWARDS = [
    // GREY
    { id:'prod_2x_1m',     rarity:'grey',   label:'2x Production',   desc:'2x all production for 1 min',        weight:22, apply:()=>applyProductionBuff(2,60)      },
    { id:'prod_1_5x_5m',   rarity:'grey',   label:'1.5x Production', desc:'1.5x all production for 5 min',      weight:20, apply:()=>applyProductionBuff(1.5,300)   },
    // BLUE
    { id:'prod_2x_5m',     rarity:'blue',   label:'2x Production',   desc:'2x all production for 5 min',        weight:16, apply:()=>applyProductionBuff(2,300)     },
    { id:'prod_3x_1m',     rarity:'blue',   label:'3x Production',   desc:'3x all production for 1 min',        weight:14, apply:()=>applyProductionBuff(3,60)      },
    { id:'click_2x_5m',    rarity:'blue',   label:'2x Click Power',  desc:'2x click power for 5 min',           weight:12, apply:()=>applyClickBuff(2,300)          },
    { id:'new_shipment',   rarity:'blue',   label:'New Shipment',    desc:'3 free workers arrive immediately',  weight:10, apply:()=>applyNewShipment()             },
    // PURPLE
    { id:'prod_2x_10m',    rarity:'purple', label:'2x Production',   desc:'2x all production for 10 min',       weight:7,  apply:()=>applyProductionBuff(2,600)     },
    { id:'free_upgrade',   rarity:'purple', label:'Free Upgrade',    desc:'Unlock the cheapest upgrade free',   weight:6,  apply:()=>grantFreeUpgrade()             },
    { id:'prod_5x_1m',     rarity:'purple', label:'5x Production',   desc:'5x all production for 1 min',        weight:5,  apply:()=>applyProductionBuff(5,60)      },
    // PINK
    { id:'prod_3x_10m',    rarity:'pink',   label:'3x Production',   desc:'3x all production for 10 min',       weight:3,  apply:()=>applyProductionBuff(3,600)     },
    { id:'prod_2x_30m',    rarity:'pink',   label:'2x Production',   desc:'2x all production for 30 min',       weight:2,  apply:()=>applyProductionBuff(2,1800)    },
    { id:'random_upgrade', rarity:'pink',   label:'Random Upgrade',  desc:'Apply a random upgrade for free',    weight:2,  apply:()=>grantRandomUpgrade()           },
    // GOLD
    { id:'prod_5x_10m',    rarity:'gold',   label:'5x Production',   desc:'5x all production for 10 min',       weight:1,  apply:()=>applyProductionBuff(5,600)     },
    { id:'prod_10x_1m',    rarity:'gold',   label:'10x Production',  desc:'10x all production for 1 min',       weight:1,  apply:()=>applyProductionBuff(10,60)     },
    { id:'fast_fortune',   rarity:'gold',   label:'Fast Fortune',    desc:'Production ticks every 0.5s for 45 min', weight:1, apply:()=>applyFastFortune()        },
];

// ── True weighted random — strictly less than 0 prevents floating-point edge case
function weightedRandom(pool) {
    const total = pool.reduce((s, r) => s + r.weight, 0);
    let r = Math.random() * total;
    for (const item of pool) {
        r -= item.weight;
        if (r < 0) return item;
    }
    return pool[pool.length - 1];
}

// ── Buff helpers
function applyProductionBuff(mult, seconds) {
    clearExistingBuff();
    crateWorkerBonus = mult; crateClickBonus = mult;
    activeBuff = { label: mult + 'x Production', endTime: Date.now() + seconds * 1000 };
    startBuffTimer();
}
function applyClickBuff(mult, seconds) {
    clearExistingBuff();
    crateClickBonus = mult;
    activeBuff = { label: mult + 'x Click Power', endTime: Date.now() + seconds * 1000 };
    startBuffTimer();
}
function applyFastFortune() {
    fastFortuneActive = true;
    fastFortuneEnd = Date.now() + 45 * 60 * 1000;
    reschedulePassive(500);
    startFastFortuneTimer();
    updateBuffDisplay();
}
function applyNewShipment() {
    for (let i = 0; i < 3; i++) {
        workers++;
        spawnWorker();
    }
    showFloatingMsg('New Shipment! 3 workers arrived.');
    updateDisplay();
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
    if (fastFortuneActive && Date.now() < fastFortuneEnd) {
        const rem = Math.max(0, Math.ceil((fastFortuneEnd - Date.now()) / 1000));
        const m = Math.floor(rem / 60), s = rem % 60;
        lines.push('Fast Fortune: ' + (m > 0 ? m + 'm ' + s + 's' : s + 's'));
    }
    block.innerHTML = (lines.length ? lines.join('<br>') : 'No active buff') + '<div id="buffTimer"></div>';
}
function startBuffTimer() {
    if (buffInterval) clearInterval(buffInterval);
    buffInterval = setInterval(() => {
        if (!activeBuff) { clearInterval(buffInterval); buffInterval = null; updateBuffDisplay(); return; }
        const rem = Math.ceil((activeBuff.endTime - Date.now()) / 1000);
        if (rem <= 0) { clearExistingBuff(); return; }
        const m = Math.floor(rem / 60), s = rem % 60;
        const block = document.getElementById('crateBuffBlock');
        if (block) block.innerHTML =
            'Active: ' + activeBuff.label +
            '<div id="buffTimer">' + (m > 0 ? m+'m '+s+'s' : s+'s') + ' left</div>';
    }, 500);
}
let ffTimerInterval = null;
function startFastFortuneTimer() {
    if (ffTimerInterval) clearInterval(ffTimerInterval);
    ffTimerInterval = setInterval(() => {
        if (!fastFortuneActive) { clearInterval(ffTimerInterval); return; }
        if (Date.now() >= fastFortuneEnd) {
            fastFortuneActive = false;
            reschedulePassive(1000);
            clearInterval(ffTimerInterval);
        }
        updateBuffDisplay();
    }, 1000);
}

function reschedulePassive(ms) {
    if (passiveInterval) clearInterval(passiveInterval);
    passiveInterval = setInterval(passiveTick, ms);
}

// =====================
// UPGRADE GRANTS
// =====================
const ALL_UPGRADE_IDS = ['click1','click2','click3','click4','worker1','worker2','worker3',
                         'field1','field2','field3','manor1','manor2','manor3','overseer1','overseer2'];

function grantFreeUpgrade() {
    for (const id of ALL_UPGRADE_IDS) {
        if (tryGrantUpgrade(id)) { showFloatingMsg('Free upgrade applied!'); updateDisplay(); return; }
    }
    const bonus = Math.floor(cotton * 0.1) + 500;
    addCotton(bonus);
    showFloatingMsg('All upgrades bought. +' + bonus.toLocaleString() + ' cotton instead.');
    updateDisplay();
}
function grantRandomUpgrade() {
    const available = ALL_UPGRADE_IDS.filter(canGrantUpgrade);
    if (!available.length) {
        const bonus = Math.floor(cotton * 0.15) + 1000;
        addCotton(bonus);
        showFloatingMsg('All upgrades bought. +' + bonus.toLocaleString() + ' cotton.');
        return;
    }
    const pick = available[Math.floor(Math.random() * available.length)];
    if (tryGrantUpgrade(pick)) { showFloatingMsg('Random upgrade applied!'); updateDisplay(); }
}
function canGrantUpgrade(id) {
    if (id==='click1')  return !clickUpgrade1Bought;
    if (id==='click2')  return clickUpgrade1Bought  && !clickUpgrade2Bought;
    if (id==='click3')  return clickUpgrade2Bought  && !clickUpgrade3Bought;
    if (id==='click4')  return clickUpgrade3Bought  && !clickUpgrade4Bought;
    if (id==='worker1') return !workerUpgrade1Bought;
    if (id==='worker2') return workerUpgrade1Bought && !workerUpgrade2Bought;
    if (id==='worker3') return workerUpgrade2Bought && !workerUpgrade3Bought;
    if (id==='field1')  return !fieldUpgrade1Bought;
    if (id==='field2')  return fieldUpgrade1Bought  && !fieldUpgrade2Bought;
    if (id==='field3')  return fieldUpgrade2Bought  && !fieldUpgrade3Bought;
    if (id==='manor1')  return !manorUpgrade1Bought;
    if (id==='manor2')  return manorUpgrade1Bought  && !manorUpgrade2Bought;
    if (id==='manor3')    return manorUpgrade2Bought  && !manorUpgrade3Bought;
    if (id==='overseer1') return !overseerUpgrade1Bought;
    if (id==='overseer2') return overseerUpgrade1Bought && !overseerUpgrade2Bought;
    return false;
}
function tryGrantUpgrade(id) { if (!canGrantUpgrade(id)) return false; applyUpgrade(id); return true; }
function applyUpgrade(id) {
    if (id==='click1')  { clickMultiplier  *= 2; clickUpgrade1Bought  = true; }
    if (id==='click2')  { clickMultiplier  *= 2; clickUpgrade2Bought  = true; }
    if (id==='click3')  { clickMultiplier  *= 2; clickUpgrade3Bought  = true; }
    if (id==='click4')  { mastersTouchActive = true; clickUpgrade4Bought = true; }
    if (id==='worker1') { workerMultiplier *= 2; workerUpgrade1Bought = true; }
    if (id==='worker2') { workerMultiplier *= 2; workerUpgrade2Bought = true; }
    if (id==='worker3') { workerMultiplier *= 2; workerUpgrade3Bought = true; }
    if (id==='field1')  { fieldIncome      *= 2; fieldUpgrade1Bought  = true; }
    if (id==='field2')  { fieldIncome      *= 2; fieldUpgrade2Bought  = true; }
    if (id==='field3')  { fieldIncome      *= 2; fieldUpgrade3Bought  = true; }
    if (id==='manor1')  { manorIncome      *= 2; manorUpgrade1Bought  = true; }
    if (id==='manor2')  { manorIncome      *= 2; manorUpgrade2Bought  = true; }
    if (id==='manor3')    { manorIncome *= 2; manorUpgrade3Bought = true; }
    if (id==='overseer1') { overseerIncome *= 2; overseerUpgrade1Bought = true; }
    if (id==='overseer2') { overseerIncome *= 2; overseerUpgrade2Bought = true; }
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
// CRATE SPINNER — ROOT-CAUSE FIX
//
// The real bug was calculating targetX using a hardcoded ITEM_W that didn't
// match actual rendered pixel width. Fix: measure the actual rendered width of
// the first item after the DOM is built, then compute targetX from that.
// We also snap, force reflow, THEN animate — this guarantees the browser paints
// position 0 before starting the transition.
// =====================
let crateSpinning = false;

function openCrateModal() {
    if (crateSpinning) return;
    const cost = getCrateCost();
    if (cotton < cost) {
        showFloatingMsg('Need ' + cost.toLocaleString() + ' cotton to open.');
        return;
    }
    cotton -= cost;
    crateOpens++;
    updateDisplay();

    // Pick winner ONCE before building strip
    const winner = weightedRandom(CRATE_REWARDS);

    const STRIP_COUNT = 60;
    const WINNER_IDX  = 50; // near the end so there's lots of spin-up

    // Build strip array — winner at WINNER_IDX, random elsewhere
    const strip = Array.from({ length: STRIP_COUNT }, (_, i) =>
        i === WINNER_IDX ? winner : weightedRandom(CRATE_REWARDS)
    );

    // Build DOM items
    const inner = document.getElementById('spinnerInner');
    inner.style.willChange = 'transform';

    // Step 1: kill transition, snap to x=0
    inner.style.transition = 'none';
    inner.style.transform  = 'translateX(0px)';
    inner.innerHTML        = '';

    strip.forEach(r => {
        const el = document.createElement('div');
        el.className = 'spinItem rarity-' + r.rarity;
        el.innerHTML = '<div class="spin-rarity">' + r.rarity + '</div><div class="spin-main">' + r.label + '</div>';
        inner.appendChild(el);
    });

    // Reset result UI before showing modal
    const result = document.getElementById('spinResult');
    result.style.display = 'none'; result.className = '';
    document.getElementById('closeModalBtn').style.display = 'none';
    document.getElementById('crateModalTitle').textContent = 'Opening Crate';
    document.getElementById('crateModal').classList.add('open');
    crateSpinning = true;

    // Step 2: force reflow so the browser commits the snap + new DOM
    void inner.offsetWidth;

    // Step 3: measure the ACTUAL rendered width of one item (includes margins)
    // getBoundingClientRect gives the true rendered size
    const firstItem  = inner.firstElementChild;
    const itemStyle  = window.getComputedStyle(firstItem);
    const marginL    = parseFloat(itemStyle.marginLeft)  || 0;
    const marginR    = parseFloat(itemStyle.marginRight) || 0;
    const ACTUAL_W   = firstItem.getBoundingClientRect().width + marginL + marginR;

    // Step 4: compute target so the winner's centre aligns with the track's centre
    const trackEl    = document.getElementById('spinnerTrack');
    const trackW     = trackEl.getBoundingClientRect().width;
    const TRACK_HALF = trackW / 2;

    const winnerLeft   = WINNER_IDX * ACTUAL_W; // left edge of winner card
    const winnerCentre = winnerLeft + ACTUAL_W / 2;
    // Optional small jitter (stay within ±30% of card so it's clearly the winner)
    const jitter = (Math.random() - 0.5) * ACTUAL_W * 0.3;
    const targetX = -(winnerCentre - TRACK_HALF + jitter);

    const SPIN_MS = 5200;

    // Step 5: now enable transition and kick it off
    inner.style.transition = 'transform ' + SPIN_MS + 'ms cubic-bezier(0.03, 0.82, 0.18, 1)';
    inner.style.transform  = 'translateX(' + targetX + 'px)';

    // Step 6: apply reward AFTER animation finishes
    setTimeout(() => {
        crateSpinning = false;
        inner.style.willChange = 'auto';

        result.className = 'spinResult rarity-' + winner.rarity;
        result.innerHTML =
            '<span class="result-rarity">' + winner.rarity + '</span>' +
            '<span class="result-name">'   + winner.label  + '</span>' +
            '<span class="result-desc">'   + winner.desc   + '</span>';
        result.style.display = 'block';
        document.getElementById('crateModalTitle').textContent = 'You got...';
        document.getElementById('closeModalBtn').style.display = 'inline-block';

        winner.apply();
        saveGame();
    }, SPIN_MS + 400);
}

function closeCrateModal() {
    document.getElementById('crateModal').classList.remove('open');
    updateDisplay();
}

// =====================
// ACHIEVEMENTS
// =====================
const achievementDefs = [
    { id:'cotton_1',    label:'First Pick',       desc:'Collect 1 cotton',            goal:1,          badge:'1'    },
    { id:'cotton_100',  label:'Getting Started',  desc:'Collect 100 cotton',          goal:100,        badge:'100'  },
    { id:'cotton_1k',   label:'Cotton Farmer',    desc:'Collect 1,000 cotton',        goal:1000,       badge:'1K'   },
    { id:'cotton_10k',  label:'Field Hand',       desc:'Collect 10,000 cotton',       goal:10000,      badge:'10K'  },
    { id:'cotton_100k', label:'Field Boss',       desc:'Collect 100,000 cotton',      goal:100000,     badge:'100K' },
    { id:'cotton_500k', label:'Cotton Baron',     desc:'Collect 500,000 cotton',      goal:500000,     badge:'500K' },
    { id:'cotton_1m',   label:'Cotton Tycoon',    desc:'Collect 1,000,000 cotton',    goal:1000000,    badge:'1M'   },
    { id:'cotton_5m',   label:'The Landowner',    desc:'Collect 5,000,000 cotton',    goal:5000000,    badge:'5M'   },
    { id:'cotton_25m',  label:'Manor Lord',       desc:'Collect 25,000,000 cotton',   goal:25000000,   badge:'25M'  },
    { id:'cotton_100m', label:'Cotton Empire',    desc:'Collect 100,000,000 cotton',  goal:100000000,  badge:'100M' },
    { id:'cotton_250m', label:'The Harvest King', desc:'Collect 250,000,000 cotton',  goal:250000000,  badge:'250M' },
    { id:'cotton_500m', label:'Half a Billion',   desc:'Collect 500,000,000 cotton',  goal:500000000,  badge:'500M' },
    { id:'cotton_1b',   label:'Cotton God',       desc:'Collect 1,000,000,000 cotton',goal:1000000000, badge:'1B'   },
];
let unlockedAchievements = new Set();

function addCotton(amount) {
    cotton          += amount;
    totalCottonEarned += amount;
    checkAchievements();
}
function checkAchievements() {
    let changed = false;
    achievementDefs.forEach(a => {
        if (!unlockedAchievements.has(a.id) && totalCottonEarned >= a.goal) {
            unlockedAchievements.add(a.id); showAchievementToast(a); changed = true;
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
        div.innerHTML = '<div class="ach-badge">' + (unlocked ? a.badge : '?') + '</div>' +
            '<div><span class="ach-name">' + a.label + '</span><span class="ach-desc">' + a.desc + '</span></div>';
        list.appendChild(div);
    });
    document.getElementById('achCount').textContent =
        unlockedAchievements.size + ' / ' + achievementDefs.length + ' unlocked';
}

// =====================
// DOM REFERENCES
// =====================
const cottonDisplay = document.getElementById('cottonCount');
const cpsDisplay    = document.getElementById('cps');
const gameArea      = document.getElementById('gameArea');

// =====================
// SMOOTH COTTON COUNTER
// Runs on rAF — chases the real `cotton` value so the number always flows upward
// =====================
function animateCottonDisplay() {
    const diff = cotton - displayedCotton;
    if (Math.abs(diff) < 0.5) {
        displayedCotton = cotton;
    } else {
        // Chase speed: faster when gap is large, minimum 0.5/frame so small incomes are visible
        const step = Math.max(Math.abs(diff) * 0.08, 0.5) * Math.sign(diff);
        displayedCotton += step;
    }
    cottonDisplay.textContent = Math.floor(displayedCotton).toLocaleString();
    requestAnimationFrame(animateCottonDisplay);
}
requestAnimationFrame(animateCottonDisplay);

// =====================
// UPGRADE BUTTONS SYNC
// =====================
function syncUpgradeButtons() {
    function set(id, bought, locked) {
        const b = document.getElementById(id); if (!b) return;
        b.classList.toggle('bought', bought);
        b.classList.toggle('locked', !bought && locked);
        b.disabled = bought || (!bought && locked);
    }
    set('clickUpgrade1Btn',  clickUpgrade1Bought,  false);
    set('clickUpgrade2Btn',  clickUpgrade2Bought,  !clickUpgrade1Bought);
    set('clickUpgrade3Btn',  clickUpgrade3Bought,  !clickUpgrade2Bought);
    set('clickUpgrade4Btn',  clickUpgrade4Bought,  !clickUpgrade3Bought);
    set('workerUpgrade1Btn', workerUpgrade1Bought, false);
    set('workerUpgrade2Btn', workerUpgrade2Bought, !workerUpgrade1Bought);
    set('workerUpgrade3Btn', workerUpgrade3Bought, !workerUpgrade2Bought);
    set('fieldUpgrade1Btn',  fieldUpgrade1Bought,  false);
    set('fieldUpgrade2Btn',  fieldUpgrade2Bought,  !fieldUpgrade1Bought);
    set('fieldUpgrade3Btn',  fieldUpgrade3Bought,  !fieldUpgrade2Bought);
    set('manorUpgrade1Btn',    manorUpgrade1Bought,    false);
    set('manorUpgrade2Btn',    manorUpgrade2Bought,    !manorUpgrade1Bought);
    set('manorUpgrade3Btn',    manorUpgrade3Bought,    !manorUpgrade2Bought);
    set('overseerUpgrade1Btn', overseerUpgrade1Bought, false);
    set('overseerUpgrade2Btn', overseerUpgrade2Bought, !overseerUpgrade1Bought);
}

function attachUpgradeHandlers() {
    function buy(btnId, costVal, upgradeId, flagFn) {
        document.getElementById(btnId).onclick = function() {
            if (flagFn() || this.classList.contains('locked')) return;
            if (cotton < costVal) return;
            cotton -= costVal; applyUpgrade(upgradeId); updateDisplay();
        };
    }
    buy('clickUpgrade1Btn',  150,    'click1',  () => clickUpgrade1Bought);
    buy('clickUpgrade2Btn',  1000,   'click2',  () => clickUpgrade2Bought);
    buy('clickUpgrade3Btn',  2500,   'click3',  () => clickUpgrade3Bought);
    buy('clickUpgrade4Btn',  120000, 'click4',  () => clickUpgrade4Bought);
    buy('workerUpgrade1Btn', 1000,   'worker1', () => workerUpgrade1Bought);
    buy('workerUpgrade2Btn', 3000,   'worker2', () => workerUpgrade2Bought);
    buy('workerUpgrade3Btn', 5000,   'worker3', () => workerUpgrade3Bought);
    buy('fieldUpgrade1Btn',  42000,  'field1',  () => fieldUpgrade1Bought);
    buy('fieldUpgrade2Btn',  150000, 'field2',  () => fieldUpgrade2Bought);
    buy('fieldUpgrade3Btn',  320000, 'field3',  () => fieldUpgrade3Bought);
    buy('manorUpgrade1Btn',    400000,  'manor1',    () => manorUpgrade1Bought);
    buy('manorUpgrade2Btn',    700000,  'manor2',    () => manorUpgrade2Bought);
    buy('manorUpgrade3Btn',    920000,  'manor3',    () => manorUpgrade3Bought);
    buy('overseerUpgrade1Btn', 4000000, 'overseer1', () => overseerUpgrade1Bought);
    buy('overseerUpgrade2Btn', 7650000, 'overseer2', () => overseerUpgrade2Bought);
}
attachUpgradeHandlers();

// =====================
// CLICK COTTON
// =====================
document.getElementById('cottonButton').onclick = function(e) {
    const base   = 1 * clickMultiplier * crateClickBonus;
    const bonus  = mastersTouchActive ? (70 + mastersTouchBonus) : 0;
    const gained = base + bonus;
    addCotton(gained);
    showPopNumber(e.clientX, e.clientY, Math.floor(gained));
    this.classList.remove('clicked'); void this.offsetWidth; this.classList.add('clicked');
    // Masters Touch leveling
    if (mastersTouchActive) {
        mastersTouchClicks++;
        tryMastersTouchLevelUp();
        updateMastersTouchBar();
    }
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
        workerCost = Math.min(Math.floor(workerCost * 1.2), MAX_WORKER_COST);
        updateDisplay();
    }
};
function spawnWorker() {
    const w   = document.createElement('img');
    w.src     = 'images/worker.png'; w.className = 'worker';
    const btn = document.getElementById('cottonButton');
    const bR  = btn.getBoundingClientRect();
    const gR  = gameArea.getBoundingClientRect();
    let x, y, safe = false;
    while (!safe) {
        x = Math.random() * (gR.width  - 80);
        y = Math.random() * (gR.height - 80);
        const ox = x+80 > (bR.left-gR.left) && x < (bR.right -gR.left);
        const oy = y+80 > (bR.top -gR.top)  && y < (bR.bottom-gR.top);
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
        fieldCost = Math.min(Math.floor(fieldCost * 1.4), MAX_FIELD_COST);
        updateDisplay();
    }
};
function spawnField(index) {
    const f = document.createElement('img');
    f.src = 'images/field.png'; f.className = 'field';
    f.style.cssText = 'position:absolute;pointer-events:none;width:200px;';
    const gR = gameArea.getBoundingClientRect();
    f.style.left = (gR.right + 20) + 'px';
    f.style.top  = (gR.top + 50 + 110 * index) + 'px';
    document.body.appendChild(f);
}

// =====================
// BUY MANOR
// =====================
document.getElementById('buyManor').onclick = function() {
    if (cotton >= manorCost) {
        cotton -= manorCost; manors++;
        spawnManor(manors - 1);
        manorCost = Math.min(Math.floor(BASE_MANOR_COST * Math.pow(1.3, manors)), MAX_MANOR_COST);
        updateDisplay();
    }
};
function spawnManor(index) {
    const m = document.createElement('img');
    m.src = 'images/manor.png'; m.className = 'manor';
    // Position relative to gameArea using absolute page coordinates (not fixed/viewport)
    const gR = gameArea.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    m.style.position      = 'absolute';
    m.style.pointerEvents = 'none';
    m.style.width         = '195px';
    m.style.left = (gR.left + scrollX - 210) + 'px';
    m.style.top  = (gR.top  + scrollY + 10 + 175 * index) + 'px';
    document.body.appendChild(m);
}

// =====================
// BUY OVERSEER
// =====================
document.getElementById('buyOverseer').onclick = function() {
    if (cotton >= overseerCost) {
        cotton -= overseerCost;
        overseers++;
        spawnOverseer();
        overseerCost = Math.min(Math.round(BASE_OVERSEER_COST * Math.pow(1.36, overseers)), MAX_OVERSEER_COST);
        const mult = getOverseerWorkerMult().toFixed(2);
        showFloatingMsg('Overseer hired! Workers now x' + mult);
        updateDisplay();
    }
};

function spawnOverseer() {
    const o = document.createElement('img');
    o.src = 'images/overseer.png'; o.className = 'overseer';
    const btn = document.getElementById('cottonButton');
    const bR  = btn.getBoundingClientRect();
    const gR  = gameArea.getBoundingClientRect();
    // Overseers are 90px wide/tall, slightly bigger than workers
    const W = 90, H = 90;
    let x, y, safe = false, attempts = 0;
    while (!safe && attempts < 200) {
        attempts++;
        x = Math.random() * (gR.width  - W);
        y = Math.random() * (gR.height - H);
        const ox = x + W > (bR.left - gR.left) && x < (bR.right  - gR.left);
        const oy = y + H > (bR.top  - gR.top)  && y < (bR.bottom - gR.top);
        if (!(ox && oy)) safe = true;
    }
    o.style.left = x + 'px'; o.style.top = y + 'px';
    gameArea.appendChild(o);
}
function getPerSecond() {
    const ovMult = getOverseerWorkerMult();
    const wCps = workers  * cottonPerWorker * workerMultiplier * ovMult * crateWorkerBonus;
    const fCps = fields.length * fieldIncome  * crateWorkerBonus;
    const mCps = manors   * manorIncome       * crateWorkerBonus;
    const oCps = overseers * overseerIncome   * crateWorkerBonus;
    const ffMult = (fastFortuneActive && Date.now() < fastFortuneEnd) ? 2 : 1;
    return (wCps + fCps + mCps + oCps) * ffMult;
}

function updateDisplay() {
    // Cotton display is handled by rAF smooth counter — don't set textContent here
    cpsDisplay.textContent = getPerSecond().toFixed(2);

    document.getElementById('buyWorker').textContent  = 'Hire Worker ('   + workerCost.toLocaleString()             + ' cotton)';
    document.getElementById('buyField').textContent   = 'Buy Field ('      + Math.floor(fieldCost).toLocaleString()  + ' cotton)';
    document.getElementById('buyManor').textContent   = 'Build Manor ('    + Math.floor(manorCost).toLocaleString()  + ' cotton)';
    document.getElementById('buyOverseer').textContent = 'Hire Overseer (' + Math.floor(overseerCost).toLocaleString() + ' cotton)';

    const cost = getCrateCost();
    document.getElementById('crateCostVal').textContent  = cost.toLocaleString();
    document.getElementById('crateOpensVal').textContent = crateOpens;
    document.getElementById('openCrateBtn').disabled     = cotton < cost;

    const scaleLine = document.getElementById('crateScaleLine');
    if (scaleLine) scaleLine.style.display = (crateOpens < 10) ? 'block' : 'none';

    document.getElementById('workerCountNum').textContent   = workers;
    document.getElementById('overseerCountNum').textContent = overseers;

    // Show overseer multiplier line once at least one is hired
    const multLine = document.getElementById('overseerMultLine');
    if (multLine) {
        if (overseers > 0) {
            const mult = getOverseerWorkerMult().toFixed(1);
            multLine.textContent = 'Workers x' + mult;
            multLine.style.display = 'block';
        } else {
            multLine.style.display = 'none';
        }
    
