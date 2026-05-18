let capture;
let hands;
let detections = {};
let cameraError = false;

let userWins = 0;
let computerWins = 0;
let draws = 0;
let gamePaused = false;
let gameEnded = false;
let gameState = "WAITING"; // WAITING, COUNTDOWN, BATTLE, RESULT
let countdownValue = 3;
let countdownTimer = 0;
let roundsPlayed = 0;
const TOTAL_ROUNDS_LIMIT = 3;

let computerGesture = "---";
let winnerResult = "等待中...";
let lastChoiceTime = 0;

// 手部關節連接定義（根據 MediaPipe 21 個關鍵點索引）
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], // 拇指
  [0, 5], [5, 6], [6, 7], [7, 8], // 食指
  [0, 9], [9, 10], [10, 11], [11, 12], // 中指
  [0, 13], [13, 14], [14, 15], [15, 16], // 無名指
  [0, 17], [17, 18], [18, 19], [19, 20], // 小指
  [5, 9], [9, 13], [13, 17] // 掌心連線
];

function setup() {
  createCanvas(windowWidth, windowHeight); // 全螢幕畫布
  
  // 建立原始的 video 元素，但不啟動 p5 的 capture 以免與 MediaPipe 衝突
  capture = createElement('video').attribute('playsinline', '');
  capture.size(640, 480);
  capture.hide();

  // Use window.Hands and window.Camera to ensure they are found globally
  if (window.Hands) {
    // Initialize MediaPipe Hands
    hands = new window.Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      }
    });

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7
    });

    hands.onResults(onResults);

    // Initialize MediaPipe Camera Utility
    if (window.Camera) {
      const camera = new window.Camera(capture.elt, {
        onFrame: async () => {
          // Only send frames if the video element is ready
          if (capture.elt.readyState >= 2) {
            await hands.send({ image: capture.elt });
          }
        },
        width: 640,
        height: 480
      });
      
      camera.start().catch(err => {
        console.error("攝像頭啟動失敗: ", err);
        cameraError = true;
        if (location.protocol === 'file:') {
          alert("MediaPipe 需要在本地伺服器環境運行。請使用 VS Code 的 Live Server 擴充功能開啟。");
        }
      });
    } else {
      console.error("MediaPipe Camera utility not found.");
    }
  } else {
    console.error("MediaPipe Hands library not found. 請檢查網路連線。");
  }
}

