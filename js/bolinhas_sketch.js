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
  const w = container ? container.clientWidth : 800;
  const h = container ? container.clientHeight : 800;
  const canvas = createCanvas(w, h);
  if (container) {
    canvas.parent('canvas-container');
  }

  frameRate(30);
  background(0); // Fundo preto original

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
  if (container) {
    // Redimensiona o canvas sem limpar o conteudo ja desenhado
    const prevGraphics = get();
    resizeCanvas(container.clientWidth, container.clientHeight);
    background(0);
    image(prevGraphics, 0, 0);
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

// Trata o recebimento do evento /piscou
function onMensagemPiscou(data) {
  // Sorteia posicao dentro das dimensoes atuais da tela
  bolinhaX = Math.floor(random(0, width));
  bolinhaY = Math.floor(random(0, height));
  
  // Sorteia cor e raio
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
