/**
 * ear_detector.js - Extrator de Recursos Faciais e Expressão
 * 
 * Extrai:
 * 1. EAR (Eye Aspect Ratio) com detecção de piscada por histerese
 * 2. EYE Abertura normalizada (0.0 a 1.0) para cada olho
 * 3. Ângulos da cabeça (Pitch, Roll, Yaw) em graus
 * 4. MAR (Mouth Aspect Ratio) - abertura da boca
 * 5. BROW (Eyebrow Raise) - elevação das sobrancelhas esquerda/direita (0.0 a 1.0)
 */

function euclideanDistance2D(p1, p2, width = 1, height = 1) {
  const dx = (p1.x - p2.x) * width;
  const dy = (p1.y - p2.y) * height;
  return Math.sqrt(dx * dx + dy * dy);
}

function clamp(val, min = 0.0, max = 1.0) {
  return Math.max(min, Math.min(max, val));
}

class FacialFeatureExtractor {
  constructor(options = {}) {
    // Limiares de histerese para a piscada
    this.thresholdClose = options.thresholdClose !== undefined ? options.thresholdClose : 0.19;
    this.thresholdOpen = options.thresholdOpen !== undefined ? options.thresholdOpen : 0.24;

    this.isEyeClosed = false;
    this.blinkCount = 0;
    this.lastBlinkTime = 0;
    this.minBlinkIntervalMs = 120; // Debounce

    this.onBlink = options.onBlink || null;

}

  setThresholds(closeThresh, openThresh) {
    this.thresholdClose = closeThresh;
    this.thresholdOpen = openThresh;
  }

  calculateEyeEAR(landmarks, pA, pB, pC, pD, pE, pF, width, height) {
    const ptA = landmarks[pA];
    const ptB = landmarks[pB];
    const ptC = landmarks[pC];
    const ptD = landmarks[pD];
    const ptE = landmarks[pE];
    const ptF = landmarks[pF];

    if (!ptA || !ptB || !ptC || !ptD || !ptE || !ptF) return 0;

    const distBF = euclideanDistance2D(ptB, ptF, width, height);
    const distCE = euclideanDistance2D(ptC, ptE, width, height);
    const distAD = euclideanDistance2D(ptA, ptD, width, height);

    if (distAD === 0) return 0;
    return (distBF + distCE) / (2.0 * distAD);
  }

  /**
   * Ângulos da cabeça (Pitch, Roll, Yaw) estimados geometricamente em graus
   */
  calculateHeadPose(landmarks, width, height) {
    const nose = landmarks[1];
    const eyeLeft = landmarks[33];
    const eyeRight = landmarks[263];
    const chin = landmarks[152];
    const glabella = landmarks[168] || landmarks[9];

    if (!nose || !eyeLeft || !eyeRight || !chin || !glabella) {
      return { pitch: 0, roll: 0, yaw: 0 };
    }

    // 1. Roll: inclinação lateral no plano da imagem (eixo Z)
    const dxEyes = (eyeRight.x - eyeLeft.x) * width;
    const dyEyes = (eyeRight.y - eyeLeft.y) * height;
    const rollRad = Math.atan2(dyEyes, dxEyes);
    const rollDeg = rollRad * (180 / Math.PI);

    // 2. Yaw: rotação esquerda/direita (eixo Y)
    // Compara a distância horizontal do nariz até cada olho
    const distNoseL = Math.abs((nose.x - eyeLeft.x) * width);
    const distNoseR = Math.abs((eyeRight.x - nose.x) * width);
    const totalEyeDist = distNoseL + distNoseR;
    let yawDeg = 0;
    if (totalEyeDist > 0) {
      const yawRatio = (distNoseR - distNoseL) / totalEyeDist; // -1 (olhando dir) a +1 (olhando esq)
      yawDeg = yawRatio * 60; // escala em graus aproximados
    }

    // 3. Pitch: inclinação para cima/baixo (eixo X)
    // Compara a proporção do nariz entre a glabela e o queixo
    const topDist = Math.abs((nose.y - glabella.y) * height);
    const bottomDist = Math.abs((chin.y - nose.y) * height);
    const totalFaceH = topDist + bottomDist;
    let pitchDeg = 0;
    if (totalFaceH > 0) {
      // Razão neutra é aproximadamente 0.42 (top / total)
      const pitchRatio = (topDist / totalFaceH) - 0.42;
      pitchDeg = pitchRatio * 90; // escala em graus
    }

    return {
      pitch: parseFloat(pitchDeg.toFixed(1)),
      roll: parseFloat(rollDeg.toFixed(1)),
      yaw: parseFloat(yawDeg.toFixed(1))
    };
  }

  /**
   * MAR (Mouth Aspect Ratio) - Abertura da Boca
   * Lábios verticais: 13, 14
   * Comissuras laterais: 61, 291
   */
  calculateMAR(landmarks, width, height) {
    const p13 = landmarks[13];
    const p14 = landmarks[14];
    const p61 = landmarks[61];
    const p291 = landmarks[291];

    if (!p13 || !p14 || !p61 || !p291) return 0;

    const verticalDist = euclideanDistance2D(p13, p14, width, height);
    const horizontalDist = euclideanDistance2D(p61, p291, width, height);

    if (horizontalDist === 0) return 0;
    const mar = verticalDist / horizontalDist;
    return parseFloat(mar.toFixed(3));
  }

