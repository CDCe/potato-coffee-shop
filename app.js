// Potato Coffee Shop: l'app di Potato.
(() => {
  const { rpc, sblocca, suona, mmss, durata, esc, quando, cuori, sprite } = CAFFE;
  const $ = (s) => document.querySelector(s);

  // Il vassoio resta sul telefono finché non ordina: può riempirlo con calma, anche chiudendo l'app.
  function leggiVassoio() {
    try { const v = JSON.parse(localStorage.getItem('caffe_vassoio') || '[]'); return Array.isArray(v) ? v.slice(0, 8) : []; } catch (_) { return []; }
  }
  function salvaVassoio() {
    try { localStorage.setItem('caffe_vassoio', JSON.stringify(S.vassoio)); localStorage.setItem('caffe_modo', S.modo); } catch (_) { /* niente */ }
  }
  const oraCorta = (ms) => new Date(ms).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

  const S = {
    vassoio: leggiVassoio(),
    modo: localStorage.getItem('caffe_modo') === 'in_fila' ? 'in_fila' : 'insieme',
    servitiPrima: null, // quante righe dell'ordine erano servite al giro prima (per festeggiare ogni consegna)
    chiave: localStorage.getItem('caffe_parola') || new URLSearchParams(location.search).get('k') || '',
    q: null,            // ultimo quadro arrivato dal server
    sfaso: 0,           // orologio del server meno orologio del telefono
    vista: '',          // chiave della vista disegnata (per non ridisegnare mentre scrive)
    scelta: null,       // bevanda toccata nel menu
    voto: 0, etichette: new Set(), bacio: false,
    scheda: 'bancone',
    occupato: false,
    ultimoStato: '',
  };

  const BATTUTE = {
    // Le frasi del barista al bancone (le prime quattro e le ultime due sono di Cristian).
    menu: [
      '¡Caffè para la pote! ☕',
      'Más rápido que Starbucks 😎',
      'Ojalá lloviera café en el campo 🎶',
      'Café para olvidar 🎶',
      'Un café, dos besos: es la tarifa 💋',
      'Barista certificado, con licencia de amor ❤️',
      'Il cliente ha sempre ragione. Soprattutto se è Potato.',
      'Oggi offre la casa. La casa sono io.',
      'Despacito no: qui si serve prestissimo 🎶',
      'Y yo te pedí el perdón que yo nunca concedo 🎶',
      'Este café está más caliente que tú, bebu 🔥',
      'Il caffè è pronto, il barista pure 😏',
    ],
    scelta: ['Ottima scelta. Vuoi aggiungere una nota?', 'Segnato. Qualche richiesta speciale?', 'Buon gusto, come sempre.'],
    in_attesa: ['Ordine partito! Il barista ha ricevuto la chiamata.', 'Campanello suonato. Arrivo, Potato.', 'Ricevuto! Cronometro alla mano.'],
    vassoio: ['Messo sul vassoio. Altro?', 'Segnato. Ti porto anche qualcos\'altro?', 'Sul vassoio. Quando hai finito, ordina tutto.'],
    servito_riga: ['Ecco il primo! Il resto arriva.', 'Uno servito, il prossimo è già in lavorazione.', 'Consegnato. Non andare via, c\'è dell\'altro.'],
    in_preparazione: ['Lo sto preparando adesso, con amore.', 'Mani all\'opera. Tra poco è da te.', 'Sto versando. Non sbirciare.'],
    fretta: ['Corro, corro! Sto arrivando!', 'Quasi fatto, giuro!', 'Ultimi secondi... non guardare l\'orologio!'],
    scaduto: ['Perdonami Potato... sono in ritardo.', 'Tempo scaduto. Mi sono giocato dieci punti.', 'Lo so, lo so. Mi faccio perdonare.'],
    consegnato: ['Ecco a te. Con affetto, il tuo barista.', 'Servita! Com\'è andato il servizio?', 'Fatto. Dimmi la verità: quanti cuori merito?'],
    consegnato_tardi: ['Eccolo... in ritardo, ma fatto col cuore.', 'Scusa l\'attesa. Spero sia buono almeno.'],
    grazie: ['Grazie Potato! Torna quando vuoi.', 'Recensione ricevuta. Il barista arrossisce.', 'Alla prossima. La casa ti aspetta.'],
    bacio: ['Un bacio di mancia! Giornata fatta.', 'La mancia migliore del mondo. Grazie!'],
    chiuso: ['Il barista è fuori. Torna presto, promesso.'],
  };
  const scegli = (lista) => lista[Math.floor(Math.random() * lista.length)];
  // Al bancone gira una frase diversa ogni volta: mai la stessa di prima.
  function fraseBancone() {
    const prima = localStorage.getItem('caffe_frase');
    const lista = BATTUTE.menu.filter((f) => f !== prima);
    const f = scegli(lista);
    try { localStorage.setItem('caffe_frase', f); } catch (_) { /* niente */ }
    return f;
  }

  // ---------- Dialogo a macchina da scrivere ----------
  let timerBattuta = null;
  function parla(testo) {
    const p = $('#battuta');
    clearInterval(timerBattuta);
    let i = 0;
    p.textContent = '';
    timerBattuta = setInterval(() => {
      p.textContent = testo.slice(0, ++i);
      if (i >= testo.length) clearInterval(timerBattuta);
    }, 28);
    p.onclick = () => { clearInterval(timerBattuta); p.textContent = testo; };
  }

  function posa(nome, classe = '') {
    const b = $('#barista');
    const src = `assets/barista/${nome}.png`;
    if (!b.src.endsWith(src)) b.src = src;
    b.className = 'barista ' + classe;
  }

  function avviso(testo) {
    const d = document.createElement('div');
    d.className = 'avviso';
    d.textContent = testo;
    document.body.append(d);
    setTimeout(() => d.remove(), 2600);
  }

  function coriandoli(icona, quanti = 14) {
    const c = document.createElement('div');
    c.className = 'coriandoli';
    for (let i = 0; i < quanti; i++) {
      const im = document.createElement('img');
      im.src = `assets/icone/${icona}.png`;
      im.style.left = Math.random() * 92 + '%';
      im.style.animationDelay = Math.random() * 0.7 + 's';
      c.append(im);
    }
    document.body.append(c);
    setTimeout(() => c.remove(), 2800);
  }

  const adesso = () => Date.now() + S.sfaso;

  // ---------- Server ----------
  async function chiama(nome, argomenti = {}) {
    const q = await rpc(nome, { p_chiave: S.chiave, ...argomenti });
    S.q = q;
    S.sfaso = q.ora - Date.now();
    return q;
  }

  async function aggiorna() {
    if (!S.chiave || S.occupato) return;
    try {
      await chiama('apri');
      $('#porta').hidden = true;
      disegna();
    } catch (e) {
      if (e.codice === 'parola_sbagliata') { localStorage.removeItem('caffe_parola'); S.chiave = ''; mostraPorta(true); }
    }
  }

  async function azione(nome, argomenti, alTermine) {
    if (S.occupato) return;
    S.occupato = true;
    try {
      await chiama(nome, argomenti);
      if (alTermine) alTermine();
    } catch (e) {
      const testi = {
        locale_chiuso: 'Il locale ha appena chiuso.',
        ordine_in_corso: 'C\'è già un ordine in corso.',
        troppi_ordini: 'Il barista è stremato: troppi ordini oggi.',
        bevanda_sconosciuta: 'Qualcosa sul vassoio non è più in menu.',
        vassoio_vuoto: 'Il vassoio è vuoto.',
        vassoio_pieno: 'Troppa roba sul vassoio: massimo 8 cose.',
      };
      avviso(testi[e.codice] || 'Non riesco a parlare con il bancone. Riprova.');
      try { await chiama('apri'); } catch (_) { /* resta il quadro vecchio */ }
    } finally {
      S.occupato = false;
      disegna();
    }
  }

  // ---------- Avvisi sul telefono (notifiche push) ----------
  // stati: attivi, da_attivare, bloccati, serve_home (iPhone fuori dalla Home), no (browser senza push)
  const pushOk = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const suIphone = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
  function statoPush() {
    if (!pushOk()) return suIphone() ? 'serve_home' : 'no';
    if (Notification.permission === 'denied') return 'bloccati';
    return Notification.permission === 'granted' && localStorage.getItem('caffe_push') === '1' ? 'attivi' : 'da_attivare';
  }
  function chiaveBin(b64) {
    const raw = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
  }
  async function iscriviPush(chiedi) {
    if (!pushOk() || !S.chiave) return false;
    if (chiedi && Notification.permission !== 'granted' && (await Notification.requestPermission()) !== 'granted') return false;
    if (Notification.permission !== 'granted') return false;
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chiaveBin(await rpc('push_chiave', {})) });
    const j = sub.toJSON();
    await rpc('push_iscrivi', { p_chiave: S.chiave, p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth });
    localStorage.setItem('caffe_push', '1');
    return true;
  }
  function bloccoAvvisi(breve) {
    const s = statoPush();
    if (s === 'attivi') return breve ? '' : '<p class="avvisi-ok">🔔 Avvisi attivi su questo telefono.</p>';
    if (s === 'da_attivare') return `<button class="bottone largo" id="attiva-avvisi">🔔 ${breve ? 'Avvisami quando è pronto' : 'Attiva gli avvisi'}</button>`;
    if (breve) return '';
    if (s === 'bloccati') return '<p class="nota-piccola">Gli avvisi sono bloccati. Per riaccenderli: Impostazioni › Notifiche › Potato Coffee.</p>';
    if (s === 'serve_home') return '<p class="nota-piccola">Per ricevere gli avvisi apri il locale dall\'icona sulla schermata Home (Safari › Condividi › Aggiungi alla schermata Home).</p>';
    return '<p class="nota-piccola">Questo browser non riceve avvisi.</p>';
  }

  // ---------- Disegno ----------
  function momento() {
    const h = new Date().getHours();
    return h >= 5 && h < 12 ? 'mattina' : h >= 12 && h < 18 ? 'pomeriggio' : 'sera';
  }

  function disegna() {
    const q = S.q;
    if (!q) return;
    const o = q.ordine;
    const aperto = q.locale.aperto;

    const c = $('#cartellino');
    c.className = 'cartellino ' + (aperto ? 'aperto' : 'chiuso');
    c.textContent = aperto ? `Aperto · ${q.barista.livello}` : 'Chiuso';
    $('#scena').classList.toggle('chiusa', !aperto && !o);
    $('#cartello-chiuso').hidden = aperto || !!o;
    $('#barista').hidden = !aperto && !o;

    const stato = o ? o.stato : aperto ? 'menu' : 'chiuso';
    // Con "uno alla volta" l'ordine resta aperto: ogni riga servita ridisegna la vista e si festeggia.
    const serviti = o ? (o.righe || []).filter((r) => r.servito_il).length : 0;
    const appenaServito = !!(o && S.servitiPrima && S.servitiPrima.id === o.id && serviti > S.servitiPrima.n && o.stato !== 'consegnato');
    S.servitiPrima = o ? { id: o.id, n: serviti } : null;
    if (appenaServito) { suona('consegna'); coriandoli('stella', 8); }

    const chiaveVista = stato + ':' + (o ? o.id + ':' + serviti : '') + ':' + (o && o.stato === 'consegnato' ? '' : q.menu.map((m) => m.id).join(','));
    const cambiato = stato !== S.ultimoStato;

    if (cambiato) {
      const eraAttesa = ['in_attesa', 'in_preparazione'].includes(S.ultimoStato);
      if (stato === 'consegnato' && (eraAttesa || S.ultimoStato === 'scaduto')) { suona('consegna'); coriandoli('stella', 10); }
      if (stato === 'scaduto' && eraAttesa) suona('scaduto');
      S.ultimoStato = stato;
    }

    // Scena
    const banco = $('#sul-banco');
    if (stato === 'consegnato') {
      posa('consegna');
      banco.src = sprite(o.sprite); banco.hidden = false;
      $('#vapore').hidden = !['americano', 'cappuccino', 'te'].includes(o.sprite);
    } else {
      banco.hidden = true; $('#vapore').hidden = true;
      if (stato === 'menu') posa('saluto', cambiato ? 'entra' : '');
      else if (stato === 'scaduto') posa('scusa');
      else if (stato !== 'chiuso') posa('prepara', o.scadenza - adesso() < 120000 ? 'fretta' : '');
    }

    if (chiaveVista !== S.vista) {
      S.vista = chiaveVista;
      const v = $('#vista');
      if (stato === 'menu') { S.scelta = null; v.innerHTML = vistaMenu(q); disegnaVassoio(); parla(fraseBancone()); }
      else if (stato === 'chiuso') { v.innerHTML = vistaChiuso(q); parla(BATTUTE.chiuso[0]); }
      else if (stato === 'in_attesa' || stato === 'in_preparazione') { v.innerHTML = vistaAttesa(o); parla(scegli(appenaServito ? BATTUTE.servito_riga : BATTUTE[stato])); }
      else if (stato === 'scaduto') { v.innerHTML = vistaScaduto(o); parla(scegli(BATTUTE.scaduto)); }
      else if (stato === 'consegnato') { S.voto = 0; S.etichette = new Set(); S.bacio = false; v.innerHTML = vistaRecensione(o); parla(scegli(o.in_ritardo ? BATTUTE.consegnato_tardi : BATTUTE.consegnato)); }
    }
    tic();
    disegnaTessera(q);
    disegnaBarista(q);
  }

  function vistaMenu(q) {
    return `<div class="menu">${q.menu.map((m) => `
      <button class="voce" data-bevanda="${esc(m.id)}">
        <img src="${sprite(m.sprite)}" alt="" onerror="this.src='assets/bevande/americano.png'">
        <b>${esc(m.nome)}</b><small>${esc(m.descrizione)}</small>
      </button>`).join('')}</div>
      <div id="conferma"></div>
      <div id="vassoio"></div>`;
  }

  // Scadenze come le calcola il server: insieme = tutto entro il più lento;
  // uno alla volta = ognuno entro il suo tempo e almeno 5 minuti dopo quello prima.
  function tempiVassoio(righe, modo) {
    if (modo !== 'in_fila' || righe.length < 2) {
      const max = Math.max(...righe.map((r) => r.minuti || 15));
      return righe.map(() => max);
    }
    let prec = null;
    return righe.map((r) => { let t = r.minuti || 15; if (prec !== null) t = Math.max(t, prec + 5); prec = t; return t; });
  }

  function disegnaVassoio() {
    const box = $('#vassoio');
    if (!box || !S.q) return;
    // Se il barista ha tolto qualcosa dal menu, sparisce anche dal vassoio.
    S.vassoio = S.vassoio.filter((r) => S.q.menu.some((m) => m.id === r.bevanda));
    const v = S.vassoio;
    if (!v.length) { box.innerHTML = ''; return; }
    const fila = S.modo === 'in_fila' && v.length > 1;
    const tempi = tempiVassoio(v, S.modo);
    box.innerHTML = `<div class="pannello vassoio">
      <p class="titoletto">Il tuo vassoio</p>
      <ul class="storico">${v.map((r, i) => `<li>
        ${fila ? `<span class="numero">${i + 1}</span>` : ''}
        <img class="bev" src="${sprite(r.sprite)}" alt="">
        <div class="dati"><b>${esc(r.nome)}</b><small>${fila ? 'entro ' + tempi[i] + ' minuti' : (r.minuti || 15) + ' minuti'}${r.nota ? ' · ' + esc(r.nota) : ''}</small></div>
        ${fila && i > 0 ? `<button class="tasto-piccolo" data-su="${i}" aria-label="Sposta prima">▲</button>` : ''}
        <button class="tasto-piccolo" data-togli="${i}" aria-label="Togli">✕</button>
      </li>`).join('')}</ul>
      ${v.length > 1 ? `<div class="etichette scelte">
          <button class="etichetta${fila ? '' : ' accesa'}" data-modo="insieme">Tutto insieme</button>
          <button class="etichetta${fila ? ' accesa' : ''}" data-modo="in_fila">Uno alla volta</button>
        </div>
        <p class="nota-piccola">${fila ? 'Arrivano in quest\'ordine, ognuno col suo tempo. Con ▲ sposti una cosa più su.' : `Arriva tutto insieme, entro ${tempi[0]} minuti.`}</p>` : ''}
      <div class="riga-bottoni"><button class="bottone verde largo" id="ordina">${v.length > 1 ? `Ordina tutto (${v.length})` : 'Ordina'}</button></div>
    </div>`;
  }

  function vistaConferma(m) {
    const opz = m.opzioni || [];
    const varianti = m.varianti || [];
    S.opzione = opz[0] || null;
    // Per ogni gruppo (macinato/in grani, intensità) parte acceso quello di mezzo se sono tre, altrimenti il primo.
    S.varianti = varianti.map((g) => g.scelte[g.scelte.length === 3 ? 1 : 0]);
    return `<div class="pannello conferma">
      <div class="conferma-testa"><img id="conferma-img" src="${sprite(S.opzione ? S.opzione.sprite : m.sprite)}" alt=""><div><b>${esc(m.nome)}</b><br><small>Il barista ha ${m.minuti || 15} minuti per portartelo.</small></div></div>
      ${opz.length ? `<p class="nota-piccola" style="margin:10px 0 0">Cosa ti va?</p><div class="etichette scelte">${opz.map((o, i) =>
        `<button class="etichetta${i === 0 ? ' accesa' : ''}" data-opzione="${i}">${esc(o.nome)}</button>`).join('')}</div>` : ''}
      ${varianti.map((g, gi) => `<p class="nota-piccola" style="margin:10px 0 0">${esc(g.titolo)}</p><div class="etichette scelte">${g.scelte.map((s) =>
        `<button class="etichetta${S.varianti[gi] === s ? ' accesa' : ''}" data-variante="${gi}" data-valore="${esc(s)}">${esc(s)}</button>`).join('')}</div>`).join('')}
      <input type="text" id="nota" maxlength="140" placeholder="${opz.length ? 'Altro? Scrivilo qui (gusto, marca...)' : 'Una nota? (poco zucchero, tazza grande...)'}" autocomplete="off">
      <div class="riga-bottoni"><button class="bottone verde largo" id="aggiungi">Metti sul vassoio</button></div>
    </div>`;
  }

  function vistaChiuso(q) {
    return `<div class="pannello centro"><p class="titoletto">Il locale è chiuso</p>
      <p>${esc(q.locale.cartello || 'Il barista è fuori casa. Riapre appena torna.')}</p></div>`;
  }

  // Le righe di un ordine con più cose: cosa è già arrivato e cosa manca.
  function listaRighe(o) {
    const fila = o.modo === 'in_fila';
    return `<ul class="storico righe-ordine">${o.righe.map((r, i) => {
      const fatto = !!r.servito_il;
      const stato = fatto ? (r.in_ritardo ? '✓ servito in ritardo' : '✓ servito') : fila ? 'entro le ' + oraCorta(r.scadenza) : 'in arrivo';
      return `<li class="${fatto ? 'fatto' : fila && i === o.riga_ora ? 'ora' : ''}">
        ${fila ? `<span class="numero">${i + 1}</span>` : ''}<img class="bev" src="${sprite(r.sprite)}" alt="">
        <div class="dati"><b>${esc(r.nome)}</b><small>${stato}${r.nota ? ' · ' + esc(r.nota) : ''}</small></div></li>`;
    }).join('')}</ul>`;
  }

  function vistaAttesa(o) {
    const righe = o.righe || [];
    const tante = righe.length > 1;
    const adessoRiga = righe[o.riga_ora] || righe[0] || {};
    const titolo = !tante ? o.nome : o.modo === 'in_fila' ? 'Ora arriva: ' + adessoRiga.nome : 'Tutto insieme';
    const nota = tante ? o.nota : (righe[0] && righe[0].nota) || o.nota;
    return `<div class="pannello">
      <div class="attesa-testa"><img src="${sprite(o.sprite)}" alt="">
        <div><b>${esc(titolo)}</b><small>Ordine n. ${o.id}${nota ? ' · ' + esc(nota) : ''}</small></div></div>
      <div class="orologio" id="orologio">--:--</div>
      <div class="tacche" id="tacche">${'<i></i>'.repeat(10)}</div>
      <div class="passi" id="passi"><span>Ricevuto</span><span>In preparazione</span><span>Servito</span></div>
      ${tante ? listaRighe(o) : ''}
      <div class="riga-bottoni" id="riga-annulla"><button class="bottone chiaro" id="annulla">Ho cambiato idea</button></div>
      <div class="avvisi-breve">${bloccoAvvisi(true)}</div>
    </div>`;
  }

  function vistaScaduto(o) {
    return `<div class="pannello centro">
      <p class="titoletto">Tempo scaduto</p>
      <p>${esc(o.modo === 'in_fila' && o.righe && o.righe[o.riga_ora] ? o.righe[o.riga_ora].nome : o.nome)}, ordine n. ${o.id}. Il barista perde <b>10 punti</b>.<br>Se arriva lo stesso, ne recupera 5.</p>
      <div class="orologio rosso" id="ritardo">+00:00</div>
      <div class="riga-bottoni"><button class="bottone chiaro" id="rinuncia">Lascia perdere</button></div>
    </div>`;
  }

  const ETICHETTE = ['Perfetto', 'Bello caldo', 'Bello fresco', 'Servito col sorriso', 'Velocissimo', 'Un po\' lento', 'Mancava il bacio'];
  const PAROLE_VOTO = ['', 'Da rivedere...', 'Così così', 'Buono', 'Molto buono', 'Barista dell\'anno'];

  function vistaRecensione(o) {
    const tempo = o.consegnato_il - o.creato;
    return `<div class="pannello">
      <p class="titoletto">Com'è andato il servizio?</p>
      <p class="nota-piccola" style="margin-top:-4px">${esc(o.nome)} · servito in ${durata(tempo)}
        <span class="esito ${o.in_ritardo ? 'ritardo' : ''}">${o.in_ritardo ? 'in ritardo' : 'puntuale'}</span></p>
      <div class="cuori" id="cuori">${[1, 2, 3, 4, 5].map((i) => `<button data-voto="${i}" aria-label="${i} cuori"><img src="assets/icone/cuore-vuoto.png" alt=""></button>`).join('')}</div>
      <p class="voto-parola" id="voto-parola">Tocca i cuori</p>
      <div class="etichette" id="etichette">${ETICHETTE.map((e) => `<button class="etichetta" data-etichetta="${esc(e)}">${esc(e)}</button>`).join('')}</div>
      <textarea id="commento" maxlength="300" placeholder="Due parole per il barista (se vuoi)"></textarea>
      <div class="bacio" id="bacio"><span class="casella"></span><span>Lascia un bacio di mancia</span></div>
      <div class="riga-bottoni">
        <button class="bottone chiaro" id="salta">Salta</button>
        <button class="bottone verde" id="invia">Invia</button>
      </div>
    </div>`;
  }

  // ---------- Orologio ----------
  let ultimaFretta = false;
  function tic() {
    const o = S.q && S.q.ordine;
    if (!o) return;
    if (o.stato === 'in_attesa' || o.stato === 'in_preparazione') {
      const resta = o.scadenza - adesso();
      const el = $('#orologio');
      if (!el) return;
      el.textContent = mmss(resta);
      const tono = resta < 120000 ? 'rosso' : resta < 300000 ? 'caldo' : '';
      el.className = 'orologio ' + tono;
      // 10 tacche su tutto il tempo (15 minuti: una tacca ogni minuto e mezzo).
      const piene = Math.max(0, Math.ceil(10 * resta / Math.max(1, o.scadenza - o.creato)));
      const t = $('#tacche');
      t.className = 'tacche ' + tono;
      [...t.children].forEach((x, i) => x.classList.toggle('piena', i < piene));
      const passi = $('#passi').children;
      passi[0].className = 'fatto';
      passi[1].className = o.stato === 'in_preparazione' ? 'ora' : '';
      $('#riga-annulla').hidden = o.stato !== 'in_attesa';
      const fretta = resta < 120000;
      if (fretta && !ultimaFretta) { parla(scegli(BATTUTE.fretta)); posa('prepara', 'fretta'); }
      ultimaFretta = fretta;
      if (resta <= -1500 && !S.occupato) aggiorna();
    } else if (o.stato === 'scaduto') {
      const el = $('#ritardo');
      if (el) el.textContent = '+' + mmss(adesso() - o.scadenza);
    }
  }

  // ---------- Tessera ----------
  function disegnaTessera(q) {
    const t = q.tessera;
    const caselle = [];
    for (let i = 1; i <= 10; i++) {
      if (i <= t.timbri) caselle.push('<i class="timbrato"><img src="assets/icone/timbro.png" alt=""></i>');
      else if (i === 10) caselle.push('<i class="premio"><img src="assets/icone/stella.png" alt=""></i>');
      else caselle.push(`<i>${i}</i>`);
    }
    const mancano = 10 - t.timbri;
    const lenti = q.menu.filter((m) => (m.minuti || 15) !== 15).map((m) => `${m.minuti} per ${m.nome.toLowerCase()}`);
    const tempi = '15 minuti' + (lenti.length ? ` (${lenti.join(', ')})` : '');
    $('#scheda-tessera').innerHTML = `
      <div class="pannello">
        <p class="titoletto">Tessera fedeltà di Potato</p>
        <p style="margin:0">Un timbro per ogni ordine servito. Al decimo scatta un <b>premio a sorpresa</b>, scelto dal barista.</p>
        <div class="tessera">${caselle.join('')}</div>
        <p class="centro" style="margin:0">${mancano === 10 && t.premi > 0 ? 'Tessera nuova di zecca.' : mancano === 1 ? 'Manca <b>un solo</b> timbro!' : `Mancano <b>${mancano}</b> timbri al premio.`}</p>
        <p class="nota-piccola centro">Premi già vinti: <b>${t.premi}</b></p>
      </div>
      <div class="pannello">
        <p class="titoletto">Avvisi sul telefono</p>
        <p style="margin:0 0 10px">Ti avviso io quando il barista prende l'ordine, quando te lo serve e se sfora i tempi. Anche ad app chiusa.</p>
        ${bloccoAvvisi(false)}
      </div>
      <div class="pannello">
        <p class="titoletto">Come funziona il locale</p>
        <ul class="regole">
          <li><span>Riempi il vassoio e ordina: tutto insieme o uno alla volta</span><b>1</b></li>
          <li><span>Al barista arriva la chiamata</span><b>2</b></li>
          <li><span>Ha ${esc(tempi)} per servirti</span><b>3</b></li>
          <li><span>Tu lasci cuori e, se vuoi, un bacio</span><b>4</b></li>
        </ul>
      </div>`;
  }

  // ---------- Scheda barista ----------
  function rigaStorico(o) {
    let esito, classe = '';
    if (o.stato === 'consegnato') { esito = (o.in_ritardo ? 'in ritardo, ' : 'puntuale, ') + durata(o.consegnato_il - o.creato); classe = o.in_ritardo ? 'ritardo' : ''; }
    else if (o.stato === 'scaduto') { esito = 'mai arrivato'; classe = 'ritardo'; }
    else { esito = 'annullato'; classe = 'grigio'; }
    const p = o.punti;
    return `<li>
      <img class="bev" src="${sprite(o.sprite)}" alt="">
      <div class="dati"><b>${esc(o.nome)}</b><small>${quando(o.creato)} · <span class="esito ${classe}">${esito}</span></small>
        ${o.voto ? `<em>${cuori(o.voto)}${o.bacio ? ' + bacio' : ''}</em>` : o.bacio ? '<em>Mancia: un bacio</em>' : ''}
        ${o.commento ? `<small>«${esc(o.commento)}»</small>` : ''}</div>
      ${o.stato === 'annullato' ? '' : `<span class="punti-ordine ${p >= 0 ? 'piu' : 'meno'}">${p > 0 ? '+' : ''}${p}</span>`}
    </li>`;
  }

  function disegnaBarista(q) {
    const b = q.barista;
    const punti = Math.max(0, b.punti);
    const soglie = [0, 50, 150, 300, 600];
    const base = [...soglie].reverse().find((s) => s <= punti) || 0;
    const pieno = b.prossimo ? Math.round(100 * (punti - base) / (b.prossimo - base)) : 100;
    $('#scheda-barista').innerHTML = `
      <div class="pannello">
        <div class="barista-testa">
          <div class="ritratto"><img src="assets/barista/saluto.png" alt=""></div>
          <div style="flex:1">
            <p class="nota-piccola" style="margin:0">Il tuo barista</p>
            <p class="livello">${esc(b.livello)}</p>
            <div class="barra"><i style="width:${pieno}%"></i></div>
            <p class="nota-piccola" style="margin-top:4px">${b.punti} punti${b.prossimo ? ` · prossimo grado a ${b.prossimo}` : ' · grado massimo'}</p>
          </div>
        </div>
        <div class="numeri">
          <div><b>${b.puntualita == null ? '-' : b.puntualita + '%'}</b><small>puntualità</small></div>
          <div><b>${b.media_voto == null ? '-' : String(b.media_voto).replace('.', ',')}</b><small>media cuori</small></div>
          <div><b>${b.baci}</b><small>baci di mancia</small></div>
        </div>
      </div>
      <div class="pannello">
        <p class="titoletto">Come guadagna (e perde) punti</p>
        <ul class="regole">
          <li><span>Servito nella prima metà del tempo (8 minuti su 15)</span><b class="piu">+15</b></li>
          <li><span>Servito in tempo</span><b class="piu">+10</b></li>
          <li><span>Tempo scaduto</span><b class="meno">-10</b></li>
          <li><span>Servito in ritardo</span><b class="meno">-5</b></li>
          <li><span>I tuoi cuori (da 1 a 5)</span><b>da -4 a +4</b></li>
          <li><span>Bacio di mancia</span><b class="piu">+3</b></li>
        </ul>
        <p class="nota-piccola">Con «uno alla volta» ogni consegna conta per conto suo.</p>
      </div>
      <div class="pannello">
        <p class="titoletto">Ultimi ordini</p>
        ${q.storico.length ? `<ul class="storico">${q.storico.map(rigaStorico).join('')}</ul>` : '<p style="margin:0">Ancora nessun ordine. Il barista scalpita.</p>'}
      </div>`;
  }

  // ---------- Tocchi ----------
  // Musica di sottofondo: parte al primo tocco (l'iPhone non la fa partire da sola), si ferma con l'app in background.
  function musica() {
    const a = $('#musica');
    const accesa = localStorage.getItem('caffe_musica') !== '0';
    if (accesa && !document.hidden) { a.volume = 0.35; a.play().catch(() => {}); } else a.pause();
  }
  document.addEventListener('visibilitychange', musica);

  document.addEventListener('click', (ev) => {
    sblocca();
    if ($('#musica').paused && localStorage.getItem('caffe_musica') !== '0') musica();
    const el = ev.target.closest('button, .bacio');
    if (!el) return;

    if (el.dataset.scheda) {
      S.scheda = el.dataset.scheda;
      document.querySelectorAll('.schede button').forEach((b) => b.classList.toggle('attiva', b === el));
      document.querySelectorAll('.scheda').forEach((s) => { s.hidden = s.id !== 'scheda-' + S.scheda; });
      window.scrollTo(0, 0);
      suona('tocco');
      return;
    }
    if (el.id === 'attiva-avvisi') {
      el.disabled = true;
      iscriviPush(true).then((ok) => {
        avviso(ok ? 'Avvisi attivi! Ti scrivo io.' : statoPush() === 'bloccati' ? 'Avvisi bloccati dalle impostazioni.' : 'Non sono riuscito ad attivarli. Riprova.');
        if (ok) suona('ordine');
      }).catch(() => avviso('Non sono riuscito ad attivarli. Riprova.'))
        .finally(() => { el.disabled = false; disegnaTessera(S.q); const b = document.querySelector('.avvisi-breve'); if (b) b.innerHTML = bloccoAvvisi(true); });
      return;
    }
    if (el.id === 'musica-tasto') {
      const spenta = localStorage.getItem('caffe_musica') === '0';
      localStorage.setItem('caffe_musica', spenta ? '1' : '0');
      el.classList.toggle('muto', !spenta);
      musica();
      return;
    }
    if (el.id === 'muto') {
      const muto = localStorage.getItem('caffe_muto') === '1';
      localStorage.setItem('caffe_muto', muto ? '0' : '1');
      el.classList.toggle('muto', !muto);
      if (muto) suona('tocco');
      return;
    }
    if (el.dataset.bevanda) {
      const m = S.q.menu.find((x) => x.id === el.dataset.bevanda);
      S.scelta = m;
      document.querySelectorAll('.voce').forEach((v) => v.classList.toggle('scelta', v === el));
      $('#conferma').innerHTML = vistaConferma(m);
      parla(scegli(BATTUTE.scelta));
      suona('tocco');
      $('#conferma').scrollIntoView({ behavior: 'smooth', block: 'end' });
      return;
    }
    if (el.dataset.opzione && S.scelta) {
      S.opzione = (S.scelta.opzioni || [])[+el.dataset.opzione] || null;
      document.querySelectorAll('[data-opzione]').forEach((b) => b.classList.toggle('accesa', b === el));
      if (S.opzione) $('#conferma-img').src = sprite(S.opzione.sprite);
      suona('tocco');
      return;
    }
    if (el.dataset.variante && S.scelta) {
      const gi = +el.dataset.variante;
      S.varianti[gi] = el.dataset.valore;
      document.querySelectorAll(`[data-variante="${gi}"]`).forEach((b) => b.classList.toggle('accesa', b === el));
      suona('tocco');
      return;
    }
    if (el.id === 'aggiungi' && S.scelta) {
      if (S.vassoio.length >= 8) { avviso('Il vassoio è pieno: ordina prima questi.'); return; }
      const m = S.scelta;
      const scelta = [S.opzione ? S.opzione.nome : '', ...(S.varianti || [])].filter(Boolean).join(' · ');
      S.vassoio.push({
        bevanda: m.id, scelta, nota: $('#nota').value.trim().slice(0, 140),
        nome: m.nome + (scelta ? ' · ' + scelta : ''), sprite: S.opzione ? S.opzione.sprite : m.sprite, minuti: m.minuti || 15,
      });
      salvaVassoio();
      S.scelta = null;
      $('#conferma').innerHTML = '';
      document.querySelectorAll('.voce').forEach((v) => v.classList.remove('scelta'));
      disegnaVassoio();
      parla(scegli(BATTUTE.vassoio));
      suona('cuore');
      $('#vassoio').scrollIntoView({ behavior: 'smooth', block: 'end' });
      return;
    }
    if (el.dataset.su) {
      const i = +el.dataset.su;
      [S.vassoio[i - 1], S.vassoio[i]] = [S.vassoio[i], S.vassoio[i - 1]];
      salvaVassoio(); disegnaVassoio(); suona('tocco');
      return;
    }
    if (el.dataset.togli) {
      S.vassoio.splice(+el.dataset.togli, 1);
      salvaVassoio(); disegnaVassoio(); suona('tocco');
      return;
    }
    if (el.dataset.modo) {
      S.modo = el.dataset.modo === 'in_fila' ? 'in_fila' : 'insieme';
      salvaVassoio(); disegnaVassoio(); suona('tocco');
      return;
    }
    if (el.id === 'ordina' && S.vassoio.length) {
      el.disabled = true;
      suona('ordine');
      const righe = S.vassoio.map(({ bevanda, scelta, nota }) => ({ bevanda, scelta, nota }));
      azione('ordina_vassoio', { p_righe: righe, p_modo: righe.length > 1 ? S.modo : 'insieme' }, () => {
        S.vassoio = [];
        salvaVassoio();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      return;
    }
    if (el.id === 'annulla' || el.id === 'rinuncia') {
      azione('annulla', { p_ordine: S.q.ordine.id });
      return;
    }
    if (el.dataset.voto) {
      S.voto = +el.dataset.voto;
      [...$('#cuori').children].forEach((b, i) => {
        b.classList.toggle('acceso', i < S.voto);
        b.firstElementChild.src = `assets/icone/${i < S.voto ? 'cuore' : 'cuore-vuoto'}.png`;
      });
      $('#voto-parola').textContent = PAROLE_VOTO[S.voto];
      suona('cuore');
      return;
    }
    if (el.dataset.etichetta) {
      const e = el.dataset.etichetta;
      S.etichette.has(e) ? S.etichette.delete(e) : S.etichette.add(e);
      el.classList.toggle('accesa');
      suona('tocco');
      return;
    }
    if (el.id === 'bacio') {
      S.bacio = !S.bacio;
      el.classList.toggle('acceso', S.bacio);
      if (S.bacio) { suona('bacio'); coriandoli('cuore', 8); }
      return;
    }
    if (el.id === 'invia' || el.id === 'salta') {
      const salta = el.id === 'salta';
      const bacio = !salta && S.bacio;
      const args = salta
        ? { p_ordine: S.q.ordine.id }
        : { p_ordine: S.q.ordine.id, p_voto: S.voto || null, p_etichette: [...S.etichette], p_commento: $('#commento').value, p_bacio: S.bacio };
      azione('feedback', args, () => {
        if (!salta) { setTimeout(() => parla(scegli(bacio ? BATTUTE.bacio : BATTUTE.grazie)), 50); if (S.voto >= 4) coriandoli('cuore', 12); }
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  });

  // ---------- Parola d'ordine ----------
  function mostraPorta(errore) {
    $('#porta').hidden = false;
    $('#porta-errore').hidden = !errore;
  }
  $('#porta-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    sblocca();
    S.chiave = $('#porta-parola').value.trim();
    if (!S.chiave) return;
    try {
      await chiama('apri');
      localStorage.setItem('caffe_parola', S.chiave);
      $('#porta').hidden = true;
      suona('ordine');
      disegna();
    } catch (e) {
      S.chiave = '';
      mostraPorta(true);
    }
  });

  // ---------- Avvio ----------
  $('#muto').classList.toggle('muto', localStorage.getItem('caffe_muto') === '1');
  $('#musica-tasto').classList.toggle('muto', localStorage.getItem('caffe_musica') === '0');
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(() => {
      // Se gli avvisi sono già accesi, si rinnova l'iscrizione a ogni apertura (il telefono a volte la cambia).
      if (statoPush() === 'attivi') iscriviPush(false).catch(() => {});
    }).catch(() => {});
  }
  if (S.chiave) {
    localStorage.setItem('caffe_parola', S.chiave);
    if (location.search) history.replaceState(null, '', location.pathname);
    aggiorna();
  } else mostraPorta(false);

  setInterval(tic, 250);
  // Con un ordine in corso si chiede al bancone ogni 4 secondi, altrimenti ogni 30.
  let ultimo = 0;
  setInterval(() => {
    if (document.hidden || !S.chiave) return;
    const o = S.q && S.q.ordine;
    const vivo = o && o.stato !== 'consegnato';
    if (Date.now() - ultimo >= (vivo ? 4000 : 30000)) { ultimo = Date.now(); aggiorna(); }
  }, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { ultimo = Date.now(); aggiorna(); } });
})();
