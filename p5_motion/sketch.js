let port;
let writer, reader;
let brightness = 0;
let modeText = "N/A";
let handPose;
let video;
let hands = [];

// 신호등 주기 (p5에서도 관리)
let redTime = 2000;
let yellowTime = 500;
let greenTime = 2000;

let redSlider, yellowSlider, greenSlider;
let redState = 0, yellowState = 0, greenState = 0;
let lastMode = "";  // 🔥 모드 변경 체크용 변수

function preload() {
  handPose = ml5.handPose();
}

function setup() {
  createCanvas(960, 480);

  // ✅ 비디오 캡처 (flipped 제거 -> 카메라가 동작을 안함, hide() 유지)
  video = createCapture(VIDEO);
  video.size(320, 240);
  video.hide();  // HTML 기본 출력 숨기기

  // ✅ 비디오가 완전히 로드된 후 실행
  video.elt.onloadeddata = () => {
    console.log("✅ Video loaded, starting hand tracking...");
    handPose.detectStart(video, gotHands);
  };

  // 시리얼 연결 버튼
  let connectButton = createButton("Connect to Arduino");
  connectButton.position(10, 10);
  connectButton.mousePressed(connectToArduino);

  // 슬라이더 UI
  redSlider = createSlider(100, 5000, 2000, 100);
  redSlider.position(30, 50);
  yellowSlider = createSlider(100, 5000, 500, 100);
  yellowSlider.position(30, 80);
  greenSlider = createSlider(100, 5000, 2000, 100);
  greenSlider.position(30, 110);

  redSlider.input(sendData);
  yellowSlider.input(sendData);
  greenSlider.input(sendData);
}

function draw() {
  background(240);
  textSize(16);

  // 왼쪽 UI 영역 (슬라이더, 인디케이터, 신호등)
  fill(0);
  text("🚦 신호등 설정", 10, 40);
  text("🔴 빨강 시간: " + redSlider.value() + " ms", 250, 55);
  text("🟡 노랑 시간: " + yellowSlider.value() + " ms", 250, 85);
  text("🟢 초록 시간: " + greenSlider.value() + " ms", 250, 115);

  drawTrafficLight(50, 200);
  drawModeIndicator(30, 350);
  drawBrightnessIndicator(30, 400);

  // === [핵심 수정] 카메라와 키포인트를 거울 모드(좌우 반전)로 표시 ===
  push();
  // 1) 우측 영역 (640, 0)에 320x240짜리 뒤집힌 영상을 그릴 것이므로,
  //    가로축으로 640+320 = 960만큼 translate()한 뒤,
  // 2) scale(-1, 1)을 써서 좌우 반전
  translate(640 + 320, 0);
  scale(-1, 1);

  // 👉 실제 그리는 좌표는 (0,0)~(320,240)이지만
  //    화면상으로는 (640,0)~(960,240)에 뒤집힌 상태로 나타남
    image(video, 0, 0, 320, 240);

    if (hands.length === 1) {
    // 🙌 단 하나의 손만 인식됨
    let single = hands[0];
    
    // 영상 해상도 (320, 240)이라면 → midX = 160
    // 만약 video.width가 160이라면 midX=80 등 상황에 맞게 변경
    let midX = 320 / 2; // 또는 video.width / 2

    // 🔥 single.keypoints[0].x 가 midX보다 크면 왼손, 작으면 오른손
    if (single.keypoints[0].x > midX) { // 
      // 왼손 로직
      handleLeftHandForTimeChange(single);
      console.log("🎯 Single hand recognized as LEFT hand");
    } else {
      // 오른손 로직
      handleRightHandForModeChange(single);
      console.log("🎯 Single hand recognized as RIGHT hand");
    }
  } 
  else if (hands.length >= 2) {
    // 🙌 두 손 이상
    // x좌표 정렬 → [왼쪽, 오른쪽]
    hands.sort((a, b) => b.keypoints[0].x - a.keypoints[0].x);

    let leftHand  = hands[0];
    let rightHand = hands[1];

    handleLeftHandForTimeChange(leftHand);
    handleRightHandForModeChange(rightHand);
    console.log("🎯 Two hands recognized: Left & Right");
  }

  // 키포인트 시각화 (공통)
  for (let h of hands) {
    for (let kp of h.keypoints) {
      fill(255, 0, 0);
      noStroke();
      circle(kp.x, kp.y, 10);
    }
  }
  pop();
}

// =====================================================================
// 📌 1) 왼손: 신호등 주기 조절
// =====================================================================

