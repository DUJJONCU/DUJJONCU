// --- [1. Firebase 설정] ---
const firebaseConfig = {
    apiKey: "AIzaSyBCuJM2V5d4f803lSRG-Lx1hxVnqNBnHTw",
    authDomain: "dujjoncu-3094e.firebaseapp.com",
    databaseURL: "https://dujjoncu-3094e-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "dujjoncu-3094e",
    storageBucket: "dujjoncu-3094e.firebasestorage.app",
    messagingSenderId: "874617692321",
    appId: "1:874617692321:web:5e1a608a9dfdb7a98210e0",
    measurementId: "G-GE1K18P88X"
};

let db;
try {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    db = firebase.database();
} catch (e) { console.error("DB 연결 실패", e); }

// --- [2. 전역 변수 및 설정] ---
let userData = null;
let lastClick = 0;
let bubbleTimer = null;
let isSleeping = false;
let lastInteractionTime = Date.now();
let crisisTimer = null;
let comboCount = 0;
let comboTimer = null;

const GRADES = {
    Common: { name: "커먼", color: "#bdc3c7", power: 1.2, chance: 0.739 },
    Uncommon: { name: "언커먼", color: "#2ecc71", power: 1.5, chance: 0.20 },
    Rare: { name: "레어", color: "#3498db", power: 2.5, chance: 0.05 },
    Epic: { name: "에픽", color: "#9b59b6", power: 6.0, chance: 0.01 },
    Legendary: { name: "레전드", color: "#f1c40f", power: 25.0, chance: 0.001 }
};

const TITLES = [
    { lv: 0, name: "밀가루 반죽" }, { lv: 10, name: "오븐 구경꾼" },
    { lv: 50, name: "바삭한 쿠키" }, { lv: 150, name: "은색의 미식가" },
    { lv: 500, name: "황금 요리사" }
];

const DIALOGUES = {
    mzMeme: ["럭키비키잖아! 🍀", "주인님 폼 미쳤다..ㄷㄷ", "갓생 가보자고!", "오히려 좋아!", "꺾이지 않는 마음!"],
    hungry: ["배고파요..", "꼬르륵..", "현기증 난단 말이에요"],
    depressed: ["우울해.. 놀아줘요..", "기운이 하나도 없어..", "쿠키 인생 허무하다.."],
    sleeping: ["Zzz..", "꿈속에서 굽는 중..", "5분만 더.."]
};

// --- [3. 핵심 공식 함수] ---
function calculateStats() {
    if (!userData) return { tapPower: 10, luck: 5, hgDrain: 0.5, comboTime: 1500 };

    let basePower = 10 + (userData.lv * 2);
    let equipMult = 1;      
    let hgReduction = 0;    
    let extraLuck = 0;      
    let extraCombo = 0;     

    if (userData.inventory) {
        if (userData.inventory.weapon) equipMult *= userData.inventory.weapon.power;
        if (userData.inventory.helmet) equipMult *= userData.inventory.helmet.power;
        if (userData.inventory.armor) hgReduction = (userData.inventory.armor.power * 0.05);
        if (userData.inventory.boots) extraCombo = (userData.inventory.boots.power * 100);
        if (userData.inventory.accessory) extraLuck = (userData.inventory.accessory.power * 2);
    }

    const titleBonus = 1 + (TITLES.filter(t => userData.lv >= t.lv).length * 0.02);
    const moodBonus = 1 + (userData.mood / 100);
    const comboBonus = 1 + (Math.floor(comboCount / 10) * 0.1);

    return {
        tapPower: basePower * equipMult * titleBonus * moodBonus * comboBonus,
        luck: 5 + extraLuck,
        hgDrain: Math.max(0.1, (0.5 + (userData.lv * 0.005)) - hgReduction),
        comboTime: 1500 + extraCombo
    };
}

