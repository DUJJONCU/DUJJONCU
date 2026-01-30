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
    { lv: 0, name: "밀가루 반죽" },
    { lv: 10, name: "오븐 구경꾼" },
    { lv: 30, name: "초보 쿠키" },
    { lv: 70, name: "바삭한 모험가" },
    { lv: 120, name: "베테랑 쿠키" },
    { lv: 170, name: "전설의 황금반죽" },
    { lv: 200, name: "🍪 솔라나 마스터" }
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
    checkGroggy();
    checkFoodSupply();

    if (isSleeping) {
        userData.hg = Math.min(100, userData.hg + 0.3);
        userData.mood = Math.min(100, userData.mood + 0.2);
        createZzz();
        if(userData.hg >= 100) {
            isSleeping = false;
            document.getElementById('character-img').classList.remove('sleeping');
            document.getElementById('sleep-btn').innerText = "💤 잠자기";
        }
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
    console.log("클릭 감지됨!"); // 이 줄을 함수 맨 위에 추가하세요.

    if (!userData) {
        console.log("유저 데이터가 없음!");
        return;
    }
    // 1. 가드 조건 확인
    if (!userData || isSleeping || userData.isAdventuring || crisisTimer) return;
    if (userData.hg <= 0) {
        showBubble("배고파서 기운이 없어요..");
        return;
    }

    const stats = calculateStats();
    const now = Date.now();
    
    // 매크로 방지용 쿨타임 (너무 짧으면 80 -> 50으로 줄여보세요)
    if (now - lastClick < 50) return; 
    lastClick = now;
    lastInteractionTime = now;

    // 2. 콤보 처리
    comboCount++;
    clearTimeout(comboTimer);
    showComboUI(comboCount);
    comboTimer = setTimeout(() => { 
        comboCount = 0; 
        hideComboUI(); 
    }, stats.comboTime);

    // 3. 경험치 계산 (핵심!)
    let isCritical = (Math.random() * 100) < stats.luck;
    // tapPower가 너무 낮으면 티가 안 날 수 있으니 최소값을 보장해봅시다.
    let gainedXp = Math.max(10, stats.tapPower) * (isCritical ? 3 : 1);

    // 실제 데이터에 더하기
    userData.xp += gainedXp;
    userData.hg = Math.max(0, userData.hg - stats.hgDrain);
    userData.mood = Math.min(100, userData.mood + 0.2);

    // 4. 즉시 반영 (이 순서가 중요합니다)
    checkLevelUp(); // 레벨업 먼저 확인
    updateUI();     // 그다음 화면 갱신
    saveData();     // 마지막으로 DB 저장 (비동기)

    // 5. 시각 효과
    const img = document.getElementById('character-img');
    if (img) {
        img.style.transform = `scale(${isCritical ? 1.2 : 1.1}) rotate(${Math.random() * 10 - 5}deg)`;
        setTimeout(() => { img.style.transform = "scale(1) rotate(0deg)"; }, 100);
    }
    
    if (isCritical) {
        showBubble("💥 CRITICAL!!");
        triggerCriticalEffect();
    }
}