let lastAdjustTime = 0;

function handleLeftHandForTimeChange(hand) {
  if (!hand) return;

  // 현재 시각 (p5.js)
  let now = millis();

  // 0.5초마다 한 번씩만 조절
  if (now - lastAdjustTime > 500) {
    // 1) 각 손가락 bent 여부
    let thumbBent  = isThumbBent(hand);
    let indexBent  = isIndexBent(hand);
    let middleBent = isMiddleBent(hand);
    let ringBent   = isRingBent(hand);
    let pinkyBent  = isPinkyBent(hand);

    // 2) 각 LED의 주기를 조절
    if (!thumbBent && indexBent && middleBent && ringBent && pinkyBent) {
        redTime += 100; // 엄지만 폈을 때 빨강 시간 증가
      }
      else if(!thumbBent && !indexBent && middleBent && ringBent && pinkyBent){
        redTime -= 100; // 엄지와 검지만 폈을 때 빨강 시간 감소
      }
      else if(!thumbBent && indexBent && middleBent && ringBent && !pinkyBent){
        yellowTime += 100; // 엄지와 새끼만 폈을 때 노랑 시간 증가
      }
      else if(!thumbBent && indexBent && middleBent && !ringBent && !pinkyBent){
        yellowTime -= 100; // 엄지와 새끼, 약지를 폈을 때 노랑 시간 감소
      }
      else if(!thumbBent && !indexBent && !middleBent && !ringBent && !pinkyBent){
        greenTime += 100; // 손가락을 모두 폈을 때 초록 시간 증가
      }
      else if(!thumbBent && !indexBent && middleBent && !ringBent && !pinkyBent){
        greenTime -= 100; // 중지만 구부렸을 때 초록 시간 감소
      }
      
     // 범위 제한 (빨강/노랑/초록 전부)
     redTime    = constrain(redTime,    100, 5000);
     yellowTime = constrain(yellowTime, 100, 5000);
     greenTime  = constrain(greenTime,  100, 5000);

     // 아두이노 전송 (쉼표 구분)
     sendTimeToArduino(redTime, yellowTime, greenTime);

     // 슬라이더 값도 동기화
     redSlider.value(redTime);
     yellowSlider.value(yellowTime);
     greenSlider.value(greenTime);

     // 타이머 갱신
     lastAdjustTime = now;
    }
  }

  function sendTimeToArduino(r, y, g) { // 아두이노로 시간 전송 함수
    if (!writer) return;
    let data = `${r},${y},${g}\n`;
    writer.write(new TextEncoder().encode(data));
    console.log("📤 Time updated:", data);
  }

// =====================================================================
// 🖐️ 관절별 "굽힘(bent)" 판별 함수들
// =====================================================================
function isThumbBent(hand) {
  // 엄지: MCP=2, TIP=4
  let threshold = 10; // 필요하면 조정
  let MCP = hand.keypoints[2];
  let TIP = hand.keypoints[4];
  return (TIP.y > MCP.y + threshold);
}

function isIndexBent(hand) {
  // 검지: PIP=6, TIP=8
  let threshold = 10;
  let PIP = hand.keypoints[6];
  let TIP = hand.keypoints[8];
  return (TIP.y > PIP.y + threshold);
}

function isMiddleBent(hand) {
  // 중지: PIP=10, TIP=12
  let threshold = 10;
  let PIP = hand.keypoints[10];
  let TIP = hand.keypoints[12];
  return (TIP.y > PIP.y + threshold);
}

function isRingBent(hand) {
  // 약지: PIP=14, TIP=16
  let threshold = 10;
  let PIP = hand.keypoints[14];
  let TIP = hand.keypoints[16];
  return (TIP.y > PIP.y + threshold);
}

function isPinkyBent(hand) {
  // 새끼: PIP=18, TIP=20
  let threshold = 10;
  let PIP = hand.keypoints[18];
  let TIP = hand.keypoints[20];
  return (TIP.y > PIP.y + threshold);
}

