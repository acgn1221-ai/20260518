let capture;
let hands;
let detections = {};

function setup() {
  createCanvas(640, 480);
  
  // Initialize p5.js video capture
  capture = createCapture(VIDEO);
  capture.size(640, 480);
  capture.hide();

  // Initialize MediaPipe Hands
  hands = new Hands({
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
  const camera = new Camera(capture.elt, {
    onFrame: async () => {
      await hands.send({ image: capture.elt });
    },
    width: 640,
    height: 480
  });
  camera.start();
}

function onResults(results) {
  detections = results;
}

function draw() {
  // Draw the webcam feed
  image(capture, 0, 0, width, height);

  // Draw landmarks if hands are detected
  if (detections.multiHandLandmarks) {
    for (const landmarks of detections.multiHandLandmarks) {
      for (let i = 0; i < landmarks.length; i++) {
        let x = landmarks[i].x * width;
        let y = landmarks[i].y * height;
        
        fill(0, 255, 0);
        noStroke();
        ellipse(x, y, 10, 10);
      }
    }
  }
}