// --- [4. 인증 및 로그인] ---
async function handleAuth() {
    const id = document.getElementById('user-id-input').value.trim();
    const pw = document.getElementById('user-pw-input').value.trim();
    if (id.length < 4 || pw.length < 4) return alert("ID/PW를 4자 이상 입력해주세요!");

    try {
        const snap = await db.ref(`users/${id}`).once('value');
        const saved = snap.val();

        if (saved) {
            if (saved.password === pw) {
                userData = saved;
                repairData();
                loginSuccess();
            } else alert("비밀번호가 틀렸습니다.");
        } else {
            if (confirm(`'${id}'로 새로 시작할까요?`)) {
                userData = {
                    id, password: pw, lv: 1, xp: 0, hg: 100, shards: 0, foodCount: 5, mood: 50,
                    inventory: { weapon: null, armor: null, boots: null, helmet: null, accessory: null },
                    collections: { items: [], titles: [] },
                    isAdventuring: false, adventureEndTime: 0
                };
                await db.ref(`users/${id}`).set(userData);
                loginSuccess();
            }
        }
    } catch (e) { alert("연결 실패!"); }
}

function repairData() {
    if (!userData.inventory) userData.inventory = { weapon: null, armor: null, boots: null, helmet: null, accessory: null };
    if (userData.inventory.helmet === undefined) userData.inventory.helmet = null;
    if (userData.inventory.boots === undefined) userData.inventory.boots = null;
    if (!userData.collections) userData.collections = { items: [], titles: [] };
    if (userData.mood === undefined) userData.mood = 50;
    if (userData.shards === undefined) userData.shards = 0;
}

function loginSuccess() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
    updateRanking(); 
    updateWeather();
    setInterval(updateRanking, 60000);
    setInterval(gameLoop, 1000);
}

// --- [5. 게임 루프] ---
function gameLoop() {
    if (!userData) return;
    checkGroggy();
    checkFoodSupply();

    if (isSleeping) {
        userData.hg = Math.min(100, userData.hg + 0.3);
        userData.mood = Math.min(100, userData.mood + 0.2);
        createZzz();
        if(userData.hg >= 100) isSleeping = false; // 배부르면 잠에서 깸
    } else {
        userData.mood = Math.max(0, userData.mood - 0.05);
    }

    if (Date.now() - lastInteractionTime > 12000) {
        let pool = isSleeping ? DIALOGUES.sleeping : (userData.hg < 30 ? DIALOGUES.hungry : (userData.mood < 30 ? DIALOGUES.depressed : DIALOGUES.mzMeme));
        showBubble(pool[Math.floor(Math.random() * pool.length)]);
        lastInteractionTime = Date.now();
    }

    if (userData.isAdventuring && Date.now() >= userData.adventureEndTime) {
        userData.isAdventuring = false;
        const reward = Math.floor(Math.random() * 51) + 30;
        userData.shards += reward;
        alert(`🏹 탐험 완료! 조각 ${reward}개 획득!`);
        saveData();
    }
    updateUI();
}

// --- [6. 메인 액션] ---
function handleTap() {
    if (!userData || isSleeping || userData.isAdventuring || crisisTimer) return;
    if (userData.hg <= 0) return showBubble("배고파서 기운이 없어요..");

    const stats = calculateStats();
    const now = Date.now();
    if (now - lastClick < 80) return;
    lastClick = now;
    lastInteractionTime = now;

    comboCount++;
    clearTimeout(comboTimer);
    showComboUI(comboCount);
    comboTimer = setTimeout(() => { comboCount = 0; hideComboUI(); }, stats.comboTime);

    let isCritical = (Math.random() * 100) < stats.luck;
    let gainedXp = stats.tapPower * (isCritical ? 3 : 1);

    userData.xp += gainedXp;
    userData.hg = Math.max(0, userData.hg - stats.hgDrain);
    userData.mood = Math.min(100, userData.mood + 0.2);

    const img = document.getElementById('character-img');
    img.style.transform = `scale(${isCritical ? 1.2 : 1.1}) rotate(${Math.random() * 10 - 5}deg)`;
    if (isCritical) {
        showBubble("💥 CRITICAL!!");
        triggerCriticalEffect();
    }
    if (userData.mood >= 50) createSparkle();

    checkLevelUp();
    updateUI();
}

