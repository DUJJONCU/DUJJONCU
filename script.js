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

function toggleSleep() {
    const sleepBtn = document.getElementById('sleep-btn');
    const characterImg = document.getElementById('character-img'); // 캐릭터 이미지 가져오기
    
    if (!isSleeping) {
        // 1. 자러 갈 때
        isSleeping = true;
        
        // 애니메이션 클래스 추가
        characterImg.classList.add('sleeping');
        
        // 버튼 및 상태 변경
        sleepBtn.innerHTML = "💤 깨우기";
        console.log("캐릭터가 잠들었습니다.");
    } else {
        // 2. 깨어날 때
        isSleeping = false;
        
        // 애니메이션 클래스 제거
        characterImg.classList.remove('sleeping');
        
        // 버튼 및 상태 변경
        sleepBtn.innerHTML = "⚡ 활동";
        console.log("캐릭터가 깨어났습니다.");
    }
}
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
    updateRanking(); 
    updateWeather();
    setInterval(updateRanking, 60000);
    setInterval(gameLoop, 1000);
}

// --- [5. 게임 루프] ---
function gameLoop() {
    if (!userData) return;

    // [수정] 보너스 타임 랜덤 발생 로직 (중괄호와 실행 함수 연결 수정)
    if (!isBonusTime && Math.random() < 0.001) {
        startBonusTime();
    }
    
    checkGroggy();
    checkFoodSupply();

    if (isSleeping) {
        userData.hg = Math.min(100, userData.hg + 0.3);
        // [수정] 자는 동안 무드가 올라가는 속도를 절반으로 줄임 (0.2 -> 0.1)
        userData.mood = Math.min(100, userData.mood + 0.1); 
        createZzz();
        if(userData.hg >= 100) {
            isSleeping = false;
            const charImg = document.getElementById('character-img');
            if(charImg) charImg.classList.remove('sleeping');
            const sleepBtn = document.getElementById('sleep-btn');
            if(sleepBtn) sleepBtn.innerText = "💤 잠자기";
        }
    } else {
        // [수정] 활동 중 무드 감소 폭을 2배로 증가 (0.05 -> 0.1)
    userData.mood = Math.max(0, userData.mood - 0.1);
}

    // [수정된 부분] 12초마다 두쫀쿠가 상태에 맞는 대사를 무작위로 출력
    if (Date.now() - lastInteractionTime > 12000) {
        // 상태별 리스트 설정
        const state = isSleeping ? 'sleeping' : 
                      (userData.hg < 30 ? 'hungry' : 
                      (userData.mood < 30 ? 'depressed' : 'mzMeme'));
        
        const pool = DIALOGUES[state];
        const randomQuote = pool[Math.floor(Math.random() * pool.length)];
        
        showBubble(randomQuote); // 말풍선 띄우기
        lastInteractionTime = Date.now(); // 시간 초기화
    }

    if (userData.isAdventuring && Date.now() >= userData.adventureEndTime) {
        userData.isAdventuring = false;
        const reward = Math.floor(Math.random() * 51) + 30;
        userData.shards += reward;
        alert(`🏹 탐험 완료! 조각 ${reward}개 획득!`);
        saveData();
    }
    // [gameLoop 내부에 추가]
    if (currentWeather === "🌧️ 비" || currentWeather === "🌫️ 안개") {
    // 비나 안개 날씨에는 무드가 추가로 0.05 더 감소
    userData.mood = Math.max(0, userData.mood - 0.05);
    }
    // gameLoop 내부
    if (!isSleeping) {
    // 기존 -0.05에서 -0.15 정도로 강화 (3배 더 빨리 우울해짐)
    userData.mood = Math.max(0, userData.mood - 0.15); 
    } 

    // [gameLoop 내 하단에 추가]
    if (!isSleeping && userData.hg < 30) {
    // 배고픔이 30 미만이면 무드가 추가로 0.1 더 감소 (총 0.2 감소)
    userData.mood = Math.max(0, userData.mood - 0.1);
    }
    updateUI();
}

