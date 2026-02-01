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

// [여기에 추가하세요!]
let isBonusTime = false; 
let bonusTimer = null;

const GRADES = {
    Common: { name: "커먼", color: "#bdc3c7", power: 1.2, chance: 0.739 },
    Uncommon: { name: "언커먼", color: "#2ecc71", power: 1.5, chance: 0.20 },
    Rare: { name: "레어", color: "#3498db", power: 2.5, chance: 0.05 },
    Epic: { name: "에픽", color: "#9b59b6", power: 6.0, chance: 0.01 },
    Legendary: { name: "레전드", color: "#f1c40f", power: 25.0, chance: 0.001 }
};

const TITLES = [
    { lv: 0, name: "밀가루 반죽" },
    { lv: 10, name: "오븐 구경꾼" },
    { lv: 30, name: "초보 쿠키" },
    { lv: 70, name: "바삭한 모험가" },
    { lv: 120, name: "베테랑 쿠키" },
    { lv: 170, name: "전설의 황금반죽" },
    { lv: 200, name: "🍪 솔라나 마스터" }
];

const DIALOGUES = {
    // 1. 기본/기분 좋을 때 (MZ 밈 + 츤데레 믹스)
    mzMeme: [
        "럭키비키잖아! 🍀", "주인님 폼 미쳤다..ㄷㄷ", "갓생 가보자고!", "오히려 좋아!", "중꺾마! 알죠?",
        "이거 완전 에바인데? (긍정적)", "두쫀쿠 폼 미쳤다!", "알잘딱깔센하게 클릭해봐요.", "오늘 컨디션 완전 가보자고!", "주인님 T에요? 왜 이렇게 잘해?",
        "완전 럭키비키! 내 소수점이 늘어났어!", "이게 바로 두쫀쿠의 스웩입니다.", "클릭 한 번에 감동 한 스푼..", "나 오늘 좀 킹받게 귀엽나?", "솔라나 가즈아! 내 반죽도 가즈아!",
        "주인님 센스 미쳤다, 진짜.", "훗, 내가 바로 이 구역의 갓생 쿠키.", "맛있게 구워지는 중, 방해 금지!", "내 조각 모으는 당신, 갓생 인정.", "오늘따라 바삭바삭한 기분이네요!"
    ],
    // 2. 배고플 때 (Hungry 수치가 낮을 때)
    hungry: [
        "배고파요.. 반죽이 말라가..", "꼬르륵.. 나 현기증 난단 말이에요!", "101010.. 배고프다는 2진수 신호입니다.", "설탕 충전 시급! 당 떨어져요!", "먹이 안 주면 당신의 데이터를 갉아먹겠어.",
        "쿠키가 배고프면 뭐가 되는지 알아요? 가루가 돼요.", "주인님만 입이에요? 나도 입 있다구!", "한 입만.. 딱 한 입만 🍪", "배꼽시계가 솔라나 네트워크보다 정확하네.", "나 쓰러지면 누가 랭킹 올려요?",
        "반죽에 탄력이 없어지고 있어요..", "먹이 주기 버튼, 그거 장식 아니죠?", "아.. 고소한 냄새 환청이 들려.", "굶기면 나 진짜 가출할 거야!", "내 배에서 천둥 소리 나요, 들려요?",
        "당분.. 당분이 부족해서 시스템 오류 날 것 같아.", "주인님 혼자 맛있는 거 먹지 마요!", "나 지금 초예민 상태인 거 안 보여요?", "반죽이 얇아지는 기분이야, 살려줘!", "꼬르륵 소리가 서버까지 들리겠네."
    ],
    // 3. 기분 나쁠 때 (Mood 수치가 낮을 때)
    depressed: [
        "우울해.. 놀아줘요..", "기운이 하나도 없어.. 쿠생 무상..", "쿠키 인생 허무하다.. 난 누굴 위해 구워지나..", "흥! 주인님 미워! 관심 좀 줘요!", "나랑 안 놀아주면 눅눅해질 테다.",
        "지금 저기압이니까 건드리지 마요.", "세상은 왜 이렇게 삭막한 걸까?", "기분 별로야. 힐링 조각이 필요해.", "오늘따라 내 초코칩이 무겁게 느껴지네..", "나를 그냥 오븐 속에 방치하는 건가요?",
        "기분이 바닥이에요. 조각 좀 줘봐요.", "주인님은 센스가 꽝이야! 내 맘도 모르고.", "흥, 저 구석에 가서 반죽이나 말려야지.", "아무것도 하기 싫어.. 클릭도 하지 마!", "내 표정 안 보여요? 완전 삐졌음!",
        "관심 부족이야! 나도 사랑받고 싶다구.", "오늘 날씨.. 아니 데이터 흐름이 우울하네.", "나 삐뚤어질 거야, 말리지 마요.", "반죽이 눅눅해지는 기분이야.. 흑흑.", "주인님 바보! 멍청이! 해삼! 멍게!"
    ],
    // 4. 잠잘 때 (Sleeping 상태)
    sleeping: [
        "Zzz.. 초코칩 꿈 꾸는 중..", "꿈속에서 굽는 중.. 건드리지 마..", "5분만 더.. 오븐 온도가 딱 좋은데..", "음냐.. 주인님 바보.. (잠꼬대)", "쿨쿨.. 랭킹 1위는 내 거다..",
        "Zzz.. 설탕 비가 내려요.. 맛있다..", "잠잘 땐 개도 안 건드린다는데..", "Zzz.. 나 깨우면 반죽 던질 거야..", "반죽이 쉬는 중입니다.. 쉿!", "꿈속에서 비트코인 샀어.. 대박..",
        "Zzz.. 냠냠.. 마법의 가루..", "조용히 해줘요, 미인이 잠자는 중이니까.", "잠이 보약이야.. 쿨쿨..", "Zzz.. 나 버리면 안 돼.. (눈물 한 방울)", "오븐 속은 따뜻해.. 쿨쿨..",
        "꿈속에서 레벨 999 찍었지롱!", "Zzz.. 🍪🍪🍪.. 쿠키 천국!", "좋은 꿈 꾸게 해줘서 고마워요.. 쿨쿨..", "Zzz.. 시스템 최적화 중.. 아니 자는 중..", "Zzz.. (완벽하게 숙면 중)"
    ]
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
    // 각 장비에 level이 없으면 0으로 초기화
    for (let key in userData.inventory) {
        if (userData.inventory[key] && userData.inventory[key].level === undefined) {
            userData.inventory[key].level = 0;
        }
    }
    if (userData.inventory.helmet === undefined) userData.inventory.helmet = null;
    if (userData.inventory.boots === undefined) userData.inventory.boots = null;
    if (!userData.collections) userData.collections = { items: [], titles: [] };
    if (userData.mood === undefined) userData.mood = 50;
    if (userData.shards === undefined) userData.shards = 0;
}

