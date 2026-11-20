// Potato Coffee Shop: il bancone del barista. Si apre dai bottoni del messaggio Telegram.
(() => {
  const { rpc, sblocca, suona, mmss, durata, esc, quando, cuori, sprite } = CAFFE;
  const $ = (s) => document.querySelector(s);

  // La chiave arriva una volta nel frammento del link (#k=...), poi resta sul telefono.
  const fr = new URLSearchParams(location.hash.slice(1));
  let chiave = fr.get('k') || localStorage.getItem('caffe_barista') || '';
  const daFare = fr.get('fai');
  const ordineLink = fr.get('o');
  if (fr.get('k')) localStorage.setItem('caffe_barista', chiave);
  if (location.hash) history.replaceState(null, '', location.pathname);

  let q = null;
  let sfaso = 0;
  let scrivendo = false;
  const adesso = () => Date.now() + sfaso;

  const ESITI = {
    puntuale_15: ['Servito velocissimo: +15 punti', ''],
    puntuale_10: ['Servito in tempo: +10 punti', ''],
    ritardo: ['Servito in ritardo: -5 punti', 'ritardo'],
    in_preparazione: ['Segnato: lo stai preparando', ''],
    gia_consegnato: ['Era già segnato come servito', 'grigio'],
    gia_in_preparazione: ['Lo stavi già preparando', 'grigio'],
    appena_servito: ['Servito un attimo fa: per il prossimo usa il bottone qui sotto', 'grigio'],
    gia_scaduto: ['Ormai è scaduto: servilo lo stesso', 'ritardo'],
    gia_annullato: ['Potato lo aveva annullato', 'grigio'],
    non_trovato: ['Ordine non trovato', 'grigio'],
    aperto: ['Locale aperto', ''],
    chiuso: ['Locale chiuso', 'grigio'],
  };

  async function chiama(azione = 'stato', ordine = null, testo = '') {
    try {
      q = await rpc('barista', { p_chiave: chiave, p_azione: azione, p_ordine: ordine, p_testo: testo });
      sfaso = q.ora - Date.now();
      if (q.esito && ESITI[q.esito]) {
        const [t, classe] = ESITI[q.esito];
        const dopo = q.prossimo ? `<p class="nota-piccola">${esc(q.servito)} consegnato. Ora tocca a <b>${esc(q.prossimo)}</b>.</p>` : '';
        $('#esito').innerHTML = `<div class="pannello centro"><span class="esito ${classe}" style="font-size:18px;padding:6px 12px">${t}</span>${dopo}</div>`;
        if (q.esito.startsWith('puntuale')) suona('consegna');
      }
      disegna();
    } catch (e) {
      $('#ordine').innerHTML = `<div class="pannello centro"><p class="titoletto">Chiave non valida</p>
        <p>Apri questa pagina dai bottoni del messaggio Telegram: il link porta la chiave con sé.</p></div>`;
      ['#locale', '#numeri', '#storico'].forEach((s) => { $(s).innerHTML = ''; });
    }
  }

  function disegna() {
    const o = q.ordine;
    const c = $('#cartellino');
    c.className = 'cartellino ' + (q.locale.aperto ? 'aperto' : 'chiuso');
    c.textContent = (q.locale.aperto ? 'Aperto' : 'Chiuso') + ` · ${q.barista.livello} · ${q.barista.punti} punti`;

    if (o && o.stato !== 'consegnato') {
      const righe = o.righe || [];
      const tante = righe.length > 1;
      const fila = tante && o.modo === 'in_fila';
      const ora = righe[o.riga_ora] || righe[0] || {};
      const nota = tante ? o.nota : (righe[0] && righe[0].nota) || o.nota;
      const titolo = fila ? 'Ora: ' + ora.nome : tante ? 'Tutto insieme' : o.nome;
      const lista = !tante ? '' : `<ul class="storico righe-ordine">${righe.map((r, i) => {
        const fatto = !!r.servito_il;
        const stato = fatto ? (r.in_ritardo ? '✓ servito in ritardo' : '✓ servito') : 'entro le ' + new Date(r.scadenza).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        return `<li class="${fatto ? 'fatto' : fila && i === o.riga_ora ? 'ora' : ''}">${fila ? `<span class="numero">${i + 1}</span>` : ''}
          <img class="bev" src="${sprite(r.sprite)}" alt=""><div class="dati"><b>${esc(r.nome)}</b><small>${stato}</small>
          ${r.nota ? `<small class="nota-riga">Nota: ${esc(r.nota)}</small>` : ''}</div></li>`;
      }).join('')}</ul>`;
      const servito = fila ? 'Servito: ' + esc(String(ora.nome || '').split(' · ')[0]) : tante ? 'Servito tutto' : 'Servito';
      $('#ordine').innerHTML = `<div class="pannello">
        <div class="attesa-testa"><img src="${sprite(o.sprite)}" alt="">
          <div><b>${esc(titolo)}</b><small>Ordine n. ${o.id} · ${quando(o.creato)}${fila ? ' · uno alla volta' : ''}</small>${nota ? `<small class="nota-ordine">Nota: ${esc(nota)}</small>` : ''}</div></div>
        <div class="orologio" id="orologio"></div>
        ${lista}
        <div class="riga-bottoni">
          ${o.stato === 'in_attesa' ? '<button class="bottone" data-fai="preparo">Lo preparo</button>' : ''}
          <button class="bottone verde" data-fai="consegnato">${servito}</button>
        </div></div>`;
    } else if (o) {
      $('#ordine').innerHTML = `<div class="pannello centro"><p class="titoletto">${esc(o.nome)} servito</p>
        <p style="margin:0">In ${durata(o.consegnato_il - o.creato)}. Potato sta scrivendo la recensione...</p></div>`;
    } else {
      $('#ordine').innerHTML = `<div class="pannello centro"><p class="titoletto">Nessun ordine</p><p style="margin:0">Bancone tranquillo. Quando Potato ordina ti arriva il messaggio.</p></div>`;
    }

    if (!scrivendo) {
      $('#locale').innerHTML = `<div class="pannello">
        <p class="titoletto">Il locale è ${q.locale.aperto ? 'aperto' : 'chiuso'}</p>
        ${q.locale.aperto
          ? `<input type="text" id="cartello" maxlength="120" placeholder="Cartello per Potato (torno alle 18, sono in call...)">
             <div class="riga-bottoni"><button class="bottone rosso" data-locale="chiudi">Chiudi il locale</button></div>`
          : `<p style="margin:0">${esc(q.locale.cartello || 'Nessun cartello.')}</p>
             <div class="riga-bottoni"><button class="bottone verde" data-locale="apri">Riapri</button></div>`}
        <p class="nota-piccola">Da chiuso Potato non può ordinare: niente punti persi mentre sei fuori.</p></div>`;
    }

    const b = q.barista;
    $('#numeri').innerHTML = `<div class="pannello"><div class="numeri" style="margin-top:0">
      <div><b>${b.puntualita == null ? '-' : b.puntualita + '%'}</b><small>puntualità</small></div>
      <div><b>${b.media_voto == null ? '-' : String(b.media_voto).replace('.', ',')}</b><small>media cuori</small></div>
      <div><b>${b.baci}</b><small>baci di mancia</small></div></div>
      <p class="nota-piccola centro">Tessera di Potato: ${q.tessera.timbri}/10 timbri · premi dovuti finora: ${q.tessera.premi}</p></div>`;

    $('#storico').innerHTML = `<div class="pannello"><p class="titoletto">Ultimi ordini</p>${q.storico.length ? `<ul class="storico">${q.storico.map((x) => {
      const esito = x.stato === 'consegnato' ? (x.in_ritardo ? 'in ritardo, ' : 'puntuale, ') + durata(x.consegnato_il - x.creato) : x.stato === 'scaduto' ? 'mai servito' : 'annullato';
      const classe = x.stato === 'annullato' ? 'grigio' : x.in_ritardo ? 'ritardo' : '';
      return `<li><img class="bev" src="${sprite(x.sprite)}" alt=""><div class="dati"><b>${esc(x.nome)}</b>
        <small>${quando(x.creato)} · <span class="esito ${classe}">${esito}</span></small>
        ${x.voto ? `<em>${cuori(x.voto)}${x.bacio ? ' + bacio' : ''}</em>` : x.bacio ? '<em>Mancia: un bacio</em>' : ''}
        ${x.etichette && x.etichette.length ? `<small>${x.etichette.map(esc).join(' · ')}</small>` : ''}
        ${x.commento ? `<small>«${esc(x.commento)}»</small>` : ''}</div>
        ${x.stato === 'annullato' ? '' : `<span class="punti-ordine ${x.punti >= 0 ? 'piu' : 'meno'}">${x.punti > 0 ? '+' : ''}${x.punti}</span>`}</li>`;
    }).join('')}</ul>` : '<p style="margin:0">Ancora niente.</p>'}</div>`;
    tic();
  }

  function tic() {
    const o = q && q.ordine;
    const el = $('#orologio');
    if (!o || !el) return;
    const resta = o.scadenza - adesso();
    if (o.stato === 'scaduto' || resta < 0) { el.textContent = '+' + mmss(-resta); el.className = 'orologio rosso'; }
    else { el.textContent = mmss(resta); el.className = 'orologio ' + (resta < 120000 ? 'rosso' : resta < 300000 ? 'caldo' : ''); }
  }

  document.addEventListener('click', (ev) => {
    sblocca();
    const el = ev.target.closest('button');
    if (!el) return;
    if (el.dataset.fai && q.ordine) {
      el.disabled = true;
      // Dalla pagina si dice quale riga si consegna: così un doppio tocco non serve anche quella dopo.
      const riga = el.dataset.fai === 'consegnato' && q.ordine.modo === 'in_fila' && q.ordine.riga_ora != null ? String(q.ordine.riga_ora) : '';
      chiama(el.dataset.fai, q.ordine.id, riga);
    }
    if (el.dataset.locale) { scrivendo = false; chiama(el.dataset.locale, null, ($('#cartello') || {}).value || ''); }
  });
  document.addEventListener('focusin', (ev) => { if (ev.target.id === 'cartello') scrivendo = true; });
  document.addEventListener('focusout', (ev) => { if (ev.target.id === 'cartello' && !ev.target.value) scrivendo = false; });

  if (!chiave) {
    $('#ordine').innerHTML = `<div class="pannello centro"><p class="titoletto">Serve la chiave</p><p style="margin:0">Apri questa pagina da un bottone del messaggio Telegram.</p></div>`;
  } else {
    chiama(daFare && ordineLink ? daFare : 'stato', ordineLink ? +ordineLink : null);
    setInterval(tic, 250);
    setInterval(() => { if (!document.hidden && !scrivendo) chiama(); }, 5000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) chiama(); });
  }
})();