// =====================================================================
// 🙌 제스처 판별(오른손)
// =====================================================================
function handleRightHandForModeChange(hand) {
    if (!hand) return; // 손이 없으면 무시
    let newMode = getrighthandGestureMode(hand); // 신호 변경 함수 사용

    // 디버깅 출력
    console.log("[RightHand newMode]", newMode);

    if (newMode && newMode !== lastMode) {
      sendGestureMode(newMode);
      lastMode = newMode;
    }
  }
  
  function getrighthandGestureMode(hand) { // 신호 변경 함수
    let thumb = isThumbBent(hand);
    let index = isIndexBent(hand);
    let middle= isMiddleBent(hand);
    let ring  = isRingBent(hand);
    let pinky = isPinkyBent(hand);
  
    // Blink
    if (!thumb && !index && !middle && ring && pinky) { // 엄지, 검지, 중지만 폈을 때
      return "blinking";
    }
    // Normal
    else if (!thumb && index && middle && ring && pinky) { // 엄지만 폈을 때
      return "normal";
    }
    // Off
    else if (!thumb && !index && !middle && ring && !pinky) { // 약지 빼고 모두 구부렸을 때
      return "off";
    }
    // Emergency
    else if (!thumb && !index && middle && ring && pinky) { // 엄지와 검지만 폈을 때
      return "emergency";
    }
    // 그 외 이전 신호 유지
    return null;
  }


// ✅ 신호등 그리기
function drawTrafficLight(x, y) {
  let size = 50, spacing = 70;
  fill(redState ? 'red' : 'gray');
  ellipse(x, y, size);
  fill(yellowState ? 'yellow' : 'gray');
  ellipse(x + spacing, y, size);
  fill(greenState ? 'green' : 'gray');
  ellipse(x + spacing * 2, y, size);
}

// ✅ 모드 인디케이터 그리기
function drawModeIndicator(x, y) {
  let w = 140, h = 30;
  let modeColor = modeText === "Emergency Mode" ? "red" :
                  modeText === "Blinking Mode" ? "yellow" :
                  modeText === "Normal Mode" ? "green" : "gray";

  fill(modeColor);
  rect(x, y, w, h, 10);
  fill(0);
  textAlign(CENTER, CENTER);
  text(modeText, x + w / 2, y + h / 2);
}

function drawBrightnessIndicator(x, y) {
  textAlign(LEFT, CENTER);
  fill(0);
  text("💡 현재 밝기: " + brightness, x, y);
}

// ✅ 아두이노 연결
async function connectToArduino() {
  try {
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });
    writer = port.writable.getWriter();
    readData();
    console.log("✅ Connected to Arduino");
  } catch (err) {
    console.error("❌ Connection failed:", err);
  }
}

// ✅ 아두이노로 모드 전송
async function sendGestureMode(mode) {
  if (!writer) return;
  let cmd = "";
  if (mode === "normal") {
    cmd = "MODE:NORMAL\n";
  } else if (mode === "emergency") {
    cmd = "MODE:RED\n";
  } else if (mode === "blinking") {
    cmd = "MODE:BLINK\n";
  } else if (mode === "off") {
    cmd = "MODE:OFF\n";
  }
  await writer.write(new TextEncoder().encode(cmd));
  console.log("📤 Sent mode:", cmd.trim());
}


// ✅ 시리얼 데이터 수신
async function readData() {
  const textDecoder = new TextDecoderStream();
  const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
  const reader = textDecoder.readable.getReader();

  try {
    let dataBuffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        dataBuffer += value;
        let lines = dataBuffer.split("\n");
        while (lines.length > 1) {
          let line = lines.shift().trim();
          handleSerialData(line);
        }
        dataBuffer = lines[0];
      }
    }
  } catch (err) {
    console.error("❌ Read error:", err);
  } finally {
    reader.releaseLock();
  }
}

function handleSerialData(data) {
  console.log("📩 Received:", data);
  let parts = data.split(",");
  if (parts.length === 7) {
    let isEmergency = parts[0] === "1";
    let isBlinking = parts[1] === "1";
    let isCycleRunning = parts[2] === "1";

    redState = parseInt(parts[3]);
    yellowState = parseInt(parts[4]);
    greenState = parseInt(parts[5]);
    brightness = parseInt(parts[6]);

    if (!isCycleRunning && !isEmergency && !isBlinking) modeText = "OFF";
    else if (isEmergency) modeText = "Emergency Mode";
    else if (isBlinking) modeText = "Blinking Mode";
    else modeText = "Normal Mode";
  } else {
    console.error("❌ Invalid data format:", data);
  }
}

function gotHands(results) { // 손 인식 함수(콜백) -> hands(전역변수)에 결과 저장
  hands = results;
}

// ✅ 슬라이더 값 전송
async function sendData() {
  if (port && writer) {
    let data = `${redSlider.value()},${yellowSlider.value()},${greenSlider.value()}\n`;
    await writer.write(new TextEncoder().encode(data));
    console.log("📤 Sent to Arduino:", data);
  }
}
