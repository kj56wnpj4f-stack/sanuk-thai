// Sanuk Thai – app-logica (geen build-stap nodig)
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const app = $("#app");

  // ---------- opslag (veilig) ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem("sanuk:" + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("sanuk:" + k, JSON.stringify(v)); } catch {} },
  };

  const state = {
    gender: store.get("gender", "m"),
    view: "home", level: null, tab: "words",
    scores: store.get("scores", {}),
    quiz: null,
  };

  // ---------- placeholders ----------
  const FORMS = {
    m: { P: ["ครับ", "khráp"], Pq: ["ครับ", "khráp"], I: ["ผม", "phǒm"] },
    f: { P: ["ค่ะ", "khâ"], Pq: ["คะ", "khá"], I: ["ฉัน", "chǎn"] },
  };
  const fill = (s, idx) => {
    const f = FORMS[state.gender];
    return s.replace(/\{(Pq|P|I)\}/g, (_, k) => f[k][idx]);
  };
  const th = s => fill(s, 0);
  const ro = s => fill(s, 1);

  // ---------- toonkleuren ----------
  function toneClass(syl) {
    const d = syl.normalize("NFD");
    if (d.includes("̌")) return "t-rise";
    if (d.includes("̂")) return "t-fall";
    if (d.includes("́")) return "t-high";
    if (d.includes("̀")) return "t-low";
    return "t-mid";
  }
  const esc = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function romHTML(s) {
    return ro(s).split(/([\s\-,!?.]+)/).map(part =>
      /^[\s\-,!?.]*$/.test(part) ? esc(part) : `<span class="${toneClass(part)}">${esc(part)}</span>`).join("");
  }

  // ---------- spraak ----------
  let thaiVoice = null;
  function pickVoice() {
    if (!("speechSynthesis" in window)) return;
    const vs = speechSynthesis.getVoices().filter(v => /^th/i.test(v.lang));
    // voorkeur voor natuurlijk klinkende stemmen
    thaiVoice = vs.find(v => /premium|enhanced|natural|neural|google/i.test(v.name)) || vs[0] || null;
    const note = $("#voiceNote");
    if (!thaiVoice && speechSynthesis.getVoices().length) {
      note.hidden = false;
      note.textContent = "Geen Thaise stem gevonden op dit apparaat. Op Mac/iPhone: Instellingen → Toegankelijkheid → Gesproken materiaal → Stemmen → Thai (bv. Kanya, ‘Verbeterd’). In Chrome werkt ‘Google ไทย’ meestal direct.";
    } else note.hidden = true;
  }
  if ("speechSynthesis" in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  function say(text, slow) {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(th(text).replace(/[!?]/g, ""));
    u.lang = "th-TH";
    if (thaiVoice) u.voice = thaiVoice;
    u.rate = slow ? 0.55 : 0.85;
    speechSynthesis.speak(u);
  }
  const speakBtns = key => `<div class="speak">
      <button class="sbtn" data-say="${key}">▶ Normaal</button>
      <button class="sbtn" data-say="${key}" data-slow="1">🐢 Langzaam</button></div>`;

  // registry voor uit te spreken teksten
  let sayReg = [];
  const reg = t => (sayReg.push(t), sayReg.length - 1);

  // ---------- views ----------
  function render(keepScroll) {
    sayReg = [];
    document.querySelectorAll(".navbtn").forEach(b => b.classList.toggle("active", b.dataset.view === state.view || (state.view === "level" && b.dataset.view === "home")));
    document.querySelectorAll(".gbtn").forEach(b => b.classList.toggle("active", b.dataset.g === state.gender));
    if (state.view === "home") app.innerHTML = viewHome();
    else if (state.view === "level") app.innerHTML = viewLevel();
    else if (state.view === "menu") app.innerHTML = viewMenu();
    else if (state.view === "tones") app.innerHTML = viewTones();
    if (!keepScroll) window.scrollTo({ top: 0 });
  }

  function viewHome() {
    const groups = [...new Set(LEVELS.map(l => l.group))];
    const done = Object.values(state.scores).filter(s => s === 10).length;
    return `<h1>Thais voor op reis</h1>
      <p class="sub">Restaurant, onderweg, hotel en markt. Elk niveau: 5 zinnen, 10 woorden en een toets. ${done ? `Perfect gehaald: ${done} van ${LEVELS.length}.` : ""}</p>
      ${groups.map(g => `<h2>${g}</h2><div class="grid">${LEVELS.filter(l => l.group === g).map(l => {
        const s = state.scores[l.id];
        return `<button class="level ${s === 10 ? "perfect" : ""}" data-level="${l.id}">
          <b>${l.name}</b><span>${l.topic}</span>
          <div class="score">${s === undefined ? "&nbsp;" : s === 10 ? "★ 10/10" : `Beste: ${s}/10`}</div></button>`;
      }).join("")}</div>`).join("")}`;
  }

  function wordCard(w, i) {
    const k = reg(w.th), ke = reg(w.ex.th);
    return `<div class="card">
      <div class="row"><div>
        <div class="th">${esc(th(w.th))}</div>
        <div class="rom">${romHTML(w.rom)}</div>
        <div class="nl">${esc(w.nl)}</div>
      </div>${speakBtns(k)}</div>
      <button class="more" data-toggle="x${i}">Voorbeeld & alternatieven ▾</button>
      <div class="extra" id="x${i}" hidden>
        <h4>Voorbeeldzin</h4>
        <div class="row"><div>
          <div class="th sm">${esc(th(w.ex.th))}</div>
          <div class="rom sm">${romHTML(w.ex.rom)}</div>
          <div class="nl">${esc(w.ex.nl)}</div>
        </div>${speakBtns(ke)}</div>
        ${w.alts.length ? `<h4 style="margin-top:10px">Alternatieven</h4>${w.alts.map(a => {
          const ka = reg(a.th);
          return `<div class="alt"><span class="th sm">${esc(th(a.th))}</span>
            <span class="rom sm">${romHTML(a.rom)}</span><span class="nl">– ${esc(a.nl)}</span>
            <button class="sbtn" data-say="${ka}">▶</button></div>`;
        }).join("")}` : ""}
      </div></div>`;
  }

  function phraseCard(p) {
    const k = reg(p.th);
    return `<div class="card"><div class="row"><div>
        <div class="th">${esc(th(p.th))}</div>
        <div class="rom">${romHTML(p.rom)}</div>
        <div class="nl">${esc(p.nl)}</div>
      </div>${speakBtns(k)}</div>
      ${p.note ? `<div class="note">💡 ${esc(p.note)}</div>` : ""}</div>`;
  }

  function viewLevel() {
    const l = LEVELS.find(x => x.id === state.level);
    const tabs = [["words", "10 woorden"], ["phrases", "5 zinnen"], ["quiz", "Toets"]];
    let body = "";
    if (state.tab === "words") body = l.words.map(wordCard).join("");
    if (state.tab === "phrases") body = l.phrases.map(phraseCard).join("");
    if (state.tab === "quiz") body = viewQuiz(l);
    return `<button class="back" data-view="home">← Alle lessen</button>
      <h1>${l.name}: ${l.topic}</h1>
      <div class="tabs">${tabs.map(([k, n]) => `<button class="tab ${state.tab === k ? "active" : ""}" data-tab="${k}">${n}</button>`).join("")}</div>
      ${body}`;
  }

  // ---------- toets ----------
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  function newQuiz(l) {
    const items = shuffle([...l.words, ...l.phrases]).slice(0, 10);
    const pool = [...l.words, ...l.phrases];
    const others = LEVELS.flatMap(x => [...x.words, ...x.phrases]);
    return {
      levelId: l.id, i: 0, correct: 0, answered: false,
      qs: items.map((it, n) => {
        const dir = n % 2 === 0 ? "th2nl" : "nl2th";
        let wrong = shuffle(pool.filter(x => x !== it && x.nl !== it.nl));
        if (wrong.length < 3) wrong = wrong.concat(shuffle(others.filter(x => x !== it)));
        const opts = shuffle([it, ...wrong.slice(0, 3)]);
        return { it, dir, opts, answer: opts.indexOf(it) };
      }),
    };
  }
  function viewQuiz(l) {
    let q = state.quiz;
    if (!q || q.levelId !== l.id) q = state.quiz = newQuiz(l);
    if (q.i >= q.qs.length) {
      const best = Math.max(state.scores[l.id] || 0, q.correct);
      return `<div class="card quiz"><h2 style="margin-top:0">${q.correct}/10 goed</h2>
        <p>${q.correct === 10 ? "Foutloos! Sanuk mâak!" : q.correct >= 7 ? "Mooi zo, bijna perfect." : "Oefen de woorden nog even en probeer het opnieuw."}</p>
        <p class="nl">Je beste score voor dit niveau: ${best}/10</p>
        <button class="primary" data-act="restart">Opnieuw</button></div>`;
    }
    const cur = q.qs[q.i];
    const kq = reg(cur.it.th);
    const question = cur.dir === "th2nl"
      ? `<div class="q">Wat betekent dit?</div><div class="row"><div><div class="th">${esc(th(cur.it.th))}</div><div class="rom">${romHTML(cur.it.rom)}</div></div>${speakBtns(kq)}</div>`
      : `<div class="q">Hoe zeg je in het Thais: <b>${esc(cur.it.nl)}</b>?</div>`;
    const opts = cur.opts.map((o, n) => {
      let cls = "";
      if (q.answered) { if (n === cur.answer) cls = "ok"; else if (n === q.picked) cls = "bad"; }
      const label = cur.dir === "th2nl" ? esc(o.nl)
        : `<span class="th sm">${esc(th(o.th))}</span><br><span class="rom sm">${romHTML(o.rom)}</span>`;
      return `<button class="opt ${cls}" data-pick="${n}" ${q.answered ? "disabled" : ""}>${label}</button>`;
    }).join("");
    return `<div class="quiz">
      <div class="progress"><div style="width:${q.i * 10}%"></div></div>
      <div class="card">${question}</div>
      <div class="opts">${opts}</div>
      ${q.answered ? `<button class="primary" data-act="next">${q.i === 9 ? "Bekijk score" : "Volgende →"}</button>` : ""}
    </div>`;
  }
  function finishQuiz() {
    const q = state.quiz;
    const prev = state.scores[q.levelId] || 0;
    state.scores[q.levelId] = Math.max(prev, q.correct);
    store.set("scores", state.scores);
    if (q.correct === 10) showFlag();
  }
  function showFlag() {
    const o = $("#overlay");
    o.innerHTML = `<div class="win" role="dialog" aria-label="Foutloos">
      <div class="flag"><i class="r"></i><i class="w"></i><i class="b"></i><i class="w"></i><i class="r"></i></div>
      <h3>Farang Kèng Mâak!</h3>
      <div class="th">ฝรั่งเก่งมาก</div>
      <p class="nl">‘Superslimme buitenlander’ – 10 uit 10 zonder fouten. Tijd voor een Chang.</p>
      <button class="primary" data-act="close">Khàwp-khun!</button></div>`;
    o.hidden = false;
    say("ฝรั่งเก่งมาก{P}");
  }

  // ---------- menukaart & tonen ----------
  function viewMenu() {
    return `<h1>Menukaart</h1>
      <p class="sub">Gerechten die je overal tegenkomt. Chili’s geven de gebruikelijke pittigheid aan – vraag gerust <b>${esc(th("ไม่เผ็ด{P}"))}</b> (${romHTML("mâi phèt {P}")}).</p>
      ${DISHES.map(d => { const k = reg(d.th + "{P}"); return `<div class="card"><div class="row"><div>
        <div class="th">${esc(d.th)}</div><div class="rom">${romHTML(d.rom)}</div>
        <div class="nl">${esc(d.nl)}</div>
        <div class="spice" aria-label="pittigheid ${d.spice} van 3">${d.spice ? "🌶".repeat(d.spice) : "<span class='nl'>mild</span>"}</div>
      </div>${speakBtns(k)}</div>
      <div class="note">Bestellen: <span class="th sm">${esc(th("ขอ" + d.th + "{P}"))}</span> · ${romHTML("khǎw " + d.rom + " {P}")}</div></div>`; }).join("")}`;
  }
  function viewTones() {
    return `<h1>De vijf tonen</h1>
      <p class="sub">In het Thais verandert de toonhoogte de betekenis. In de hele app zijn lettergrepen gekleurd per toon.</p>
      ${TONES.map(t => { const k = reg(t.ex); return `<div class="card"><div class="row"><div>
        <b class="${t.cls}">${t.name}</b> <span class="nl">· teken: ${t.mark}</span>
        <div class="th">${t.ex}</div><div class="rom">${romHTML(t.rom)}</div><div class="nl">${t.nl}</div>
        <div class="note">${t.desc}</div></div>${speakBtns(k)}</div></div>`; }).join("")}
      <h2>Oefen het verschil</h2>
      ${[["ใกล้", "klâi", "dichtbij"], ["ไกล", "klai", "ver"], ["ไก่", "kài", "kip"], ["ไข่", "khài", "ei"], ["เสือ", "sǔea", "tijger"], ["เสื้อ", "sûea", "shirt"]]
        .map(([a, r, n]) => { const k = reg(a); return `<div class="alt"><span class="th sm">${a}</span><span class="rom">${romHTML(r)}</span><span class="nl">– ${n}</span><button class="sbtn" data-say="${k}">▶</button></div>`; }).join("")}
      <h2>Zo zeggen Thai het echt</h2>
      <p class="sub">De app toont de ‘nette’ uitspraak. In de spreektaal hoor je vaak dit:</p>
      ${SPOKEN.map(s => `<div class="card"><div class="alt"><span class="th sm">${s.th}</span>
        <span class="rom sm">${romHTML(s.formal)}</span><span class="nl">→ klinkt als</span><span class="rom sm">${romHTML(s.spoken)}</span></div>
        <div class="nl">${s.nl}</div></div>`).join("")}`;
  }

  // ---------- events ----------
  document.addEventListener("click", e => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.id === "homeBtn") { state.view = "home"; return render(); }
    if (t.dataset.view) { state.view = t.dataset.view; return render(); }
    if (t.dataset.g) { state.gender = t.dataset.g; store.set("gender", state.gender); return render(); }
    if (t.dataset.level) { state.view = "level"; state.level = t.dataset.level; state.tab = "words"; state.quiz = null; return render(); }
    if (t.dataset.tab) { state.tab = t.dataset.tab; if (t.dataset.tab === "quiz") state.quiz = null; return render(); }
    if (t.dataset.say !== undefined) return say(sayReg[+t.dataset.say], !!t.dataset.slow);
    if (t.dataset.toggle) { const x = document.getElementById(t.dataset.toggle); x.hidden = !x.hidden; return; }
    if (t.dataset.pick !== undefined) {
      const q = state.quiz, cur = q.qs[q.i];
      q.answered = true; q.picked = +t.dataset.pick;
      if (q.picked === cur.answer) q.correct++;
      return render(true);
    }
    if (t.dataset.act === "next") { const q = state.quiz; q.i++; q.answered = false; q.picked = null; if (q.i >= q.qs.length) finishQuiz(); return render(); }
    if (t.dataset.act === "restart") { state.quiz = null; return render(); }
    if (t.dataset.act === "close") { $("#overlay").hidden = true; return; }
  });

  render();
})();
