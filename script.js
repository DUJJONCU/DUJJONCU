// 1. Firebase 설정 (본인 키 유지)
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

// 중복 초기화 방지 및 DB 연결
if (!firebase.apps.length) { 
    firebase.initializeApp(firebaseConfig); 
}
const db = firebase.database();

// --- [전역 변수] ---
let userData = null;
let lastClick = 0;
let bubbleTimer = null;
let globalRankers = [];

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

// --- [로그인 시스템] ---
async function handleAuth() {
    const idInput = document.getElementById('user-id-input');
    const pwInput = document.getElementById('user-pw-input');
    if (!idInput || !pwInput) return;

    const id = idInput.value.trim();
    const pw = pwInput.value.trim();
    if (id.length < 4 || pw.length < 4) return alert("ID/PW 4자 이상 입력하세요!");

    try {
        const snapshot = await db.ref(`users/${id}`).once('value');
        const saved = snapshot.val();

        if (saved) {
            if (saved.password === pw) { 
                userData = saved; 
                if(!userData.inventory) userData.inventory = { weapon: null, armor: null, boots: null, helmet: null };
                loginSuccess(); 
            } else {
                alert("비밀번호가 틀렸습니다.");
            }
        } else {
            if (confirm(`'${id}'로 새로 시작할까요?`)) {
                userData = {
                    id, password: pw, lv: 1, xp: 0, hg: 100, shards: 0, foodCount: 5,
                    inventory: { weapon: null, armor: null, boots: null, helmet: null },
                    isAdventuring: false, adventureEndTime: 0
                };
                await db.ref(`users/${id}`).set(userData);
                loginSuccess();
            }
        }
    } catch (e) {
        console.error("로그인 에러:", e);
        alert("서버 연결 실패! Firebase 설정을 확인하세요.");
    }
}

function loginSuccess() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
    createMarqueeDOM();
    watchRanking();
    
    // 메인 루프 (1초마다 실행)
    setInterval(() => {
        if (!userData) return;

        // 탐험 완료 체크
        if (userData.isAdventuring) {
            if (Date.now() >= userData.adventureEndTime) {
                userData.isAdventuring = false;
                const reward = Math.floor(Math.random() * 51) + 30; // 30~80개
                userData.shards += reward;
                alert(`🏹 탐험 완료! 조각 ${reward}개를 획득했습니다!`);
                saveData();
            }
        }
        // updateUI 함수 내부 맨 아래 추가
const img = document.getElementById('character-img');
let equipCount = Object.values(userData.inventory || {}).filter(v => v !== null).length;

if (equipCount === 4) {
    img.classList.add('gold-aura'); // 4개 다 모으면 황금 오라!
} else {
    img.classList.remove('gold-aura');
}
    }, 1000);
}

// --- [핵심: 캐릭터 클릭] ---
function handleTap() {
    if (!userData) return;

    // 1. 상태 체크 (탐험 중/배고픔)
    if (userData.isAdventuring) {
        showBubble("탐험 중에는 바빠요! 🏹");
        return;
    }
    if (userData.hg <= 0) {
        showBubble("배고파서 못 구워요...🍪");
        return;
    }

    // 2. 연타 방지
    const now = Date.now();
    if (now - lastClick < 80) return;
    lastClick = now;

    // 3. 수치 감소 및 증가
    userData.hg = Math.max(0, userData.hg - (1.2 + userData.lv * 0.03));
    
    let power = 1.0;
    let equipCount = 0;
    for (let k in userData.inventory) {
        if (userData.inventory[k]) { 
            power *= userData.inventory[k].power; 
            equipCount++; 
        }
    }
    if (equipCount === 4) power *= 2.0;

    let finalXP = 10 * power;
    if (Math.random() < 0.05) {
        finalXP *= 5;
        showBubble("🔥 CRITICAL!! 🔥");
        document.getElementById('character-img').style.filter = "brightness(2)";
        setTimeout(() => document.getElementById('character-img').style.filter = "none", 150);
    }

    userData.xp += finalXP;

    // 4. 애니메이션
    const img = document.getElementById('character-img');
    img.style.transform = "scale(0.85) translateY(5px)";
    setTimeout(() => img.style.transform = "scale(1)", 50);

    checkLevelUp();
    updateUI();
    saveData();
}

// --- [시스템 함수들] ---
function updateUI() {
    if (!userData) return;
    try {
        const titleData = TITLES.filter(t => userData.lv >= t.lv).slice(-1)[0];
        document.getElementById('user-title').innerText = `[${titleData.name}]`;
        document.getElementById('level-display').innerText = `Lv.${userData.lv} ${userData.id}`;

        const nextXP = Math.floor(Math.pow(userData.lv, 2.8) * 300);
        document.getElementById('exp-bar').style.width = Math.min(100, (userData.xp/nextXP)*100) + "%";
        document.getElementById('exp-label').innerText = `${Math.floor(userData.xp).toLocaleString()} / ${nextXP.toLocaleString()} XP`;

        document.getElementById('hungry-bar').style.width = userData.hg + "%";
        document.getElementById('hg-label').innerText = `${Math.floor(userData.hg)} / 100 HG`;
        document.getElementById('food-count-display').innerText = `🍪 남은 먹이: ${userData.foodCount}/10`;

        const marquee = document.getElementById('rank-marquee');
        if (marquee && globalRankers.length > 0) {
            const top1 = globalRankers[0];
            marquee.innerText = `🏆 1위: ${top1.name}(Lv.${top1.lv}) | 내 랭킹을 높여보세요!`;
        }
    } catch (e) { console.error("UI 업데이트 에러"); }
}

