/**
 * bolinhas_sketch.js
 * 
 * Port fiel do sketch original em Processing (Bolinhas_OSC_PISCADAS.pde)
 * Autor original: Sandro Benigno (2020)
 * Port Web: JavaScript / p5.js
 */

let bolinhaX = 0;
let bolinhaY = 0;
let bolinhaR = 0;
let bolinhaG = 0;
let bolinhaB = 0;
let bolinhaRaio = 20;
let oscRecebido = false;
let bolinhasCount = 0;
const MAX_BOLINHAS = 500;

function setup() {
  const container = document.getElementById('canvas-container');
  const w = (container && container.clientWidth > 0) ? container.clientWidth : window.innerWidth;
  const h = (container && container.clientHeight > 0) ? container.clientHeight : window.innerHeight;
  const canvas = createCanvas(w, h);
  if (container) {
    canvas.parent('canvas-container');
  }

  frameRate(30);
  background(0); // Fundo preto original

  // Observer para redimensionar se o iframe ou tela mudar
  if (window.ResizeObserver && container) {
    const ro = new ResizeObserver(() => {
      windowResized();
    });
    ro.observe(container);
  }

  // Escuta o barramento estilo OSC
  if (window.oscBus) {
    window.oscBus.on('/piscou', (data) => {
      onMensagemPiscou(data);
    });
  }

  updateCounterUI();
}

function windowResized() {
  const container = document.getElementById('canvas-container');
  if (container && container.clientWidth > 0 && container.clientHeight > 0) {
    if (width !== container.clientWidth || height !== container.clientHeight) {
      const prevGraphics = get();
      resizeCanvas(container.clientWidth, container.clientHeight);
      background(0);
      image(prevGraphics, 0, 0);
    }
  }
}

function draw() {
  // Se recebeu o trigger "/piscou", desenha a bolinha
  if (oscRecebido) {
    desenhaBolinha(bolinhaX, bolinhaY);
  }

  // Atingiu 500 bolinhas? Entao limpa a tela (comportamento exato do PDE)
  if (bolinhasCount >= MAX_BOLINHAS) {
    limparTela();
  }
}

function desenhaBolinha(x, y) {
  colorMode(RGB, 255);
  noStroke();
  fill(bolinhaR, bolinhaG, bolinhaB);
  ellipse(x, y, bolinhaRaio, bolinhaRaio);
  
  bolinhasCount++;
  oscRecebido = false; // Esperando o proximo recebimento
  updateCounterUI();
}

function limparTela() {
  background(0);
  bolinhasCount = 0;
  updateCounterUI();
}

// Qualquer tecla pressionada induz a limpeza da tela (como no Processing)
function keyPressed() {
  limparTela();
}

// Suporte a toque para mobile:
// Toque simples: adiciona bolinha na tela
// Toque duplo ou manter pressionado: limpa a tela
let lastTouchTime = 0;

function touchStarted() {
  // Ignora se o toque foi em botões da barra inferior
  if (event && event.target && event.target.tagName === "BUTTON") return;

  const now = millis();
  if (now - lastTouchTime < 350) {
    limparTela();
  } else {
    if (touches.length > 0) {
      bolinhaX = Math.floor(touches[0].x);
      bolinhaY = Math.floor(touches[0].y);
    } else {
      bolinhaX = Math.floor(mouseX || random(0, width));
      bolinhaY = Math.floor(mouseY || random(0, height));
    }
    bolinhaR = Math.floor(random(0, 255));
    bolinhaG = Math.floor(random(0, 255));
    bolinhaB = Math.floor(random(0, 255));
    bolinhaRaio = Math.floor(random(15, 50));
    oscRecebido = true;
  }
  lastTouchTime = now;
}

// Trata o recebimento do evento /piscou
function onMensagemPiscou(data) {
  const curW = width > 50 ? width : (window.innerWidth || 800);
  const curH = height > 50 ? height : (window.innerHeight || 800);

  bolinhaX = Math.floor(random(0, curW));
  bolinhaY = Math.floor(random(0, curH));
  bolinhaR = Math.floor(random(0, 255));
  bolinhaG = Math.floor(random(0, 255));
  bolinhaB = Math.floor(random(0, 255));
  bolinhaRaio = Math.floor(random(15, 50));
  
  oscRecebido = true;
}

function updateCounterUI() {
  const el = document.getElementById('bolinhas-count');
  if (el) {
    el.innerText = `${bolinhasCount} / ${MAX_BOLINHAS}`;
  }
}

// Exporta funcoes auxiliares para botoes na UI
window.manualTriggerBlink = () => {
  if (window.oscBus) {
    window.oscBus.send('/piscou', { earL: 0.15, earR: 0.15, manual: true });
  } else {
    onMensagemPiscou();
  }
};

window.manualClearCanvas = () => {
  limparTela();
};


