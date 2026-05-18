let capture;
let hands;
let detections = {};

function setup() {
  createCanvas(640, 480);
  
  // Initialize p5.js video capture
  capture = createCapture(VIDEO, (stream) => {
    console.log("Webcam access granted.");
  });
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
      camera.start();
    } else {
      console.error("MediaPipe Camera utility not found.");
    }
  } else {
    console.error("MediaPipe Hands library not found. Ensure you are running on a server and connected to the internet.");
  }
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