  /**
   * BROW (Eyebrow Raise) - Elevação das Sobrancelhas [0.0 a 1.0]
   * 
   * Mede a distância vertical entre o arco da sobrancelha e o olho:
   * No MediaPipe normalizado (0 a 1 em Y):
   *   eyeTopL (159).y é maior que browL (105).y (porque o topo da tela é Y=0).
   *   distL = (eyeTopL.y - browL.y)
   * 
   * Na escala real relativa à distância interocular:
   *   Em descanso / repouso: distRatio fica em torno de ~0.22 a ~0.26
   *   Ao franzir / descer:   distRatio cai para ~0.16 a ~0.20
   *   Ao erguer (espanto):   distRatio sobe para ~0.30 a ~0.40+
   */
  calculateEyebrowRaise(landmarks, width, height) {
    const browL = landmarks[105];
    const eyeTopL = landmarks[159];
    const browR = landmarks[334];
    const eyeTopR = landmarks[386];
    const eyeL = landmarks[33];
    const eyeR = landmarks[263];

    if (!browL || !eyeTopL || !browR || !eyeTopR || !eyeL || !eyeR) {
      return { browL: 0, browR: 0 };
    }

    const interOcular = euclideanDistance2D(eyeL, eyeR, width, height);
    if (interOcular === 0) return { browL: 0, browR: 0 };

    // Distância vertical positiva (olho está mais abaixo na tela que a sobrancelha)
    const distL = Math.max(0, (eyeTopL.y - browL.y) * height) / interOcular;
    const distR = Math.max(0, (eyeTopR.y - browR.y) * height) / interOcular;

    // Em repouso real distRatio é ~0.24
    // Escala calibrada:
    //   Repouso (<= 0.24) -> 0.00
    //   Erguida (>= 0.36) -> 1.00
    const scoreL = clamp((distL - 0.24) / 0.12, 0.0, 1.0);
    const scoreR = clamp((distR - 0.24) / 0.12, 0.0, 1.0);

    return {
      browL: parseFloat(scoreL.toFixed(3)),
      browR: parseFloat(scoreR.toFixed(3))
    };
  }

  /**
   * Processa o conjunto completo de recursos do quadro
   */
  processLandmarks(landmarks, width, height) {
    if (!landmarks || landmarks.length === 0) {
      return {
        earL: 0, earR: 0, earMed: 0,
        eyeNormL: 0, eyeNormR: 0,
        isEyeClosed: false, blinkTriggered: false, blinkCount: this.blinkCount,
        headPose: { pitch: 0, roll: 0, yaw: 0 },
        mar: 0,
        brows: { browL: 0, browR: 0 }
      };
    }

    // 1. EAR
    const earL = this.calculateEyeEAR(landmarks, 33, 160, 158, 133, 153, 144, width, height);
    const earR = this.calculateEyeEAR(landmarks, 362, 385, 387, 263, 373, 380, width, height);
    const earMed = (earL + earR) / 2.0;

    // 2. Abertura ocular normalizada (0.0 = limiar de fechado, 1.0 = olho totalmente aberto/alerta)
    const eyeNormL = clamp((earL - this.thresholdClose) / (this.thresholdOpen - this.thresholdClose + 1e-6), 0.0, 1.0);
    const eyeNormR = clamp((earR - this.thresholdClose) / (this.thresholdOpen - this.thresholdClose + 1e-6), 0.0, 1.0);

    // 3. Máquina de estados para detecção de piscadas com histerese e debounce
    let blinkTriggered = false;
    const now = Date.now();

    if (!this.isEyeClosed) {
      if (earMed < this.thresholdClose && (now - this.lastBlinkTime >= this.minBlinkIntervalMs)) {
        this.isEyeClosed = true;
        this.blinkCount += 1;
        this.lastBlinkTime = now;
        blinkTriggered = true;
        if (typeof this.onBlink === 'function') {
          this.onBlink({
            earL: parseFloat(earL.toFixed(3)),
            earR: parseFloat(earR.toFixed(3)),
            earMed: parseFloat(earMed.toFixed(3)),
            blinkCount: this.blinkCount,
            timestamp: now
          });
        }
      }
    } else {
      if (earMed > this.thresholdOpen) {
        this.isEyeClosed = false;
      }
    }

    // 4. Recursos adicionais contínuos
    const headPose = this.calculateHeadPose(landmarks, width, height);
    const mar = this.calculateMAR(landmarks, width, height);
    const brows = this.calculateEyebrowRaise(landmarks, width, height);

    return {
      earL,
      earR,
      earMed,
      eyeNormL: parseFloat(eyeNormL.toFixed(3)),
      eyeNormR: parseFloat(eyeNormR.toFixed(3)),
      isEyeClosed: this.isEyeClosed,
      blinkTriggered,
      blinkCount: this.blinkCount,
      headPose,
      mar,
      brows
    };
  }
}

// Compatibilidade e exportação global
window.BlinkDetector = FacialFeatureExtractor;
window.FacialFeatureExtractor = FacialFeatureExtractor;








