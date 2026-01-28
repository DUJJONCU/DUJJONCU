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

// --- [2. 전역 변수] ---
let userData = null;
let lastClick = 0;
let bubbleTimer = null;
let isSleeping = false;
let lastInteractionTime = Date.now();

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
    worker: ["퇴근하고 싶다..", "월요병엔 쿠키가 약..", "커피 수혈 필요..", "금융치료 시급.."],
    hungry: ["배고파요..", "꼬르륵..", "현기증 난단 말이에요"],
    sleeping: ["Zzz..", "꿈속에서 굽는 중..", "5분만 더.."]
};

// --- [3. 로그인 및 메인 루프] ---

async function handleAuth() {
    const id = document.getElementById('user-id-input').value.trim();
    const pw = document.getElementById('user-pw-input').value.trim();
    if (id.length < 4 || pw.length < 4) return alert("ID/PW 4자 이상!");

    try {
        const snap = await db.ref(`users/${id}`).once('value');
        const saved = snap.val();
        if (saved) {
            if (saved.password === pw) { userData = saved; loginSuccess(); }
            else alert("비밀번호가 틀렸습니다.");
        } else {
            if (confirm(`'${id}'로 새로 시작할까요?`)) {
                userData = {
                    id, password: pw, lv: 1, xp: 0, hg: 100, shards: 0, foodCount: 5, mood: 50,
                    inventory: { weapon: null, armor: null, boots: null, helmet: null },
                    isAdventuring: false, adventureEndTime: 0, groggyEndTime: null, sleepEndTime: null
                };
                await db.ref(`users/${id}`).set(userData);
                loginSuccess();
            }
        }
    } catch (e) { alert("서버 연결 실패!"); }
}

function loginSuccess() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
    updateWeather();
    updateRanking();
    checkGroggy();
    setInterval(updateWeather, 60000);
    setInterval(updateRanking, 60000);
    setInterval(gameLoop, 1000);
}