function checkLevelUp() {
    let nextXP = Math.floor(Math.pow(userData.lv, 2.8) * 300 * 1.5);
    if (userData.xp >= nextXP) {
        userData.lv++;
        userData.shards += (userData.lv * 100); 
        triggerLevelUpEffect();
        showBubble(`🎉 LEVEL UP! (Lv.${userData.lv})`);
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

    // --- [상태 체크 로직 추가] ---
    const statusTag = document.getElementById('status-tag');
    let statusText = "● 활동중";
    let statusColor = "#14F195"; // 기본 민트색

    if (userData.hg <= 0) {
        statusText = "● 그로기 (탈진)";
        statusColor = "#ff4757"; // 빨간색
    } else if (isSleeping) {
        statusText = "● 휴식 중";
        statusColor = "#3498db"; // 파란색
    } else if (userData.isAdventuring) {
        statusText = "● 탐험 중";
        statusColor = "#f1c40f"; // 노란색
    }

    if (statusTag) {
        statusTag.innerText = statusText;
        statusTag.style.color = statusColor;
        statusTag.style.border = `1px solid ${statusColor}`;
    }
    // --- [상태 체크 로직 끝] ---

    // 1. 경험치 계산 (공식 최적화)
    const getLevelXP = (lv) => Math.floor(Math.pow(lv, 2.8) * 300 * 1.5);
    const prevXP = userData.lv === 1 ? 0 : getLevelXP(userData.lv - 1);
    const nextXP = getLevelXP(userData.lv);
    
    const requiredXPInThisLevel = nextXP - prevXP;
    const currentXPInThisLevel = Math.max(0, userData.xp - prevXP);
    
    let xpPercent = (currentXPInThisLevel / requiredXPInThisLevel) * 100;
    xpPercent = Math.min(100, Math.max(0, xpPercent));

    // 2. DOM 반영 (정확한 ID 참조)
    const expBar = document.getElementById('exp-bar');
    const expLabel = document.getElementById('exp-label');
    
    if (expBar) {
        expBar.style.width = xpPercent + "%";
    }
    if (expLabel) {
        // 소수점 3자리까지 표시해서 아주 미세하게 움직이는 것도 보이게 함
        expLabel.innerText = xpPercent.toFixed(3) + "%";
    }

    // 3. 기타 상태바 (허기, 기분)
    document.getElementById('hungry-bar').style.width = userData.hg + "%";
    document.getElementById('hg-label').innerText = `${Math.floor(userData.hg)} HG`;

    document.getElementById('mood-bar').style.width = userData.mood + "%";
    document.getElementById('mood-label').innerText = `${Math.floor(userData.mood)} MOOD`;

    document.getElementById('food-val').innerText = `${userData.foodCount}/10`;
    document.getElementById('shard-val').innerText = Math.floor(userData.shards).toLocaleString();

    const title = TITLES.filter(t => userData.lv >= t.lv).pop();
    document.getElementById('user-title').innerText = `[${title.name}] Lv.${userData.lv}`;
}

function openModal() {
    const modal = document.getElementById('game-modal');
    const content = document.getElementById('modal-tab-content');
    modal.classList.add('active');
    
    content.innerHTML = `
        <div style="text-align:center; margin-bottom:15px;"><h2 style="color:#14F195; margin:0; font-size:18px;">📜 전체 메뉴</h2></div>
        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:8px; margin-bottom:15px;">
            <div onclick="showMenuDetail('m-equip')" style="background:#333; color:#fff; border:1px solid #9945FF; height:50px; border-radius:10px; display:flex; justify-content:center; align-items:center; font-size:11px; cursor:pointer;">⚔️ 장비</div>
            <div onclick="showMenuDetail('m-dungeon')" style="background:#333; color:#fff; border:1px solid #9945FF; height:50px; border-radius:10px; display:flex; justify-content:center; align-items:center; font-size:11px; cursor:pointer;">🏹 탐험</div>
            <div onclick="showMenuDetail('m-rank')" style="background:#333; color:#fff; border:1px solid #9945FF; height:50px; border-radius:10px; display:flex; justify-content:center; align-items:center; font-size:11px; cursor:pointer;">🏆 순위</div>
            <div onclick="showMenuDetail('m-boss')" style="background:#444; color:#fff; border:1px solid #ff4757; height:50px; border-radius:10px; display:flex; justify-content:center; align-items:center; font-size:11px; cursor:pointer;">👹 보스</div>
        </div>
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

    // 2. 장비가 있는 경우: 강화 진행
    const upgradeCost = (userData.inventory[type].level + 1) * 200; // 단계별 비용 상승
    if (userData.shards < upgradeCost) return alert(`강화비 ${upgradeCost}💎이 부족합니다!`);
    
    userData.shards -= upgradeCost;
    
    // 강화 성공 확률 (단계가 높을수록 낮아짐)
    const successChance = 0.8 - (item.level * 0.05); 
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

    // 탐험 설정
    userData.hg -= 30;
    userData.isAdventuring = true;
    userData.adventureZoneIdx = zoneIdx; // 어떤 구역인지 기록
    userData.adventureEndTime = Date.now() + (zone.time * 60 * 1000);
    
    alert(`[${zone.name}]으로 탐험을 떠났습니다! (${zone.time}분 소요)`);
    saveData();
    showMenuDetail('m-dungeon'); // 메뉴 새로고침
    updateUI();
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
    const weatherList = ["☀️ 맑음", "🌧️ 비", "❄️ 눈"];
    const current = weatherList[Math.floor(Math.random() * weatherList.length)];
    document.querySelectorAll('.weather-particle').forEach(p => p.remove());
    if (current === "🌧️ 비" || current === "❄️ 눈") {
        const emoji = current === "🌧️ 비" ? "💧" : "❄️";
        for (let i = 0; i < 20; i++) {
            const p = document.createElement('div');
            p.className = 'weather-particle';
            p.innerText = emoji;
            p.style.left = Math.random() * 100 + "%";
            p.style.animationDuration = (Math.random() * 2 + 1) + "s";
            p.style.animationDelay = Math.random() * 2 + "s";
            container.appendChild(p);
        }
    }
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