// =====================
// BUSINESS NAME
// =====================
let businessName = '';
let gameStarted = false;

// =====================
// STRAWBERRY MODE
// =====================
let strawberryMode = false;

function getWord() { return strawberryMode ? 'Strawberry' : 'Cotton'; }
function getWordLower() { return strawberryMode ? 'strawberry' : 'cotton'; }

function applyStrawberryMode() {
    strawberryMode = true;
    refreshAllText();
    // swap the cotton button image
    const cb = document.getElementById('cottonButton');
    if (cb) cb.src = 'images/strawberry.png';
    showFloatingMsg('Strawberry mode activated!');
}

function refreshAllText() {
    if (!strawberryMode) return;

    // Swap the cotton button image
    const cb = document.getElementById('cottonButton');
    if (cb) cb.src = 'images/strawberry.png';

    // Swap page title and h1
    document.title = 'Strawberry Picker';
    const h1 = document.getElementById('titleBtn');
    if (h1) h1.textContent = 'Strawberry Picker';

    // Swap the stats bar word
    const wordLabel = document.getElementById('cottonWordLabel');
    if (wordLabel) wordLabel.textContent = 'Strawberry';

    // Walk every text node in the document and replace cotton/Cotton/COTTON
    function swapTextNodes(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const orig = node.nodeValue;
            const swapped = orig
                .replace(/COTTON/g, 'STRAWBERRY')
                .replace(/Cotton/g, 'Strawberry')
                .replace(/cotton/g, 'strawberry');
            if (swapped !== orig) node.nodeValue = swapped;
        } else if (
            node.nodeType === Node.ELEMENT_NODE &&
            node.id !== 'namingOverlay' &&       // skip the naming screen
            node.id !== 'secretModal' &&          // skip the code modal
            node.tagName !== 'SCRIPT' &&
            node.tagName !== 'STYLE'
        ) {
            node.childNodes.forEach(swapTextNodes);
        }
    }
    swapTextNodes(document.body);

    // Re-run updateDisplay so dynamically set button text also gets the new word
    updateDisplay();
    renderAchievements();
    updateSlotWordLabel();
}

function confirmBusinessName() {
    const input = document.getElementById('businessNameInput');
    const name  = input.value.trim();
    if (!name) {
        input.style.border = '2px solid #cc3030';
        input.focus();
        return;
    }
    businessName = name;
    gameStarted = true;
    document.getElementById('namingOverlay').style.display = 'none';
    document.getElementById('businessNameDisplay').textContent = name;
    // Defer one tick so the overlay hide is painted before spawn calls measure layout
    setTimeout(finishGameInit, 0);
}

// key listeners attached in DOMContentLoaded at bottom of file

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
        msg.textContent = '+1,000,000,000 ' + getWordLower() + '!';
        setTimeout(closeSecretModal, 1200);
        showFloatingMsg('Secret code redeemed! +1 billion ' + getWordLower() + '.');
        saveGame();
    } else if (val === 'tuco') {
        if (!strawberryMode) {
            applyStrawberryMode();
            msg.style.color = '#cc2255';
            msg.textContent = 'Strawberry mode activated!';
            saveGame();
            setTimeout(closeSecretModal, 1200);
        } else {
            msg.style.color = '#888';
            msg.textContent = 'Already in strawberry mode.';
        }
    } else if (val === 'key123') {
        if (!cratesAreFree) {
            cratesAreFree = true;
            msg.style.color = '#2a6a0a';
            msg.textContent = 'Crates are now free!';
            saveGame();
            setTimeout(closeSecretModal, 1200);
            showFloatingMsg('Crates are free until reset.');
            updateDisplay();
        } else {
            msg.style.color = '#888';
            msg.textContent = 'Already active.';
        }
    } else if (val === 'goldgoldgold') {
        addToInventory('gold', 3);
        msg.style.color = '#c09830';
        msg.textContent = '3 gold mercy crates added to inventory!';
        showFloatingMsg('GOLDGOLDGOLD — 3 gold crates added!');
        setTimeout(closeSecretModal, 1500);
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
let mastersTouchBonus   = 0;
const CRIT_CHANCE      = 0.033; // 3.3% manual
const CRIT_CHANCE_AUTO = 0.005; // 0.5% dedicated master
const CRIT_MULT        = 18;
let critCpsBonus = 0;
let critCpsTimer = null;

function triggerCritCpsBoost() {
    critCpsBonus = 10;
    if (critCpsTimer) clearTimeout(critCpsTimer);
    critCpsTimer = setTimeout(() => {
        critCpsBonus = 0;
        critCpsTimer = null;
        updateMastersTouchBar();
    }, 5000);
    updateMastersTouchBar();
}


function mastersTouchClicksNeeded() { return Math.round((5 * Math.pow(3, mastersTouchLevel)) / 2); }
function mastersTouchProgress()     { return mastersTouchClicks / mastersTouchClicksNeeded(); }
function tryMastersTouchLevelUp() {
    if (!mastersTouchActive) return;
    while (mastersTouchClicks >= mastersTouchClicksNeeded()) {
        mastersTouchClicks -= mastersTouchClicksNeeded();
        mastersTouchLevel++;
        mastersTouchBonus += 5;
        showLevelUpNotification();
    }
    updateMastersTouchBar();
}

function rollCrit(isAuto) {
    if (!mastersTouchActive) return false;
    return Math.random() < (isAuto ? CRIT_CHANCE_AUTO : CRIT_CHANCE);
}

function showCritEffect(x, y, gained) {
    // Gold screen flash
    const flash = document.createElement('div');
    flash.style.cssText = 'position:fixed;inset:0;background:rgba(255,210,0,0.22);pointer-events:none;z-index:8000;animation:critFlash 0.5s forwards;';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 500);

    // Big CRIT text
    const crit = document.createElement('div');
    crit.style.cssText = 'position:fixed;left:50%;top:38%;transform:translateX(-50%);pointer-events:none;z-index:8001;text-align:center;animation:critPop 1.2s forwards;';
    crit.innerHTML =
        '<div style="font-family:\'Courier New\',monospace;font-size:52px;font-weight:bold;color:#f5c000;text-shadow:0 0 18px #f5a000,0 2px 0 #7a5000;letter-spacing:4px;">CRIT</div>' +
        '<div style="font-family:\'Courier New\',monospace;font-size:22px;color:#ffd700;margin-top:-6px;">x' + CRIT_MULT + '</div>';
    document.body.appendChild(crit);
    setTimeout(() => crit.remove(), 1200);
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
    const show = mastersTouchActive || dedicatedMasterActive;
    bar.style.display = show ? 'block' : 'none';
    if (!show) return;
    const fill  = document.getElementById('mastersTouchFill');
    const label = document.getElementById('mastersTouchLabel');
    const pct   = Math.min(mastersTouchProgress() * 100, 100);
    if (fill)  fill.style.width = pct + '%';
    // Build PT timer string
    let ptStr = '';
    if (properTechniqueActive && properTechniqueEnd > Date.now()) {
        const rem = Math.ceil((properTechniqueEnd - Date.now()) / 1000);
        const m = Math.floor(rem / 60), s = rem % 60;
        ptStr = '   |   Proper Technique: ' + m + 'm ' + String(s).padStart(2,'0') + 's (+10 cps)';
    }
    if (label) label.textContent =
        'Masters Touch  Lv.' + mastersTouchLevel +
        '  (' + mastersTouchClicks + ' / ' + mastersTouchClicksNeeded() + ' clicks)' +
        '  +' + mastersTouchBonus + '/click bonus' +
        (dedicatedMasterActive ? '   |   Dedicated: ' + getDedicatedMasterCps().toFixed(1) + ' cps' : '') +
        ptStr;
}

// =====================
// DEDICATED MASTER
// =====================
let dedicatedMasterActive = false; // bought flag
let dedicatedMasterInterval = null;

function getDedicatedMasterCps() {
    return 3 + mastersTouchLevel + properTechniqueBonus + critCpsBonus;
}

function startDedicatedMaster() {
    if (dedicatedMasterInterval) clearInterval(dedicatedMasterInterval);
    // fires getDedicatedMasterCps() times per second by running every ~333ms base
    // We tick every 333ms and fire one click per tick, re-evaluated each tick
    dedicatedMasterInterval = setInterval(() => {
        if (!dedicatedMasterActive) return;
        const cps = getDedicatedMasterCps();
        // Fire cps clicks spread over 1s: we tick at 10Hz and fire cps/10 clicks per tick
        // Simplest: run interval at 1000/cps ms
        // But cps changes, so instead: run at fixed 100ms and accumulate fractional clicks
        // Actually: just fire once per tick at 1000/cps ms — handled below via reschedule
        doAutomaticClick();
    }, 333); // will be reschedule-corrected after level ups
}

// Proper approach: use a self-correcting interval that reads getDedicatedMasterCps() dynamically
let _dedAccum = 0;
let _dedLastTick = 0;
function dedicatedMasterTick(now) {
    if (!dedicatedMasterActive) { _dedLastTick = 0; _dedAccum = 0; return; }
    // Always reschedule so the loop never dies
    requestAnimationFrame(dedicatedMasterTick);
    // Skip work while game is paused, but keep the loop alive
    if (gamePaused) { _dedLastTick = now; return; }
    if (_dedLastTick === 0) { _dedLastTick = now; return; }
    const elapsed = (now - _dedLastTick) / 1000;
    _dedLastTick = now;
    _dedAccum += getDedicatedMasterCps() * elapsed;
    while (_dedAccum >= 1) {
        _dedAccum -= 1;
        doAutomaticClick();
    }
}

function doAutomaticClick() {
    const base   = 1 * clickMultiplier * crateClickBonus;
    const bonus  = mastersTouchActive ? (70 + mastersTouchBonus) : 0;
    const isCrit = rollCrit(true);
    const gained = (base + bonus) * (isCrit ? CRIT_MULT : 1);
    addCotton(gained);
    const btn = document.getElementById('cottonButton');
    if (btn) {
        const r = btn.getBoundingClientRect();
        const x = r.left + Math.random() * r.width;
        const y = r.top  + Math.random() * r.height * 0.5;
        showPopNumber(x, y, Math.floor(gained));
        if (isCrit) { showCritEffect(x, y, gained); if (dedicatedMasterActive) triggerCritCpsBoost(); }
        btn.classList.remove('clicked'); void btn.offsetWidth; btn.classList.add('clicked');
    }
    if (mastersTouchActive) {
        mastersTouchClicks++;
        tryMastersTouchLevelUp();
    }
    updateDisplay();
}

// Upgrade flags
let clickUpgrade1Bought  = false;
let clickUpgrade2Bought  = false;
let clickUpgrade3Bought  = false;
let clickUpgrade4Bought  = false; // Masters Touch
let clickUpgrade5Bought  = false; // Dedicated Master
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
let cratesAreFree = false; // set by key123 secret code

// Mercy system
let cratesSincePink = 0;   // resets when a pink+ is won
const MERCY_PINK_THRESHOLD = 15;
let cratesSinceGold = 0;   // resets when a gold is won
const MERCY_GOLD_THRESHOLD = 20;

const PINK_ONLY_REWARDS  = () => CRATE_REWARDS.filter(r => r.rarity === 'pink');

