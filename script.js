// 1. Firebase 설정 (변경하지 마세요)
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

// 초기화 에러 방지 로직
let db;
try {
    if (!firebase.apps.length) { 
        firebase.initializeApp(firebaseConfig); 
    }
    db = firebase.database();
} catch (e) {
    console.error("Firebase 로딩 실패. HTML 하단에 Firebase SDK가 있는지 확인하세요.");
}

// --- [전역 변수] ---
let userData = null;
let lastClick = 0;
let bubbleTimer = null;
let globalRankers = [];
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

// --- [대사 확장 시스템: 500개까지 배열 안에 채우시면 됩니다] ---
const DIALOGUES = {
    mzMeme: [
        "럭키비키잖아! 🍀", "주인님 폼 미쳤다..ㄷㄷ", "너 T야? 쿠키 줘!", "갓생 가보자고!", 
        "오히려 좋아!", "이거 완전 실화냐?", "꺾이지 않는 마음!", "분위기 무엇?"
        // 여기에 계속 추가 가능 (500개까지)
    ],
    worker: [
        "퇴근하고 싶다..", "월요병엔 쿠키가 약..", "자본주의의 맛..", "멍 때리기 장인",
        "커피 수혈이 필요해..", "오늘 점메추 고?", "한 입만 더.."
    ],
    healing: [
        "고생 많았어요 ✨", "쉬어가도 괜찮아요.", "주인님 최고!", "밤공기가 좋네요.",
        "토닥토닥.. 잘하고 있어요", "당신 곁엔 제가 있어요."
    ],
    hungry: ["배고파요..", "꼬르륵..", "기운이 없어요..", "쿠키 냄새 나요.."],
    sleeping: ["Zzz..", "음냐음냐..", "건드리지 마세요..", "꿈속에서 굽는 중.."]
};

// --- [로그인 시스템] ---
async function handleAuth() {
    console.log("로그인 시도..."); // 버튼 작동 확인용 콘솔
    const idInput = document.getElementById('user-id-input');
    const pwInput = document.getElementById('user-pw-input');
    
    if (!idInput || !pwInput) return;

    const id = idInput.value.trim();
    const pw = pwInput.value.trim();
    
    if (id.length < 4 || pw.length < 4) {
        alert("ID/PW 4자 이상 입력하세요!");
        return;
    }

    if (!db) {
        alert("데이터베이스 연결 대기 중입니다. 잠시 후 다시 시도하세요.");
        return;
    }

    try {
        const snapshot = await db.ref(`users/${id}`).once('value');
        const saved = snapshot.val();

        if (saved) {
            if (saved.password === pw) { 
                userData = saved; 
                // 기존 데이터에 새 필드(기분, 인벤토리)가 없을 경우 보정
                if(!userData.inventory) userData.inventory = { weapon: null, armor: null, boots: null, helmet: null };
                if(userData.mood === undefined) userData.mood = 50; 
                loginSuccess(); 
            } else { alert("비밀번호가 틀렸습니다."); }
        } else {
            if (confirm(`'${id}'로 새로 시작할까요?`)) {
                userData = {
                    id, password: pw, lv: 1, xp: 0, hg: 100, shards: 0, foodCount: 5, mood: 50,
                    inventory: { weapon: null, armor: null, boots: null, helmet: null },
                    isAdventuring: false, adventureEndTime: 0
                };
                await db.ref(`users/${id}`).set(userData);
                loginSuccess();
            }
        }
    } catch (e) { 
        console.error(e);
        alert("서버 연결 실패! 인터넷 상태를 확인하세요."); 
    }
}

// --- [로그인 이후 메인 로직] ---
function loginSuccess() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
    
    // 전광판 생성 (없을 경우만)
    createMarqueeDOM();
    watchRanking();
    
    // 1초 루프
    setInterval(() => {
        if (!userData) return;

        // 1. 한국 시간 정기 보상
        const now = new Date();
        const kst = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (9 * 3600000));
        const hours = kst.getHours();
        const rewardHours = [4, 10, 16, 22];
        if (rewardHours.includes(hours) && localStorage.getItem('lastReward') != hours) {
            userData.foodCount = Math.min(10, userData.foodCount + 3);
            localStorage.setItem('lastReward', hours);
            showBubble("🎁 정기 보너스! 쿠키 +3");
            saveData();
        }

        // 2. 잠자기 및 기분 관리
        if (isSleeping) {
            userData.hg = Math.min(100, userData.hg + 0.8);
            userData.mood = Math.min(100, userData.mood + 0.5);
            createZzz();
        } else {
            userData.mood = Math.max(0, userData.mood - 0.05);
        }

        // 3. 10초 방치 대사 처리 (배고픔 -> 잠자기 -> 기분 순서)
        const idleTime = Date.now() - lastInteractionTime;
        if (idleTime > 10000) {
            let pool;
            if (isSleeping) pool = DIALOGUES.sleeping;
            else if (userData.hg < 30) pool = DIALOGUES.hungry;
            else if (hours >= 22 || hours < 6) pool = DIALOGUES.healing;
            else pool = DIALOGUES.mzMeme;
            
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

        updateUI();
    }, 1000);
}

