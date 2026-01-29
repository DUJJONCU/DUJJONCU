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
let crisisTimer = null;

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

// --- [3. 인증 및 루프] ---
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
    setInterval(updateWeather, 60000);
    setInterval(updateRanking, 60000);
    setInterval(gameLoop, 1000);
}

function gameLoop() {
    if (!userData) return;
    checkGroggy();

    if (isSleeping) {
        userData.hg = Math.min(100, userData.hg + 0.3);
        userData.mood = Math.min(100, userData.mood + 0.2);
        createZzz();
    } else {
        userData.mood = Math.max(0, userData.mood - 0.05);
    }

    const idleTime = Date.now() - lastInteractionTime;
    if (idleTime > 12000) {
        let pool = isSleeping ? DIALOGUES.sleeping : 
                  (userData.hg < 30 ? DIALOGUES.hungry : 
                  (userData.mood < 30 ? DIALOGUES.depressed : DIALOGUES.mzMeme));
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

// --- [4. 액션 함수] ---
function handleTap() {
    if (!userData || isSleeping || userData.isAdventuring || crisisTimer) return;
    if (userData.hg <= 0) return showBubble("배고파서 기운이 없어요..");

    // [돌발 이벤트] 기분 10 미만 시 30% 확률로 가출 위기
    if (userData.mood < 10 && Math.random() < 0.3) {
        triggerCrisis();
        return;
    }

    const now = Date.now();
    if (now - lastClick < 80) return;
    lastClick = now;
    lastInteractionTime = now;

    // 파워 및 보너스 계산
    let power = 1.0;
    if (userData.inventory) {
        for (let k in userData.inventory) { 
            if (userData.inventory[k]) power *= userData.inventory[k].power; 
        }
    }
    const moodBonus = 1 + (userData.mood / 100);
    
    // [시각 효과] 반짝이
    if (userData.mood >= 50) createSparkle();

    userData.xp += 10 * power * moodBonus;
    userData.hg = Math.max(0, userData.hg - (0.5 + userData.lv * 0.01));
    userData.mood = Math.min(100, userData.mood + 0.2);

    const img = document.getElementById('character-img');
    img.style.transform = `scale(1.1) rotate(${Math.random() * 10 - 5}deg)`;
    img.classList.remove('shake');
    void img.offsetWidth;
    img.classList.add('shake');
    setTimeout(() => { img.style.transform = "scale(1) rotate(0deg)"; }, 100);

    checkLevelUp();
    saveData();
}

function handleFeed() {
    if (userData.foodCount > 0 && userData.hg < 100) {
        userData.foodCount--;
        userData.hg = Math.min(100, userData.hg + 30);
        userData.mood = Math.min(100, userData.mood + 10);
        showBubble("냠냠! 맛있다 🍪");
        saveData();
    } else if (userData.foodCount <= 0) alert("먹이가 부족합니다!");
}

function toggleSleep() {
    if (!isSleeping) {
        isSleeping = true;
        userData.sleepEndTime = Date.now() + (30 * 60 * 1000); 
        document.getElementById('character-img').classList.add('sleeping');
        showBubble("💤 휴식 중... (30분)");
    } else {
        if (Date.now() < userData.sleepEndTime) {
            const remain = Math.ceil((userData.sleepEndTime - Date.now()) / 60000);
            return alert(`아직 더 자야 해요! ${remain}분 남음.`);
        }
        isSleeping = false;
        userData.sleepEndTime = null;
        document.getElementById('character-img').classList.remove('sleeping');
        showBubble("☀️ 상쾌한 아침!");
    }
    saveData();
}

// --- [5. 시스템 및 UI] ---
function updateUI() {
    if (!userData) return;
    const nextXP = Math.floor(Math.pow(userData.lv, 2.8) * 300);
    
    let moodTag = "";
    let nameColor = "#9945FF";
    if (userData.mood >= 80) { moodTag = " 🥰 [행복]"; nameColor = "#14F195"; }
    else if (userData.mood >= 40) { moodTag = " 😊 [보통]"; nameColor = "#9945FF"; }
    else if (userData.mood >= 15) { moodTag = " 😕 [우울]"; nameColor = "#ff9f43"; }
    else { moodTag = " 😭 [절망]"; nameColor = "#ff4757"; }

    const titleData = TITLES.filter(t => userData.lv >= t.lv).slice(-1)[0];
    document.getElementById('user-title').innerHTML = `<span style="color:${nameColor}">[${titleData.name}]</span> Lv.${userData.lv}${moodTag}`;

    document.getElementById('exp-bar').style.width = Math.min(100, (userData.xp/nextXP)*100) + "%";
    document.getElementById('exp-label').innerText = `${Math.floor(userData.xp).toLocaleString()} / ${nextXP.toLocaleString()} XP`;
    document.getElementById('hungry-bar').style.width = userData.hg + "%";
    document.getElementById('hg-label').innerText = `${Math.floor(userData.hg)} HG`;

    if(document.getElementById('mood-bar')) {
        document.getElementById('mood-bar').style.width = userData.mood + "%";
        document.getElementById('mood-label').innerText = `${Math.floor(userData.mood)} MOOD`;
    }
    document.getElementById('food-count-display').innerText = `🍪 먹이: ${userData.foodCount}/10 | 💎 조각: ${userData.shards}`;
}

function triggerCrisis() {
    if (crisisTimer) return;
    showBubble("💢 나 진짜 나갈 거예요! (달래기 클릭!!)");
    const charImg = document.getElementById('character-img');
    charImg.style.filter = "sepia(1) saturate(5) hue-rotate(-50deg)";

    const rescueBtn = document.createElement('button');
    rescueBtn.innerText = "❤️ 달래기 (터치!)";
    rescueBtn.style.cssText = "position:fixed; top:40%; left:50%; transform:translate(-50%, -50%); z-index:2001; padding:20px; background:red; color:white; border-radius:10px; font-family:'Galmuri9'; border:none; box-shadow: 0 0 20px white; cursor:pointer;";
    
    rescueBtn.onclick = () => {
        clearTimeout(crisisTimer);
        crisisTimer = null;
        userData.mood = 35;
        charImg.style.filter = "";
        rescueBtn.remove();
        showBubble("흥, 이번만 참는 거예요.");
        saveData();
        updateUI();
    };
    document.body.appendChild(rescueBtn);

    crisisTimer = setTimeout(() => {
        rescueBtn.remove();
        charImg.style.opacity = "0"; 
        showBubble("😭 결국 가출했습니다... (잠시 후 복귀)");
        userData.xp = Math.max(0, userData.xp - 500); 
        setTimeout(() => {
            charImg.style.opacity = "1";
            charImg.style.filter = "";
            crisisTimer = null;
            userData.mood = 20;
            saveData();
            updateUI();
        }, 5000); 
    }, 5000);
}

function createSparkle() {
    const char = document.getElementById('character-img');
    const rect = char.getBoundingClientRect();
    const s = document.createElement('div');
    s.innerText = "✨";
    s.style.cssText = `position:fixed; left:${rect.left + Math.random() * rect.width}px; top:${rect.top + Math.random() * 20}px; font-size:20px; pointer-events:none; z-index:1000; transition:all 0.8s ease-out;`;
    document.body.appendChild(s);
    setTimeout(() => {
        s.style.transform = `translate(${(Math.random() - 0.5) * 100}px, -100px) rotate(${Math.random() * 360}deg)`;
        s.style.opacity = '0';
    }, 20);
    setTimeout(() => s.remove(), 800);
}

function openModal() {
    const modal = document.getElementById('game-modal');
    const content = document.getElementById('modal-tab-content');
    modal.classList.add('active');
    if(!userData.inventory) userData.inventory = { weapon: null, armor: null, boots: null, helmet: null };
    const inv = userData.inventory;
    const parts = { weapon: "⚔️ 무기", armor: "👕 방어구", boots: "👟 신발", helmet: "🪖 투구" };

    let html = `<h2 style="color:#14F195; margin-bottom:15px; font-size:18px;">📜 전체 메뉴</h2><div style="text-align:left; margin-bottom:15px;"><b style="color:#9945FF; font-size:13px;">📦 장비제작 (500💎)</b><div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:5px;">`;
    for (let key in parts) {
        const item = inv[key];
        const gName = item ? GRADES[item.grade].name : "미착용";
        const gColor = item ? GRADES[item.grade].color : "#555";
        html += `<div style="background:#222; padding:8px; border-radius:8px; border:1px solid ${gColor}; font-size:11px;"><span style="color:#aaa;">${parts[key]}</span><br><b style="color:${gColor};">${gName}</b><br><button onclick="craftInMenu('${key}')" style="margin-top:4px; font-size:9px; cursor:pointer;">제작</button></div>`;
    }
    html += `</div></div><div style="text-align:left; margin-bottom:20px;"><b style="color:#14F195; font-size:13px;">🏹 던전 탐험 (5분)</b><div style="background:#222; padding:10px; border-radius:8px; margin-top:5px; display:flex; justify-content:space-between; align-items:center;"><span style="font-size:11px; color:#ccc;">심해 던전</span>${userData.isAdventuring ? `<span style="color:#f1c40f; font-size:11px;">탐험 중...</span>` : `<button class="solana-btn" onclick="startAdventureInMenu()" style="padding:5px 10px; font-size:11px;">출발(40HG)</button>`}</div></div><button class="solana-btn" onclick="closeModal()" style="background:#555; width:100%;">닫기</button>`;
    content.innerHTML = html;
}

function craftInMenu(type) {
    if (userData.shards < 500) return alert("조각이 부족합니다!");
    userData.shards -= 500;
    const rand = Math.random();
    let grade = "Common", cum = 0;
    for (let g in GRADES) { cum += GRADES[g].chance; if (rand <= cum) { grade = g; break; } }
    userData.inventory[type] = { grade: grade, power: GRADES[grade].power };
    alert(`🔨 [${GRADES[grade].name}] 제작 성공!`);
    saveData();
    openModal();
}

function startAdventureInMenu() {
    if (userData.hg < 40) return alert("배고파서 못 가요!");
    userData.hg -= 40;
    userData.isAdventuring = true;
    userData.adventureEndTime = Date.now() + (5 * 60 * 1000);
    saveData();
    openModal();
}

function checkGroggy() {
    if (!userData) return;
    const now = Date.now();
    const charImg = document.getElementById('character-img');
    if (userData.hg <= 0 || (userData.groggyEndTime && now < userData.groggyEndTime)) {
        if (!userData.groggyEndTime) userData.groggyEndTime = now + (6 * 3600000);
        isSleeping = true;
        charImg.classList.add('sleeping');
    }
}

function checkLevelUp() {
    const nextXP = Math.floor(Math.pow(userData.lv, 2.8) * 300);
    if (userData.xp >= nextXP) { userData.xp = 0; userData.lv++; userData.foodCount = Math.min(10, userData.foodCount + 5); showBubble("🎉 LEVEL UP!!"); }
}

function updateWeather() {
    const hour = new Date().getHours();
    const screen = document.getElementById('screen');
    if(screen) screen.style.background = (hour >= 6 && hour < 18) ? "linear-gradient(180deg, #74ebd5, #ACB6E5)" : "linear-gradient(180deg, #141E30, #243B55)";
}

async function updateRanking() {
    try {
        const snapshot = await db.ref('users').orderByChild('xp').limitToLast(10).once('value');
        let ranks = []; snapshot.forEach(snap => ranks.push(snap.val())); ranks.reverse();
        const el = document.getElementById('ranking-list');
        if(el) el.innerText = ranks.map((u, i) => `${i+1}위: ${u.id}(Lv.${u.lv})`).join("  |  ");
    } catch(e) {}
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
function createZzz() {
    const char = document.getElementById('character-img');
    const z = document.createElement('div');
    z.className = 'zzz-particle'; z.innerText = 'Z';
    const rect = char.getBoundingClientRect();
    z.style.left = (rect.right - 50) + 'px'; z.style.top = (rect.top + 30) + 'px';
    document.body.appendChild(z);
    setTimeout(() => z.remove(), 2000);
}