function onResults(results) {
  detections = results;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function draw() {
  background('#e7c6ff'); // 設定背景顏色

  // 計算 60% 的影像寬高與置中偏移量
  let videoW = width * 0.6; 
  let videoH = height * 0.6;
  let xOff = (width - videoW) / 2; // 水平置中
  let yOff = (height - videoH) / 2; // 垂直置中

  if (capture.elt.readyState >= 2) {
    // --- 繪製置中且縮放的攝影機影像與手部關節 ---
    push();
    translate(xOff + videoW, yOff); // 移動到顯示區域右側準備水平翻轉
    scale(-1, 1); // 鏡像處理
    image(capture, 0, 0, videoW, videoH);
    
    if (detections.multiHandLandmarks && !gameEnded) {
      for (const landmarks of detections.multiHandLandmarks) {
        // 繪製骨架 (座標需乘以縮放後的 videoW/H)
        stroke(0, 255, 0);
        strokeWeight(2);
        for (const connection of HAND_CONNECTIONS) {
          const start = landmarks[connection[0]];
          const end = landmarks[connection[1]];
          line(start.x * videoW, start.y * videoH, end.x * videoW, end.y * videoH);
        }
        // 繪製關節
        for (let i = 0; i < landmarks.length; i++) {
          fill(0, 255, 0);
          noStroke();
          ellipse(landmarks[i].x * videoW, landmarks[i].y * videoH, 5, 5);
        }
      }
    }
    pop();
  } else {
    fill(0);
    textAlign(CENTER, CENTER);
    textSize(24);
    text(cameraError ? "相機啟動失敗" : "正在等待相機...", width / 2, height / 2);
  }

  // --- 遊戲邏輯控制 ---
  if (detections.multiHandLandmarks && detections.multiHandLandmarks.length > 0) {
    processGame(detections.multiHandLandmarks[0]);
  } else if (gameState === "BATTLE") {
    // 如果在出拳瞬間手不見了
    winnerResult = "手勢消失";
    gameState = "RESULT";
    lastChoiceTime = millis();
  }

  drawUI();
}

/**
 * 處理遊戲流程
 */
function processGame(landmarks) {
  if (gameEnded) return;

  const finger = getFingerStates(landmarks);
  let userGesture = analyzeGesture(landmarks);

  // 檢查是否需要判斷「繼續/結束」 (當局數達到 3 局且在等待狀態)
  if (roundsPlayed >= TOTAL_ROUNDS_LIMIT && gameState === "WAITING") {
    // 結束手勢：中(9-12)、無名(13-16)、小指(17-20)舉起 -> OK 手勢
    if (!finger.thumb && !finger.index && finger.middle && finger.ring && finger.pinky) {
      gameEnded = true;
      return;
    }
    // 繼續手勢：大拇指(1-4)、食指(5-8)、小指(17-20)舉起
    if (finger.thumb && finger.index && !finger.middle && !finger.ring && finger.pinky) {
      roundsPlayed = 0; // 重置局數，但保留總分（或依需求重置分數）
      gameState = "COUNTDOWN";
      countdownValue = 3;
      countdownTimer = millis();
    }
    return;
  }

  // 正常的遊戲循環
  if (gameState === "WAITING" && roundsPlayed < TOTAL_ROUNDS_LIMIT) {
    gameState = "COUNTDOWN";
    countdownValue = 3;
    countdownTimer = millis();
  }

  if (gameState === "COUNTDOWN") {
    let elapsed = millis() - countdownTimer;
    if (elapsed < 1000) countdownValue = 3;
    else if (elapsed < 2000) countdownValue = 2;
    else if (elapsed < 3000) countdownValue = 1;
    else {
      gameState = "BATTLE";
    }
  }

  if (gameState === "BATTLE") {
    if (userGesture !== "未知") {
      const options = ["石頭 (Rock)", "剪刀 (Scissors)", "布 (Paper)"];
      computerGesture = options[Math.floor(random(options.length))];
      winnerResult = decideWinner(userGesture, computerGesture);
      
      if (winnerResult === "使用者") userWins++;
      else if (winnerResult === "電腦") computerWins++;
      else if (winnerResult === "平手") draws++;
      
      roundsPlayed++;
      gameState = "RESULT";
      lastChoiceTime = millis();
    }
  }

  if (gameState === "RESULT") {
    if (millis() - lastChoiceTime > 2000) {
      gameState = "WAITING";
    }
  }
}

function getFingerStates(landmarks) {
  // 拇指伸直判斷 (與小指根部的距離)
  let thumbUp = dist(landmarks[4].x, landmarks[4].y, landmarks[17].x, landmarks[17].y) > 
                dist(landmarks[3].x, landmarks[3].y, landmarks[17].x, landmarks[17].y);
  return {
    thumb: thumbUp,
    index: landmarks[8].y < landmarks[6].y,
    middle: landmarks[12].y < landmarks[10].y,
    ring: landmarks[16].y < landmarks[14].y,
    pinky: landmarks[20].y < landmarks[18].y
  };
}

function analyzeGesture(landmarks) {
  const f = getFingerStates(landmarks);
  if (f.index && f.middle && f.ring && f.pinky) {
    return "布 (Paper)";
  } else if (f.index && f.middle && !f.ring && !f.pinky) {
    return "剪刀 (Scissors)";
  } else if (!f.thumb && !f.index && !f.middle && !f.ring && !f.pinky) {
    return "石頭 (Rock)";
  } else {
    return "未知";
  }
}

function decideWinner(user, computer) {
  if (user === computer) return "平手";
  if (
    (user === "石頭 (Rock)" && computer === "剪刀 (Scissors)") ||
    (user === "剪刀 (Scissors)" && computer === "布 (Paper)") ||
    (user === "布 (Paper)" && computer === "石頭 (Rock)")
  ) {
    return "使用者";
  } else {
    return "電腦";
  }
}

function drawUI() {
  // 左上角計分板
  push();
  fill(255, 230);
  noStroke();
  rect(10, 10, 220, 170, 10);
  fill(0);
  textSize(18);
  textAlign(LEFT, TOP);
  text("【累計戰績】", 25, 25);
  text(`使用者勝: ${userWins}`, 25, 55);
  text(`電腦勝　: ${computerWins}`, 25, 85);
  text(`平手局數: ${draws}`, 25, 115);
  text(`目前局數: ${roundsPlayed}/${TOTAL_ROUNDS_LIMIT}`, 25, 145);
  pop();

  // 右上角狀態
  push();
  fill(255, 230);
  noStroke();
  rect(width - 210, 10, 200, 100, 10);
  fill(0);
  textAlign(RIGHT, TOP);
  text("【對戰結果】", width - 25, 25);
  if (winnerResult === "使用者") fill(0, 150, 0);
  else if (winnerResult === "電腦") fill(200, 0, 0);
  else fill(0);
  text(`勝者: ${winnerResult}`, width - 25, 55);
  fill(0);
  text(`電腦出: ${computerGesture}`, width - 25, 85);
  pop();

  // 畫面中央提示
  if (gameEnded) {
    background(0, 200);
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(40);
    text(`遊戲結束！\n總戰績\n使用者 ${userWins} : 電腦 ${computerWins}\n(平手: ${draws})`, width/2, height/2);
  } else if (roundsPlayed >= TOTAL_ROUNDS_LIMIT && gameState === "WAITING") {
    fill(0);
    rectMode(CENTER);
    fill(255, 230);
    rect(width/2, height * 0.85, 600, 100, 10);
    fill(0);
    textAlign(CENTER, CENTER);
    textSize(22);
    text("已達 3 局！\n繼續：比出『大拇指+食指+小指』\n結束：比出『中指+無名指+小指 (OK)』", width/2, height * 0.85);
  } else if (gameState === "COUNTDOWN") {
    fill(255, 0, 0);
    textAlign(CENTER, CENTER);
    textSize(100);
    text(countdownValue, width/2, height/2);
  } else if (gameState === "BATTLE") {
    fill(0, 0, 255);
    textAlign(CENTER, CENTER);
    textSize(80);
    text("出拳！", width/2, height/2);
  }
}
