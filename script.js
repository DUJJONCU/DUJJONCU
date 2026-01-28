// --- [1. Firebase 설정 및 초기화] ---
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
    if (!firebase.apps.length) { 
        firebase.initializeApp(firebaseConfig); 
    }
    db = firebase.database();
} catch (e) {
    console.error("Firebase 로딩 실패:", e);
}

// --- [2. 전역 변수] ---
let userData = null;
let lastClick = 0;
let bubbleTimer = null;
let globalRankers = [];
let isSleeping = false;
let lastInteractionTime = Date.now();

// --- [3. 상수 데이터 (등급, 칭호, 대사)] ---
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
    mzMeme: ["럭키비키잖아! 🍀", "주인님 폼 미쳤다..ㄷㄷ", "너 T야? 쿠키 줘!", "갓생 가보자고!", "오히려 좋아!", "이거 완전 실화냐?", "꺾이지 않는 마음!"],
    worker: ["퇴근하고 싶다..", "월요병엔 쿠키가 약..", "자본주의의 맛..", "멍 때리기 장인", "커피 수혈이 필요해.."],
    healing: ["고생 많았어요 ✨", "쉬어가도 괜찮아요.", "주인님 최고!", "밤공기가 좋네요.", "토닥토닥.. 잘하고 있어요"],
    hungry: ["배고파요..", "꼬르륵..", "기운이 없어요..", "현기증 난단 말이에요"],
    sleeping: ["Zzz..", "음냐음냐..", "건드리지 마세요..", "꿈속에서 굽는 중.."]
};

// --- [4. 핵심 시스템 함수 (날씨, 랭킹, 그로기)] ---

function updateWeather() {
    const hour = new Date().getHours();
    const screen = document.getElementById('screen');
    if (!screen) return;
    let bg;
    if (hour >= 6 && hour < 12) bg = "linear-gradient(180deg, #FFEFBA, #FFFFFF)";
    else if (hour >= 12 && hour < 18) bg = "linear-gradient(180deg, #74ebd5, #ACB6E5)";
    else if (hour >= 18 && hour < 21) bg = "linear-gradient(180deg, #FF512F, #DD2476)";
    else bg = "linear-gradient(180deg, #141E30, #243B55)";
    screen.style.background = bg;
}

async function updateRanking() {
    if (!db) return;
    try {
        const snapshot = await db.ref('users').orderByChild('xp').limitToLast(10).once('value');
        let ranks = [];
        snapshot.forEach(snap => { ranks.push(snap.val()); });
        ranks.reverse();
        globalRankers = ranks.map(r => ({ name: r.id, lv: r.lv }));
        const text = ranks.map((u, i) => `${i+1}위: ${u.id}(Lv.${u.lv})`).join("  |  ");
        const listEl = document.getElementById('ranking-list');
        if (listEl) listEl.innerText = text;
    } catch(e) { console.error("Ranking Error", e); }
}

function checkGroggy() {
    if (!userData) return;
    const now = Date.now();
    
    // 1. 이미 그로기(기절) 상태인지 확인
    if (userData.groggyEndTime && now < userData.groggyEndTime) {
        isSleeping = true;
        document.getElementById('character-img').classList.add('sleeping');
        const remainMin = Math.ceil((userData.groggyEndTime - now) / 60000);
        showBubble(`😵 기절 중.. (${remainMin}분 남음)`);
        document.querySelectorAll('.action-btn').forEach(b => b.disabled = true);
    } 
    // 2. 배고픔 0일 때 새로 기절시키기
    else if (userData.hg <= 0) {
        userData.groggyEndTime = now + (6 * 60 * 60 * 1000); // 6시간 추가
        saveData();
        checkGroggy(); // 재귀 호출로 UI 즉시 반영
    } 
    // 3. 정상 상태일 때
    else {
        document.querySelectorAll('.action-btn').forEach(b => b.disabled = false);
        document.getElementById('character-img').classList.remove('sleeping');
    }
}

// --- [5. 게임 실행 로직] ---

function loginSuccess() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
    
    updateWeather();
    updateRanking();
    checkGroggy();
    
    // 정기 실행 타이머들
    setInterval(updateRanking, 60000); // 랭킹 1분마다
    setInterval(gameLoop, 1000);       // 메인 루프 1초마다
}

function gameLoop() {
    if (!userData) return;

    // 1. 한국 시간 정기 보상
    const now = new Date();
    const kstHour = new Date(now.getTime() + (9 * 3600000)).getUTCHours();
    const rewardHours = [4, 10, 16, 22];
    if (rewardHours.includes(kstHour) && localStorage.getItem('lastReward') != kstHour) {
        userData.foodCount = Math.min(10, userData.foodCount + 3);
        localStorage.setItem('lastReward', kstHour);
        showBubble("🎁 정기 보너스! 쿠키 +3");
        saveData();
    }

    // 2. 상태 자동 회복/감소
    if (isSleeping) {
        userData.hg = Math.min(100, userData.hg + 0.8);
        userData.mood = Math.min(100, userData.mood + 0.5);
        createZzz();
    } else {
        userData.mood = Math.max(0, userData.mood - 0.05);
    }

    // 3. 방치 대사
    const idleTime = Date.now() - lastInteractionTime;
    if (idleTime > 10000) {
        let pool = isSleeping ? DIALOGUES.sleeping : (userData.hg < 30 ? DIALOGUES.hungry : DIALOGUES.mzMeme);
        showBubble(pool[Math.floor(Math.random() * pool.length)]);
        lastInteractionTime = Date.now();
    }

    // 4. 탐험 체크
    if (userData.isAdventuring && Date.now() >= userData.adventureEndTime) {
        userData.isAdventuring = false;
        const reward = Math.floor(Math.random() * 51) + 30; 
        userData.shards += reward;
        alert(`🏹 탐험 완료! 조각 ${reward}개를 획득했습니다!`);
        saveData();
    }

    checkGroggy();
    updateUI();
}