// --- [6. 메인 액션] ---
function handleTap() {
    if (!userData || isSleeping || userData.isAdventuring || crisisTimer) return;
    
    // 1. 배고픔 체크
    if (userData.hg <= 0) {
        showBubble("배고파서 기운이 없어요..");
        return;
    }

    const stats = calculateStats();
    const now = Date.now();
    
    // 쿨타임 체크
    if (now - lastClick < 50) return; 
    lastClick = now;
    lastInteractionTime = now;

    let gainedXp = 0;
    let isCritical = false;

    // --- [경험치 계산 로직 수정] ---
    if (isBonusTime) {
        comboCount++;
        clearTimeout(comboTimer);
        showComboUI(comboCount);
        comboTimer = setTimeout(() => { 
            comboCount = 0; 
            hideComboUI(); 
        }, stats.comboTime);

        isCritical = (Math.random() * 100) < (stats.luck * 2); 
        // 보너스 타임: 탭 파워를 적극 반영 (최소 50~200 이상)
        gainedXp = (stats.tapPower * 2) * (isCritical ? 5 : 2);
        
        createSparkle(); 
    } else {
        // 평상시: 레벨에 비례해서 경험치 획득량 대폭 상향 (최소 10점 이상)
        gainedXp = 10 + (userData.lv * 2); 
        comboCount = 0; 
        hideComboUI();
    }

    // --- [데이터 반영] ---
    // 숫자로 확실히 변환하고 경험치 추가
    userData.xp = (Number(userData.xp) || 0) + gainedXp; 
    
    // 허기 소모
    const hgLoss = isBonusTime ? (stats.hgDrain * 0.5) : stats.hgDrain;
    userData.hg = Math.max(0, userData.hg - hgLoss);
    
    userData.mood = Math.min(100, userData.mood + 0.1);

    // 로그 확인 (F12 콘솔에서 상승폭 확인용)
    console.log(`획득 XP: ${gainedXp}, 현재 XP: ${userData.xp.toFixed(2)}`);

    // 저장 및 UI 갱신
    checkLevelUp();
    updateUI();
    saveData();

    // 캐릭터 흔들기 효과
    const img = document.getElementById('character-img');
    if (img) {
        const scale = isBonusTime ? (isCritical ? 1.4 : 1.2) : 1.1;
        img.style.transform = `scale(${scale}) rotate(${Math.random() * 10 - 5}deg)`;
        setTimeout(() => { img.style.transform = "scale(1) rotate(0deg)"; }, 100);
    }
    
    if (isBonusTime && isCritical) {
        showBubble("💥 CRITICAL!!");
        triggerCriticalEffect();
    }
}