// --- [캐릭터 클릭 액션] ---
function handleTap() {
    if (!userData || isSleeping) return;
    if (userData.isAdventuring) return showBubble("탐험 중에는 바빠요! 🏹");
    if (userData.hg <= 0) return showBubble("배고파서 못 구워요...🍪");

    const now = Date.now();
    if (now - lastClick < 80) return;
    lastClick = now;
    lastInteractionTime = now;

    // 기분 보너스 적용
    const moodBonus = 1 + (userData.mood / 100);
    userData.hg = Math.max(0, userData.hg - (1.2 + userData.lv * 0.03));
    userData.mood = Math.min(100, userData.mood + 0.1); 

    let power = 1.0;
    for (let k in userData.inventory) { if (userData.inventory[k]) power *= userData.inventory[k].power; }
    
    userData.xp += 10 * power * moodBonus;

    // 애니메이션 트리거
    const img = document.getElementById('character-img');
    img.classList.remove('shake');
    void img.offsetWidth; 
    img.classList.add('shake');

    checkLevelUp();
    updateUI();
    saveData();
}

// --- [UI 및 보조 기능] ---
function toggleSleep() {
    isSleeping = !isSleeping;
    const img = document.getElementById('character-img');
    const btn = document.getElementById('sleep-btn');
    if (isSleeping) {
        img.classList.add('sleeping');
        if(btn) btn.innerText = "☀️ 깨우기";
        showBubble("Zzz... 기운 충전 중");
    } else {
        img.classList.remove('sleeping');
        if(btn) btn.innerText = "💤 잠자기";
        showBubble("잘 잤다! 가보자고!");
    }
}

function createZzz() {
    const char = document.getElementById('character-img');
    if(!char) return;
    const z = document.createElement('div');
    z.className = 'zzz-particle'; z.innerText = 'Z';
    const rect = char.getBoundingClientRect();
    z.style.left = (rect.right - 50) + 'px';
    z.style.top = (rect.top + 30) + 'px';
    document.body.appendChild(z);
    setTimeout(() => z.remove(), 2000);
}

function handleFeed() {
    if (!userData) return;
    if (userData.foodCount > 0 && userData.hg < 100) {
        userData.foodCount--;
        userData.hg = Math.min(100, userData.hg + 30);
        userData.mood = Math.min(100, userData.mood + 10);
        showBubble("냠냠! 맛있다 🍪");
        saveData();
    } else if (userData.foodCount <= 0) alert("먹이가 부족합니다!");
}

function updateUI() {
    if (!userData) return;
    const titleData = TITLES.filter(t => userData.lv >= t.lv).slice(-1)[0];
    
    const ut = document.getElementById('user-title');
    const ld = document.getElementById('level-display');
    const eb = document.getElementById('exp-bar');
    const el = document.getElementById('exp-label');
    const hb = document.getElementById('hungry-bar');
    const hl = document.getElementById('hg-label');
    const fcd = document.getElementById('food-count-display');

    if(ut) ut.innerText = `[${titleData.name}]`;
    if(ld) ld.innerText = `Lv.${userData.lv} ${userData.id}`;

    const nextXP = Math.floor(Math.pow(userData.lv, 2.8) * 300);
    if(eb) eb.style.width = Math.min(100, (userData.xp/nextXP)*100) + "%";
    if(el) el.innerText = `${Math.floor(userData.xp).toLocaleString()} / ${nextXP.toLocaleString()} XP`;

    if(hb) hb.style.width = userData.hg + "%";
    if(hl) hl.innerText = `${Math.floor(userData.hg)} / 100 HG`;
    if(fcd) fcd.innerText = `🍪 남은 먹이: ${userData.foodCount}/10`;

    const marquee = document.getElementById('rank-marquee');
    if (marquee && globalRankers.length > 0) {
        marquee.innerText = `🏆 1위: ${globalRankers[0].name}(Lv.${globalRankers[0].lv}) | 기분 좋게 클릭하세요!`;
    }
}

function checkLevelUp() {
    const nextXP = Math.floor(Math.pow(userData.lv, 2.8) * 300);
    if (userData.xp >= nextXP) {
        userData.xp = 0;
        userData.lv++;
        userData.foodCount = Math.min(10, userData.foodCount + 5);
        showBubble("🎉 LEVEL UP!! 🎉");
    }
}

function saveData() {
    if (!userData || !db) return;
    db.ref(`users/${userData.id}`).set(userData);
    db.ref(`rankings/${userData.id}`).set({ name: userData.id, lv: userData.lv });
}

