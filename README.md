# Interfaces com Redes Neurais e Expressão Facial - Web (MediaPipe + p5.js)

![](img/preview_novo.jpg)

Esta aplicação é a migração e evolução para ambiente Web do projeto original [**Interfaces com Redes Neurais e Expressão Facial**](https://github.com/LAC-EBA-UFMG/Interfaces_com_Redes_Neurais_e_Expressao_Facial)

A versão original utilizava Python, OpenCV, ONNX (RFB-320 e PFLD) e enviava mensagens UDP/OSC (`/piscou`) para um sketch em Java no Processing (`Bolinhas_OSC_PISCADAS.pde`).

Nesta versão Web, tudo roda 100% no navegador (Client-Side), sem a necessidade de instalar Python, drivers de câmera locais ou bibliotecas nativas.

🔗 **Acesse a aplicação online no GitHub Pages:**  
👉 [https://sandrobenigno.github.io/Interfaces_com_Redes_Neurais_e_Expressao_Facial_WEB/](https://sandrobenigno.github.io/Interfaces_com_Redes_Neurais_e_Expressao_Facial_WEB/)

---

## 🚀 Funcionalidades

- **MediaPipe Face Mesh em Tempo Real**: Rastreia 468 marcos faciais com aceleração por WebAssembly e WebGL.
- **Cálculo Fiel de EAR (Eye Aspect Ratio)**:
  - Implementa a equação euclidiana de Soukupová & Cech nos pontos oculares originais.
  - Máquina de estados com **histerese** (`setP_fechar` e `setP_abrir`) ajustáveis por controles deslizantes na interface.
- **Port do Sketch das Bolinhas (`Bolinhas_OSC_PISCADAS`)**:
  - Reescrito em **p5.js**.
  - Mantém a estética original: tela preta, bolinhas coloridas sorteadas a cada piscada, contagem até 500 para limpeza automática e reset por tecla ou clique.
- **Arquitetura Desacoplada estilo OSC**:
  - Comunicação entre iframes, abas e janelas via **`BroadcastChannel`** e fallback para **`window.postMessage`**.
  - Permite rodar os dois módulos em iframes na mesma tela (Split View) ou até mesmo em monitores diferentes (abrindo a tela de bolinhas em uma janela pop-up separada).

---

## 📁 Estrutura do Projeto

```text
Interfaces_com_Redes_Neurais_e_Expressao_Facial_WEB/
├── index.html               # Página mestre (Layout responsivo com iframes e alternância de views)
├── detector.html            # Módulo de visão: Câmera + MediaPipe + HUD do EAR + Calibração
├── bolinhas.html            # Módulo gráfico: Sketch das Bolinhas em p5.js
├── css/
│   └── style.css            # Tema escuro, layout em grid, HUD de depuração e controles
├── js/
│   ├── ear_detector.js      # Lógica matemática de EAR e histerese da piscada
│   ├── event_bus.js         # Barramento de eventos (substituto web do protocolo OSC)
│   └── bolinhas_sketch.js   # Sketch p5.js que gera círculos aleatórios a cada /piscou
└── README.md
```

---

## 💻 Como Rodar Localmente

Devido às políticas de segurança do navegador para permissão de câmera (`getUserMedia`), as páginas com webcam precisam rodar em `localhost` ou sob `https://`.

Para rodar localmente, execute um servidor HTTP simples no terminal dentro desta pasta:

### Com Python:
```bash
python -m http.server 8080
```
Depois, abra no navegador: [http://localhost:8080](http://localhost:8080)

### Com Node.js / npx:
```bash
npx serve .
```

---

## ⌨️ Atalhos e Interações

- **Teclado (em qualquer tela)**: Pressionar qualquer tecla limpa a tela de bolinhas (reseta a contagem).
- **Botão "⚡ Testar Piscada"**: Simula o recebimento do sinal `/piscou` sem precisar piscar os olhos (útil para testes rápidos).
- **Botão "↗ Abrir Bolinhas em Nova Aba"**: Abre o sketch em uma janela separada. Por usar `BroadcastChannel`, as piscadas capturadas na câmera continuam alimentando as bolinhas na outra janela/monitor em tempo real!

---

## 📡 Integração com PureData, Processing e DAWs via OSC (UDP)

A aplicação continua rodando diretamente pelo **GitHub Pages** (ou localmente). Para enviar mensagens OSC para softwares como **PureData**, **Processing**, **SuperCollider** ou **Reaper**, você só precisa iniciar o script de ponte (*bridge*) no seu computador:

### 1. Instale as dependências da bridge (apenas na primeira vez):
```bash
pip install websockets python-osc
```

### 2. Execute a bridge apontando para a porta UDP desejada:
Exemplo para o PureData escutando na porta **`12345`**:
```bash
python bridge/bridge_osc.py --port 12345
```
*(Se omitir a porta, o padrão é 12345. Para apontar para outra máquina na rede: `--ip 192.168.1.50 --port 12345`)*

### 3. Ative o envio na interface Web:
- Na barra inferior do detector, basta marcar a caixinha **`[x] 📡 OSC UDP`**.
- O indicador mostrará `🟢 Ativo`. A aplicação passa a emitir tanto o evento discreto de piscada quanto os fluxos periódicos de expressividade facial (~30 Hz):

#### 📋 Mapa de Mensagens OSC (Discretas e Periódicas):

| Endereço OSC | Tipos | Argumentos | Descrição |
| :--- | :--- | :--- | :--- |
| `/piscou` | `ff` | `[earL, earR]` | **(Evento)** Disparado no instante exato em que os olhos fecham |
| `/head/angles` | `fff` | `[pitch, roll, yaw]` | **(Periódico)** Ângulos da cabeça em graus (Cima/Baixo, Inclinação, Giro) |
| `/eye/open` | `ff` | `[left, right]` | **(Periódico)** Abertura ocular normalizada de `0.0` (fechado) a `1.0` (aberto) |
| `/mouth/mar` | `f` | `[mar]` | **(Periódico)** Abertura vertical da boca (*Mouth Aspect Ratio*) |
| `/brow/raise` | `ff` | `[left, right]` | **(Periódico)** Elevação das sobrancelhas normalizada de `0.0` (repouso) a `1.0` |