function checkLevelUp() {
    const nextXP = Math.floor(Math.pow(userData.lv, 2.8) * 300 * 1.5); 
    if (userData.xp >= nextXP) {
        userData.lv++;
        userData.foodCount = Math.min(10, userData.foodCount + 2); 
        showBubble("🎉 LEVEL UP!! Lv." + userData.lv);
        triggerLevelUpEffect();
        saveData();
    }
}

function handleFeed() {
    if (userData.foodCount > 0 && userData.hg < 100) {
        userData.foodCount--;
        userData.hg = Math.min(100, userData.hg + 30);
        userData.mood = Math.min(100, userData.mood + 10);
        showBubble("냠냠! 맛있다 🍪");
        saveData();
        updateUI();
    } else alert("먹이가 부족하거나 배부릅니다!");
}

// --- [7. UI 및 모달] ---
function updateUI() {
    if (!userData) return;

    const prevXP = userData.lv === 1 ? 0 : Math.floor(Math.pow(userData.lv - 1, 2.8) * 300 * 1.5);
    const nextXP = Math.floor(Math.pow(userData.lv, 2.8) * 300 * 1.5);

    const requiredXPInThisLevel = nextXP - prevXP;
    const currentXPInThisLevel = userData.xp - prevXP;
    
    let xpPercent = ((currentXPInThisLevel / requiredXPInThisLevel) * 100).toFixed(2);
    if (xpPercent < 0) xpPercent = "0.00";
    if (xpPercent > 100) xpPercent = "100.00";

    const expBar = document.getElementById('exp-bar');
    if (expBar) expBar.style.width = xpPercent + "%";
    const expLabel = document.getElementById('exp-label');
    if (expLabel) expLabel.innerText = xpPercent + "%";

    const hgBar = document.getElementById('hungry-bar');
    if (hgBar) hgBar.style.width = userData.hg + "%";
    document.getElementById('hg-label').innerText = `😋 ${Math.floor(userData.hg)}%`;

    const moodBar = document.getElementById('mood-bar');
    if (moodBar) moodBar.style.width = userData.mood + "%";
    document.getElementById('mood-label').innerText = `🎭 ${Math.floor(userData.mood)}%`;

    document.getElementById('food-val').innerText = `${userData.foodCount}/10`;
    document.getElementById('shard-val').innerText = userData.shards.toLocaleString();
}

function openModal() {
    const modal = document.getElementById('game-modal');
    const content = document.getElementById('modal-tab-content');
    if (!modal || !content) return;
    modal.classList.add('active');
    
    let html = `
        <div style="text-align:center; margin-bottom:15px;"><h2 style="color:#14F195; margin:0; font-size:18px;">📜 전체 메뉴</h2></div>
        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:8px; margin-bottom:15px;">
            <div onclick="showMenuDetail('m-equip')" style="background:#333; color:#fff; border:1px solid #9945FF; height:50px; border-radius:10px; display:flex; justify-content:center; align-items:center; font-size:11px; cursor:pointer;">⚔️ 장비</div>
            <div onclick="showMenuDetail('m-dungeon')" style="background:#333; color:#fff; border:1px solid #9945FF; height:50px; border-radius:10px; display:flex; justify-content:center; align-items:center; font-size:11px; cursor:pointer;">🏹 탐험</div>
            <div onclick="showMenuDetail('m-rank')" style="background:#333; color:#fff; border:1px solid #9945FF; height:50px; border-radius:10px; display:flex; justify-content:center; align-items:center; font-size:11px; cursor:pointer;">🏆 순위</div>
        </div>
        <div id="menu-detail-area" style="min-height:160px; background:rgba(0,0,0,0.3); border-radius:10px; padding:10px; border:1px solid #333;">
            <p style="text-align:center; color:#666; font-size:11px; margin-top:60px;">메뉴를 선택하세요.</p>
        </div>
        <button onclick="closeModal()" style="background:#FF4757; width:100%; margin-top:15px; padding:12px; border:none; border-radius:10px; color:white; font-weight:bold; cursor:pointer;">닫기</button>
    `;
    content.innerHTML = html;
}