function loginSuccess() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
    
    // 이 코드를 추가하세요: 저장된 스킨이 있으면 즉시 적용
    if (userData && userData.currentSkin) {
        applySkin(userData.currentSkin);
    }

    updateRanking(); 
    updateWeather();
    setInterval(updateRanking, 60000);
    setInterval(gameLoop, 1000);
}

// --- [5. 게임 루프 통합본] ---
function gameLoop() {
    if (!userData) return;

    // 1. 보너스 타임 로직
    if (!isBonusTime && Math.random() < 0.001) {
        startBonusTime();
    }
    
    checkGroggy();
    checkFoodSupply();

    // 변수 안정화: mood 값이 없으면 100으로 초기화
    if (userData.mood === undefined) userData.mood = 100;
    if (userData.hungry === undefined) userData.hungry = 100;

    // 2. 상태별 수치 변화 로직
    if (isSleeping) {
        // 자는 동안 수치 회복
        userData.hungry = Math.min(100, (userData.hungry || 0) + 0.3);
        userData.mood = Math.min(100, userData.mood + 0.1); 
        createZzz();
        
        if(userData.hungry >= 100) {
            isSleeping = false;
            const charImg = document.getElementById('character-img');
            if(charImg) charImg.classList.remove('sleeping');
            const sleepBtn = document.getElementById('sleep-btn');
            if(sleepBtn) sleepBtn.innerText = "⚡ 활동";
        }
    } else {
        // 활동 중 수치 감소 (기본 감소량 적용)
        userData.hungry = Math.max(0, (userData.hungry || 0) - 0.1);
        userData.mood = Math.max(0, userData.mood - 0.15); // 기존보다 강화된 감소폭

        // [날씨 영향] 비나 안개 시 무드 추가 감소
        if (typeof currentWeather !== 'undefined' && (currentWeather.includes("비") || currentWeather.includes("안개"))) {
            userData.mood = Math.max(0, userData.mood - 0.05);
        }

        // [배고픔 영향] 배고픔이 30 미만이면 무드 추가 감소
        if (userData.hungry < 30) {
            userData.mood = Math.max(0, userData.mood - 0.1);
        }
    }

    // 3. 탐험 완료 체크
    if (userData.isAdventuring && Date.now() >= userData.adventureEndTime) {
        userData.isAdventuring = false;
        const reward = Math.floor(Math.random() * 51) + 30;
        userData.shards = (userData.shards || 0) + reward;
        alert(`🏹 탐험 완료! 조각 ${reward}개 획득!`);
        saveData();
    }

    // 4. 대사 출력 (12초마다 무작위)
    if (Date.now() - lastInteractionTime > 12000) {
        const state = isSleeping ? 'sleeping' : 
                      (userData.hungry < 30 ? 'hungry' : 
                      (userData.mood < 30 ? 'depressed' : 'mzMeme'));
        
        if (typeof DIALOGUES !== 'undefined' && DIALOGUES[state]) {
            const pool = DIALOGUES[state];
            const randomQuote = pool[Math.floor(Math.random() * pool.length)];
            showBubble(randomQuote);
        }
        lastInteractionTime = Date.now();
    }

    // 5. UI 업데이트 및 자동 저장
    updateUI();
    if (Date.now() % 5000 < 1000) saveData(); 
}
// --- [6. 메인 액션] ---
// --- [부유 텍스트 함수: handleTap 밖으로 뺍니다] ---
// [1] 부유 텍스트 생성기 (파일 하단이나 handleTap 위에 두세요)
function showFloatingText(x, y, text, color = "#14F195") {
    const el = document.createElement('div');
    el.innerText = text;
    el.style.cssText = `
        position: fixed; left: ${x}px; top: ${y}px;
        color: ${color}; font-weight: bold; font-size: 24px;
        pointer-events: none; z-index: 9999;
        animation: floatUp 0.8s ease-out forwards;
        text-shadow: 0 0 10px rgba(0,0,0,0.8);
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 800);
}

function handleTap(event) {
    if (!userData || isSleeping || userData.isAdventuring || crisisTimer) return;
    if (userData.hg <= 0) { showBubble("배고파서 기운이 없어요.."); return; }

    const stats = calculateStats();
    const now = Date.now();
    if (now - lastClick < 80) return; // 물리적 탭 속도 제한
    lastClick = now;

    let gainedXp = isBonusTime ? (15 + (userData.lv * 0.2)) : (3 + (userData.lv * 0.05));

    if (gainedXp > 40) gainedXp = 40; // 최대 캡(Cap)

    let isCritical = (Math.random() * 100) < (isBonusTime ? stats.luck * 1.5 : 5);
    if (isCritical) gainedXp *= 2;

    let clickX = event ? (event.clientX || (event.touches && event.touches[0].clientX)) : window.innerWidth/2;
    let clickY = event ? (event.clientY || (event.touches && event.touches[0].clientY)) : window.innerHeight/2;

    showFloatingText(clickX, clickY, `+${Math.floor(gainedXp)}`, isCritical ? "#ff4757" : "#14F195");

    userData.xp = (Number(userData.xp) || 0) + gainedXp;
    userData.hg = Math.max(0, userData.hg - (isBonusTime ? stats.hgDrain * 0.7 : stats.hgDrain));
    
    checkLevelUp(); // 여기서 아래 2번 함수를 호출함
    updateUI();    // 여기서 아래 3번 로직을 실행함
    saveData();

    const img = document.getElementById('character-img');
    if (img) {
        img.style.transform = `scale(1.1) rotate(${Math.random() * 8 - 4}deg)`;
        setTimeout(() => { img.style.transform = "scale(1) rotate(0deg)"; }, 80);
    }
}

function handleFeed() {
    if (userData.foodCount > 0 && userData.hg < 100) {
        userData.foodCount--;
        userData.hg = Math.min(100, userData.hg + 30);
        // --- [무드 상승 로직 까다롭게 변경] ---
    // 1. 기본적으로 40%의 확률로만 기분이 좋아짐 (나머지 60%는 클릭해도 무드 안 오름)
    if (Math.random() < 0.4) {
        let moodBoost = 0.1; // 기본 상승치

        // 2. 날씨가 '비'나 '안개'일 때는 기분이 잘 안 올라감 (상승치 절반)
        if (currentWeather === "🌧️ 비" || currentWeather === "🌫️ 안개") {
            moodBoost *= 0.5;
        }

        // 3. 배가 든든할 때(70 이상)는 기분이 더 잘 올라감 (보너스)
        if (userData.hg > 70) {
            moodBoost += 0.05;
        }

        userData.mood = Math.min(100, userData.mood + moodBoost);
    }
        showBubble("냠냠! 맛있다 🍪");
        saveData();
        updateUI();
    } else alert("먹이가 부족하거나 배부릅니다!");
}

// --- [7. UI 및 모달] ---
// [수정] 경험치 바 업데이트 로직
function updateUI() {
    if (!userData) return;

    // 1. 상단 상태 태그 업데이트
    const statusTag = document.getElementById('status-tag');
    let statusText = "● 활동중";
    let statusColor = "#14F195"; 

    if (isBonusTime) {
        statusText = "🔥 BONUS TIME!!";
        statusColor = "#ff4757"; 
    } else if (userData.hg <= 0) {
        statusText = "● 그로기 (탈진)";
        statusColor = "#ea14d1ae"; 
    } else if (isSleeping) {
        statusText = "● 휴식 중";
        statusColor = "#3498db"; 
    } else if (userData.isAdventuring) {
        statusText = "● 탐험 중";
        statusColor = "#f1c40f"; 
    }

    if (statusTag) {
        statusTag.innerText = statusText;
        statusTag.style.color = statusColor;
        statusTag.style.border = `1px solid ${statusColor}`;
        statusTag.style.animation = isBonusTime ? "blink 0.5s infinite" : "none";
    }

    // 2. 경험치 바 계산 (30일 밸런스 공식 적용)
    const getLevelXP = (lv) => {
        let req = 500 + (lv * 500) + (Math.pow(lv, 2) * 150);
        if (lv >= 100) req += Math.pow(lv - 99, 3) * 15;
        if (lv >= 200) req += Math.pow(lv - 199, 4) * 50;
        return Math.floor(req);
    };

    const nextXPRequired = getLevelXP(userData.lv);
    let xpPercent = (userData.xp / nextXPRequired) * 100;
    xpPercent = Math.min(100, Math.max(0, xpPercent));

    const expBar = document.getElementById('exp-bar');
    const expLabel = document.getElementById('exp-label');

    if (expBar) expBar.style.width = xpPercent + "%";
    if (expLabel) {
        expLabel.innerText = `Lv.${userData.lv} (${xpPercent.toFixed(4)}%)`;
    }

    // 3. 자원 수치 업데이트
    const hungryBar = document.getElementById('hungry-bar');
    const hungryVal = document.getElementById('hungry-val');
    const moodBar = document.getElementById('mood-bar');
    const moodVal = document.getElementById('mood-val');

    if (hungryBar) hungryBar.style.width = userData.hg + "%";
    if (hungryVal) hungryVal.innerText = `${Math.floor(userData.hg)}/100`;
    if (moodBar) moodBar.style.width = userData.mood + "%";
    if (moodVal) moodVal.innerText = `${Math.floor(userData.mood)}/100`;

    if (document.getElementById('food-val')) document.getElementById('food-val').innerText = `${userData.foodCount}/10`;
    if (document.getElementById('shard-val')) document.getElementById('shard-val').innerText = Math.floor(userData.shards).toLocaleString();

    // 4. 이름 및 칭호 표시
    const title = TITLES.filter(t => userData.lv >= t.lv).pop();
    let nameDisplay = `[${title.name}] ${userData.id}`;
    if (userData.isDonator) {
        nameDisplay = `<span style="color:#f1c40f; font-weight:bold;">[💎명예]</span> ` + nameDisplay;
    }
    const userTitleEl = document.getElementById('user-title');
    if (userTitleEl) userTitleEl.innerHTML = nameDisplay;
}
   
function openModal() {
    const modal = document.getElementById('game-modal');
    const content = document.getElementById('modal-tab-content');
    if (!modal || !content) return;

    // 모달 활성화 (방법 통일)
    modal.style.display = 'block';
    
    // 이 안에 기부 버튼 코드가 들어있어야 합니다.
    content.innerHTML = `
        <div style="text-align:center; margin-bottom:15px;"><h2 style="color:#14F195; margin:0; font-size:18px;">📜 전체 메뉴</h2></div>
        
        <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:8px; margin-bottom:15px;">
            <div onclick="showMenuDetail('m-equip')" style="background:#333; color:#fff; border:1px solid #9945FF; height:45px; border-radius:10px; display:flex; justify-content:center; align-items:center; font-size:11px; cursor:pointer;">⚔️ 장비/강화</div>
            <div onclick="showMenuDetail('m-dungeon')" style="background:#333; color:#fff; border:1px solid #9945FF; height:45px; border-radius:10px; display:flex; justify-content:center; align-items:center; font-size:11px; cursor:pointer;">🏹 구역탐험</div>
            <div onclick="showMenuDetail('m-rank')" style="background:#333; color:#fff; border:1px solid #9945FF; height:45px; border-radius:10px; display:flex; justify-content:center; align-items:center; font-size:11px; cursor:pointer;">🏆 랭킹순위</div>
            <div onclick="showMenuDetail('m-boss')" style="background:#444; color:#fff; border:1px solid #ff4757; height:45px; border-radius:10px; display:flex; justify-content:center; align-items:center; font-size:11px; cursor:pointer;">👹 보스레이드</div>
        </div>
        
        <div onclick="donateShards()" style="background:linear-gradient(45deg, #f1c40f, #d4af37); color:#000; border:1px solid #fff; height:40px; border-radius:10px; display:flex; justify-content:center; align-items:center; font-size:11px; cursor:pointer; font-weight:bold; margin-bottom:15px; box-shadow: 0 0 10px rgba(241, 196, 15, 0.5);">💖 10만 조각 기부 (명예 획득)</div>

        <div id="menu-detail-area" style="min-height:160px; background:rgba(0,0,0,0.3); border-radius:10px; padding:10px; border:1px solid #333;">
            <p style="text-align:center; color:#666; font-size:11px; margin-top:60px;">메뉴를 선택하세요.</p>
        </div>
        
        <button onclick="closeModal()" style="background:#FF4757; width:100%; margin-top:15px; padding:12px; border:none; border-radius:10px; color:white; font-weight:bold; cursor:pointer;">닫기</button>
    `;
}

const BOSSES = {
    weekly: { name: "🔥 주간 보스: 라바 골렘", minLv: 80, hp: 10000, rewardShard: 2000 },
    monthly: { name: "🐉 월간 보스: 솔라나 드래곤", minLv: 180, hp: 100000, rewardShard: 20000 }
};

async function showMenuDetail(menuId) {
    const detailArea = document.getElementById('menu-detail-area');
    let html = '';

    if (menuId === 'm-equip') {
        html = `<b style="color:#9945FF;">🛡️ 장비 강화 스테이션</b><br>
                <div style="margin-top:10px; max-height:280px; overflow-y:auto; padding-right:5px;">`;

        const parts = { 
            weapon: { label: "무기", icon: "⚔️" }, 
            helmet: { label: "투구", icon: "🪖" }, 
            armor: { label: "갑옷", icon: "👕" }, 
            boots: { label: "신발", icon: "👟" }, 
            accessory: { label: "반지", icon: "💍" } 
        };

        // 실제 로직과 동일한 배수 설정
        const gradeMultipliers = { Common: 1, Uncommon: 1.2, Rare: 1.5, Epic: 3, Legendary: 10 };

        Object.keys(parts).forEach(key => {
            const item = userData.inventory[key];
            const p = parts[key];

            if (!item) {
                // 장비가 없을 때: 제작 버튼
                html += `
                    <div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:12px; margin-bottom:10px; border:1px dashed #444;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-size:12px; color:#888;">${p.icon} ${p.label} 없음</span>
                            <button onclick="upgradeItem('${key}')" style="font-size:10px; padding:5px 10px; cursor:pointer; background:#444; color:#fff; border:none; border-radius:6px;">🔨 제작 (300💎)</button>
                        </div>
                    </div>`;
            } else {
                // 장비가 있을 때: 강화 정보 표시
                const baseCost = gradeMultipliers[item.grade] * 200;
                const levelCost = item.level * 100; 
                const upgradeCost = Math.floor(baseCost + levelCost);
                
                // 3강까지는 SAFE, 그 이후는 RISK
                const isSafe = item.level < 3;
                const safetyTag = isSafe 
                    ? `<span style="color:#14F195; font-size:10px; font-weight:bold;">[SAFE]</span>` 
                    : `<span style="color:#ff4757; font-size:10px; font-weight:bold;">[RISK]</span>`;

                html += `
                    <div style="background:rgba(255,255,255,0.08); padding:12px; border-radius:12px; margin-bottom:10px; border:1px solid #9945FF;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <div>
                                <div style="font-size:13px; font-weight:bold; color:#fff;">
                                    ${p.icon} ${GRADES[item.grade].name} ${p.label} +${item.level}
                                </div>
                                <div style="font-size:10px; color:#14F195; margin-top:3px;">전투력 상승: +${(GRADES[item.grade].power + (item.level * 5))}</div>
                            </div>
                            <button onclick="upgradeItem('${key}')" style="background:#9945FF; color:#fff; border:none; padding:6px 12px; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer;">
                                강화하기
                            </button>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; border-top:1px solid rgba(255,255,255,0.1); padding-top:8px;">
                            <span style="font-size:11px; color:#f1c40f; font-weight:bold;">💎 ${upgradeCost.toLocaleString()}</span>
                            ${safetyTag}
                        </div>
                    </div>`;
            }
        });

        html += `</div>`;
    }
    else if (menuId === 'm-rank') {
        detailArea.innerHTML = "로딩 중...";
        const snap = await db.ref('users').once('value');
        const ranks = Object.values(snap.val() || {}).sort((a, b) => b.xp - a.xp).slice(0, 50); // 50명으로 확장
        html = `<b style="color:#f1c40f;">🏆 TOP 50</b><div style="margin-top:5px; max-height:180px; overflow-y:auto;">` + 
               ranks.map((u, i) => `<div style="font-size:11px; margin-bottom:3px; text-align:left;">${i+1}. ${u.id} (Lv.${u.lv})</div>`).join('') + `</div>`;
    } 
    else if (menuId === 'm-dungeon') {
    html = `<b style="color:#14F195;">🏹 재료 파밍 (구역 선택)</b><br>
            <div style="margin-top:10px; max-height:280px; overflow-y:auto; padding-right:5px;">`;

    EXPLORE_ZONES.forEach((z, i) => {
        const isLocked = userData.lv < z.minLv;
        const costTag = (z.cost === 0) 
            ? `<span style="color:#14F195; font-weight:bold;">FREE</span>` 
            : `<span style="color:#f1c40f;">💎 ${z.cost.toLocaleString()}</span>`;

        html += `
            <div style="background:rgba(255,255,255,0.05); border:1px solid ${isLocked ? '#444' : '#9945FF'}; 
                        padding:12px; border-radius:12px; margin-bottom:10px; opacity:${isLocked ? 0.6 : 1};">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:13px; font-weight:bold; color:${isLocked ? '#888' : '#fff'};">
                        ${z.name} <small style="font-size:9px; color:#aaa;">(Lv.${z.minLv})</small>
                    </span>
                    ${!userData.isAdventuring && !isLocked ? 
                        `<button onclick="startZoneExplore(${i})" style="font-size:10px; padding:5px 12px; background:#9945FF; color:white; border:none; border-radius:6px; cursor:pointer;">채집 시작</button>` : ''}
                </div>
                <div style="font-size:10px; color:#888; margin-top:5px; line-height:1.4;">${z.desc}</div>
                <div style="font-size:11px; color:#ccc; margin-top:8px; display:flex; justify-content:space-between; border-top:1px solid rgba(255,255,255,0.05); padding-top:8px;">
                    <span>비용: ${costTag}</span>
                    <span>⏳ ${z.time}분</span>
                </div>
            </div>`;
    });
    // ... (이하 탐험 중 UI는 기존과 동일)
    html += `</div>`;
}

    else if (menuId === 'm-boss') {
    html = `<b style="color:#ff4757;">👹 거대 보스 레이드</b><br>
            <div style="margin-top:10px;">`;
    
    for (let key in BOSSES) {
        const b = BOSSES[key];
        const isLocked = userData.lv < b.minLv;
        html += `
            <div style="background:rgba(255,0,0,0.05); border:1px solid ${isLocked ? '#444' : '#ff4757'}; padding:12px; border-radius:12px; margin-bottom:10px;">
                <div style="font-size:12px; font-weight:bold;">${isLocked ? '🔒 ' : ''}${b.name}</div>
                <div style="font-size:10px; color:#aaa; margin:5px 0;">필요 레벨: ${b.minLv} | 보상: 💎${b.rewardShard.toLocaleString()}</div>
                ${!isLocked ? `<button onclick="fightBoss('${key}')" style="width:100%; padding:5px; background:#ff4757; border:none; color:white; border-radius:5px; cursor:pointer;">도전하기</button>` : ''}
            </div>`;
    }
    html += `</div>`;
    }
    else if (menuId === 'm-dungeon') {
        html = `<b style="color:#14F195;">🏹 구역 탐험</b><div style="margin-top:10px;">`;
        EXPLORE_ZONES.forEach((z, i) => {
            const isLocked = userData.lv < z.minLv;
            html += `<div style="background:rgba(255,255,255,0.05); border:1px solid ${isLocked ? '#444' : '#9945FF'}; padding:8px; border-radius:10px; margin-bottom:5px; opacity:${isLocked ? 0.6 : 1};">
                <span style="font-size:11px;">${isLocked ? '🔒' : '📍'} ${z.name}</span>
                ${!userData.isAdventuring && !isLocked ? `<button onclick="startZoneExplore(${i})" style="float:right; font-size:10px;">출발</button>` : ''}
            </div>`;
        });
        html += `</div>`;
    }
    else if (menuId === 'm-rank') {
        detailArea.innerHTML = "조회 중...";
        const snap = await db.ref('users').once('value');
        const ranks = Object.values(snap.val() || {}).sort((a,b)=>b.xp-a.xp).slice(0, 10);
        html = `<b>🏆 TOP 10</b><br>` + ranks.map((u, i) => `<div style="font-size:11px;">${i+1}. ${u.id} (Lv.${u.lv})</div>`).join('');
    }
    detailArea.innerHTML = html;
}

async function fightBoss(type) {
    const boss = BOSSES[type];
    if (userData.hg < 50) return alert("전투를 하기엔 너무 배고픕니다! (최소 50 HG 필요)");
    
    userData.hg -= 50;
    alert(`${boss.name}과의 전투를 시작합니다!`);
    
    // 확률적 승리 (레벨이 높을수록 유리하게 설정 가능)
    const success = Math.random() > 0.3; // 70% 확률로 승리
    
    if (success) {
        userData.shards += boss.rewardShard;
        alert(`🎉 처치 성공! 보상으로 조각 ${boss.rewardShard}개를 얻었습니다!`);
    } else {
        alert("🛑 아쉽게 패배했습니다... 좀 더 수련해서 오세요!");
    }
    
    saveData();
    updateUI();
    showMenuDetail('m-boss');
}



// --- [8. 보조 함수들] ---
function upgradeItem(type) {
    let item = userData.inventory[type];
    
    // 1. 장비 제작 (기존 로직 유지)
    if (!item) {
        if (userData.shards < 300) return alert("제작비 300💎이 부족합니다!");
        userData.shards -= 300;
        userData.inventory[type] = { grade: "Common", level: 0, power: GRADES.Common.power };
        alert(`🔨 [커먼] ${type} 제작 완료!`);
        saveData(); updateUI(); showMenuDetail('m-equip'); return;
    }

    // 2. 강화 비용 계산 (Rare 1강 기준 약 400💎 공식)
    const gradeMultipliers = { Common: 1, Uncommon: 1.2, Rare: 1.5, Epic: 3, Legendary: 10 };
    const baseCost = gradeMultipliers[item.grade] * 200;
    const levelCost = item.level * 100; 
    const upgradeCost = Math.floor(baseCost + levelCost);

    if (userData.shards < upgradeCost) {
        return alert(`강화비 ${upgradeCost.toLocaleString()}💎이 부족합니다!`);
    }
    
    // 3. 강화 시도 확인
    const safetyMsg = item.level < 3 ? "✅ 3강까지는 파괴/하락 없는 안전 구간입니다." : "⚠️ 실패 시 강화 단계가 하락할 수 있습니다!";
    if (!confirm(`비용: ${upgradeCost.toLocaleString()}💎\n${safetyMsg}\n강화를 시도하시겠습니까?`)) return;

    userData.shards -= upgradeCost;
    
    // 4. 성공 확률 설정
    const gradeSuccessBase = { Common: 0.95, Uncommon: 0.85, Rare: 0.7, Epic: 0.5, Legendary: 0.3 };
    let successChance = gradeSuccessBase[item.grade] - (item.level * 0.03);
    
    // 3강까지는 무조건 성공 (안전 강화)
    if (item.level < 3) successChance = 1.0;

    const rand = Math.random();

    if (rand < successChance) {
        // --- [성공 로직] ---
        item.level++;
        
        // 10강 달성 시 다음 등급 승급 도전
        if (item.level > 10) {
            const gradeOrder = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];
            let currentIdx = gradeOrder.indexOf(item.grade);
            
            if (currentIdx < gradeOrder.length - 1) {
                const nextGrade = gradeOrder[currentIdx + 1];
                item.grade = nextGrade;
                item.level = 0; // 승급 시 0강부터 다시 시작
                item.power = GRADES[nextGrade].power;
                alert(`🎊 축하합니다! 장비가 [${GRADES[nextGrade].name}] 등급으로 진화했습니다!`);
            } else {
                item.level = 10; // 레전더리 10강이 끝
                alert("이미 신의 경지에 도달한 장비입니다!");
            }
        } else {
            showBubble(`✨ 강화 성공! (+${item.level})`);
        }
    } else {
        // --- [실패 로직] ---
        if (item.level <= 3) {
            // 안전 구간은 실패해도 변화 없음 (사실 확률 100%라 여기 올 일은 없음)
            showBubble(`❌ 강화 실패... (안전 구간이라 단계 유지)`);
        } else {
            // 4강부터는 실패 시 1단계 하락
            item.level = Math.max(3, item.level - 1); 
            alert(`💀 강화 실패! 단계가 하락하여 (+${item.level})이 되었습니다.`);
        }
    }

    saveData();
    updateUI(); 
    showMenuDetail('m-equip');
}

// [3단계] 레벨별 탐험 구역 설정
const EXPLORE_ZONES = [
    { 
        name: "🌾 카다이프 실타래 들판", 
        minLv: 1, cost: 0, 
        shard: [5, 15], food: [2, 5], time: 5,
        desc: "바삭한 면들이 바람에 날리는 들판입니다. 기본 재료를 얻기 좋아요."
    },
    { 
        name: "🧈 노란 무염버터 샘터", 
        minLv: 30, cost: 500, 
        shard: [50, 100], food: [5, 10], time: 15,
        desc: "풍미 가득한 버터가 흐르는 곳입니다. 카다이프를 볶을 때 필수죠!"
    },
    { 
        name: "💚 피스타치오 꾸덕 호수", 
        minLv: 80, cost: 2000, 
        shard: [200, 450], food: [10, 20], time: 30,
        desc: "진한 초록빛 스프레드가 가득합니다. 가장 인기 있는 재료입니다."
    },
    { 
        name: "☁️ 마시멜로 쫀득 구름 언덕", 
        minLv: 130, cost: 8000, 
        shard: [1000, 2500], food: [20, 40], time: 60,
        desc: "밟으면 푹신하고 쫀득한 언덕입니다. 두쫀쿠의 식감을 담당해요."
    },
    { 
        name: "🍫 화이트 커버춰 암석 지대", 
        minLv: 180, cost: 30000, 
        shard: [5000, 12000], food: [50, 100], time: 120,
        desc: "반짝이는 초콜릿 원석이 박힌 동굴입니다. 최상급 코팅 재료를 얻으세요!"
    }
];

async function startZoneExplore(zoneIdx) {
    const zone = EXPLORE_ZONES[zoneIdx];

    // 1. 레벨 제한 확인
    if (userData.lv < zone.minLv) {
        return alert(`이곳은 레벨 ${zone.minLv} 이상부터 입장 가능합니다!`);
    }
    // 2. 이미 탐험 중인지 확인
    if (userData.isAdventuring) {
        return alert("이미 탐험 중인 캐릭터가 있습니다!");
    }
    // 3. 허기 확인
    if (userData.hg < 30) {
        return alert("배고파서 탐험을 떠날 수 없어요! (최소 30 HG 필요)");
    }

    // --- [수정된 부분: 데이터 시트의 cost 값을 직접 사용] ---
    const entryFee = zone.cost || 0; // 데이터에 cost가 없으면 0으로 처리
    
    if (userData.shards < entryFee) {
        return alert(`입장료 ${entryFee.toLocaleString()}💎이 부족합니다!`);
    }
    
    // 입장료 차감
    userData.shards -= entryFee; 
    // --------------------------------------------------

    // 탐험 설정
    userData.hg -= 30;
    userData.isAdventuring = true;
    userData.adventureZoneIdx = zoneIdx; 
    userData.adventureEndTime = Date.now() + (zone.time * 60 * 1000);

    // 알림창 메시지 분기 (무료/유료)
    if (entryFee > 0) {
        alert(`[${zone.name}] 입장료 ${entryFee.toLocaleString()}💎 지불! 탐험을 시작합니다.`);
    } else {
        alert(`[${zone.name}] 탐험을 시작합니다!`);
    }
    
    saveData();
    showMenuDetail('m-dungeon'); 
    updateUI();
}

function saveData() {
    if (userData && db) {
        // 유저의 시간당 레벨업 속도를 추측하기 위한 로그
        console.log(`[MONITOR] ID: ${userData.id} | Lv: ${userData.lv} | XP: ${Math.floor(userData.xp)}`);
        
        // 비정상 유저 감지
        if (userData.lv > 350) {
            console.warn(`🚨 주의: ${userData.id} 유저가 350레벨을 돌파했습니다.`);
        }

        db.ref(`users/${userData.id}`).set(userData);
    }
}

// 3. 모달 닫기 공통 함수 (기존에 있다면 확인만 하세요)
function showBubble(text) {
    const bubble = document.getElementById('speech-bubble');
    const bubbleText = document.getElementById('bubble-text');
    
    if (!bubble || !bubbleText) return;

    bubbleText.innerText = text;
    // 'block'이 아니라 'flex'여야 세로 중앙 정렬이 작동합니다!
    bubble.style.display = 'flex'; 

    // 3초 뒤에 사라지게 설정
    setTimeout(() => {
        bubble.style.display = 'none';
    }, 3000);
}

function showComboUI(c) {
    let el = document.getElementById('combo-display');
    if(!el) {
        el = document.createElement('div'); 
        el.id = 'combo-display';
        document.getElementById('character-area').appendChild(el);
    }
    el.style.left = (c % 2 === 0) ? '75%' : '25%';
    el.innerHTML = `<span style="font-size: 32px; color: #FF4757;">${c}</span> COMBO!`; 
    el.style.display = 'block';
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
    const container = document.getElementById('character-area');
    const weatherList = ["☀️ 맑음", "🌧️ 비", "❄️ 눈", "🍃 바람", "🌫️ 안개"];
    const current = weatherList[Math.floor(Math.random() * weatherList.length)];
    
    // 기존 입자 및 효과 제거
    document.querySelectorAll('.weather-particle, .fog-layer').forEach(p => p.remove());
    container.style.filter = "none"; // 필터 초기화

    if (current === "🌧️ 비" || current === "❄️ 눈" || current === "🍃 바람") {
        const emoji = current === "🌧️ 비" ? "💧" : (current === "❄️ 눈" ? "❄️" : "🍃");
        const count = current === "🍃 바람" ? 10 : 20; // 바람은 조금만

        for (let i = 0; i < count; i++) {
            const p = document.createElement('div');
            p.className = 'weather-particle';
            p.innerText = emoji;
            p.style.left = Math.random() * 100 + "%";
            p.style.fontSize = (Math.random() * 10 + 10) + "px";
            p.style.animationDuration = (Math.random() * 2 + (current === "🍃 바람" ? 3 : 2)) + "s";
            p.style.animationDelay = Math.random() * 2 + "s";
            
            // 바람일 때는 사선으로 날아가도록 클래스 추가
            if (current === "🍃 바람") p.classList.add('windy');
            
            container.appendChild(p);
        }
    } else if (current === "🌫️ 안개") {
        // 안개 효과: 반투명한 레이어 추가 및 캐릭터 살짝 흐리게
        const fog = document.createElement('div');
        fog.className = 'fog-layer';
        container.appendChild(fog);
        container.style.filter = "contrast(90%) brightness(110%)";
    } else if (current === "☀️ 맑음") {
        // 맑을 때는 캐릭터에 광원 효과 (필터)
        container.style.filter = "saturate(1.2) brightness(1.1)";
    }
    
    console.log("현재 날씨:", current);
}

async function updateRanking() {
    const snap = await db.ref('users').once('value');
    const top30 = Object.values(snap.val() || {}).sort((a,b)=>b.xp-a.xp).slice(0, 10);
    const el = document.getElementById('ranking-list');
    if(el) el.innerText = top30.map((u,i)=>`${i+1}위: ${u.id}`).join(" | ");
}

function checkGroggy() { if (userData && userData.hg <= 0) isSleeping = true; }

function checkFoodSupply() {
    const now = new Date();
    const h = now.getHours();
    const supply = [22, 4, 10, 16];
    let slot = "";
    supply.forEach(sh => { if(h >= sh && h < sh+6) slot = `${now.getDate()}-${sh}`; });
    if(slot && userData && userData.lastFoodSlot !== slot) {
        userData.foodCount = Math.min(10, userData.foodCount + 2);
        userData.lastFoodSlot = slot;
        showBubble("🎁 정기 보급 완료!");
        saveData(); updateUI();
    }
}

async function donateShards() {
    const DONATION_AMOUNT = 100000; // 기부 금액 (10만 조각)

    if (userData.shards < DONATION_AMOUNT) {
        return alert(`기부하려면 ${DONATION_AMOUNT.toLocaleString()}💎이 필요합니다. 조금 더 모아주세요!`);
    }

    if (confirm(`정말로 ${DONATION_AMOUNT.toLocaleString()}💎을 기부하여 명예를 얻으시겠습니까?\n(영구적인 전용 태그가 부여됩니다!)`)) {
        userData.shards -= DONATION_AMOUNT;
        userData.isDonator = true; // 기부자 상태 기록
        
        showBubble("💖 대량 기부! 당신은 이 시대의 성자입니다!");
        alert("✨ 기부가 완료되었습니다! 이제 이름 옆에 [💎명예] 태그가 붙습니다.");
        
        saveData();
        updateUI();
        if (document.getElementById('game-modal').classList.contains('active')) {
            showMenuDetail('m-boss'); // 또는 적절한 메뉴 새로고침
        }
    }
}

// --- [날씨 시스템 최종 수정본] ---
let currentWeather = "☀️ 맑음";

// 🕒 1분마다 날씨 변경
setInterval(updateWeather, 60000);

// 🚀 로그인 성공 시 호출되도록 loginSuccess 함수 안에 updateWeather(); 가 있는지 확인하세요!
// 🚀 게임 시작 시 즉시 실행 (가장 중요!)
setTimeout(updateWeather, 1000);

// --- [8. 스킨 및 보조 시스템] ---

// 1. 스킨 데이터 설정
const SKINS = {
    'default': { 
        name: '오리지널 블랙', 
        background: '#050505' 
    },
    'solana': { 
        name: '네온 시티 (SOL)', 
        background: "url('./assets/images/backgrounds/solanacity.png')", 
        msg: "솔라나의 에너지가 흐르는 네온 시티에 오신 것을 환영합니다! ⚡",
        uiStyle: {
            borderColor: "#19FB9B", // 솔라나 민트색 테두리
            boxShadow: "0 0 15px #DC1FFF" // 퍼플 네온 광채 효과
        }
    },
    'sunset': { 
        name: '사이버 선셋', 
        background: "url('./assets/images/backgrounds/cybersunset.jpg')", 
        msg: "보랏빛 노을 사이로 시커 타워가 빛나고 있어요... 🌆✨",
        themeColor: "#ff00ff", // UI 포인트 컬러 (네온 핑크)
        characterEffect: "neon-glow" // 캐릭터에 은은한 빛 효과 추가 (선택 사항)
    },
    'bakery': { 
        name: '두쫀쿠 베이커리', 
        background: "url('./assets/images/backgrounds/bakery.jpg')", 
        msg: "갓 구운 따끈따끈한 두쫀쿠들이 기다려요! 🥖🍪" 
    },
    'village': { 
        name: '평화로운 마을', 
        background: "url('./assets/images/backgrounds/village_bg.jpg')", 
        msg: "마을 공기가 참 좋다, 그치? 🌲" 
    }
};


// 3. 스킨 메뉴 열기
function openSkinMenu() {
    const modal = document.getElementById('game-modal');
    const modalContent = document.getElementById('modal-tab-content');
    if (!modal || !modalContent) return;

    modal.style.display = 'block';
    let html = `
        <div id="skin-menu-container" style="padding: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="color: #14F195; margin: 0;">🎨 스킨 보관함</h3>
                <span onclick="closeModal()" style="cursor:pointer; color:#888; font-size:24px;">&times;</span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
    `;
    for (let key in SKINS) {
        html += `
            <div onclick="applySkin('${key}')" style="
                cursor: pointer; padding: 20px 10px; border-radius: 12px;
                background: ${SKINS[key].background}; border: 2px solid rgba(255,255,255,0.1);
                text-align: center; transition: transform 0.2s;
            ">
                <span style="color: white; font-weight: bold; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">${SKINS[key].name}</span>
            </div>
        `;
    }
    html += `</div></div>`;
    modalContent.innerHTML = html;
}

// 4. 레벨업 판정 함수 (에러 해결의 핵심)
function checkLevelUp() {
    if (!userData) return;
    const getRequiredXP = (lv) => {
        let req = 500 + (lv * 500) + (Math.pow(lv, 2) * 150);
        if (lv >= 100) req += Math.pow(lv - 99, 3) * 15;
        if (lv >= 200) req += Math.pow(lv - 199, 4) * 50;
        return Math.floor(req);
    };

    let required = getRequiredXP(userData.lv);
    if (userData.xp >= required) {
        userData.xp -= required;
        userData.lv++;
        showBubble(`🎊 LEVEL UP! Lv.${userData.lv}`);
        userData.shards += (userData.lv * 10);
        triggerLevelUpEffect();
        saveData();
        checkLevelUp(); // 연속 레벨업 체크
    }
}

// 5. 유틸리티 함수들
function closeModal() {
    const modal = document.getElementById('game-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
}

function showBubble(text) {
    const bubble = document.getElementById('speech-bubble');
    const bubbleText = document.getElementById('bubble-text');
    if (!bubble || !bubbleText) return;
    bubbleText.innerText = text;
    bubble.style.display = 'flex'; 
    setTimeout(() => { bubble.style.display = 'none'; }, 3000);
}

function saveData() {
    if (userData && db) {
        console.log(`[MONITOR] ID: ${userData.id} | Lv: ${userData.lv} | XP: ${Math.floor(userData.xp)}`);
        db.ref(`users/${userData.id}`).set(userData);
    }
}

// 레트로 게임기 엔진

// --- [잠자기 기능 추가] ---
function toggleSleep() {
    if (!userData) return;
    isSleeping = !isSleeping;
    
    const charImg = document.getElementById('character-img');
    const sleepBtn = document.querySelector('.action-btn:nth-child(2)'); // 두 번째 버튼 (활동/잠자기)

    if (isSleeping) {
        if (charImg) charImg.classList.add('sleeping');
        if (sleepBtn) sleepBtn.innerText = "☀️ 깨우기";
        showBubble("Zzz... 숙면 중...");
    } else {
        if (charImg) charImg.classList.remove('sleeping');
        if (sleepBtn) sleepBtn.innerText = "💤 잠자기";
        showBubble("하암~ 잘 잤다!");
    }
    saveData();
    updateUI();
}

// --- [레트로 오디오 엔진] ---
if (typeof RetroAudio === 'undefined') {
    var RetroAudio = {
        ctx: null,
        isPlaying: false,
        loopInterval: null, // 타이머를 저장할 변수 추가

        init() {
            if (!this.ctx) {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
        },

        playLoop() {
            this.init();
            if (this.isPlaying) return; // 이미 재생 중이면 무시
            
            this.isPlaying = true;
            const sequence = [440, 523, 659, 783]; 
            let step = 0;

            // 기존에 돌아가던 타이머가 있다면 확실히 제거
            if (this.loopInterval) clearInterval(this.loopInterval);

            this.loopInterval = setInterval(() => {
                if (!this.isPlaying) {
                    clearInterval(this.loopInterval); // 멈춤 상태면 타이머 해제
                    return;
                }
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'square';
                osc.frequency.setValueAtTime(sequence[step % sequence.length], this.ctx.currentTime);
                gain.gain.setValueAtTime(0.02, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start();
                osc.stop(this.ctx.currentTime + 0.2);
                step++;
            }, 200);
        },

        // 멈춤 기능 추가
        stopLoop() {
            this.isPlaying = false;
            if (this.loopInterval) {
                clearInterval(this.loopInterval);
                this.loopInterval = null;
            }
        },

        playClick() {
            this.init();
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle'; 
            osc.frequency.setValueAtTime(523.25, this.ctx.currentTime); 
            osc.frequency.exponentialRampToValueAtTime(1046.50, this.ctx.currentTime + 0.1); 
            gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.1);
        },

        playMenuClick() {
            this.init();
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square'; 
            osc.frequency.setValueAtTime(523.25, this.ctx.currentTime); 
            osc.frequency.exponentialRampToValueAtTime(783.99, this.ctx.currentTime + 0.05); 
            gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.05);
        }
    }; // RetroAudio 객체 끝
} // if문 끝

// --- [이벤트 연결] ---
window.addEventListener('click', () => {
    RetroAudio.playLoop();
}, { once: true });

const charImgEl = document.getElementById('character-img'); 
if (charImgEl) {
    charImgEl.addEventListener('click', () => {
        RetroAudio.playClick();
    });
}

document.addEventListener('click', (e) => {
    if (e.target.closest('button') || e.target.closest('.nav-item') || e.target.closest('.action-btn')) {
        RetroAudio.playMenuClick();
    }
});

function openWalkMenu() {
    // 레트로 클릭음 재생
    if (typeof RetroAudio !== 'undefined') RetroAudio.playMenuClick();

    const content = `
        <div style="text-align:center; padding: 10px;">
            <h3 style="color:#14F195; margin-bottom:20px;">🐾 두쫀쿠 산책센터</h3>
            <div style="display:grid; gap:10px;">
                <button onclick="startGpsSearch()" style="padding:15px; border-radius:12px; border:none; background:#9945FF; color:#fff; font-weight:bold;">📍 GPS로 두쫀쿠 찾기</button>
                <button onclick="openUserList()" style="padding:15px; border-radius:12px; border:none; background:#333; color:#fff; font-weight:bold;">🏠 다른 유저 방문하기</button>
            </div>
            <p style="font-size:11px; color:#888; margin-top:15px;">※ 산책 수익은 $DUJJONCU 유동성 풀에 기여됩니다.</p>
        </div>
    `;
    
    // 기존 모달 함수 활용
    const modalTab = document.getElementById('modal-tab-content');
    if (modalTab) {
        modalTab.innerHTML = content;
        document.getElementById('game-modal').style.display = 'flex';
    }
}
// [통합된 스킨 적용 및 저장 함수]
function applySkin(skinId) {
    const screen = document.getElementById('screen');
    const skin = SKINS[skinId];
    if (!screen || !skin) return;

    // 1. 화면에 스킨 입히기
    screen.style.backgroundImage = "none"; 
    screen.style.background = skin.background;
    screen.style.backgroundSize = "cover";
    screen.style.backgroundPosition = "center";

    // 2. 유저 데이터에 저장 (로그아웃 후에도 유지)
    if (userData) {
        userData.currentSkin = skinId; 
        saveData(); // Firebase 서버에 저장 요청
        console.log("스킨 저장 완료:", skinId);
    }

    if (typeof closeModal === 'function') closeModal();
    showBubble(skin.msg || `✨ ${skin.name} 스킨이 적용되었습니다!`);
}

// [수정된 날씨 업데이트 함수]
function updateWeather() {
    const weatherIconEl = document.getElementById('weather-icon');
    const weatherTextEl = document.getElementById('weather-text');
    
    const weatherList = [
        { name: "맑음", emoji: "☀️" },
        { name: "비", emoji: "🌧️" },
        { name: "눈", emoji: "❄️" },
        { name: "바람", emoji: "🍃" },
        { name: "안개", emoji: "🌫️" }
    ];
    
    const selected = weatherList[Math.floor(Math.random() * weatherList.length)];
    if (weatherIconEl) weatherIconEl.innerText = selected.emoji;
    if (weatherTextEl) weatherTextEl.innerText = selected.name;
    
    console.log("날씨 동기화:", selected.name);
}