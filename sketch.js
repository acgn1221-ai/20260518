let capture;
let hands;
let detections = {};

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
      for (let i = 0; i < landmarks.length; i++) {
        let x = landmarks[i].x * width;
        let y = landmarks[i].y * height;
        
        fill(0, 255, 0);
        noStroke();
        ellipse(x, y, 8, 8);
      }
    }
  }
  pop(); // 離開鏡像模式
}