function startAdventure() {
    if (userData.hg < 40) return alert("기력이 부족합니다! (40 HG 필요)");
    if (userData.isAdventuring) return alert("이미 탐험 중입니다!");

    userData.hg -= 40;
    userData.isAdventuring = true;
    userData.adventureEndTime = Date.now() + (1000 * 60 * 5); // 5분
    
    closeModal();
    saveData();
    showBubble("모험을 떠납니다! 🏹");
}

function handleFeed() {
    if (userData.foodCount > 0 && userData.hg < 100) {
        userData.foodCount--;
        userData.hg = Math.min(100, userData.hg + 30);
        showBubble("냠냠! 맛있다 🍪");
        updateUI();
        saveData();
    } else if (userData.foodCount <= 0) {
        alert("먹이가 부족합니다!");
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
    if (!userData) return;
    db.ref(`users/${userData.id}`).set(userData);
    db.ref(`rankings/${userData.id}`).set({ name: userData.id, lv: userData.lv });
}

function watchRanking() {
    db.ref('rankings').orderByChild('lv').limitToLast(10).on('value', (s) => {
        const d = s.val(); const list = [];
        if(d) for(let k in d) list.push(d[k]);
        globalRankers = list.sort((a,b) => b.lv - a.lv);
    });
}

// --- [모달 및 UI 제작] ---
function openModal() { document.getElementById('game-modal').classList.add('active'); viewMenu(); }
function closeModal() { document.getElementById('game-modal').classList.remove('active'); }

function viewMenu() {
    document.getElementById('modal-tab-content').innerHTML = `
        <h2 style="text-align:center;">📜 메뉴</h2>
        <div style="display:grid; gap:10px;">
            <button onclick="viewStorage()" style="padding:15px; background:#e67e22; color:white; border-radius:10px; border:none; font-weight:bold;">📦 가방 및 제작</button>
            <button onclick="viewDungeon()" style="padding:15px; background:#3498db; color:white; border-radius:10px; border:none; font-weight:bold;">🏹 던전 탐험</button>
            <button onclick="closeModal()" style="padding:10px; background:#7f8c8d; color:white; border-radius:10px; border:none;">닫기</button>
        </div>`;
}

function viewStorage() {
    const inv = userData.inventory;
    const parts = { weapon: "⚔️ 무기", armor: "👕 방어구", boots: "👟 신발", helmet: "🪖 투구" };
    let html = `<h3 style="margin:0 0 10px 0;">📦 가방 (조각: ${userData.shards})</h3><div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">`;
    for (let key in parts) {
        const item = inv[key];
        const color = item ? GRADES[item.grade].color : "#ccc";
        const name = item ? GRADES[item.grade].name : "비었음";
        html += `<div style="border:1px solid #ddd; padding:10px; border-radius:10px; text-align:center;">
            <small>${parts[key]}</small><br><b style="color:${color};">[${name}]</b><br>
            <button onclick="craftItem('${key}')" style="margin-top:5px; font-size:10px; cursor:pointer;">제작(500💎)</button>
        </div>`;
    }
    html += `</div><button onclick="viewMenu()" style="width:100%; margin-top:15px; padding:10px; border-radius:10px; border:none; cursor:pointer;">뒤로가기</button>`;
    document.getElementById('modal-tab-content').innerHTML = html;
}

function viewDungeon() {
    let btnHtml = '';
    if (userData.isAdventuring) {
        const leftSec = Math.ceil((userData.adventureEndTime - Date.now()) / 1000);
        btnHtml = `<button disabled style="width:100%; padding:15px; background:#95a5a6; color:white; border-radius:10px; border:none;">탐험 중 (${leftSec}초 남음)</button>`;
    } else {
        btnHtml = `<button onclick="startAdventure()" style="width:100%; padding:15px; background:#3498db; color:white; border:none; border-radius:10px; font-weight:bold; cursor:pointer;">탐험 시작 (40 HG)</button>`;
    }

    document.getElementById('modal-tab-content').innerHTML = `
        <h3 style="margin-top:0;">🏹 심해 오븐 탐험</h3>
        <p style="font-size:12px; color:#666;">5분 동안 조각을 모으러 떠납니다.<br><b>보상: 조각 30~80개</b></p>
        ${btnHtml}
        <button onclick="viewMenu()" style="width:100%; margin-top:10px; padding:10px; border:none; border-radius:10px; cursor:pointer;">뒤로가기</button>
    `;
}

function craftItem(type) {
    if (userData.shards < 500) return alert("조각이 부족합니다!");
    userData.shards -= 500;
    const rand = Math.random();
    let grade = "Common", cum = 0;
    for (let k in GRADES) {
        cum += GRADES[k].chance;
        if (rand <= cum) { grade = k; break; }
    }
    userData.inventory[type] = { grade, power: GRADES[grade].power };
    alert(`🔨 제작 완료! [${GRADES[grade].name}] 등급을 획득했습니다!`);
    viewStorage();
    saveData();
}

function showBubble(msg) {
    const b = document.getElementById('speech-bubble');
    if(!b) return;
    b.innerText = msg; b.style.display = 'block';
    if(bubbleTimer) clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => b.style.display = 'none', 2000);
}

function createMarqueeDOM() {
    if(document.getElementById('rank-container')) return;
    const bar = document.createElement('div');
    bar.id = 'rank-container';
    bar.style = "background:#2c3e50; overflow:hidden; padding:5px 0;";
    bar.innerHTML = `<div id="rank-marquee" style="color:white; font-size:11px; white-space:nowrap; padding-left:100%; animation:marquee 20s linear infinite;">서버 랭킹 불러오는 중...</div>`;
    document.body.prepend(bar);
}