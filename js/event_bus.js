/**
 * EventBus - Comunicacao Desacoplada estilo OSC para Web
 * 
 * Utiliza BroadcastChannel (funciona entre iframes, abas e janelas diferentes)
 * com fallback e espelhamento em window.postMessage para compatibilidade total.
 */
class OSCEventBus {
  constructor(channelName = 'neural_facial_osc') {
    this.channelName = channelName;
    this.listeners = new Map();

    // Inicializa BroadcastChannel se disponivel
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(this.channelName);
      this.channel.onmessage = (event) => {
        this._dispatch(event.data);
      };
    } else {
      this.channel = null;
      console.warn('BroadcastChannel nao suportado neste navegador. Usando postMessage.');
    }

    // Escuta window.postMessage (iframes locais)
    window.addEventListener('message', (event) => {
      if (event.data && event.data.channel === this.channelName) {
        this._dispatch(event.data.payload);
      }
    });
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
      } catch (err) {
        console.error('Erro ao enviar via BroadcastChannel:', err);
      }
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
  }

  /**
   * Registra um listener para um determinado endereco OSC
   * @param {string} address Ex: "/piscou" ou "*" para todos
   * @param {Function} callback 
   */
  on(address, callback) {
    if (!this.listeners.has(address)) {
      this.listeners.set(address, new Set());
    }
    this.listeners.get(address).add(callback);
  }

  /**
   * Remove um listener
   */
  off(address, callback) {
    if (this.listeners.has(address)) {
      this.listeners.get(address).delete(callback);
    }
  }

  _dispatch(payload) {
    if (!payload || !payload.address) return;

    // Callbacks do endereco especifico
    if (this.listeners.has(payload.address)) {
      this.listeners.get(payload.address).forEach((cb) => {
        try {
          cb(payload.data, payload);
        } catch (e) {
          console.error(`Erro no listener para ${payload.address}:`, e);
        }
      });
    }

    // Callbacks globais wildcard '*'
    if (this.listeners.has('*')) {
      this.listeners.get('*').forEach((cb) => {
        try {
          cb(payload.data, payload);
        } catch (e) {
          console.error('Erro no listener coringa (*):', e);
        }
      });
    }
  }
}

// Instancia global para uso direto
window.oscBus = new OSCEventBus();