function getCrateCost() {
    if (cratesAreFree) return 0;
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

// Reroll upgrade
let crateRerollUpgrade = false;
let crateHourlyUpgrade = false;
let crateHourlyStacks  = 0;
let crateHourlyTimer   = null;
let crateHourlyQueue   = 0;

let crateHourlyLastTick = 0; // timestamp of last hourly award

function startHourlyCrateTimer() {
    if (crateHourlyTimer) clearInterval(crateHourlyTimer);
    if (!crateHourlyUpgrade) return;
    if (crateHourlyLastTick === 0) crateHourlyLastTick = Date.now();
    crateHourlyTimer = setInterval(() => {
        crateHourlyQueue += crateHourlyStacks;
        addToInventory('normal', crateHourlyStacks);
        crateHourlyLastTick = Date.now();
        updateCrateHourlyDisplay(); // countdown only
        updateDisplay();
    }, 50 * 60 * 1000);
}

function updateCrateHourlyDisplay() {
    // Only show the countdown — no "free crates ready" text, crates go straight to inventory
    const countdownEl = document.getElementById('hourlyCountdownLine');
    const queueEl    = document.getElementById('hourlyQueueLine');
    if (queueEl) queueEl.style.display = 'none'; // always hidden
    if (!crateHourlyUpgrade) {
        if (countdownEl) countdownEl.style.display = 'none';
        return;
    }
    if (countdownEl && crateHourlyLastTick > 0) {
        const msUntilNext = (crateHourlyLastTick + 50 * 60 * 1000) - Date.now();
        if (msUntilNext > 0) {
            const totalSec = Math.ceil(msUntilNext / 1000);
            const h = Math.floor(totalSec / 3600);
            const m = Math.floor((totalSec % 3600) / 60);
            const s = totalSec % 60;
            const parts = [];
            if (h > 0) parts.push(h + 'h');
            parts.push(String(m).padStart(2,'0') + 'm');
            parts.push(String(s).padStart(2,'0') + 's');
            countdownEl.textContent = 'Next crate in: ' + parts.join(' ');
            countdownEl.style.display = 'block';
        } else {
            countdownEl.style.display = 'none';
        }
    } else if (countdownEl) {
        countdownEl.style.display = 'none';
    }
}

const REROLL_CHANCE = 0.20; // 20% chance an item shows reroll tag

// Land deal persistent tax
let landDealTaxRate = 0; // 0.02 to 0.10 applied to each cotton gain

// Proper technique bonus
let properTechniqueBonus = 0; // extra cps added to dedicated master

const CRATE_REWARDS = [
    // GREY
    { id:'prod_2x_1m',        rarity:'grey',   label:'2x Production',      desc:'2x all production for 1 min',                 weight:22, apply:()=>applyProductionBuff(2,60)        },
    { id:'prod_1_5x_5m',      rarity:'grey',   label:'1.5x Production',    desc:'1.5x all production for 5 min',               weight:20, apply:()=>applyProductionBuff(1.5,300)     },
    // BLUE
    { id:'prod_2x_5m',        rarity:'blue',   label:'2x Production',      desc:'2x all production for 5 min',                 weight:16, apply:()=>applyProductionBuff(2,300)       },
    { id:'prod_3x_1m',        rarity:'blue',   label:'3x Production',      desc:'3x all production for 1 min',                 weight:14, apply:()=>applyProductionBuff(3,60)        },
    { id:'click_2x_5m',       rarity:'blue',   label:'2x Click Power',     desc:'2x click power for 5 min',                    weight:12, apply:()=>applyClickBuff(2,300)            },
    { id:'new_shipment',      rarity:'blue',   label:'New Shipment',       desc:'3 free workers arrive immediately',            weight:10, apply:()=>applyNewShipment()               },
    // PURPLE
    { id:'prod_2x_10m',       rarity:'purple', label:'2x Production',      desc:'2x all production for 10 min',                weight:12,  apply:()=>applyProductionBuff(2,600)       },
    { id:'free_upgrade',      rarity:'purple', label:'Free Upgrade',       desc:'Unlock the cheapest upgrade free',             weight:10,  apply:()=>grantFreeUpgrade()               },
    { id:'prod_5x_1m',        rarity:'purple', label:'5x Production',      desc:'5x all production for 1 min',                 weight:9,  apply:()=>applyProductionBuff(5,60)        },
    { id:'land_deal',         rarity:'purple', label:'Land Deal',          desc:'Sacrifice 2-10% income forever for 5-7x current cotton', weight:7, apply:()=>applyLandDeal()        },
    // PINK
    { id:'prod_3x_10m',       rarity:'pink',   label:'3x Production',      desc:'3x all production for 10 min',                weight:3,  apply:()=>applyProductionBuff(3,600)       },
    { id:'prod_2x_30m',       rarity:'pink',   label:'2x Production',      desc:'2x all production for 30 min',                weight:2,  apply:()=>applyProductionBuff(2,1800)      },
    { id:'random_upgrade',    rarity:'pink',   label:'Random Upgrade',     desc:'Apply a random upgrade for free',              weight:2,  apply:()=>grantRandomUpgrade()             },
    { id:'proper_technique',  rarity:'pink',   label:'Proper Technique',   desc:'+10 cps to Dedicated Master, fills half level + 50% requirement', weight:2, apply:()=>applyProperTechnique() },
    // GOLD
    { id:'prod_5x_10m',       rarity:'gold',   label:'5x Production',      desc:'5x all production for 10 min',                weight:1,  apply:()=>applyProductionBuff(5,600)       },
    { id:'prod_10x_1m',       rarity:'gold',   label:'10x Production',     desc:'10x all production for 1 min',                weight:1,  apply:()=>applyProductionBuff(10,60)       },
    { id:'fast_fortune',      rarity:'gold',   label:'Fast Fortune',       desc:'Production ticks every 0.5s for 45 min',       weight:1,  apply:()=>applyFastFortune()               },
    { id:'abandoned_op',      rarity:'gold',   label:'Abandoned Operation',desc:'Gain 3 fields, 1 manor, 10 workers, 1 overseer',weight:1, apply:()=>applyAbandonedOperation()       },
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
    for (let i = 0; i < 3; i++) { workers++; spawnWorker(); }
    showFloatingMsg('New Shipment! 3 ' + getWordLower() + ' workers arrived.');
    updateDisplay();
}

function applyAbandonedOperation() {
    const msgs = [];

    // Try to grant one of each upgrade type (cheapest available)
    // Clicker upgrade
    const clickerUpg = ['click1','click2','click3'].find(canGrantUpgrade);
    if (clickerUpg) { applyUpgrade(clickerUpg); msgs.push('clicker upgrade'); }

    // Field upgrade
    const fieldUpg = ['field1','field2','field3'].find(canGrantUpgrade);
    if (fieldUpg) { applyUpgrade(fieldUpg); msgs.push('field upgrade'); }

    // Manor upgrade
    const manorUpg = ['manor1','manor2','manor3'].find(canGrantUpgrade);
    if (manorUpg) { applyUpgrade(manorUpg); msgs.push('manor upgrade'); }

    const allUpgradesHeld = !clickerUpg && !fieldUpg && !manorUpg;

    if (allUpgradesHeld) {
        // All three upgrade trees maxed — give bonus resources instead
        for (let i = 0; i < 5; i++) { workers++; spawnWorker(); }
        spawnField(fields.length);
        fields.push(true);
        fieldCost = Math.min(Math.floor(fieldCost * 1.4), MAX_FIELD_COST);
        overseers++;
        spawnOverseer();
        overseerCost = Math.min(Math.round(BASE_OVERSEER_COST * Math.pow(1.36, overseers)), MAX_OVERSEER_COST);
        showFloatingMsg('Abandoned Operation! All upgrades owned — bonus: 5 workers, 1 field, 1 overseer!');
    } else {
        showFloatingMsg('Abandoned Operation! Granted: ' + msgs.join(', ') + '.');
    }

    syncUpgradeButtons();
    updateDisplay();
}

let properTechniqueActive = false;
let properTechniqueEnd    = 0;
let ptTimerInterval       = null;

function applyProperTechnique() {
    // Requires BOTH Masters Touch and Dedicated Master — else reroll
    if (!mastersTouchActive || !dedicatedMasterActive) {
        const fallback = weightedRandom(CRATE_REWARDS.filter(r => r.id !== 'proper_technique'));
        fallback.apply();
        return;
    }
    properTechniqueActive = true;
    properTechniqueEnd    = Date.now() + 20 * 60 * 1000; // 20 minutes
    properTechniqueBonus  = 10;
    const needed = mastersTouchClicksNeeded();
    mastersTouchClicks = Math.min(Math.floor(needed * 0.5), needed - 1);
    showFloatingMsg('Proper Technique! +10 Dedicated cps for 20 min, level bar half-filled.');
    startProperTechniqueTimer();
    updateMastersTouchBar();
    updateDisplay();
}

function startProperTechniqueTimer() {
    if (ptTimerInterval) clearInterval(ptTimerInterval);
    ptTimerInterval = setInterval(() => {
        if (!properTechniqueActive) { clearInterval(ptTimerInterval); return; }
        if (Date.now() >= properTechniqueEnd) {
            properTechniqueActive = false;
            properTechniqueBonus  = 0;
            clearInterval(ptTimerInterval);
            showFloatingMsg('Proper Technique expired.');
            updateMastersTouchBar();
            updateDisplay();
            return;
        }
        updateMastersTouchBar(); // keep countdown live every second
    }, 1000);
}

// Land Deal — shows a modal with accept/decline
let pendingLandDeal = null;

function applyLandDeal() {
    const taxRate = 0.02 + Math.random() * 0.08; // 2%-10%
    const multiplier = 5 + Math.random() * 2;    // 5x-7x
    const gained = Math.floor(cotton * multiplier);
    const afterCotton = cotton + gained;
    pendingLandDeal = { taxRate, multiplier, gained, afterCotton };
    showLandDealModal(taxRate, multiplier, gained, afterCotton);
}

function showLandDealModal(taxRate, multiplier, gained, afterCotton) {
    const existing = document.getElementById('landDealModal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'landDealModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:7000;display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = `
        <div style="background:#f0ead8;border:3px solid #5a7a3a;padding:30px 36px;max-width:400px;width:90%;font-family:'Courier New',monospace;text-align:center;">
            <div style="font-size:13px;text-transform:uppercase;letter-spacing:2px;color:#5a7a3a;margin-bottom:12px;">Land Deal</div>
            <div style="font-size:14px;color:#333;line-height:1.7;margin-bottom:16px;">
                A developer offers to buy your land.<br>
                <strong style="color:#2a4a1a;">+${gained.toLocaleString()} ${getWordLower()}</strong> (${multiplier.toFixed(1)}x your current)<br>
                <span style="color:#aa3030;">In exchange: -${(taxRate*100).toFixed(1)}% of all future income forever</span><br><br>
                <span style="color:#555;">You would have: <strong>${afterCotton.toLocaleString()}</strong> ${getWordLower()}</span>
            </div>
            <div style="display:flex;gap:12px;justify-content:center;">
                <button onclick="acceptLandDeal()" style="font-family:'Courier New',monospace;font-size:14px;padding:9px 24px;background:#4a7a2a;color:#f0ead8;border:2px solid #2a5a0a;cursor:pointer;font-weight:bold;">Accept</button>
                <button onclick="declineLandDeal()" style="font-family:'Courier New',monospace;font-size:14px;padding:9px 24px;background:#f0ead8;border:2px solid #aaa;cursor:pointer;color:#666;">Decline</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
}

function acceptLandDeal() {
    if (!pendingLandDeal) return;
    addCotton(pendingLandDeal.gained);
    landDealTaxRate = Math.min(landDealTaxRate + pendingLandDeal.taxRate, 0.90); // cap at 90% total
    pendingLandDeal = null;
    document.getElementById('landDealModal')?.remove();
    resumeGame();
    showFloatingMsg('Deal accepted! Income taxed at ' + (landDealTaxRate * 100).toFixed(1) + '% forever.');
    updateDisplay();
}

function declineLandDeal() {
    pendingLandDeal = null;
    document.getElementById('landDealModal')?.remove();
    resumeGame();
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
const ALL_UPGRADE_IDS = ['click1','click2','click3','click4','click5','worker1','worker2','worker3',
                         'field1','field2','field3','manor1','manor2','manor3','overseer1','overseer2','hourly1'];

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
    if (id==='click5')  return clickUpgrade4Bought  && !clickUpgrade5Bought;
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
    if (id==='hourly1') return !crateHourlyUpgrade;
    return false;
}
function tryGrantUpgrade(id) { if (!canGrantUpgrade(id)) return false; applyUpgrade(id); return true; }
function applyUpgrade(id) {
    if (id==='click1')  { clickMultiplier  *= 2; clickUpgrade1Bought  = true; }
    if (id==='click2')  { clickMultiplier  *= 2; clickUpgrade2Bought  = true; }
    if (id==='click3')  { clickMultiplier  *= 2; clickUpgrade3Bought  = true; }
    if (id==='click4')  { mastersTouchActive = true; clickUpgrade4Bought = true; }
    if (id==='click5')  { dedicatedMasterActive = true; clickUpgrade5Bought = true; _dedLastTick = 0; requestAnimationFrame(dedicatedMasterTick); }
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
    if (id==='overseer2')  { overseerIncome *= 2; overseerUpgrade2Bought = true; }
    if (id==='hourly1') {
        if (!crateHourlyUpgrade) {
            crateHourlyUpgrade = true;
            crateHourlyStacks = 1;
            startHourlyCrateTimer();
        }
    }
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

function playCrateLidPop(callback) {
    const icon = document.getElementById('crateIcon');
    if (!icon) { if (callback) callback(); return; }
    icon.classList.remove('popping');
    void icon.offsetWidth; // force reflow so animation restarts
    icon.classList.add('popping');
    const onDone = () => {
        icon.classList.remove('popping');
        icon.removeEventListener('animationend', onDone);
        if (callback) callback();
    };
    icon.addEventListener('animationend', onDone);
}

function buyCrate() {
    // Check gold mercy first (rarest), then pink mercy
    const isMercyGold = cratesSinceGold >= MERCY_GOLD_THRESHOLD;
    const isMercyPink = cratesSincePink >= MERCY_PINK_THRESHOLD;
    if (isMercyGold) {
        addToInventory('gold', 1);
        cratesSinceGold = 0;
        showFloatingMsg('Gold mercy crate earned! Check your inventory.');
        updateDisplay();
        return;
    }
    if (isMercyPink) {
        addToInventory('mercy', 1);
        cratesSincePink = 0;
        showFloatingMsg('Mercy crate earned! Check your inventory.');
        updateDisplay();
        return;
    }
    // Pay for a crate and add to inventory
    const cost = getCrateCost();
    if (cotton < cost) {
        showFloatingMsg('Need ' + cost.toLocaleString() + ' ' + getWordLower() + ' to buy a crate.');
        return;
    }
    cotton -= cost;
    crateOpens++;
    addToInventory('normal', 1);
    updateDisplay();
    showFloatingMsg('Crate added to inventory!');
}

function openCrateModal() {
    // Opening is now done through the inventory — redirect if called directly
    showFloatingMsg('Use the inventory to open crates!');
}

function _doCrateModalOpen(isMercyPink, isMercy, isMercyGold) {
    pauseGame();

    let pool;
    if (isMercyGold) { pool = CRATE_REWARDS.filter(r => r.rarity === 'gold'); cratesSinceGold = 0; cratesSincePink = 0; }
    else if (isMercyPink) { pool = CRATE_REWARDS.filter(r => r.rarity === 'pink'); cratesSincePink = 0; }
    else             { pool = CRATE_REWARDS; }

    const winner = weightedRandom(pool);

    if (!isMercy) {
        const rank = { grey:0, blue:1, purple:2, pink:3, gold:4 }[winner.rarity] ?? 0;
        if (rank >= 3) cratesSincePink = 0; else cratesSincePink++;
        if (rank >= 4) cratesSinceGold = 0; else cratesSinceGold++;
    }

    const STRIP_COUNT  = 80;
    const WINNER_IDX   = 65;
    const winnerHasReroll = crateRerollUpgrade && Math.random() < REROLL_CHANCE;

    const bgPool = isMercyGold ? CRATE_REWARDS.filter(r => r.rarity === 'gold') : (isMercyPink ? CRATE_REWARDS.filter(r => r.rarity === 'pink') : CRATE_REWARDS);
    const strip = Array.from({ length: STRIP_COUNT }, (_, i) => {
        const r = (i === WINNER_IDX) ? winner : weightedRandom(bgPool);
        const hasReroll = crateRerollUpgrade && (i === WINNER_IDX ? winnerHasReroll : Math.random() < REROLL_CHANCE);
        return { ...r, hasReroll };
    });

    // Open modal FIRST so items render and have real dimensions
    const result = document.getElementById('spinResult');
    result.style.display = 'none'; result.className = '';
    document.getElementById('closeModalBtn').style.display = 'none';
    document.getElementById('spinnerTrack').style.display = '';
    document.getElementById('crateModalTitle').textContent = isMercy ? 'Mercy Crate!' : 'Opening Crate';
    document.getElementById('crateModal').classList.add('open');
    // crateSpinning already set to true before lid animation

    // Build strip into the now-visible spinner
    const inner = document.getElementById('spinnerInner');
    inner.style.willChange = 'transform';
    inner.style.transition = 'none';
    inner.style.transform  = 'translateX(0px)';
    inner.innerHTML        = '';

    strip.forEach(r => {
        const el = document.createElement('div');
        el.className = 'spinItem rarity-' + r.rarity;
        const tag = r.hasReroll
            ? ' <span style="font-size:9px;color:#f5c000;border:1px solid #f5c000;padding:1px 3px;">&lt;reroll&gt;</span>'
            : '';
        el.innerHTML = '<div class="spin-rarity">' + r.rarity + '</div><div class="spin-main">' + r.label + tag + '</div>';
        inner.appendChild(el);
    });

    // Force reflow so the browser registers snap position before we animate
    void inner.offsetWidth;

    // Now measure — modal is open so getBoundingClientRect() returns real values
    const firstItem  = inner.firstElementChild;
    const itemStyle  = window.getComputedStyle(firstItem);
    const marginL    = parseFloat(itemStyle.marginLeft)  || 0;
    const marginR    = parseFloat(itemStyle.marginRight) || 0;
    const ACTUAL_W   = firstItem.getBoundingClientRect().width + marginL + marginR;
    const trackEl    = document.getElementById('spinnerTrack');
    const TRACK_HALF = trackEl.getBoundingClientRect().width / 2;
    const winnerCentre = WINNER_IDX * ACTUAL_W + ACTUAL_W / 2;
    const targetX  = -(winnerCentre - TRACK_HALF);
    const SPIN_MS  = 7800;

    inner.style.transition = 'transform ' + SPIN_MS + 'ms cubic-bezier(0.03, 0.82, 0.18, 1)';
    inner.style.transform  = 'translateX(' + targetX + 'px)';

    // Tick sound for each item passing — starts fast then slows to match easing
    (function crateTickLoop(elapsed, interval) {
        if (elapsed >= SPIN_MS) return;
        sfxCrateTick();
        // ease-out: interval grows as spin slows
        const progress = elapsed / SPIN_MS;
        const nextInterval = 60 + progress * 400; // 60ms → 460ms
        setTimeout(() => crateTickLoop(elapsed + nextInterval, nextInterval), nextInterval);
    })(0, 60);

    setTimeout(() => {
        crateSpinning = false;
        inner.style.willChange = 'auto';
        const winnerItem = strip[WINNER_IDX];
        if (winnerItem.hasReroll) {
            const rerollItem = weightedRandom(CRATE_REWARDS.filter(r => r.id !== winnerItem.id));
            showRerollChoice(winnerItem, rerollItem);
        } else {
            showCrateResult(winnerItem);
        }
    }, SPIN_MS + 400);
}

function showCrateResult(item) {
    const result = document.getElementById('spinResult');
    result.className = 'spinResult rarity-' + item.rarity;
    result.innerHTML =
        '<span class="result-rarity">' + item.rarity + '</span>' +
        '<span class="result-name">'   + item.label  + '</span>' +
        '<span class="result-desc">'   + item.desc   + '</span>';
    result.style.display = 'block';
    document.getElementById('crateModalTitle').textContent = 'You got...';
    document.getElementById('closeModalBtn').style.display = 'inline-block';
    item.apply();
    saveGame();
}

function showRerollChoice(originalItem, rerollItem) {
    // Spin the reroll strip first
    document.getElementById('crateModalTitle').textContent = 'Reroll Spinning...';
    document.getElementById('spinResult').style.display = 'none';
    document.getElementById('closeModalBtn').style.display = 'none';

    const existingCont = document.getElementById('rerollChoiceContainer');
    if (existingCont) { existingCont.innerHTML = ''; existingCont.style.display = 'none'; }

    const STRIP_COUNT = 60;
    const WINNER_IDX  = 48;
    const SPIN_MS     = 5200;

    const inner = document.getElementById('spinnerInner');
    inner.style.willChange = 'transform';
    inner.style.transition = 'none';
    inner.style.transform  = 'translateX(0px)';
    inner.innerHTML = '';
    document.getElementById('spinnerTrack').style.display = '';

    const strip = Array.from({ length: STRIP_COUNT }, (_, i) => {
        const r = (i === WINNER_IDX) ? rerollItem : weightedRandom(CRATE_REWARDS);
        return { ...r, hasReroll: false };
    });
    strip.forEach(r => {
        const el = document.createElement('div');
        el.className = 'spinItem rarity-' + r.rarity;
        el.innerHTML = '<div class="spin-rarity">' + r.rarity + '</div><div class="spin-main">' + r.label + '</div>';
        inner.appendChild(el);
    });

    void inner.offsetWidth;

    const firstItem  = inner.firstElementChild;
    const itemStyle  = window.getComputedStyle(firstItem);
    const marginL    = parseFloat(itemStyle.marginLeft)  || 0;
    const marginR    = parseFloat(itemStyle.marginRight) || 0;
    const ACTUAL_W   = firstItem.getBoundingClientRect().width + marginL + marginR;
    const trackEl    = document.getElementById('spinnerTrack');
    const TRACK_HALF = trackEl.getBoundingClientRect().width / 2;
    const winnerCentre = WINNER_IDX * ACTUAL_W + ACTUAL_W / 2;
    const targetX = -(winnerCentre - TRACK_HALF);

    inner.style.transition = 'transform ' + SPIN_MS + 'ms cubic-bezier(0.03, 0.82, 0.18, 1)';
    inner.style.transform  = 'translateX(' + targetX + 'px)';

    // After spin: show two full-width reward cards stacked, matching the collect reward screen
    setTimeout(() => {
        inner.style.willChange = 'auto';
        document.getElementById('spinnerTrack').style.display = 'none';
        document.getElementById('crateModalTitle').textContent = 'Choose Your Reward';

        const modalBox = document.getElementById('crateModalBox');
        let container = document.getElementById('rerollChoiceContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'rerollChoiceContainer';
            modalBox.insertBefore(container, document.getElementById('closeModalBtn'));
        }
        container.style.display = 'block';
        container.innerHTML = '';

        const hint = document.createElement('div');
        hint.style.cssText = 'font-size:11px;color:#888;margin-bottom:10px;text-align:center;font-family:"Courier New",monospace;letter-spacing:0.5px;';
        hint.textContent = 'Click a reward to collect it';
        container.appendChild(hint);

        let choiceLocked = true;
        setTimeout(() => { choiceLocked = false; }, 350);

        function makeRewardCard(item, slotLabel, accentColor) {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'margin-bottom:8px;';

            // Tiny label above the card — same position as "You got..." would be
            const lbl = document.createElement('div');
            lbl.style.cssText = 'font-size:9px;text-transform:uppercase;letter-spacing:2px;color:' + accentColor + ';margin-bottom:4px;font-family:"Courier New",monospace;font-weight:bold;';
            lbl.textContent = slotLabel;

            // Card matches #spinResult exactly — same class, same inner HTML
            const card = document.createElement('div');
            card.id = 'rerollCard_' + slotLabel.replace(/\s/g,'_');
            card.className = 'spinResult rarity-' + item.rarity;
            card.style.cssText = 'display:block;margin:0;cursor:not-allowed;opacity:0.55;transition:opacity 0.25s,transform 0.12s,box-shadow 0.12s;animation:resultPop 0.3s cubic-bezier(.17,.67,.35,1.4);';
            card.innerHTML =
                '<span class="result-rarity">' + item.rarity + '</span>' +
                '<span class="result-name">'   + item.label  + '</span>' +
                '<span class="result-desc">'   + item.desc   + '</span>';

            setTimeout(() => {
                card.style.cursor  = 'pointer';
                card.style.opacity = '1';
            }, 350);

            card.addEventListener('mouseenter', () => {
                if (choiceLocked) return;
                card.style.transform = 'scale(1.02)';
                card.style.boxShadow = '0 4px 14px rgba(0,0,0,0.22)';
            });
            card.addEventListener('mouseleave', () => {
                card.style.transform = '';
                card.style.boxShadow = '';
            });
            card.addEventListener('click', () => {
                if (choiceLocked) return;
                container.innerHTML = '';
                container.style.display = 'none';
                document.getElementById('spinnerTrack').style.display = '';
                showCrateResult(item);
            });

            wrap.appendChild(lbl);
            wrap.appendChild(card);
            return wrap;
        }

        container.appendChild(makeRewardCard(originalItem, 'Original Roll', '#5a7a3a'));
        container.appendChild(makeRewardCard(rerollItem,   'Reroll',        '#8855bb'));

    }, SPIN_MS + 300);
}
function closeCrateModal() {
    document.getElementById('crateModal').classList.remove('open');
    const rrc = document.getElementById('rerollChoiceContainer');
    if (rrc) { rrc.innerHTML = ''; rrc.style.display = 'none'; }
    resumeGame();
    updateDisplay();
}

// =====================
// ACHIEVEMENTS
// =====================
const achievementDefs = [
    { id:'cotton_1',    label:'First Pick',       desc:()=>'Collect 1 '           +getWordLower(),            goal:1,          badge:'1'    },
    { id:'cotton_100',  label:'Getting Started',  desc:()=>'Collect 100 '         +getWordLower(),            goal:100,        badge:'100'  },
    { id:'cotton_1k',   label:()=>getWord()+' Farmer',    desc:()=>'Collect 1,000 '       +getWordLower(),    goal:1000,       badge:'1K'   },
    { id:'cotton_10k',  label:'Field Hand',       desc:()=>'Collect 10,000 '      +getWordLower(),            goal:10000,      badge:'10K'  },
    { id:'cotton_100k', label:'Field Boss',       desc:()=>'Collect 100,000 '     +getWordLower(),            goal:100000,     badge:'100K' },
    { id:'cotton_500k', label:()=>getWord()+' Baron',     desc:()=>'Collect 500,000 '     +getWordLower(),    goal:500000,     badge:'500K' },
    { id:'cotton_1m',   label:()=>getWord()+' Tycoon',    desc:()=>'Collect 1,000,000 '   +getWordLower(),    goal:1000000,    badge:'1M'   },
    { id:'cotton_5m',   label:'The Landowner',    desc:()=>'Collect 5,000,000 '   +getWordLower(),            goal:5000000,    badge:'5M'   },
    { id:'cotton_25m',  label:'Manor Lord',       desc:()=>'Collect 25,000,000 '  +getWordLower(),            goal:25000000,   badge:'25M'  },
    { id:'cotton_100m', label:()=>getWord()+' Empire',    desc:()=>'Collect 100,000,000 ' +getWordLower(),    goal:100000000,  badge:'100M' },
    { id:'cotton_250m', label:'The Harvest King', desc:()=>'Collect 250,000,000 ' +getWordLower(),            goal:250000000,  badge:'250M' },
    { id:'cotton_500m', label:'Half a Billion',   desc:()=>'Collect 500,000,000 ' +getWordLower(),            goal:500000000,  badge:'500M' },
    { id:'cotton_1b',   label:()=>getWord()+' God',       desc:()=>'Collect 1,000,000,000 '+getWordLower(),   goal:1000000000, badge:'1B'   },
];
let unlockedAchievements = new Set();

// =====================
// GAME PAUSE (while crate modal is open)
// =====================
let gamePaused = false;

function pauseGame() {
    gamePaused = true;
    if (passiveInterval) { clearInterval(passiveInterval); passiveInterval = null; }
}

function resumeGame() {
    if (!gamePaused) return;
    gamePaused = false;
    _dedLastTick = 0; // reset so elapsed doesn't count pause time as game time
    reschedulePassive(fastFortuneActive ? 500 : 1000);
}

function addCotton(amount) {
    const taxed = amount * (1 - landDealTaxRate);
    cotton           += taxed;
    totalCottonEarned += taxed;
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
    const labelText = typeof a.label === 'function' ? a.label() : a.label;
    const t = document.getElementById('achievementToast');
    t.textContent = 'Achievement Unlocked: ' + labelText;
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
        const unlocked   = unlockedAchievements.has(a.id);
        const labelText  = typeof a.label === 'function' ? a.label() : a.label;
        const descText   = typeof a.desc  === 'function' ? a.desc()  : a.desc;
        const div = document.createElement('div');
        div.className = 'ach-item' + (unlocked ? ' unlocked' : '');
        div.innerHTML = '<div class="ach-badge">' + (unlocked ? a.badge : '?') + '</div>' +
            '<div><span class="ach-name">' + labelText + '</span><span class="ach-desc">' + descText + '</span></div>';
        list.appendChild(div);
    });
    document.getElementById('achCount').textContent =
        unlockedAchievements.size + ' / ' + achievementDefs.length + ' unlocked';
}

// =====================
// DOM REFERENCES — resolved lazily so they work on GitHub Pages
// =====================
const cottonDisplay = { get textContent() { return document.getElementById('cottonCount').textContent; },
                        set textContent(v) { const el = document.getElementById('cottonCount'); if(el) el.textContent = v; } };
const cpsDisplay    = { get textContent() { return document.getElementById('cps').textContent; },
                        set textContent(v) { const el = document.getElementById('cps'); if(el) el.textContent = v; } };
function getGameArea() { return document.getElementById('gameArea'); }
// Alias so existing code using `gameArea` still works
const gameArea = { getBoundingClientRect() { return getGameArea().getBoundingClientRect(); },
                   appendChild(c) { return getGameArea().appendChild(c); } };

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
    set('clickUpgrade5Btn',  clickUpgrade5Bought,  !clickUpgrade4Bought);
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
    const rrb = document.getElementById('crateRerollBtn');
    if (rrb) { rrb.classList.toggle('bought', crateRerollUpgrade); rrb.disabled = crateRerollUpgrade; }
    const hrb = document.getElementById('crateHourlyBtn');
    if (hrb) {
        hrb.classList.toggle('bought', crateHourlyUpgrade);
        hrb.disabled = crateHourlyUpgrade;
        if (!crateHourlyUpgrade) hrb.textContent = 'Wait for the Crate (150,000 ' + getWordLower() + ') — gain 1 free crate every 50 min';
    }
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
    buy('clickUpgrade5Btn',  450000, 'click5',  () => clickUpgrade5Bought);
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

    // Reroll upgrade — not part of applyUpgrade system, handled separately
    const rrBtn = document.getElementById('crateRerollBtn');
    if (rrBtn) rrBtn.onclick = function() {
        if (crateRerollUpgrade) return;
        if (cotton < 10000) return;
        cotton -= 10000;
        crateRerollUpgrade = true;
        this.classList.add('bought');
        this.disabled = true;
        updateDisplay();
    };
    const hrBtn = document.getElementById('crateHourlyBtn');
    if (hrBtn) hrBtn.onclick = function() {
        if (crateHourlyUpgrade) return;
        if (cotton < 150000) return;
        cotton -= 150000;
        applyUpgrade('hourly1');
        this.classList.add('bought');
        this.disabled = true;
        updateDisplay();
    };
}

function initHandlers() {
    attachUpgradeHandlers();

// =====================
// CLICK COTTON
// =====================
document.getElementById('cottonButton').onclick = function(e) {
    const base  = 1 * clickMultiplier * crateClickBonus;
    const bonus = mastersTouchActive ? (70 + mastersTouchBonus) : 0;
    const isCrit = rollCrit();
    const gained = (base + bonus) * (isCrit ? CRIT_MULT : 1);
    addCotton(gained);
    showPopNumber(e.clientX, e.clientY, Math.floor(gained));
    if (isCrit) showCritEffect(e.clientX, e.clientY, gained);
    this.classList.remove('clicked'); void this.offsetWidth; this.classList.add('clicked');
    if (mastersTouchActive) {
        mastersTouchClicks++;
        tryMastersTouchLevelUp();
        updateMastersTouchBar();
    }
    updateDisplay();
};

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
} // end initHandlers

function showPopNumber(x, y, value) {
    const pop = document.createElement('div');
    pop.className = 'popNumber';
    pop.style.left = (x - 10) + 'px';
    pop.style.top  = (y - 30) + 'px';
    pop.textContent = '+' + value;
    document.body.appendChild(pop);
    setTimeout(() => pop.remove(), 1000);
}

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

function spawnField(index) {
    const f = document.createElement('img');
    f.src = 'images/field.png'; f.className = 'field';
    f.style.cssText = 'position:absolute;pointer-events:none;width:200px;';
    const gR = gameArea.getBoundingClientRect();
    f.style.left = (gR.right + 20) + 'px';
    f.style.top  = (gR.top + 50 + 110 * index) + 'px';
    document.body.appendChild(f);
}

function spawnManor(index) {
    const m = document.createElement('img');
    m.src = 'images/manor.png'; m.className = 'manor';
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
// Base per-second income before fast-fortune tick-rate bonus
function getBasePerSecond() {
    const ovMult = getOverseerWorkerMult(); // includes overseer upgrade 2 bonus
    const wCps   = workers   * cottonPerWorker * workerMultiplier * ovMult * crateWorkerBonus;
    const fCps   = fields.length * fieldIncome * crateWorkerBonus;
    const mCps   = manors    * manorIncome     * crateWorkerBonus;
    const oCps   = overseers * overseerIncome  * crateWorkerBonus;
    return wCps + fCps + mCps + oCps;
}

function getPerSecond() {
    const base   = getBasePerSecond();
    const ffMult = (fastFortuneActive && Date.now() < fastFortuneEnd) ? 2 : 1;
    return base * ffMult;
}

function updateDisplay() {
    // Cotton display is handled by rAF smooth counter — don't set textContent here
    cpsDisplay.textContent = getPerSecond().toFixed(2);

    // Land deal tax indicator
    const taxEl = document.getElementById('taxDisplay');
    if (taxEl) {
        if (landDealTaxRate > 0) {
            taxEl.textContent = '| Tax: -' + (landDealTaxRate * 100).toFixed(1) + '% income';
        } else {
            taxEl.textContent = '';
        }
    }

    document.getElementById('buyWorker').textContent  = 'Hire Worker ('   + workerCost.toLocaleString()             + ' ' + getWordLower() + ')';
    document.getElementById('buyField').textContent   = 'Buy Field ('      + Math.floor(fieldCost).toLocaleString()  + ' ' + getWordLower() + ')';
    document.getElementById('buyManor').textContent   = 'Build Manor ('    + Math.floor(manorCost).toLocaleString()  + ' ' + getWordLower() + ')';
    document.getElementById('buyOverseer').textContent = 'Hire Overseer (' + Math.floor(overseerCost).toLocaleString() + ' ' + getWordLower() + ')';

    const cost = getCrateCost();
    document.getElementById('crateCostVal').textContent  = cost.toLocaleString();
    document.getElementById('crateOpensVal').textContent = crateOpens;
    document.getElementById('openCrateBtn').disabled     = cotton < cost; // buy crate button
    // Keep crate cost label word in sync
    const ccLine = document.getElementById('crateCostLine');
    if (ccLine) ccLine.innerHTML = 'Cost: <span id="crateCostVal">' + cost.toLocaleString() + '</span> ' + getWordLower();

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
    }

    const mercyLine = document.getElementById('mercyLine');
    if (mercyLine) {
        const parts = [];
        if (cratesSincePink > 0) parts.push('Pink mercy: ' + cratesSincePink + '/' + MERCY_PINK_THRESHOLD);
        if (cratesSinceGold > 0) parts.push('Gold mercy: ' + cratesSinceGold + '/' + MERCY_GOLD_THRESHOLD);
        mercyLine.textContent = parts.join('  ');
    }

    syncUpgradeButtons();
    updateMastersTouchBar();
    updateCrateHourlyDisplay();
}

let _lastPassiveTick = 0;
function passiveTick() {
    const now = Date.now();
    if (_lastPassiveTick === 0) { _lastPassiveTick = now; }
    const elapsed = Math.min((now - _lastPassiveTick) / 1000, 5);
    _lastPassiveTick = now;
    if (fastFortuneActive && now >= fastFortuneEnd) {
        fastFortuneActive = false;
        reschedulePassive(1000);
        updateBuffDisplay(); updateDisplay();
    }
    const perSec = getBasePerSecond() * (fastFortuneActive && now < fastFortuneEnd ? 2 : 1);
    addCotton(perSec * elapsed);
    updateDisplay();
}
// Prevent tab-away catch-up spike: pause/resume passive on visibility change
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        if (passiveInterval) { clearInterval(passiveInterval); passiveInterval = null; }
        _lastPassiveTick = Date.now();
        if (dedicatedMasterActive) _dedLastTick = 0;
    } else {
        if (!gamePaused) {
            const hiddenSec = Math.min((Date.now() - (_lastPassiveTick || Date.now())) / 1000, 5);
            if (hiddenSec > 0) addCotton(getBasePerSecond() * hiddenSec);
            _lastPassiveTick = 0;
            reschedulePassive(fastFortuneActive ? 500 : 1000);
            updateDisplay();
        }
    }
});
reschedulePassive(1000);
// Keep the hourly crate countdown ticking every second
setInterval(() => { if (crateHourlyUpgrade) updateCrateHourlyDisplay(); }, 1000);
function resetGame() {
    if (!confirm('Reset everything?')) return;
    localStorage.removeItem('cottonPickerSave');
    location.reload();
}

// =====================
// BACKGROUND MUSIC
// =====================
let musicMuted = false;

function toggleMute() {
    const audio = document.getElementById('bgMusic');
    const btn   = document.getElementById('muteBtn');
    if (!audio) return;
    musicMuted = !musicMuted;
    audio.muted = musicMuted;
    if (btn) btn.textContent = musicMuted ? 'Music: OFF' : 'Music: ON';
}

function startMusic() {
    const audio = document.getElementById('bgMusic');
    if (!audio) return;
    audio.volume = 0.4;
    audio.play().catch(() => {});
}

function onFirstInteraction() {
    startMusic();
    document.removeEventListener('click', onFirstInteraction);
    document.removeEventListener('keydown', onFirstInteraction);
}
document.addEventListener('click', onFirstInteraction);
document.addEventListener('keydown', onFirstInteraction);

// =====================
// SAVE / LOAD
// =====================
function saveGame() {
    localStorage.setItem('cottonPickerSave', JSON.stringify({
        businessName, strawberryMode,
        cotton, totalCottonEarned,
        workers, workerCost,
        overseers, overseerCost,
        manors, manorCost, manorIncome,
        fields: fields.length, fieldCost, fieldIncome,
        clickMultiplier, mastersTouchActive, mastersTouchLevel, mastersTouchClicks, mastersTouchBonus,
        dedicatedMasterActive, clickUpgrade5Bought, workerMultiplier,
        clickUpgrade1Bought, clickUpgrade2Bought, clickUpgrade3Bought, clickUpgrade4Bought,
        workerUpgrade1Bought, workerUpgrade2Bought, workerUpgrade3Bought,
        fieldUpgrade1Bought, fieldUpgrade2Bought, fieldUpgrade3Bought,
        manorUpgrade1Bought, manorUpgrade2Bought, manorUpgrade3Bought,
        overseerUpgrade1Bought, overseerUpgrade2Bought, overseerIncome,
        crateRerollUpgrade, crateHourlyUpgrade, crateHourlyStacks, crateHourlyQueue, crateHourlyLastTick, crateInventory, landDealTaxRate, properTechniqueBonus, properTechniqueActive, properTechniqueEnd,
        unlockedAchievements: [...unlockedAchievements],
        crateOpens, cratesSincePink, cratesSinceGold, cratesAreFree,
        activeBuff: activeBuff ? { label: activeBuff.label, endTime: activeBuff.endTime } : null,
        fastFortuneActive, fastFortuneEnd,
        crateClickBonus, crateWorkerBonus,
    }));
}

function loadGame() {
    const s = JSON.parse(localStorage.getItem('cottonPickerSave'));

    // Always ensure overlay is visible by default
    const overlay = document.getElementById('namingOverlay');
    if (overlay) overlay.style.display = 'flex';

    if (s && s.businessName) {
        // Restore all saved data
        businessName   = s.businessName;
        gameStarted    = true;
        strawberryMode = s.strawberryMode || false;

        cotton            = s.cotton            || 0;
        displayedCotton   = cotton;
        totalCottonEarned = s.totalCottonEarned || 0;
        workers           = s.workers           || 0;
        workerCost        = s.workerCost        || 10;
        overseers         = s.overseers         || 0;
        overseerCost      = s.overseerCost      || BASE_OVERSEER_COST;
        manors            = s.manors            || 0;
        manorCost         = s.manorCost         || BASE_MANOR_COST;
        manorIncome       = s.manorIncome       || 75;
        fields            = Array(s.fields || 0).fill(true);
        fieldCost         = s.fieldCost         || baseFieldCost;
        fieldIncome       = s.fieldIncome       || 25;
        clickMultiplier    = s.clickMultiplier    || 1;
        mastersTouchActive = s.mastersTouchActive || false;
        mastersTouchLevel  = s.mastersTouchLevel  || 0;
        mastersTouchClicks = s.mastersTouchClicks || 0;
        mastersTouchBonus  = s.mastersTouchBonus  || 0;
        dedicatedMasterActive = s.dedicatedMasterActive || false;
        clickUpgrade5Bought   = s.clickUpgrade5Bought   || false;
        workerMultiplier   = s.workerMultiplier   || 1;
        clickUpgrade1Bought  = s.clickUpgrade1Bought  || false;
        clickUpgrade2Bought  = s.clickUpgrade2Bought  || false;
        clickUpgrade3Bought  = s.clickUpgrade3Bought  || false;
        clickUpgrade4Bought  = s.clickUpgrade4Bought  || false;
        workerUpgrade1Bought = s.workerUpgrade1Bought || false;
        workerUpgrade2Bought = s.workerUpgrade2Bought || false;
        workerUpgrade3Bought = s.workerUpgrade3Bought || false;
        fieldUpgrade1Bought  = s.fieldUpgrade1Bought  || false;
        fieldUpgrade2Bought  = s.fieldUpgrade2Bought  || false;
        fieldUpgrade3Bought  = s.fieldUpgrade3Bought  || false;
        manorUpgrade1Bought  = s.manorUpgrade1Bought  || false;
        manorUpgrade2Bought  = s.manorUpgrade2Bought  || false;
        manorUpgrade3Bought  = s.manorUpgrade3Bought  || false;
        overseerUpgrade1Bought = s.overseerUpgrade1Bought || false;
        overseerUpgrade2Bought = s.overseerUpgrade2Bought || false;
        overseerIncome         = s.overseerIncome         || 160;
        crateRerollUpgrade     = s.crateRerollUpgrade     || false;
        crateHourlyUpgrade     = s.crateHourlyUpgrade     || false;
        crateHourlyStacks      = s.crateHourlyStacks      || 0;
        crateHourlyQueue       = s.crateHourlyQueue       || 0;
        crateHourlyLastTick    = s.crateHourlyLastTick    || 0;
        crateInventory         = s.crateInventory         || { normal: 0, mercy: 0, gold: 0 };
        // Award crates earned while the game was closed
        if (crateHourlyUpgrade && crateHourlyLastTick > 0) {
            const hoursElapsed = Math.floor((Date.now() - crateHourlyLastTick) / (50 * 60 * 1000));
            if (hoursElapsed > 0) {
                crateHourlyQueue += hoursElapsed * crateHourlyStacks;
                crateInventory.normal = (crateInventory.normal || 0) + hoursElapsed * crateHourlyStacks;
                crateHourlyLastTick += hoursElapsed * 50 * 60 * 1000;
            }
        }
        landDealTaxRate        = s.landDealTaxRate        || 0;
        properTechniqueBonus   = s.properTechniqueBonus   || 0;
        properTechniqueActive  = s.properTechniqueActive  || false;
        properTechniqueEnd     = s.properTechniqueEnd     || 0;
        if (properTechniqueActive && properTechniqueEnd > Date.now()) startProperTechniqueTimer();
        else { properTechniqueActive = false; properTechniqueBonus = 0; }
        crateOpens       = s.crateOpens       || 0;
    cratesSincePink  = s.cratesSincePink  || 0;
        cratesAreFree    = s.cratesAreFree    || false;
        crateClickBonus  = s.crateClickBonus  || 1;
        crateWorkerBonus = s.crateWorkerBonus || 1;

        if (s.unlockedAchievements) unlockedAchievements = new Set(s.unlockedAchievements);
        if (s.activeBuff && s.activeBuff.endTime > Date.now()) { activeBuff = s.activeBuff; startBuffTimer(); }
        if (s.fastFortuneActive && s.fastFortuneEnd > Date.now()) {
            fastFortuneActive = true; fastFortuneEnd = s.fastFortuneEnd;
            reschedulePassive(500); startFastFortuneTimer();
        }

        // Hide overlay and finish init with loaded data
        if (overlay) overlay.style.display = 'none';
        document.getElementById('businessNameDisplay').textContent = businessName;
        finishGameInit();
    } else {
        // Fresh start — show overlay, focus input, render minimal UI
        if (overlay) overlay.style.display = 'flex';
        const input = document.getElementById('businessNameInput');
        if (input) setTimeout(() => input.focus(), 150);
        renderAchievements();
        syncUpgradeButtons();
        updateDisplay();
    }
}

// Called either after naming (fresh start) or after loadGame (returning player)
function finishGameInit() {
    for (let i = 0; i < workers; i++) spawnWorker();
    for (let i = 0; i < overseers; i++) spawnOverseer();
    for (let i = 0; i < fields.length; i++) spawnField(i);
    for (let i = 0; i < manors; i++) spawnManor(i);

    if (dedicatedMasterActive) { _dedLastTick = 0; requestAnimationFrame(dedicatedMasterTick); }
    if (strawberryMode) {
        const cb = document.getElementById('cottonButton');
        if (cb) cb.src = 'images/strawberry.png';
    }

    syncUpgradeButtons();
    renderAchievements();
    updateDisplay();
    updateMastersTouchBar();
    if (strawberryMode) refreshAllText();
    if (crateHourlyUpgrade) startHourlyCrateTimer();
    updateCrateHourlyDisplay();
    initSlotPanel();
    renderCrateInventory();
}


// =====================
// CRATE INVENTORY
// =====================
// Each entry: { type: 'normal'|'mercy', count: N }
// We track normal crates (from hourly/slot) separately from mercy crates
let crateInventory = { normal: 0, mercy: 0, gold: 0 };

function addToInventory(type, count) {
    crateInventory[type] = (crateInventory[type] || 0) + count;
    renderCrateInventory();
    saveGame();
}

function useFromInventory(type) {
    if ((crateInventory[type] || 0) <= 0) return false;
    crateInventory[type]--;
    renderCrateInventory();
    saveGame();
    return true;
}

const _INV_GOLD_SVG   = '<svg class="inv-crate-icon" width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="2" y="7" width="20" height="15" rx="1" fill="#c09830" stroke="#f8d800" stroke-width="1.5"/><rect x="1" y="5" width="22" height="5" rx="1" fill="#f8d800" stroke="#c08000" stroke-width="1.5"/><rect x="10" y="7" width="4" height="15" fill="#f8d800" opacity="0.8"/><rect x="2" y="13" width="20" height="2" fill="#f8d800" opacity="0.8"/><circle cx="12" cy="3" r="2" fill="#f8d800" stroke="#c08000" stroke-width="1"/></svg>';
const _INV_NORMAL_SVG = '<svg class="inv-crate-icon" width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="2" y="7" width="20" height="15" rx="1" fill="#b87830" stroke="#6a4010" stroke-width="1.5"/><rect x="1" y="5" width="22" height="5" rx="1" fill="#cc8c40" stroke="#6a4010" stroke-width="1.5"/><rect x="10" y="7" width="4" height="15" fill="#6a4010"/><rect x="2" y="13" width="20" height="2" fill="#6a4010"/></svg>';
const _INV_MERCY_SVG  = '<svg class="inv-crate-icon" width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="2" y="7" width="20" height="15" rx="1" fill="#c0408a" stroke="#ff55cc" stroke-width="1.5"/><rect x="1" y="5" width="22" height="5" rx="1" fill="#e060aa" stroke="#ff55cc" stroke-width="1.5"/><rect x="10" y="7" width="4" height="15" fill="#ff55cc" opacity="0.7"/><rect x="2" y="13" width="20" height="2" fill="#ff55cc" opacity="0.7"/><path d="M8 3 L12 6 L16 3" stroke="#ff55cc" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>';

function renderCrateInventory() {
    const grid = document.getElementById('crateInventoryGrid');
    if (!grid) return;
    const COLS = 6, ROWS = 8, TOTAL = COLS * ROWS;
    grid.innerHTML = '';
    const items = [];
    for (let i = 0; i < (crateInventory.gold   || 0) && items.length < TOTAL; i++) items.push('gold');
    for (let i = 0; i < (crateInventory.mercy  || 0) && items.length < TOTAL; i++) items.push('mercy');
    for (let i = 0; i < (crateInventory.normal || 0) && items.length < TOTAL; i++) items.push('normal');
    for (let i = 0; i < TOTAL; i++) {
        const slot = document.createElement('div');
        slot.className = 'inv-slot';
        if (items[i]) {
            const type = items[i];
            slot.className += ' inv-slot-' + type;
            slot.title = type === 'gold' ? 'Gold Mercy Crate — click to open (guaranteed gold!)' : (type === 'mercy' ? 'Mercy Crate — click to open (guaranteed pink!)' : 'Supply Crate — click to open');
            slot.innerHTML = type === 'gold' ? _INV_GOLD_SVG : (type === 'mercy' ? _INV_MERCY_SVG : _INV_NORMAL_SVG);
            slot.addEventListener('click', () => openCrateFromInventory(type));
        }
        grid.appendChild(slot);
    }
    const overflow = document.getElementById('crateInventoryOverflow');
    const total = (crateInventory.normal || 0) + (crateInventory.mercy || 0) + (crateInventory.gold || 0);
    if (overflow) overflow.textContent = total > TOTAL ? '+' + (total - TOTAL) + ' more' : '';
}

function openCrateFromInventory(type) {
    if (crateSpinning) return;
    if ((crateInventory[type] || 0) <= 0) return;
    useFromInventory(type);
    // NOTE: crateOpens NOT incremented here — cost only goes up when buying
    updateDisplay();
    crateSpinning = true;
    const isMercyPinkFromInv = type === 'mercy';
    const isMercyGoldFromInv = type === 'gold';
    const isMercyFromInv = isMercyPinkFromInv || isMercyGoldFromInv;
    playCrateLidPop(() => { _doCrateModalOpen(isMercyPinkFromInv, isMercyFromInv, isMercyGoldFromInv); });
}

// =====================
// SLOT MACHINE
// =====================


// =====================
// SOUND ENGINE (Web Audio API — no files needed)
// =====================
let _audioCtx = null;
function getAudioCtx() {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return _audioCtx;
}

function playTone(freq, type, vol, dur, fadeStart) {
    if (musicMuted) return;
    try {
        const ctx = getAudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = type; osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + dur);
    } catch(e) {}
}

function playNoise(vol, dur, filterFreq) {
    if (musicMuted) return;
    try {
        const ctx = getAudioCtx();
        const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass'; filter.frequency.value = filterFreq || 800;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
        src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
        src.start(); src.stop(ctx.currentTime + dur);
    } catch(e) {}
}

// Crate wheel tick — mechanical click
// ── Crate tick: sharp mechanical ratchet click
function sfxCrateTick() {
    if (musicMuted) return;
    try {
        const ctx = getAudioCtx(); const t = ctx.currentTime;
        // Sharp transient click — noise burst + low thud
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.025, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random()*2-1) * Math.exp(-i / (d.length * 0.3));
        const src = ctx.createBufferSource(); src.buffer = buf;
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1200;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t+0.025);
        src.connect(hp); hp.connect(g); g.connect(ctx.destination);
        src.start(t);
    } catch(e) {}
}

// ── Lever pull: heavy mechanical clunk down then spring return
function sfxLeverPull() {
    if (musicMuted) return;
    try {
        const ctx = getAudioCtx(); const t = ctx.currentTime;
        // CLUNK: low pitched thud with body resonance
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, t);
        osc.frequency.exponentialRampToValueAtTime(55, t + 0.12);
        g.gain.setValueAtTime(0.6, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(t); osc.stop(t + 0.2);
        // Noise component (metal on metal)
        const buf2 = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
        const d2 = buf2.getChannelData(0);
        for (let i = 0; i < d2.length; i++) d2[i] = (Math.random()*2-1) * Math.exp(-i / (d2.length * 0.4));
        const src2 = ctx.createBufferSource(); src2.buffer = buf2;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 600; bp.Q.value = 2;
        const g2 = ctx.createGain(); g2.gain.setValueAtTime(0.35, t); g2.gain.exponentialRampToValueAtTime(0.001, t+0.1);
        src2.connect(bp); bp.connect(g2); g2.connect(ctx.destination);
        src2.start(t);
        // SPRING RETURN click at ~0.38s
        const ck = ctx.createOscillator(); const gck = ctx.createGain();
        ck.type = 'square'; ck.frequency.setValueAtTime(320, t+0.38); ck.frequency.exponentialRampToValueAtTime(160, t+0.44);
        gck.gain.setValueAtTime(0.25, t+0.38); gck.gain.exponentialRampToValueAtTime(0.001, t+0.46);
        ck.connect(gck); gck.connect(ctx.destination); ck.start(t+0.38); ck.stop(t+0.48);
    } catch(e) {}
}

// ── Coin insert: realistic metallic clink + resonance
function sfxCoin() {
    if (musicMuted) return;
    try {
        const ctx = getAudioCtx(); const t = ctx.currentTime;
        // Multiple metallic partials for coin ring
        [1760, 2640, 3520, 4400].forEach((f, i) => {
            const o = ctx.createOscillator(); const g = ctx.createGain();
            o.type = 'sine'; o.frequency.value = f * (1 + (Math.random()-0.5)*0.02);
            const delay = i * 0.006;
            g.gain.setValueAtTime(0, t+delay);
            g.gain.linearRampToValueAtTime(0.2 - i*0.03, t+delay+0.005);
            g.gain.exponentialRampToValueAtTime(0.001, t+delay+0.22+(i*0.04));
            o.connect(g); g.connect(ctx.destination);
            o.start(t+delay); o.stop(t+delay+0.3);
        });
        // Thud of coin dropping
        const thud = ctx.createOscillator(); const gthud = ctx.createGain();
        thud.type = 'sine'; thud.frequency.setValueAtTime(180, t); thud.frequency.exponentialRampToValueAtTime(80, t+0.06);
        gthud.gain.setValueAtTime(0.4, t); gthud.gain.exponentialRampToValueAtTime(0.001, t+0.08);
        thud.connect(gthud); gthud.connect(ctx.destination); thud.start(t); thud.stop(t+0.1);
    } catch(e) {}
}

// ── Reel stop: satisfying mechanical thunk + bing overtone
function sfxReelBing(reelIdx) {
    if (musicMuted) return;
    try {
        const ctx = getAudioCtx(); const t = ctx.currentTime;
        // Mechanical stop thunk
        const thunk = ctx.createOscillator(); const gt = ctx.createGain();
        thunk.type = 'sawtooth';
        const baseFreq = [200, 240, 280][reelIdx] || 200;
        thunk.frequency.setValueAtTime(baseFreq, t); thunk.frequency.exponentialRampToValueAtTime(baseFreq*0.5, t+0.05);
        gt.gain.setValueAtTime(0.5, t); gt.gain.exponentialRampToValueAtTime(0.001, t+0.08);
        thunk.connect(gt); gt.connect(ctx.destination); thunk.start(t); thunk.stop(t+0.1);
        // Bell overtone
        const bell = [880, 1100, 1320][reelIdx] || 880;
        const bo = ctx.createOscillator(); const bg = ctx.createGain();
        bo.type = 'sine'; bo.frequency.setValueAtTime(bell, t+0.02); bo.frequency.exponentialRampToValueAtTime(bell*0.97, t+0.4);
        bg.gain.setValueAtTime(0.35, t+0.02); bg.gain.exponentialRampToValueAtTime(0.001, t+0.45);
        bo.connect(bg); bg.connect(ctx.destination); bo.start(t+0.02); bo.stop(t+0.5);
        // Noise burst
        const nb = ctx.createBuffer(1, ctx.sampleRate*0.04, ctx.sampleRate);
        const nd = nb.getChannelData(0);
        for (let i=0;i<nd.length;i++) nd[i]=(Math.random()*2-1)*Math.exp(-i/(nd.length*0.5));
        const ns=ctx.createBufferSource(); ns.buffer=nb;
        const nf=ctx.createBiquadFilter(); nf.type='bandpass'; nf.frequency.value=2000;
        const ng=ctx.createGain(); ng.gain.setValueAtTime(0.3, t); ng.gain.exponentialRampToValueAtTime(0.001, t+0.05);
        ns.connect(nf); nf.connect(ng); ng.connect(ctx.destination); ns.start(t);
    } catch(e) {}
}

// ── Spin sound: fast mechanical reel whirring — "bwwwrrrrr"
let _spinLoopNodes = [];
let _spinLoopRunning = false;
function sfxSpinStart() {
    if (musicMuted) return;
    sfxSpinStop();
    _spinLoopRunning = true;
    try {
        const ctx = getAudioCtx();
        // Continuous reel noise: filtered noise that shifts in character
        function makeReelNoise(startTime, dur) {
            if (!_spinLoopRunning) return;
            const buf = ctx.createBuffer(1, ctx.sampleRate*dur, ctx.sampleRate);
            const d = buf.getChannelData(0);
            for (let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
            const src = ctx.createBufferSource(); src.buffer=buf;
            // Bandpass centered on mechanical clatter range
            const bp = ctx.createBiquadFilter(); bp.type='bandpass';
            bp.frequency.value = 400 + Math.random()*200; bp.Q.value=1.5;
            const g = ctx.createGain();
            g.gain.setValueAtTime(0.18, startTime);
            g.gain.setValueAtTime(0.18, startTime+dur-0.01);
            src.connect(bp); bp.connect(g); g.connect(ctx.destination);
            src.start(startTime); src.stop(startTime+dur+0.01);
            if (_spinLoopRunning) setTimeout(() => makeReelNoise(ctx.currentTime, 0.12), dur*1000-20);
        }
        // Rhythmic mechanical ticks overlaid
        function schedTicks(t) {
            if (!_spinLoopRunning) return;
            // Fast tick burst
            for (let i=0;i<6;i++) {
                const o=ctx.createOscillator(); const g=ctx.createGain();
                o.type='square'; o.frequency.value=180+Math.random()*40;
                const at=t+i*0.045;
                g.gain.setValueAtTime(0,at); g.gain.linearRampToValueAtTime(0.08,at+0.005);
                g.gain.exponentialRampToValueAtTime(0.001,at+0.04);
                o.connect(g); g.connect(ctx.destination);
                o.start(at); o.stop(at+0.045);
            }
            if (_spinLoopRunning) setTimeout(()=>schedTicks(ctx.currentTime), 250);
        }
        makeReelNoise(ctx.currentTime, 0.12);
        schedTicks(ctx.currentTime);
    } catch(e) {}
}
function sfxSpinStop() {
    _spinLoopRunning = false;
    _spinLoopNodes = [];
}

const SLOT_OUTCOMES = [
    { id:'lose_all',    weight:220, label:'Lose ALL',        mult:0,   loseFrac:1,   freeCrate:false, cls:'lose'    },
    { id:'lose_half',   weight:400, label:'Lose half',       mult:0,   loseFrac:0.5, freeCrate:false, cls:'lose'    },
    { id:'lose_20',     weight:100, label:'Lose 20%',        mult:0,   loseFrac:0.2, freeCrate:false, cls:'lose'    },
    { id:'gain_20',     weight:150, label:'+20%',            mult:1.2, loseFrac:0,   freeCrate:false, cls:'win'     },
    { id:'gain_50',     weight:75,  label:'+50%',            mult:1.5, loseFrac:0,   freeCrate:false, cls:'win'     },
    { id:'gain_2x',     weight:25,  label:'2x wager!',       mult:2,   loseFrac:0,   freeCrate:false, cls:'win'     },
    { id:'free_crate',  weight:25,  label:'Free crate!',     mult:1,   loseFrac:0,   freeCrate:true,  cls:'win'     },
    { id:'gain_3x',     weight:25,  label:'3x wager!',       mult:3,   loseFrac:0,   freeCrate:false, cls:'jackpot' },
    { id:'gain_4x',     weight:5,   label:'15x JACKPOT!',    mult:15,  loseFrac:0,   freeCrate:false, cls:'jackpot' },
];


// SVG slot symbols — real gambling / fruit machine symbols
const SLOT_SYMS_SVG = {
    // Fruit
    cherry:  '<svg class="slot-sym-svg" viewBox="0 0 44 44" fill="none"><circle cx="14" cy="30" r="8" fill="#dd1133" stroke="#880022" stroke-width="1.5"/><circle cx="30" cy="32" r="8" fill="#dd1133" stroke="#880022" stroke-width="1.5"/><path d="M14 22 Q18 8 30 4 Q34 10 30 24" stroke="#228822" stroke-width="2.5" fill="none" stroke-linecap="round"/><circle cx="14" cy="28" r="3" fill="#ff6688" opacity="0.5"/></svg>',
    lemon:   '<svg class="slot-sym-svg" viewBox="0 0 44 44" fill="none"><ellipse cx="22" cy="23" rx="14" ry="11" fill="#ffe030" stroke="#c09000" stroke-width="1.5"/><ellipse cx="7" cy="23" rx="5" ry="4" fill="#ffe030" stroke="#c09000" stroke-width="1.5"/><ellipse cx="37" cy="23" rx="5" ry="4" fill="#ffe030" stroke="#c09000" stroke-width="1.5"/><ellipse cx="22" cy="21" rx="7" ry="5" fill="#fff0a0" opacity="0.5"/></svg>',
    orange:  '<svg class="slot-sym-svg" viewBox="0 0 44 44" fill="none"><circle cx="22" cy="24" r="14" fill="#ff8800" stroke="#cc5500" stroke-width="1.5"/><path d="M22 10 L22 6" stroke="#228822" stroke-width="2.5" stroke-linecap="round"/><path d="M22 6 Q28 2 30 6" stroke="#228822" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="18" cy="20" r="5" fill="#ffaa40" opacity="0.45"/></svg>',
    grape:   '<svg class="slot-sym-svg" viewBox="0 0 44 44" fill="none"><circle cx="22" cy="34" r="6" fill="#8833cc" stroke="#551199" stroke-width="1"/><circle cx="14" cy="28" r="6" fill="#8833cc" stroke="#551199" stroke-width="1"/><circle cx="30" cy="28" r="6" fill="#8833cc" stroke="#551199" stroke-width="1"/><circle cx="18" cy="20" r="6" fill="#8833cc" stroke="#551199" stroke-width="1"/><circle cx="26" cy="20" r="6" fill="#8833cc" stroke="#551199" stroke-width="1"/><circle cx="22" cy="13" r="6" fill="#8833cc" stroke="#551199" stroke-width="1"/><path d="M22 7 L22 3 Q26 1 28 4" stroke="#228822" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
    watermel:'<svg class="slot-sym-svg" viewBox="0 0 44 44" fill="none"><path d="M8 32 A18 18 0 0 1 36 32 Z" fill="#cc2222" stroke="#881111" stroke-width="1.5"/><path d="M8 32 A18 18 0 0 0 36 32" fill="#44aa22" stroke="#228811" stroke-width="2"/><line x1="15" y1="32" x2="18" y2="22" stroke="#111" stroke-width="1"/><line x1="22" y1="32" x2="22" y2="18" stroke="#111" stroke-width="1"/><line x1="29" y1="32" x2="26" y2="22" stroke="#111" stroke-width="1"/></svg>',
    bell:    '<svg class="slot-sym-svg" viewBox="0 0 44 44" fill="none"><path d="M22 5 C13 5 9 12 9 20 L9 31 L35 31 L35 20 C35 12 31 5 22 5Z" fill="#f8d800" stroke="#c08000" stroke-width="2"/><rect x="13" y="31" width="18" height="5" rx="1" fill="#c08000"/><circle cx="22" cy="38" r="3.5" fill="#c08000"/><rect x="19" y="3" width="6" height="5" rx="1.5" fill="#c08000"/><ellipse cx="17" cy="16" rx="4" ry="3" fill="#fff8a0" opacity="0.4"/></svg>',
    bar:     '<svg class="slot-sym-svg" viewBox="0 0 44 44" fill="none"><rect x="4" y="12" width="36" height="20" rx="3" fill="#2233aa" stroke="#001188" stroke-width="2"/><rect x="8" y="16" width="28" height="12" rx="2" fill="#3344cc"/><text x="22" y="26" text-anchor="middle" font-size="11" font-weight="bold" fill="#ffffff" font-family="serif" letter-spacing="1">BAR</text></svg>',
    seven:   '<svg class="slot-sym-svg" viewBox="0 0 44 44" fill="none"><rect x="4" y="4" width="36" height="36" rx="5" fill="#cc1111"/><rect x="6" y="6" width="32" height="32" rx="4" fill="#ee2222"/><text x="22" y="33" text-anchor="middle" font-size="30" font-weight="bold" fill="#ffffff" font-family="serif">7</text></svg>',
    diamond: '<svg class="slot-sym-svg" viewBox="0 0 44 44" fill="none"><polygon points="22,3 40,18 22,41 4,18" fill="#33ddff" stroke="#0099bb" stroke-width="2"/><polygon points="22,9 34,18 22,36 10,18" fill="#99eeff" opacity="0.55"/><line x1="4" y1="18" x2="40" y2="18" stroke="#0099bb" stroke-width="1.5"/><polygon points="22,3 40,18 22,18" fill="#ffffff" opacity="0.2"/></svg>',
    // Filler / lose symbols (still gambling-themed, not scary)
    club:    '<svg class="slot-sym-svg" viewBox="0 0 44 44" fill="none"><circle cx="22" cy="16" r="7" fill="#333"/><circle cx="14" cy="24" r="7" fill="#333"/><circle cx="30" cy="24" r="7" fill="#333"/><rect x="18" y="28" width="8" height="10" fill="#333"/><rect x="14" y="36" width="16" height="3" fill="#333"/></svg>',
    spade:   '<svg class="slot-sym-svg" viewBox="0 0 44 44" fill="none"><path d="M22 4 L38 26 Q38 34 30 30 Q32 36 36 38 L8 38 Q12 36 14 30 Q6 34 6 26 Z" fill="#222"/><rect x="18" y="36" width="8" height="5" rx="1" fill="#222"/></svg>',
    heart:   '<svg class="slot-sym-svg" viewBox="0 0 44 44" fill="none"><path d="M22 38 L6 22 C2 17 2 10 8 7 C13 4 18 7 22 13 C26 7 31 4 36 7 C42 10 42 17 38 22 Z" fill="#dd1133" stroke="#990022" stroke-width="1.5"/></svg>',
};

// Random pool — all symbols including fillers
const SLOT_RAND_POOL = ['cherry','lemon','orange','grape','watermel','bell','bar','seven','club','spade','heart'];

// Win outcome centre symbols
const SLOT_OUTCOME_SYMS = {
    // Losses — specific visual patterns (see spinReel override)
    lose_all:   null, // random mess, set in doSlotSpin
    lose_half:  null, // one diamond in random position
    lose_20:    null, // two diamonds in random rows
    // Wins — matching triples / patterns
    gain_20:    ['cherry',  'cherry',  'lemon'   ],
    gain_50:    ['bell',    'bell',    'bell'     ],
    gain_2x:    ['bar',     'bar',     'bar'      ],
    free_crate: ['heart',   'seven',   'heart'    ],
    gain_3x:    ['seven',   'seven',   'seven'    ],
    gain_4x:    ['diamond', 'diamond', 'diamond'  ],
};

function getSlotWinSyms(id) { return SLOT_OUTCOME_SYMS[id]; }
function getSlotRandSyms() { return SLOT_RAND_POOL; }

function makeSymCell(symKey) {
    const cell = document.createElement('div');
    cell.className = 'slot-symbol';
    cell.innerHTML = SLOT_SYMS_SVG[symKey] || SLOT_SYMS_SVG['club'];
    return cell;
}


let slotSpinning = false;

function initSlotPanel() {
    seedIdleReels();
    slotWagerFrac = 0;
    const msgEl = document.getElementById('slotResultMsg');
    if (msgEl) { msgEl.textContent = 'Select a wager and pull the lever!'; msgEl.className = ''; }
    const disp = document.getElementById('slotCurrentWager');
    if (disp) disp.textContent = 'Select amount below';
    document.querySelectorAll('.slot-wager-preset').forEach(b => b.classList.remove('selected'));
    updateSlotWordLabel();
}
function openSlotModal() {
    initSlotPanel();
    document.getElementById('slotModal').classList.add('open');
    pauseGame();
}
function closeSlotModal() {
    document.getElementById('slotModal').classList.remove('open');
    resumeGame();
}

function updateSlotWordLabel() {
    const lbl = document.getElementById('slotWagerLabel');
    if (lbl) lbl.textContent = 'INSERT WAGER (' + getWordLower().toUpperCase() + ')';
    const title = document.getElementById('slotMarqueeTitle');
    if (title) title.textContent = strawberryMode ? 'LUCKY PICKER' : 'LUCKY PICKER';
}

let slotWagerFrac = 0; // currently selected fraction

function slotPreset(frac, btn) {
    slotWagerFrac = frac;
    const amount = Math.max(1, Math.floor(cotton * frac));
    const disp = document.getElementById('slotCurrentWager');
    if (disp) disp.textContent = amount.toLocaleString() + ' ' + getWordLower();
    // Highlight selected button
    document.querySelectorAll('.slot-wager-preset').forEach(b => b.classList.remove('selected'));
    if (btn) btn.classList.add('selected');
    sfxCoin();
}

function seedIdleReels() {
    const pool = getSlotRandSyms();
    for (let r = 0; r < 3; r++) {
        const inner = document.getElementById('slotReelInner' + r);
        if (!inner) continue;
        inner.style.transition = 'none';
        inner.style.transform = 'translateY(0)';
        inner.innerHTML = '';
        for (let i = 0; i < 3; i++) {
            inner.appendChild(makeSymCell(pool[Math.floor(Math.random() * pool.length)]));
        }
    }
}

function slotWeightedPick() {
    const total = SLOT_OUTCOMES.reduce((s, o) => s + o.weight, 0);
    let r = Math.random() * total;
    for (const o of SLOT_OUTCOMES) { r -= o.weight; if (r < 0) return o; }
    return SLOT_OUTCOMES[SLOT_OUTCOMES.length - 1];
}


function handlePull() {
    if (slotSpinning) return;
    sfxLeverPull();
    // Button press animation
    const btn = document.getElementById('slotPullBtn');
    if (btn) {
        btn.style.transform = 'scale(0.93)';
        btn.style.boxShadow = '0 1px 0 #440000, inset 0 2px 4px rgba(0,0,0,0.4)';
        setTimeout(() => {
            btn.style.transform = '';
            btn.style.boxShadow = '';
        }, 200);
    }
    setTimeout(doSlotSpin, 120);
}

function doSlotSpin() {
    if (slotSpinning) return;
    const wager = Math.max(1, Math.floor(cotton * slotWagerFrac));
    if (!slotWagerFrac || wager < 1) { showFloatingMsg('Select a wager first!'); return; }
    if (wager > cotton) { showFloatingMsg('Not enough ' + getWordLower() + '!'); return; }

    cotton -= wager;
    updateDisplay();

    slotSpinning = true;

    const msgEl = document.getElementById('slotResultMsg');
    if (msgEl) { msgEl.textContent = 'Good luck...'; msgEl.className = ''; }

    const outcome = slotWeightedPick();
    const randSyms = getSlotRandSyms();
    let winSyms = getSlotWinSyms(outcome.id);

    // Loss patterns — generate visual "tells"
    if (outcome.id === 'lose_all') {
        // Total random mess — pick 3 completely different symbols
        const pool = [...randSyms].sort(() => Math.random()-0.5);
        winSyms = [pool[0], pool[1], pool[2]];
    } else if (outcome.id === 'lose_half') {
        // One diamond in a random reel position, rest junk
        const dPos = Math.floor(Math.random()*3);
        winSyms = [0,1,2].map(i => i===dPos ? 'diamond' : randSyms[Math.floor(Math.random()*randSyms.length)]);
        // make sure non-diamond aren't diamond
        winSyms = winSyms.map((s,i) => (s==='diamond'&&i!==dPos) ? 'club' : s);
    } else if (outcome.id === 'lose_20') {
        // Two diamonds in two random reel positions, rest junk
        const positions = [0,1,2].sort(()=>Math.random()-0.5).slice(0,2);
        winSyms = [0,1,2].map(i => positions.includes(i) ? 'diamond' : randSyms[Math.floor(Math.random()*randSyms.length)]);
        // ensure non-diamond positions aren't accidentally diamond
        winSyms = winSyms.map((s,i) => (s==='diamond'&&!positions.includes(i)) ? 'club' : s);
    }

    // Start bwododudodudo sound
    sfxSpinStart();

    // Staggered starts, all spinning simultaneously, staggered stops
    // Fast: each reel takes ~2.5-3s total (spin starts quick)
    const REEL_START = [0, 180, 360];
    const REEL_STOP  = [2800, 3400, 4000];

    for (let r = 0; r < 3; r++) {
        const startAt = REEL_START[r];
        const spinDur = REEL_STOP[r] - REEL_START[r];
        setTimeout(() => {
            spinReel(r, winSyms[r], randSyms, spinDur);
            // Bing when this reel stops
            setTimeout(() => {
                sfxSpinStop();
                sfxReelBing(r);
                const reel = document.getElementById('slotReel' + r);
                if (reel) {
                    reel.style.boxShadow = '0 0 18px #f0d800, inset 0 0 8px #aa8800';
                    setTimeout(() => { if (reel) reel.style.boxShadow = ''; }, 700);
                }
            }, spinDur);
        }, startAt);
    }

    const totalTime = REEL_STOP[2] + 450;
    setTimeout(() => {
        sfxSpinStop();
        applySlotOutcome(outcome, wager);
        slotSpinning = false;
    }, totalTime);
}

function spinReel(reelIdx, finalSym, randSyms, totalMs) {
    const inner = document.getElementById('slotReelInner' + reelIdx);
    if (!inner) return;

    const CELL_H = 60; // .slot-symbol height
    // Build a VERY long strip so it blurs during fast spin
    const STRIP  = 60;
    const WIN_IDX = STRIP - 2;

    inner.style.transition = 'none';
    inner.style.transform = 'translateY(0)';
    inner.innerHTML = '';

    for (let i = 0; i < STRIP; i++) {
        const sym = (i === WIN_IDX) ? finalSym : randSyms[Math.floor(Math.random() * randSyms.length)];
        inner.appendChild(makeSymCell(sym));
    }

    const targetY = -(WIN_IDX * CELL_H) + CELL_H;
    void inner.offsetWidth;

    // Phase 1: BLUR-FAST (linear, full speed) for most of duration
    const fastMs = totalMs * 0.88;
    // Phase 2: Hard stop in last 12% with slight decelerate
    inner.style.transition = `transform ${fastMs}ms linear`;
    // Overshoot past winner a bit then snap back
    const overY = targetY - CELL_H * 0.4;
    inner.style.transform = `translateY(${overY}px)`;

    // Snap to exact position
    setTimeout(() => {
        inner.style.transition = `transform ${totalMs * 0.12}ms cubic-bezier(0.0, 0.0, 0.2, 1)`;
        inner.style.transform = `translateY(${targetY}px)`;
    }, fastMs);
}

function applySlotOutcome(outcome, wager) {
    const msgEl = document.getElementById('slotResultMsg');
    let returnAmt = 0;
    let msg = '';

    if (outcome.id === 'lose_all') {
        returnAmt = 0;
        msg = '💀 Lost it all! ' + wager.toLocaleString() + ' ' + getWordLower() + ' gone.';
    } else if (outcome.id === 'lose_half') {
        returnAmt = Math.floor(wager * 0.5);
        cotton += returnAmt;
        msg = '💔 Lost half — got ' + returnAmt.toLocaleString() + ' back.';
    } else if (outcome.id === 'lose_20') {
        returnAmt = Math.floor(wager * 0.8);
        cotton += returnAmt;
        msg = '✖ Lost 20% — got ' + returnAmt.toLocaleString() + ' back.';
    } else if (outcome.freeCrate) {
        returnAmt = wager;
        cotton += returnAmt;
        addToInventory('normal', 1);
        msg = '📦 Free crate added to inventory! Wager returned.';
    } else {
        returnAmt = Math.floor(wager * outcome.mult);
        cotton += returnAmt;
        const net = returnAmt - wager;
        msg = (outcome.mult >= 3 ? '🎉 ' : '✅ ') + outcome.label +
            ' — received ' + returnAmt.toLocaleString() + ' (+' + net.toLocaleString() + ' net)';
    }

    const netGain = returnAmt - wager;
    if (netGain > 0) { totalCottonEarned += netGain; checkAchievements(); }

    updateDisplay();
    saveGame();

    if (msgEl) { msgEl.textContent = msg; msgEl.className = outcome.cls || ''; }

    // Reset wager selection after each spin so player must pick again
    slotWagerFrac = 0;
    document.querySelectorAll('.slot-wager-preset').forEach(b => b.classList.remove('selected'));
    const disp = document.getElementById('slotCurrentWager');
    if (disp) disp.textContent = 'Select amount below';

    if (outcome.cls === 'win' || outcome.cls === 'jackpot') {
        const colour = outcome.cls === 'jackpot' ? '#aa00cc' : '#c09830';
        for (let r = 0; r < 3; r++) {
            const reel = document.getElementById('slotReel' + r);
            if (!reel) continue;
            reel.style.borderColor = colour;
            reel.style.boxShadow = `0 0 8px ${colour}88`;
            setTimeout(() => { reel.style.borderColor = '#4a2a08'; reel.style.boxShadow = ''; }, 1200);
        }
    }
}

// toggleSlotOdds removed — odds are hidden
document.addEventListener('DOMContentLoaded', () => {
    // Business name screen
    const confirmBtn = document.getElementById('confirmNameBtn');
    if (confirmBtn) confirmBtn.addEventListener('click', confirmBusinessName);

    const bnInput = document.getElementById('businessNameInput');
    if (bnInput) bnInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') confirmBusinessName();
    });

    // Secret code modal
    const secInput = document.getElementById('secretInput');
    if (secInput) secInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') submitSecretCode();
        if (e.key === 'Escape') closeSecretModal();
    });

    // Wire up all button handlers
    initHandlers();

    // Start smooth cotton counter
    requestAnimationFrame(animateCottonDisplay);

    // Load save and start autosave
    loadGame();
    setInterval(saveGame, 5000);
});