async function showMenuDetail(menuId) {
    const detailArea = document.getElementById('menu-detail-area');
    let html = '';

    if (menuId === 'm-equip') {
        const parts = { weapon: "⚔️ 무기", helmet: "🪖 투구", armor: "👕 갑옷", boots: "👟 신발", accessory: "💍 악세" };
        html = `<b style="color:#9945FF; font-size:12px;">📦 장비 제작 (500💎)</b><div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-top:8px; max-height:150px; overflow-y:auto;">`;
        for (let key in parts) {
            const item = userData.inventory[key];
            const gName = item ? GRADES[item.grade].name : "미착용";
            const gColor = item ? GRADES[item.grade].color : "#555";
            html += `<div style="background:#222; padding:8px; border-radius:8px; border:1px solid ${gColor}; text-align:center;">
                        <span style="font-size:9px; color:#aaa;">${parts[key]}</span><br>
                        <b style="color:${gColor}; font-size:10px;">${gName}</b>
                        <button onclick="craftInMenu('${key}')" style="margin-top:5px; font-size:9px; width:100%; cursor:pointer;">제작</button>
                    </div>`;
        }
        html += `</div>`;
    } else if (menuId === 'm-rank') {
        detailArea.innerHTML = "로딩 중...";
        const snap = await db.ref('users').once('value');
        const ranks = Object.values(snap.val() || {}).sort((a, b) => b.xp - a.xp).slice(0, 5);
        html = `<b style="color:#f1c40f;">🏆 TOP 5</b><div style="margin-top:5px;">` + 
               ranks.map((u, i) => `<div style="font-size:11px; margin-bottom:3px;">${i+1}. ${u.id} (Lv.${u.lv})</div>`).join('') + `</div>`;
    } else if (menuId === 'm-dungeon') {
        html = `<b style="color:#14F195;">🏹 원격 탐험</b><p style="font-size:10px; color:#aaa;">조각을 찾아 떠납니다 (5분)</p>
                <button onclick="startAdventureInMenu()" style="width:100%; padding:10px; background:#14F195; border:none; border-radius:5px; color:#000; font-weight:bold; cursor:pointer;">${userData.isAdventuring ? '탐험 중...' : '출발 (40 HG)'}</button>`;
    }
    detailArea.innerHTML = html;
}

// --- [8. 보조 함수들] ---
function craftInMenu(type) {
    if (userData.shards < 500) return alert("조각이 부족합니다!");
    userData.shards -= 500;
    const rand = Math.random();
    let grade = "Common", cum = 0;
    for (let g in GRADES) { cum += GRADES[g].chance; if (rand <= cum) { grade = g; break; } }
    userData.inventory[type] = { grade, power: GRADES[grade].power };
    alert(`🔨 [${GRADES[grade].name}] ${type} 제작 완료!`);
    saveData(); showMenuDetail('m-equip');
}

function startAdventureInMenu() {
    if (userData.isAdventuring) return;
    if (userData.hg < 40) return alert("배고파요!");
    userData.hg -= 40;
    userData.isAdventuring = true;
    userData.adventureEndTime = Date.now() + (5 * 60 * 1000);
    saveData(); showMenuDetail('m-dungeon');
}

function saveData() { if (userData && db) db.ref(`users/${userData.id}`).set(userData); }
function closeModal() { document.getElementById('game-modal').classList.remove('active'); }

