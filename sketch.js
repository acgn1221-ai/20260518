let capture;
let hands;
let detections = {};
let cameraError = false;

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
  let canvas = createCanvas(640, 480);
  
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
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
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

function draw() {
  // 進入鏡像模式 (水平翻轉)
  push();
  translate(width, 0);
  scale(-1, 1);

  // 檢查攝影機是否準備好
  if (capture.elt.readyState >= 2) {
    // 繪製攝影機畫面
    image(capture, 0, 0, width, height);
  } else if (cameraError) {
    background(50);
    fill(255, 100, 100);
    textAlign(CENTER, CENTER);
    push();
    scale(-1, 1);
    text("無法找到相機裝置\n請檢查權限或伺服器環境", -width/2, height/2);
    pop();
  } else {
    background(0);
    fill(255);
    textAlign(CENTER, CENTER);
    // 修正文字，使其不被鏡像翻轉
    push();
    scale(-1, 1);
    text("正在啟動攝影機...", -width/2, height/2);
    pop();
  }

  // Draw landmarks if hands are detected
  if (detections.multiHandLandmarks) {
    for (const landmarks of detections.multiHandLandmarks) {
      let gesture = analyzeGesture(landmarks);
      
      // 1. 繪製骨架連線
      stroke(0, 255, 0); // 綠色線條
      strokeWeight(2);
      for (const connection of HAND_CONNECTIONS) {
        const start = landmarks[connection[0]];
        const end = landmarks[connection[1]];
        line(
          start.x * width, start.y * height,
          end.x * width, end.y * height
        );
      }

      // 2. 繪製關節點
      for (let i = 0; i < landmarks.length; i++) {
        let x = landmarks[i].x * width;
        let y = landmarks[i].y * height;
        
        fill(0, 255, 0);
        noStroke();
        ellipse(x, y, 8, 8);
      }

      // 3. 顯示手勢文字 (需處理鏡像文字翻轉)
      push();
      scale(-1, 1);
      fill(255, 255, 0);
      textSize(32);
      textAlign(CENTER);
      // 取得手掌中心位置作為文字標籤位置
      let labelX = landmarks[0].x * width;
      let labelY = landmarks[0].y * height;
      text(gesture, -labelX, labelY + 40);
      pop();
    }
  }
  pop(); // 離開鏡像模式
}

/**
 * 判斷手勢：石頭、剪刀、布
 */
function analyzeGesture(landmarks) {
  // 判斷手指是否伸直 (指尖 y 座標小於第二關節 y 座標)
  // MediaPipe y 座標是 0~1，0 在頂部
  let indexUp = landmarks[8].y < landmarks[6].y;
  let middleUp = landmarks[12].y < landmarks[10].y;
  let ringUp = landmarks[16].y < landmarks[14].y;
  let pinkyUp = landmarks[20].y < landmarks[18].y;

  // 根據手指狀態判斷手勢
  if (indexUp && middleUp && ringUp && pinkyUp) {
    return "布 (Paper)";
  } else if (indexUp && middleUp && !ringUp && !pinkyUp) {
    return "剪刀 (Scissors)";
  } else if (!indexUp && !middleUp && !ringUp && !pinkyUp) {
    return "石頭 (Rock)";
  } else {
    return "---";
  }
}
