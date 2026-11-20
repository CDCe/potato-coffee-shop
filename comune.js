// Potato Coffee Shop: pezzi condivisi tra l'app di Potato e il banco del barista.
const CAFFE = (() => {
  const RPC = 'https://eqnjwintvsjluogotviv.supabase.co/rest/v1/rpc/';
  const CHIAVE_PUBBLICA = 'sb_publishable_u4O7aojbhybL87xuxYwisw_aO54MM5_';

  async function rpc(nome, argomenti) {
    const r = await fetch(RPC + nome, {
      method: 'POST',
      headers: {
        apikey: CHIAVE_PUBBLICA,
        Authorization: 'Bearer ' + CHIAVE_PUBBLICA,
        'Content-Type': 'application/json',
        'Content-Profile': 'caffe',
      },
      body: JSON.stringify(argomenti),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const e = new Error(j.message || 'errore');
      e.codice = j.message || 'errore';
      throw e;
    }
    return j;
  }

  // Suoni a 8 bit fatti con l'oscillatore: niente file da scaricare.
  let ctx = null;
  function sblocca() {
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { /* senza audio si vive lo stesso */ }
  }
  const MELODIE = {
    tocco: [[660, 0.05]],
    ordine: [[523, 0.09], [659, 0.09], [784, 0.09], [1047, 0.16]],
    consegna: [[784, 0.1], [988, 0.1], [1175, 0.1], [1568, 0.28]],
    scaduto: [[392, 0.16], [330, 0.16], [262, 0.3]],
    cuore: [[880, 0.06], [1175, 0.1]],
    bacio: [[1319, 0.07], [1568, 0.07], [2093, 0.16]],
  };
  function suona(nome) {
    if (!ctx || localStorage.getItem('caffe_muto') === '1') return;
    let t = ctx.currentTime + 0.01;
    for (const [freq, durata] of MELODIE[nome] || []) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.06, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + durata);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + durata + 0.02);
      t += durata;
    }
  }

  const mmss = (ms) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  };
  const durata = (ms) => {
    const s = Math.max(0, Math.round(ms / 1000));
    return Math.floor(s / 60) + ' min ' + String(s % 60).padStart(2, '0') + ' s';
  };
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const quando = (ms) => {
    const d = new Date(ms);
    const oggi = new Date();
    const ieri = new Date(Date.now() - 864e5);
    const ora = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === oggi.toDateString()) return 'oggi, ' + ora;
    if (d.toDateString() === ieri.toDateString()) return 'ieri, ' + ora;
    return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) + ', ' + ora;
  };
  const cuori = (n, classe = '') =>
    [1, 2, 3, 4, 5].map((i) => `<img class="cuoricino ${classe}" src="assets/icone/${i <= n ? 'cuore' : 'cuore-vuoto'}.png" alt="">`).join('');
  const sprite = (nome) => `assets/bevande/${encodeURIComponent(nome)}.png`;

  return { rpc, sblocca, suona, mmss, durata, esc, quando, cuori, sprite };
})();