function showBubble(msg) {
    const b = document.getElementById('speech-bubble');
    if(!b) return;
    b.innerText = msg; b.style.display = 'block';
    if(bubbleTimer) clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => b.style.display = 'none', 2500);
}

function showComboUI(c) {
    let el = document.getElementById('combo-display');
    if(!el) {
        el = document.createElement('div'); 
        el.id = 'combo-display';
        const container = document.getElementById('game-container');
        if(container) container.appendChild(el);
    }
    // 텍스트 설정 (숫자 강조)
    el.innerHTML = `<span style="font-size: 32px; color: #FF4757;">${c}</span> COMBO!`; 
    el.style.display = 'block';
    // 애니메이션 초기화
    el.style.animation = 'none';
    el.offsetHeight; /* 강제 리플로우 */
    el.style.animation = 'combo-pop 0.3s ease-out forwards';
}
function hideComboUI() { const el = document.getElementById('combo-display'); if(el) el.style.display = 'none'; }

function createZzz() {
    const char = document.getElementById('character-img');
    const z = document.createElement('div'); z.className = 'zzz-particle'; z.innerText = 'Z';
    const rect = char.getBoundingClientRect();
    z.style.left = (rect.right - 50) + 'px'; z.style.top = (rect.top + 30) + 'px';
    document.body.appendChild(z); setTimeout(() => z.remove(), 2000);
}

function createSparkle() {
    const char = document.getElementById('character-img');
    const rect = char.getBoundingClientRect();
    const s = document.createElement('div'); s.innerText = "✨";
    s.style.cssText = `position:fixed; left:${rect.left + Math.random() * rect.width}px; top:${rect.top}px; font-size:20px; pointer-events:none; transition:0.8s; z-index:100;`;
    document.body.appendChild(s);
    setTimeout(() => { s.style.transform = `translate(0, -100px)`; s.style.opacity = '0'; }, 20);
    setTimeout(() => s.remove(), 800);
}

function triggerLevelUpEffect() {
    for(let i=0; i<15; i++) {
        const s = document.createElement('div'); s.innerText = "⭐";
        s.style.cssText = `position:fixed; left:${Math.random()*100}vw; top:${Math.random()*100}vh; z-index:3000; animation: flare 1s forwards;`;
        document.body.appendChild(s); setTimeout(() => s.remove(), 1000);
    }
}

function triggerCriticalEffect() {
    const img = document.getElementById('character-img');
    img.style.filter = "brightness(2)";
    setTimeout(() => img.style.filter = "", 150);
}

function updateWeather() {
    const el = document.getElementById('weather-display');
    const ws = ["☀️ 맑음", "☁️ 구름", "🌧️ 비", "❄️ 눈"];
    if(el) el.innerText = `현재 날씨: ${ws[Math.floor(Math.random()*ws.length)]}`;
}

async function updateRanking() {
    const snap = await db.ref('users').once('value');
    const top10 = Object.values(snap.val() || {}).sort((a,b)=>b.xp-a.xp).slice(0, 10);
    const el = document.getElementById('ranking-list');
    if(el) el.innerText = top10.map((u,i)=>`${i+1}위: ${u.id}`).join(" | ");
}

function checkGroggy() { if (userData.hg <= 0) isSleeping = true; }

function checkFoodSupply() {
    const now = new Date();
    const h = now.getHours();
    const supply = [22, 4, 10, 16];
    let slot = "";
    supply.forEach(sh => { if(h >= sh && h < sh+6) slot = `${now.getDate()}-${sh}`; });
    if(slot && userData.lastFoodSlot !== slot) {
        userData.foodCount = Math.min(10, userData.foodCount + 2);
        userData.lastFoodSlot = slot;
        showBubble("🎁 정기 보급 완료!");
        saveData(); updateUI();
    }
}