function gameLoop() {
    if (!userData) return;
    checkGroggy();

    const now = new Date();
    const kstHour = new Date(now.getTime() + (9 * 3600000)).getUTCHours();
    const rewardHours = [4, 10, 16, 22];
    if (rewardHours.includes(kstHour) && localStorage.getItem('lastReward') != kstHour) {
        userData.foodCount = Math.min(10, userData.foodCount + 3);
        localStorage.setItem('lastReward', kstHour);
        showBubble("🎁 정기 보너스! 쿠키 +3");
        saveData();
    }

    if (isSleeping) {
        userData.hg = Math.min(100, userData.hg + 0.3);
        userData.mood = Math.min(100, userData.mood + 0.2);
        createZzz();
    } else {
        userData.mood = Math.max(0, userData.mood - 0.05);
    }

    const idleTime = Date.now() - lastInteractionTime;
    if (idleTime > 12000) {
        let pool = isSleeping ? DIALOGUES.sleeping : (userData.hg < 30 ? DIALOGUES.hungry : DIALOGUES.mzMeme);
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

// --- [4. 게임 액션 함수] ---

function handleTap() {
    if (!userData || isSleeping || userData.isAdventuring) return;
    if (userData.hg <= 0) return showBubble("배고파서 기운이 없어요..");

    const now = Date.now();
    if (now - lastClick < 80) return;
    lastClick = now;
    lastInteractionTime = now;

    let power = 1.0;
    if (userData.inventory) {
        for (let k in userData.inventory) { 
            if (userData.inventory[k]) power *= userData.inventory[k].power; 
        }
    }
    
    const moodBonus = 1 + (userData.mood / 100);
    userData.xp += 10 * power * moodBonus;
    userData.hg = Math.max(0, userData.hg - (1.0 + userData.lv * 0.02));

    const img = document.getElementById('character-img');
    img.classList.remove('shake');
    void img.offsetWidth;
    img.classList.add('shake');

    checkLevelUp();
    saveData();
}

function handleFeed() {
    if (userData.foodCount > 0 && userData.hg < 100) {
        userData.foodCount--;
        userData.hg = Math.min(100, userData.hg + 30);
        showBubble("냠냠! 맛있다 🍪");
        saveData();
    } else if (userData.foodCount <= 0) alert("먹이가 부족합니다!");
}

function toggleSleep() {
    const now = Date.now();
    const charImg = document.getElementById('character-img');
    const btns = document.querySelectorAll('.action-btn');

    if (!isSleeping) {
        isSleeping = true;
        userData.sleepEndTime = now + (30 * 60 * 1000); 
        charImg.classList.add('sleeping');
        showBubble("💤 30분간 휴식합니다... (조작 불가)");
        btns.forEach(b => { if(!b.classList.contains('sleep')) b.disabled = true; });
        saveData();
    } else {
        if (userData.sleepEndTime && now < userData.sleepEndTime) {
            const remainMin = Math.ceil((userData.sleepEndTime - now) / 60000);
            alert(`아직 더 자야 해요! ${remainMin}분 남았습니다.`);
            return;
        }
        isSleeping = false;
        userData.sleepEndTime = null;
        charImg.classList.remove('sleeping');
        showBubble("☀️ 잘 자고 일어났다!");
        btns.forEach(b => b.disabled = false);
        saveData();
    }
}

// --- [5. UI 및 시스템 함수] ---

function updateUI() {
    if (!userData) return;
    
    const titleData = TITLES.filter(t => userData.lv >= t.lv).slice(-1)[0];
    document.getElementById('user-title').innerText = `[${titleData.name}]`;
    
    // [강력 수정] 숫자를 강제로 제거하여 깔끔한 ID만 표시
    let cleanId = userData.id.toString().replace(/[0-9]/g, '').trim(); 
    if (cleanId === "") cleanId = userData.id;

    document.getElementById('level-display').innerText = `Lv.${userData.lv} ${cleanId}`;

    const nextXP = Math.floor(Math.pow(userData.lv, 2.8) * 300);
    document.getElementById('exp-bar').style.width = Math.min(100, (userData.xp/nextXP)*100) + "%";
    document.getElementById('exp-label').innerText = `${Math.floor(userData.xp).toLocaleString()} / ${nextXP.toLocaleString()} XP`;
    document.getElementById('hungry-bar').style.width = userData.hg + "%";
    document.getElementById('hg-label').innerText = `${Math.floor(userData.hg)} / 100 HG`;
    document.getElementById('food-count-display').innerText = `🍪 남은 먹이: ${userData.foodCount}/10`;
}

function checkGroggy() {
    if (!userData) return;
    const now = Date.now();
    const charImg = document.getElementById('character-img');
    const btns = document.querySelectorAll('.action-btn');

    const groggyTime = userData.groggyEndTime || 0;
    const sleepTime = userData.sleepEndTime || 0;
    const finishTime = Math.max(groggyTime, sleepTime);

    if (finishTime > now) {
        isSleeping = true;
        charImg.classList.add('sleeping');
        const remainMin = Math.ceil((finishTime - now) / 60000);
        
        if (userData.groggyEndTime) showBubble(`😵 기절 중.. (${remainMin}분 남음)`);
        else showBubble(`💤 휴식 중.. (${remainMin}분 남음)`);
        
        btns.forEach(b => { if(!b.classList.contains('sleep')) b.disabled = true; });
    } else if (userData.hg <= 0) {
        if(!userData.groggyEndTime) { 
            userData.groggyEndTime = now + (6 * 60 * 60 * 1000); 
            saveData(); 
        }
        isSleeping = true;
        charImg.classList.add('sleeping');
        btns.forEach(b => { if(!b.classList.contains('sleep')) b.disabled = true; });
    } else {
        if (userData.groggyEndTime || userData.sleepEndTime) {
            userData.groggyEndTime = null;
            userData.sleepEndTime = null;
            saveData();
        }
        if (isSleeping) {
            isSleeping = false;
            charImg.classList.remove('sleeping');
            btns.forEach(b => b.disabled = false);
        }
    }
}

function updateWeather() {
    const hour = new Date().getHours();
    const screen = document.getElementById('screen');
    let bg = (hour >= 6 && hour < 18) ? "linear-gradient(180deg, #74ebd5, #ACB6E5)" : "linear-gradient(180deg, #141E30, #243B55)";
    if(screen) screen.style.background = bg;
}

async function updateRanking() {
    try {
        const snapshot = await db.ref('users').orderByChild('xp').limitToLast(10).once('value');
        let ranks = [];
        snapshot.forEach(snap => { ranks.push(snap.val()); });
        ranks.reverse();
        const text = ranks.map((u, i) => `${i+1}위: ${u.id}(Lv.${u.lv})`).join("  |  ");
        const el = document.getElementById('ranking-list');
        if(el) el.innerText = text;
    } catch(e) { console.log(e); }
}

function checkLevelUp() {
    const nextXP = Math.floor(Math.pow(userData.lv, 2.8) * 300);
    if (userData.xp >= nextXP) {
        userData.xp = 0;
        userData.lv++;
        userData.foodCount = Math.min(10, userData.foodCount + 5);
        showBubble("🎉 LEVEL UP!!");
    }
}

function saveData() { if (userData && db) db.ref(`users/${userData.id}`).set(userData); }

function showBubble(msg) {
    const b = document.getElementById('speech-bubble');
    if(!b) return;
    b.innerText = msg; b.style.display = 'block';
    if(bubbleTimer) clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => b.style.display = 'none', 2500);
}

function createZzz() {
    const char = document.getElementById('character-img');
    const z = document.createElement('div');
    z.className = 'zzz-particle'; z.innerText = 'Z';
    const rect = char.getBoundingClientRect();
    z.style.left = (rect.right - 50) + 'px';
    z.style.top = (rect.top + 30) + 'px';
    document.body.appendChild(z);
    setTimeout(() => z.remove(), 2000);
}

// --- [6. 메뉴 모달 시스템] ---

function openModal() {
    const modal = document.getElementById('game-modal');
    if(modal) modal.classList.add('active');
    viewMenu();
}

function closeModal() { document.getElementById('game-modal').classList.remove('active'); }

function viewMenu() {
    document.getElementById('modal-tab-content').innerHTML = `
        <h2 style="color:#14F195;">📜 MENU</h2>
        <div style="display:flex; flex-direction:column; gap:10px;">
            <button class="solana-btn" onclick="viewStorage()" style="padding:15px;">📦 가방 및 장비제작</button>
            <button class="solana-btn" onclick="viewDungeon()" style="padding:15px;">🏹 던전 탐험</button>
            <button class="solana-btn" onclick="closeModal()" style="background:#555; padding:10px;">닫기</button>
        </div>
    `;
}

function viewStorage() {
    if(!userData.inventory) userData.inventory = { weapon: null, armor: null, boots: null, helmet: null };
    const inv = userData.inventory;
    const parts = { weapon: "⚔️ 무기", armor: "👕 방어구", boots: "👟 신발", helmet: "🪖 투구" };
    
    let html = `<h3 style="color:#9945FF;">📦 가방 (보유 조각: ${userData.shards || 0})</h3>`;
    html += `<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:20px;">`;
    
    for (let key in parts) {
        const item = inv[key];
        const gradeName = item ? GRADES[item.grade].name : "미착용";
        const gradeColor = item ? GRADES[item.grade].color : "#666";
        html += `
            <div style="background:#333; padding:10px; border-radius:10px; border:1px solid ${gradeColor};">
                <small style="color:#aaa;">${parts[key]}</small><br>
                <b style="color:${gradeColor};">${gradeName}</b><br>
                <button onclick="craftItem('${key}')" style="margin-top:5px; font-size:10px; cursor:pointer;">제작(500💎)</button>
            </div>`;
    }
    html += `</div><button class="solana-btn" onclick="viewMenu()">뒤로가기</button>`;
    document.getElementById('modal-tab-content').innerHTML = html;
}

function craftItem(type) {
    if (userData.shards < 500) return alert("조각이 부족합니다! 던전에서 더 모아오세요.");
    userData.shards -= 500;
    const rand = Math.random();
    let grade = "Common", cumulative = 0;
    for (let g in GRADES) {
        cumulative += GRADES[g].chance;
        if (rand <= cumulative) { grade = g; break; }
    }
    userData.inventory[type] = { grade: grade, power: GRADES[grade].power };
    alert(`🔨 [${GRADES[grade].name}] ${type} 제작 성공!`);
    saveData();
    viewStorage();
}

function viewDungeon() {
    let btn = userData.isAdventuring ? `<button disabled>탐험 중...</button>` : `<button class="solana-btn" onclick="startAdventure()">탐험(40HG)</button>`;
    document.getElementById('modal-tab-content').innerHTML = `
        <h3 style="color:#14F195;">🏹 심해 던전</h3>
        <p style="color:#ccc;">5분간 탐험하고 조각을 얻습니다.</p>
        ${btn}<br><br><button class="solana-btn" onclick="viewMenu()" style="background:#555;">뒤로</button>`;
}

function startAdventure() {
    if (userData.hg < 40) return alert("배고파서 못 가요!");
    userData.hg -= 40;
    userData.isAdventuring = true;
    userData.adventureEndTime = Date.now() + (5 * 60 * 1000);
    closeModal(); 
    saveData();
}