function watchRanking() {
    if(!db) return;
    db.ref('rankings').orderByChild('lv').limitToLast(10).on('value', (s) => {
        const d = s.val(); const list = [];
        if(d) for(let k in d) list.push(d[k]);
        globalRankers = list.sort((a,b) => b.lv - a.lv);
    });
}

function openModal() { document.getElementById('game-modal').classList.add('active'); viewMenu(); }
function closeModal() { document.getElementById('game-modal').classList.remove('active'); }

function viewMenu() {
    document.getElementById('modal-tab-content').innerHTML = `
        <h2 style="text-align:center;">📜 메뉴</h2>
        <div style="display:grid; gap:10px;">
            <button onclick="viewStorage()" style="padding:15px; background:#e67e22; color:white; border-radius:10px; border:none; font-weight:bold; cursor:pointer;">📦 가방 및 제작</button>
            <button onclick="viewDungeon()" style="padding:15px; background:#3498db; color:white; border-radius:10px; border:none; font-weight:bold; cursor:pointer;">🏹 던전 탐험</button>
            <button onclick="closeModal()" style="padding:10px; background:#7f8c8d; color:white; border-radius:10px; border:none; cursor:pointer;">닫기</button>
        </div>`;
}

function viewStorage() {
    const inv = userData.inventory;
    const parts = { weapon: "⚔️ 무기", armor: "👕 방어구", boots: "👟 신발", helmet: "🪖 투구" };
    let html = `<h3 style="margin:0 0 10px 0;">📦 가방 (조각: ${userData.shards})</h3><div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">`;
    for (let key in parts) {
        const item = inv[key];
        const color = item ? GRADES[item.grade].color : "#ccc";
        html += `<div style="border:1px solid #ddd; padding:10px; border-radius:10px; text-align:center;">
            <small>${parts[key]}</small><br><b style="color:${color};">[${item?GRADES[item.grade].name:'비었음'}]</b><br>
            <button onclick="craftItem('${key}')" style="margin-top:5px; font-size:10px; cursor:pointer;">제작(500💎)</button>
        </div>`;
    }
    html += `</div><button onclick="viewMenu()" style="width:100%; margin-top:15px; padding:10px; border-radius:10px; border:none; cursor:pointer;">뒤로가기</button>`;
    document.getElementById('modal-tab-content').innerHTML = html;
}

function viewDungeon() {
    let btnHtml = userData.isAdventuring ? 
        `<button disabled style="width:100%; padding:15px; background:#95a5a6; color:white; border-radius:10px; border:none;">탐험 중...</button>` :
        `<button onclick="startAdventure()" style="width:100%; padding:15px; background:#3498db; color:white; border-radius:10px; border:none; font-weight:bold; cursor:pointer;">탐험 시작 (40 HG)</button>`;
    document.getElementById('modal-tab-content').innerHTML = `
        <h3>🏹 심해 오븐 탐험</h3>
        <p style="font-size:12px; color:#666;">5분 후 조각 30~80개를 얻습니다.</p>
        ${btnHtml}
        <button onclick="viewMenu()" style="width:100%; margin-top:10px; padding:10px; border:none; border-radius:10px; cursor:pointer;">뒤로가기</button>`;
}

function startAdventure() {
    if (userData.hg < 40) return alert("기력이 부족합니다! (40 HG 필요)");
    userData.hg -= 40;
    userData.isAdventuring = true;
    userData.adventureEndTime = Date.now() + (1000 * 60 * 5); 
    closeModal(); saveData(); showBubble("모험을 떠납니다! 🏹");
}

function craftItem(type) {
    if (userData.shards < 500) return alert("조각이 부족합니다!");
    userData.shards -= 500;
    const rand = Math.random();
    let grade = "Common", cum = 0;
    for (let k in GRADES) { cum += GRADES[k].chance; if (rand <= cum) { grade = k; break; } }
    userData.inventory[type] = { grade, power: GRADES[grade].power };
    alert(`🔨 제작 완료! [${GRADES[grade].name}] 획득!`);
    viewStorage(); saveData();
}

function showBubble(msg) {
    const b = document.getElementById('speech-bubble');
    if(!b) return;
    b.innerText = msg; b.style.display = 'block';
    if(bubbleTimer) clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => b.style.display = 'none', 2500);
}

function createMarqueeDOM() {
    if(document.getElementById('rank-container')) return;
    const bar = document.createElement('div');
    bar.id = 'rank-container';
    bar.style = "background:#2c3e50; overflow:hidden; padding:5px 0;";
    bar.innerHTML = `<div id="rank-marquee" style="color:white; font-size:11px; white-space:nowrap; padding-left:100%; animation:marquee 20s linear infinite;">서버 랭킹 불러오는 중...</div>`;
    document.body.prepend(bar);
}