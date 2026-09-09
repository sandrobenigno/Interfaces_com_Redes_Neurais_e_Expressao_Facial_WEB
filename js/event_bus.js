/**
 * EventBus - Comunicacao Desacoplada estilo OSC para Web
 * 
 * - BroadcastChannel / postMessage: sincroniza iframes, abas e janelas no browser
 * - WebSocket Bridge (Opcional): envia pacotes para ponte local em Python/Node que despacha UDP/OSC
 */
class OSCEventBus {
  constructor(channelName = 'neural_facial_osc') {
    this.channelName = channelName;
    this.listeners = new Map();

    // Estado da Bridge WebSocket
    this.ws = null;
    this.wsEnabled = false;
    this.wsUrl = 'ws://127.0.0.1:8081';
    this.onBridgeStatusChange = null;

    // Inicializa BroadcastChannel se disponivel
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(this.channelName);
      this.channel.onmessage = (event) => {
        this._dispatch(event.data);
      };
    } else {
      this.channel = null;
    }

    // Escuta window.postMessage (iframes locais)
    window.addEventListener('message', (event) => {
      if (event.data && event.data.channel === this.channelName) {
        this._dispatch(event.data.payload);
      }
    });
  }

  /**
   * Ativa ou desativa a ponte WebSocket -> OSC UDP
   */
  setBridgeEnabled(enabled, url = 'ws://127.0.0.1:8081') {
    this.wsEnabled = enabled;
    this.wsUrl = url;

    if (!enabled) {
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
      if (this.onBridgeStatusChange) this.onBridgeStatusChange('disabled');
      return;
    }

    this._connectWebSocket();
  }

  _connectWebSocket() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (this.onBridgeStatusChange) this.onBridgeStatusChange('connecting');

    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        if (this.onBridgeStatusChange) this.onBridgeStatusChange('connected');
      };

      this.ws.onclose = () => {
        if (this.wsEnabled) {
          if (this.onBridgeStatusChange) this.onBridgeStatusChange('disconnected');
        }
      };

      this.ws.onerror = (err) => {
        if (this.onBridgeStatusChange) this.onBridgeStatusChange('error');
      };
    } catch (e) {
      if (this.onBridgeStatusChange) this.onBridgeStatusChange('error');
    }
  }

  /**
   * Envia uma mensagem no barramento (estilo OSC)
   * @param {string} address Ex: "/piscou"
   * @param {any} data Dados adicionais (ex: { earL, earR })
   */
  send(address, data = {}) {
    const payload = {
      address,
      data,
      timestamp: Date.now()
    };

    // 1. BroadcastChannel (entre iframes, abas e janelas)
    if (this.channel) {
      try {
        this.channel.postMessage(payload);
      } catch (err) {}
    }

    // 2. Notifica o proprio frame
    this._dispatch(payload);

    // 3. postMessage para janela pai (se estiver dentro de um iframe)
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ channel: this.channelName, payload }, '*');
    }

    // 4. postMessage para iframes filhos (se tiver)
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach((iframe) => {
      if (iframe.contentWindow) {
        iframe.contentWindow.postMessage({ channel: this.channelName, payload }, '*');
      }
    });

    // 5. Envia via WebSocket para a Bridge Python se estiver conectado
    if (this.wsEnabled && this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(payload));
      } catch (err) {
        console.error('Erro ao enviar para WebSocket Bridge:', err);
      }
    }
  }

  on(address, callback) {
    if (!this.listeners.has(address)) {
      this.listeners.set(address, new Set());
    }
    this.listeners.get(address).add(callback);
  }

  off(address, callback) {
    if (this.listeners.has(address)) {
      this.listeners.get(address).delete(callback);
    }
  }

  _dispatch(payload) {
    if (!payload || !payload.address) return;

    if (this.listeners.has(payload.address)) {
      this.listeners.get(payload.address).forEach((cb) => {
        try { cb(payload.data, payload); } catch (e) {}
      });
    }

    if (this.listeners.has('*')) {
      this.listeners.get('*').forEach((cb) => {
        try { cb(payload.data, payload); } catch (e) {}
      });
    }
  }
}

window.oscBus = new OSCEventBus();
