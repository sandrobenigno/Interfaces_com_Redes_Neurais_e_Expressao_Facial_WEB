/**
 * ear_detector.js
 * 
 * Implementa o calculo do EAR (Eye Aspect Ratio) com base nos marcos faciais do MediaPipe Face Mesh/Landmarker.
 * Indices MediaPipe (468/478 landmarks):
 * 
 * Olho Esquerdo (da pessoa, lado direito da imagem sem espelhamento):
 *  - Canto lateral externo/interno: 33 (A) e 133 (D)
 *  - Altura vertical 1: 160 (B) e 144 (F)
 *  - Altura vertical 2: 158 (C) e 153 (E)
 * 
 * Olho Direito (da pessoa):
 *  - Canto lateral externo/interno: 362 (A) e 263 (D)
 *  - Altura vertical 1: 385 (B) e 380 (F)
 *  - Altura vertical 2: 387 (C) e 373 (E)
 * 
 * Formula: EAR = (||B - F|| + ||C - E||) / (2 * ||A - D||)
 */

function euclideanDistance2D(p1, p2, width, height) {
  const dx = (p1.x - p2.x) * width;
  const dy = (p1.y - p2.y) * height;
  return Math.sqrt(dx * dx + dy * dy);
}

class BlinkDetector {
  constructor(options = {}) {
    // Limiares de histerese (baseados nos valores calibrados do projeto original)
    this.thresholdClose = options.thresholdClose !== undefined ? options.thresholdClose : 0.19;
    this.thresholdOpen = options.thresholdOpen !== undefined ? options.thresholdOpen : 0.24;

    this.isEyeClosed = false;
    this.blinkCount = 0;
    this.lastBlinkTime = 0;
    this.minBlinkIntervalMs = 120; // Debounce contra leituras espurias rapidas

    this.onBlink = options.onBlink || null;
  }

  setThresholds(closeThresh, openThresh) {
    this.thresholdClose = closeThresh;
    this.thresholdOpen = openThresh;
  }

  /**
   * Calcula o EAR de um conjunto de landmarks para um olho
   */
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
   * Processa os landmarks faciais retornados pelo MediaPipe
   * @param {Array} landmarks Array de 468/478 pontos com {x, y, z} normalizados
   * @param {number} width Largura do quadro de video
   * @param {number} height Altura do quadro de video
   * @returns {Object} { earL, earR, earMed, isEyeClosed, blinkTriggered }
   */
  processLandmarks(landmarks, width, height) {
    if (!landmarks || landmarks.length === 0) {
      return { earL: 0, earR: 0, earMed: 0, isEyeClosed: false, blinkTriggered: false };
    }

    // Olho esquerdo da pessoa (landmarks padrao MediaPipe)
    const earL = this.calculateEyeEAR(landmarks, 33, 160, 158, 133, 153, 144, width, height);
    // Olho direito da pessoa
    const earR = this.calculateEyeEAR(landmarks, 362, 385, 387, 263, 373, 380, width, height);

    const earMed = (earL + earR) / 2.0;
    let blinkTriggered = false;
    const now = Date.now();

    // Maquina de estados com Histerese (igual ao Camera_OSC_Detector_Neural_Piscadas.py)
    if (!this.isEyeClosed) {
      if (earMed < this.thresholdClose && (now - this.lastBlinkTime > this.minBlinkIntervalMs)) {
        this.isEyeClosed = true;
        this.blinkCount++;
        this.lastBlinkTime = now;
        blinkTriggered = true;

        if (this.onBlink) {
          this.onBlink({
            earL,
            earR,
            earMed,
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

    return {
      earL,
      earR,
      earMed,
      isEyeClosed: this.isEyeClosed,
      blinkTriggered,
      blinkCount: this.blinkCount
    };
  }
}

window.BlinkDetector = BlinkDetector;