function checkLevelUp() {
    // 위와 동일한 공식 적용
    const getLevelXP = (lv) => Math.floor(Math.pow(lv, 2.5) * 450 * 1.2);
    let nextXP = getLevelXP(userData.lv);

    if (userData.xp >= nextXP) {
        userData.lv++;
        userData.shards += (userData.lv * 150); 
        triggerLevelUpEffect();
        showBubble(`🎉 LEVEL UP! (Lv.${userData.lv})`);
        saveData();
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

function toggleSleep() {
    if (!userData) return;
    isSleeping = !isSleeping;
    const btn = document.getElementById('sleep-btn');
    const img = document.getElementById('character-img');
    
    if (isSleeping) {
        btn.innerText = "⏰ 깨우기";
        img.classList.add('sleeping');
        showBubble("Zzz... 잠드는 중...");
    } else {
        btn.innerText = "💤 잠자기";
        img.classList.remove('sleeping');
        showBubble("번쩍! 잘 잤다!");
    }
    saveData();
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

    // 2. 경험치 바 계산
    const getLevelXP = (lv) => Math.floor(Math.pow(lv, 2.5) * 450 * 1.2);
    const prevXP = userData.lv === 1 ? 0 : getLevelXP(userData.lv - 1);
    const nextXP = getLevelXP(userData.lv);
    
    const requiredXPInThisLevel = nextXP - prevXP;
    const currentXPInThisLevel = Math.max(0, userData.xp - prevXP);
    
    let xpPercent = (currentXPInThisLevel / requiredXPInThisLevel) * 100;
    xpPercent = Math.min(100, Math.max(0, xpPercent));

    const expBar = document.getElementById('exp-bar');
    const expLabel = document.getElementById('exp-label');
    
    if (expBar) expBar.style.width = xpPercent + "%";
    
    // [수정] 소수점을 9자리까지 표시하여 정밀도 향상
    if (expLabel) {
        expLabel.innerText = xpPercent.toFixed(9) + "%";
        // 글자가 너무 길어지면 폰트 사이즈를 살짝 줄이는 센스!
        expLabel.style.fontSize = "10px"; 
    }

   // 3. 자원 수치 업데이트 (ID 매칭 및 텍스트 갱신)
    const hungryBar = document.getElementById('hungry-bar');
    const hungryVal = document.getElementById('hungry-val'); // HTML의 숫자 표시 ID
    const moodBar = document.getElementById('mood-bar');
    const moodVal = document.getElementById('mood-val');     // HTML의 숫자 표시 ID

    // 배고픔(HG) 업데이트
    if (hungryBar) hungryBar.style.width = userData.hg + "%";
    if (hungryVal) hungryVal.innerText = `${Math.floor(userData.hg)}/100`;

    // 무드(MOOD) 업데이트
    if (moodBar) moodBar.style.width = userData.mood + "%";
    if (moodVal) moodVal.innerText = `${Math.floor(userData.mood)}/100`;

    // 기타 자원
    if (document.getElementById('food-val')) document.getElementById('food-val').innerText = `${userData.foodCount}/10`;
    if (document.getElementById('shard-val')) document.getElementById('shard-val').innerText = Math.floor(userData.shards).toLocaleString();
    // 4. 이름 및 칭호 표시 (innerHTML 사용 부분)
    const title = TITLES.filter(t => userData.lv >= t.lv).pop();
    let nameDisplay = `[${title.name}] ${userData.id}`;

    if (userData.isDonator) {
        nameDisplay = `<span style="color:#f1c40f; font-weight:bold;">[💎명예]</span> ` + nameDisplay;
    }

    const userTitleEl = document.getElementById('user-title');
    if (userTitleEl) {
        userTitleEl.innerHTML = nameDisplay; // <-- 질문하신 코드가 바로 여기 들어갑니다!
    }
}
   
function openModal() {
    const modal = document.getElementById('game-modal');
    const content = document.getElementById('modal-tab-content');
    modal.classList.add('active');
    
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

async function showMenuDetail(menuId) {
    const detailArea = document.getElementById('menu-detail-area');
    let html = '';

    if (menuId === 'm-equip') {
    const parts = { 
        weapon: { label: "무기", icon: "⚔️" }, 
        helmet: { label: "투구", icon: "🪖" }, 
        armor: { label: "갑옷", icon: "👕" }, 
        boots: { label: "신발", icon: "👟" }, 
        accessory: { label: "반지", icon: "💍" } 
    };

    html = `<div style="text-align:center; margin-bottom:10px;">
                <b style="color:#9945FF; font-size:14px;">📦 대장간</b><br>
                <small style="color:#888;">강화 성공 시 +1 / 실패 시 -1 (10강 달성 시 승급!)</small>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; max-height:280px; overflow-y:auto; padding:5px;">`;

    for (let key in parts) {
        const item = userData.inventory[key];
        const gName = item ? GRADES[item.grade].name : "미착용";
        const gColor = item ? GRADES[item.grade].color : "#555";
        const level = item ? item.level : 0;
        
        // 강화 게이지 생성 (10칸)
        let gauge = `<div style="display:flex; gap:1px; margin:4px 0;">`;
        for(let i=1; i<=10; i++) {
            gauge += `<div style="flex:1; height:4px; background:${i <= level ? gColor : '#333'}; border-radius:2px;"></div>`;
        }
        gauge += `</div>`;

        html += `
            <div style="background:rgba(0,0,0,0.4); padding:10px; border-radius:12px; border:1px solid ${item ? gColor : '#333'}; position:relative; overflow:hidden;">
                <div style="position:absolute; top:-20px; right:-20px; font-size:40px; opacity:0.1;">${parts[key].icon}</div>
                
                <div style="display:flex; align-items:center; gap:5px; margin-bottom:5px;">
                    <span style="font-size:16px;">${parts[key].icon}</span>
                    <span style="font-size:10px; color:#aaa;">${parts[key].label}</span>
                </div>

                <div style="color:${gColor}; font-size:11px; font-weight:bold;">
                    ${gName} <span style="color:#fff;">+${level}</span>
                </div>
                
                ${gauge}

                <button onclick="upgradeItem('${key}')" 
                        style="width:100%; margin-top:8px; padding:6px; font-size:10px; background:${item ? '#444' : '#9945FF'}; color:#fff; border:none; border-radius:6px; cursor:pointer; transition:0.2s;">
                    ${item ? `강화 (${(level+1)*200}💎)` : '제작 (500💎)'}
                </button>
            </div>`;
    }
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
        html = `<b style="color:#14F195;">📍 탐험 구역 선택</b><br>
                <div style="margin-top:10px; max-height:220px; overflow-y:auto; padding-right:5px;">`;

        EXPLORE_ZONES.forEach((z, i) => {
            const isLocked = userData.lv < z.minLv;
            html += `
                <div style="background:rgba(255,255,255,0.05); border:1px solid ${isLocked ? '#444' : '#9945FF'}; 
                            padding:10px; border-radius:12px; margin-bottom:10px; opacity:${isLocked ? 0.6 : 1};">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:12px; font-weight:bold; color:${isLocked ? '#888' : '#fff'};">
                            ${isLocked ? '🔒 ' : ''}${z.name} <small>(Lv.${z.minLv})</small>
                        </span>
                        ${!userData.isAdventuring && !isLocked ? 
                            `<button onclick="startZoneExplore(${i})" style="font-size:10px; padding:4px 8px; cursor:pointer;">출발</button>` : ''}
                    </div>
                    <div style="font-size:9px; color:#aaa; margin-top:4px;">🎁 예상: 💎${z.shard[0]}~${z.shard[1]} | 🍪${z.food[0]}~${z.food[1]}</div>
                </div>`;
        });

        if (userData.isAdventuring) {
            const remaining = Math.max(0, Math.ceil((userData.adventureEndTime - Date.now()) / 1000 / 60));
            html += `<div style="text-align:center; color:#f1c40f; font-size:11px; margin-top:10px;">
                        🚶 현재 탐험 중... (${remaining}분 남음)
                        </div>`;
        }
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
    
    // 1. 장비가 아예 없는 경우: 새로 제작 (커먼 등급부터 시작)
    if (!item) {
        if (userData.shards < 500) return alert("제작비 500💎이 부족합니다!");
        userData.shards -= 500;
        userData.inventory[type] = { grade: "Common", level: 0, power: GRADES.Common.power };
        alert(`🔨 [커먼] ${type}을(를) 제작했습니다!`);
        saveData(); showMenuDetail('m-equip'); return;
    }

    // ---------------- [ 여기서부터 교체 시작 ] ----------------
    
    // [수정된 매운맛 비용 공식]
    const gradeMultipliers = { 
        Common: 1, Uncommon: 2, Rare: 5, Epic: 15, Legendary: 50 
    };

    const baseCost = gradeMultipliers[item.grade] * 1000;
    const levelCost = Math.pow(item.level + 1, 2) * 500;
    const upgradeCost = baseCost + levelCost;

    if (userData.shards < upgradeCost) {
        return alert(`강화비 ${upgradeCost.toLocaleString()}💎이 부족합니다!`);
    }
    
    // 조각 차감
    userData.shards -= upgradeCost;
    
    // [수정된 매운맛 확률 공식]
    const gradeSuccessBase = { 
        Common: 0.8, Uncommon: 0.7, Rare: 0.5, Epic: 0.3, Legendary: 0.1 
    };
    const successChance = gradeSuccessBase[item.grade] - (item.level * 0.02);
    const rand = Math.random();

    if (rand < successChance) {
        // 성공!
        item.level++;
        if (item.level > 10) {
            // 10강 성공 시 다음 등급 승급
            const gradeOrder = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];
            let currentIdx = gradeOrder.indexOf(item.grade);
            
            if (currentIdx < gradeOrder.length - 1) {
                item.grade = gradeOrder[currentIdx + 1];
                item.level = 0; // 등급 업그레이드 시 강화 수치 초기화
                item.power = GRADES[item.grade].power;
                alert(`✨축하합니다! [${GRADES[item.grade].name}] 등급으로 승급했습니다!`);
            } else {
                item.level = 10; // 레전드 10강이 끝
                alert("이미 최고 등급, 최고 단계입니다!");
            }
        } else {
            alert(`✅ 강화 성공! (+${item.level})`);
        }
    } else {
        // 실패! (단계 하락)
        item.level = Math.max(0, item.level - 1);
        alert(`❌ 강화 실패... 단계가 하락했습니다. (+${item.level})`);
    }

    saveData();
    showMenuDetail('m-equip');
}

// [3단계] 레벨별 탐험 구역 설정
const EXPLORE_ZONES = [
    { name: "평온한 밀가루 밭", minLv: 1, shard: [5, 15], food: [2, 5], time: 5 },   // 5분 소요
    { name: "설탕 가루 숲", minLv: 30, shard: [50, 100], food: [5, 10], time: 15 }, // 15분 소요
    { name: "초코칩 암석 지대", minLv: 80, shard: [200, 450], food: [10, 20], time: 30 }, // 30분 소요
    { name: "솔라나 용암 동굴", minLv: 130, shard: [1000, 2500], food: [20, 40], time: 60 }, // 1시간
    { name: "마지막 심판의 오븐", minLv: 180, shard: [5000, 12000], food: [50, 100], time: 120 } // 2시간
];
const BOSSES = {
    weekly: { name: "🔥 주간 보스: 라바 골렘", minLv: 80, hp: 10000, rewardShard: 2000 },
    monthly: { name: "🐉 월간 보스: 솔라나 드래곤", minLv: 180, hp: 100000, rewardShard: 20000 }
};

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
    // 3. 허기 확인 (탐험은 에너지가 많이 듭니다)
    if (userData.hg < 30) {
        return alert("배고파서 탐험을 떠날 수 없어요! (최소 30 HG 필요)");
    }
    // --- [여기를 추가하세요: 4. 입장료 확인 및 차감] ---
    // 구역 인덱스에 따라 입장료가 비싸지게 설정 (예: 1번구역 500, 2번구역 1500...)
    const entryFee = (zoneIdx + 1) * 500; 
    
    if (userData.shards < entryFee) {
        return alert(`입장료 ${entryFee.toLocaleString()}💎이 부족합니다!`);
    }
    userData.shards -= entryFee; // 입장료 차감
    // --------------------------------------------------

    // 탐험 설정
    userData.hg -= 30;
    userData.isAdventuring = true;
    userData.adventureZoneIdx = zoneIdx; // 어떤 구역인지 기록
    userData.adventureEndTime = Date.now() + (zone.time * 60 * 1000);
    // 알림창에도 입장료 정보를 넣어주면 더 친절합니다.
    alert(`[${zone.name}] 입장료 ${entryFee}💎 지불! 탐험을 시작합니다.`);
    
    saveData();
    showMenuDetail('m-dungeon'); 
    updateUI();
}

function saveData() { if (userData && db) db.ref(`users/${userData.id}`).set(userData); }
function closeModal() { document.getElementById('game-modal').classList.remove('active'); }

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

// --- [날씨 시스템] ---
let currentWeather = "☀️ 맑음";

function updateWeather() {
    const container = document.getElementById('character-area');
    const weatherTag = document.getElementById('weather-tag');
    const weatherList = ["☀️ 맑음", "🌧️ 비", "❄️ 눈", "🍃 바람", "🌫️ 안개"];
    
    // 무작위 날씨 선택
    currentWeather = weatherList[Math.floor(Math.random() * weatherList.length)];
    
    // 1. UI 업데이트
    if (weatherTag) weatherTag.innerText = currentWeather;

    // 2. 기존 효과 제거
    document.querySelectorAll('.weather-particle, .fog-layer').forEach(p => p.remove());
    container.style.filter = "none";

    // 3. 날씨별 시각 효과 생성
    if (currentWeather === "🌧️ 비" || currentWeather === "❄️ 눈" || currentWeather === "🍃 바람") {
        const emoji = currentWeather === "🌧️ 비" ? "💧" : (currentWeather === "❄️ 눈" ? "❄️" : "🍃");
        
        for (let i = 0; i < 20; i++) {
            const p = document.createElement('div');
            p.className = 'weather-particle' + (currentWeather === "🍃 바람" ? " windy" : "");
            p.innerText = emoji;
            p.style.left = Math.random() * 100 + "%";
            p.style.fontSize = "14px";
            p.style.animationDuration = (Math.random() * 2 + 2) + "s";
            p.style.animationDelay = Math.random() * 3 + "s";
            container.appendChild(p);
        }
    } else if (currentWeather === "🌫️ 안개") {
        const fog = document.createElement('div');
        fog.className = 'fog-layer';
        container.appendChild(fog);
    } else if (currentWeather === "☀️ 맑음") {
        container.style.filter = "brightness(1.1) saturate(1.1)";
    }
}

// 🕒 30초마다 날씨 변경 (테스트를 위해 짧게 설정, 나중에 60000으로 늘리셔도 돼요!)
setInterval(updateWeather, 30000);

// 🚀 게임 시작 시 즉시 실행 (가장 중요!)
setTimeout(updateWeather, 1000);