// --- [6. UI 및 액션 함수] ---

function handleTap() {
    if (!userData || isSleeping || userData.isAdventuring) return;
    if (userData.hg <= 0) { showBubble("배고파서 못 구워요...🍪"); return; }

    const now = Date.now();
    if (now - lastClick < 80) return;
    lastClick = now;
    lastInteractionTime = now;

    const moodBonus = 1 + (userData.mood / 100);
    userData.hg = Math.max(0, userData.hg - (1.2 + userData.lv * 0.03));
    
    let power = 1.0;
    for (let k in userData.inventory) { if (userData.inventory[k]) power *= userData.inventory[k].power; }
    
    userData.xp += 10 * power * moodBonus;

    const img = document.getElementById('character-img');
    img.classList.remove('shake');
    void img.offsetWidth; 
    img.classList.add('shake');

    checkLevelUp();
    updateUI();
    saveData();
}

function updateUI() {
    if (!userData) return;
    const titleData = TITLES.filter(t => userData.lv >= t.lv).slice(-1)[0];
    
    document.getElementById('user-title').innerText = `[${titleData.name}]`;
    document.getElementById('level-display').innerText = `Lv.${userData.lv} ${userData.id}`;

    const nextXP = Math.floor(Math.pow(userData.lv, 2.8) * 300);
    document.getElementById('exp-bar').style.width = Math.min(100, (userData.xp/nextXP)*100) + "%";
    document.getElementById('exp-label').innerText = `${Math.floor(userData.xp).toLocaleString()} / ${nextXP.toLocaleString()} XP`;

    document.getElementById('hungry-bar').style.width = userData.hg + "%";
    document.getElementById('hg-label').innerText = `${Math.floor(userData.hg)} / 100 HG`;
    document.getElementById('food-count-display').innerText = `🍪 남은 먹이: ${userData.foodCount}/10`;
}

function showBubble(msg) {
    const b = document.getElementById('speech-bubble');
    if(!b) return;
    b.innerText = msg;
    b.style.display = 'block';
    if(bubbleTimer) clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => { b.style.display = 'none'; }, 2500);
}

function saveData() {
    if (!userData || !db) return;
    db.ref(`users/${userData.id}`).set(userData);
}

// 로그인 함수
async function handleAuth() {
    const id = document.getElementById('user-id-input').value.trim();
    const pw = document.getElementById('user-pw-input').value.trim();
    if (id.length < 4 || pw.length < 4) return alert("ID/PW 4자 이상!");

    try {
        const snap = await db.ref(`users/${id}`).once('value');
        const saved = snap.val();
        if (saved) {
            if (saved.password === pw) { userData = saved; loginSuccess(); }
            else alert("비번 틀림");
        } else {
            if (confirm("신규 생성?")) {
                userData = { id, password: pw, lv: 1, xp: 0, hg: 100, shards: 0, foodCount: 5, mood: 50, inventory: { weapon: null, armor: null, boots: null, helmet: null }, isAdventuring: false };
                await db.ref(`users/${id}`).set(userData);
                loginSuccess();
            }
        }
    } catch(e) { alert("연결 실패"); }
}

// --- 나머지 보조 함수 (toggleSleep, createZzz, handleFeed, openModal 등)는 기존과 동일하게 유지 ---
function toggleSleep() {
    isSleeping = !isSleeping;
    const img = document.getElementById('character-img');
    const btn = document.getElementById('sleep-btn');
    if (isSleeping) {
        img.classList.add('sleeping');
        if(btn) btn.innerText = "☀️ 깨우기";
    } else {
        img.classList.remove('sleeping');
        if(btn) btn.innerText = "💤 잠자기";
    }
}
function handleFeed() {
    if (userData.foodCount > 0 && userData.hg < 100) {
        userData.foodCount--;
        userData.hg = Math.min(100, userData.hg + 30);
        saveData();
    }
}
function checkLevelUp() {
    const nextXP = Math.floor(Math.pow(userData.lv, 2.8) * 300);
    if (userData.xp >= nextXP) {
        userData.xp = 0; userData.lv++;
        userData.foodCount = Math.min(10, userData.foodCount + 5);
        showBubble("🎉 LEVEL UP!!");
    }
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
function openModal() { document.getElementById('game-modal').classList.add('active'); viewMenu(); }
function closeModal() { document.getElementById('game-modal').classList.remove('active'); }
function viewMenu() {
    document.getElementById('modal-tab-content').innerHTML = `
        <button onclick="viewStorage()">📦 가방</button>
        <button onclick="viewDungeon()">🏹 던전</button>
        <button onclick="closeModal()">닫기</button>`;
}