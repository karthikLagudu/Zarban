(() => {
  "use strict";

  const DATA = window.ZARBAN_DATA;
  const app = document.getElementById("app");
  const ACTIVE_KEY = "zarban_active_v1";
  const HISTORY_KEY = "zarban_reports_v1";
  const MAX_QUESTIONS = 20;
  const BANDS = ["easy", "medium", "hard"];

  let chosenGrade = null;
  let activeSession = readJson(ACTIVE_KEY, null);
  let currentReport = null;
  let answerLocked = false;
  let timer = null;

  if (!DATA || !Array.isArray(DATA.questions)) {
    app.innerHTML = '<main class="shell"><p class="error">The question bank could not be loaded. Please refresh the page.</p></main>';
    return;
  }

  function readJson(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function saveActive() {
    if (activeSession) localStorage.setItem(ACTIVE_KEY, JSON.stringify(activeSession));
    else localStorage.removeItem(ACTIVE_KEY);
  }

  function reports() {
    return readJson(HISTORY_KEY, []);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function gradeMatches(text, grade) {
    return String(text)
      .split(",")
      .some((part) => {
        const range = part.trim().match(/^(\d+)\s*[-–]\s*(\d+)$/);
        if (range) return grade >= Number(range[1]) && grade <= Number(range[2]);
        return Number(part.trim()) === grade;
      });
  }

  function skillById(id) {
    return DATA.skills.find((skill) => skill.id === id);
  }

  function questionById(id) {
    return DATA.questions.find((question) => question.id === id);
  }

  function topbar(extra = "") {
    return `
      <header class="topbar">
        <div class="brand"><span class="brand-mark">∑</span> Zarban</div>
        <nav class="nav-actions" aria-label="Main navigation">${extra}</nav>
      </header>`;
  }

  function navigate(route) {
    location.hash = route;
  }

  function renderHome() {
    clearInterval(timer);
    chosenGrade = null;
    const canContinue = activeSession && !activeSession.completedAt && activeSession.currentQuestionId;
    app.innerHTML = `
      <main class="shell fade-up">
        ${topbar('<button class="btn btn-secondary" id="historyBtn">Past results</button>')}
        <section class="hero-grid">
          <div class="hero">
            <div class="eyebrow">✦ Classes 5–10 · NCERT aligned</div>
            <h1>Find out exactly where your <span class="gradient-text">math stands.</span></h1>
            <p class="hero-copy">A focused adaptive diagnostic that identifies strengths, misconceptions, and foundational gaps—then turns them into a clear study plan.</p>
            <div class="features" aria-label="Assessment benefits">
              <div class="feature"><span class="feature-icon">↗</span><div><strong>Adapts as you answer</strong><p>Difficulty changes with your responses to find the right level.</p></div></div>
              <div class="feature"><span class="feature-icon">◎</span><div><strong>Explains the why</strong><p>Wrong choices reveal misconceptions, not just incorrect answers.</p></div></div>
              <div class="feature"><span class="feature-icon">▥</span><div><strong>Builds your next steps</strong><p>Get skill mastery, learning dimensions, and a personal focus plan.</p></div></div>
            </div>
          </div>
          <div class="card start-card">
            <div class="card-heading">
              <span class="card-heading-icon">∑</span>
              <div><h2>${canContinue ? "Continue your assessment" : "Start your assessment"}</h2><p>20 questions · about 10–15 minutes</p></div>
            </div>
            ${canContinue ? `
              <div class="form-grid">
                <p class="narrative">Welcome back, <strong>${escapeHtml(activeSession.name)}</strong>. You are on question ${activeSession.answers.length + 1} of ${MAX_QUESTIONS}.</p>
                <button class="btn btn-primary btn-large" id="continueBtn">Continue assessment →</button>
                <button class="btn btn-secondary" id="newBtn">Start a new assessment</button>
                <p class="privacy-note">⌂ Progress is saved privately on this device.</p>
              </div>` : `
              <form class="form-grid" id="startForm">
                <label class="field"><span class="field-label">Your name</span><input class="input" id="name" autocomplete="name" placeholder="e.g. Aarav Sharma" maxlength="60" /></label>
                <label class="field"><span class="field-label">School <span class="optional">(optional)</span></span><input class="input" id="school" placeholder="e.g. DAV Public School" maxlength="80" /></label>
                <div class="field"><span class="field-label">Your class</span><div class="grade-grid" id="gradeGrid">${[5,6,7,8,9,10].map((grade) => `<button type="button" class="grade-btn" data-grade="${grade}" aria-pressed="false"><strong>${grade}</strong><span>Class</span></button>`).join("")}</div></div>
                <p class="error" id="startError" hidden></p>
                <button class="btn btn-primary btn-large" type="submit">Start assessment →</button>
                <p class="privacy-note">⌂ No account required. Your answers stay on this device.</p>
              </form>`}
          </div>
        </section>
      </main>`;

    document.getElementById("historyBtn").addEventListener("click", () => navigate("history"));
    if (canContinue) {
      document.getElementById("continueBtn").addEventListener("click", () => navigate("assessment"));
      document.getElementById("newBtn").addEventListener("click", () => {
        if (confirm("Start over? Your unfinished assessment will be replaced.")) {
          activeSession = null;
          saveActive();
          renderHome();
        }
      });
      return;
    }

    document.getElementById("gradeGrid").addEventListener("click", (event) => {
      const button = event.target.closest("[data-grade]");
      if (!button) return;
      chosenGrade = Number(button.dataset.grade);
      document.querySelectorAll("[data-grade]").forEach((item) => {
        const selected = item === button;
        item.classList.toggle("selected", selected);
        item.setAttribute("aria-pressed", String(selected));
      });
    });

    document.getElementById("startForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const name = document.getElementById("name").value.trim();
      const school = document.getElementById("school").value.trim();
      const error = document.getElementById("startError");
      if (!name || !chosenGrade) {
        error.textContent = "Please enter your name and choose your class.";
        error.hidden = false;
        return;
      }
      startSession(name, school, chosenGrade);
    });
  }

  function startSession(name, school, grade) {
    activeSession = {
      id: `zr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      school,
      grade,
      startedAt: Date.now(),
      currentQuestionId: null,
      answers: [],
      band: "easy",
      correctStreak: 0,
      nextSkillId: null,
      skillVisits: {},
    };
    chooseNextQuestion();
    saveActive();
    navigate("assessment");
  }

  function chooseNextQuestion() {
    const used = new Set(activeSession.answers.map((answer) => answer.questionId));
    const gradeSkills = DATA.skills.filter((skill) => gradeMatches(skill.grade, activeSession.grade));
    const availableSkills = gradeSkills.filter((skill) => DATA.questions.some((question) => question.skill === skill.id && question.grade === activeSession.grade && !used.has(question.id)));
    let targetSkill = availableSkills.find((skill) => skill.id === activeSession.nextSkillId);
    if (!targetSkill) {
      targetSkill = [...availableSkills].sort((left, right) => (activeSession.skillVisits[left.id] || 0) - (activeSession.skillVisits[right.id] || 0))[0];
    }

    let pool = DATA.questions.filter((question) => !used.has(question.id) && question.grade === activeSession.grade && (!targetSkill || question.skill === targetSkill.id) && question.band === activeSession.band);
    if (!pool.length) pool = DATA.questions.filter((question) => !used.has(question.id) && question.grade === activeSession.grade && (!targetSkill || question.skill === targetSkill.id));
    if (!pool.length) pool = DATA.questions.filter((question) => !used.has(question.id) && question.grade === activeSession.grade);
    if (!pool.length) {
      finishSession();
      return;
    }

    const question = pool[Math.floor(Math.random() * pool.length)];
    activeSession.currentQuestionId = question.id;
    activeSession.nextSkillId = null;
    activeSession.skillVisits[question.skill] = (activeSession.skillVisits[question.skill] || 0) + 1;
  }

  function renderAssessment() {
    clearInterval(timer);
    if (!activeSession || !activeSession.currentQuestionId) {
      navigate("home");
      return;
    }
    answerLocked = false;
    const question = questionById(activeSession.currentQuestionId);
    const skill = skillById(question.skill);
    const number = activeSession.answers.length + 1;
    const progress = ((number - 1) / MAX_QUESTIONS) * 100;
    app.innerHTML = `
      <main class="shell assessment-shell fade-up">
        ${topbar('<button class="btn btn-secondary" id="exitBtn">Save & exit</button>')}
        <section class="assessment-header">
          <div class="assessment-meta">
            <div><div class="student-label">${escapeHtml(activeSession.name)} · Class ${activeSession.grade}</div><div class="topic-label"><span>Topic:</span> ${escapeHtml(skill?.topic || "Mathematics")} › ${escapeHtml(skill?.name || "Core skill")}</div></div>
            <div class="status-pills"><span class="pill" id="clock">0:00</span><span class="pill">Q${number} of ${MAX_QUESTIONS}</span></div>
          </div>
          <div class="progress" aria-label="Assessment progress"><div style="width:${Math.max(progress, 2)}%"></div></div>
        </section>
        <section class="card question-card">
          <p class="question-kicker">${escapeHtml(question.band)} challenge</p>
          <h1 class="question-text">${escapeHtml(question.text)}</h1>
          <div class="options">${question.options.map((option) => `<button class="option" data-option="${option.label}"><span class="option-key">${option.label}</span><span class="option-text">${escapeHtml(option.text)}</span></button>`).join("")}</div>
          <div class="question-footer" id="questionFooter">Choose an answer to continue.</div>
        </section>
        <p class="keyboard-hint">Press <kbd>A</kbd>–<kbd>D</kbd> to answer · no right/wrong feedback is shown during the test.</p>
      </main>`;

    document.getElementById("exitBtn").addEventListener("click", () => navigate("home"));
    document.querySelector(".options").addEventListener("click", (event) => {
      const option = event.target.closest("[data-option]");
      if (option) answerQuestion(option.dataset.option);
    });
    document.addEventListener("keydown", keyboardAnswer, { once: true });
    updateClock();
    timer = setInterval(updateClock, 1000);
  }

  function keyboardAnswer(event) {
    const key = event.key.toUpperCase();
    if (["A", "B", "C", "D"].includes(key) && location.hash === "#assessment") answerQuestion(key);
    else if (location.hash === "#assessment") document.addEventListener("keydown", keyboardAnswer, { once: true });
  }

  function updateClock() {
    const clock = document.getElementById("clock");
    if (!clock || !activeSession) return;
    const seconds = Math.max(0, Math.floor((Date.now() - activeSession.startedAt) / 1000));
    const minutes = Math.floor(seconds / 60);
    clock.textContent = `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function answerQuestion(label) {
    if (answerLocked || !activeSession) return;
    answerLocked = true;
    const question = questionById(activeSession.currentQuestionId);
    const button = document.querySelector(`[data-option="${label}"]`);
    if (button) button.classList.add("selected");
    document.getElementById("questionFooter").textContent = "Answer recorded · choosing your next question…";
    const correct = label === question.correct;
    const trap = correct ? null : question.traps[label] || { type: "Unclassified_Error", misconception: "Review this concept", detail: "" };
    activeSession.answers.push({
      questionId: question.id,
      skillId: question.skill,
      band: question.band,
      selected: label,
      correct,
      trap,
      dimensions: question.dimensions,
      answeredAt: Date.now(),
    });

    if (correct) {
      activeSession.correctStreak += 1;
      if (activeSession.correctStreak >= 2) {
        activeSession.band = BANDS[Math.min(2, BANDS.indexOf(activeSession.band) + 1)];
        activeSession.correctStreak = 0;
      }
    } else {
      activeSession.correctStreak = 0;
      activeSession.band = BANDS[Math.max(0, BANDS.indexOf(activeSession.band) - 1)];
      activeSession.nextSkillId = trap.skill || question.skill;
    }

    window.setTimeout(() => {
      if (activeSession.answers.length >= MAX_QUESTIONS) finishSession();
      else {
        chooseNextQuestion();
        saveActive();
        renderAssessment();
      }
    }, 420);
  }

  function finishSession() {
    clearInterval(timer);
    if (!activeSession) return;
    const report = buildReport(activeSession);
    const history = reports().filter((item) => item.id !== report.id);
    history.unshift(report);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 30)));
    currentReport = report;
    activeSession = null;
    saveActive();
    navigate("report");
  }

  function percent(correct, total) {
    return total ? Math.round((correct / total) * 100) : 0;
  }

  function buildReport(session) {
    const correctCount = session.answers.filter((answer) => answer.correct).length;
    const accuracy = percent(correctCount, session.answers.length);
    const skillStats = {};
    const dimensionStats = {};
    const errorStats = {};

    for (const answer of session.answers) {
      const skill = skillById(answer.skillId);
      const item = skillStats[answer.skillId] || { id: answer.skillId, name: skill?.name || "Math skill", topic: skill?.topic || "Mathematics", correct: 0, total: 0 };
      item.total += 1;
      if (answer.correct) item.correct += 1;
      skillStats[answer.skillId] = item;

      const dimension = answer.dimensions?.primary || "Understanding";
      const dim = dimensionStats[dimension] || { correct: 0, total: 0 };
      dim.total += 1;
      if (answer.correct) dim.correct += 1;
      dimensionStats[dimension] = dim;

      if (!answer.correct) {
        const type = answer.trap?.type || "Unclassified_Error";
        const error = errorStats[type] || { type, count: 0, examples: [] };
        error.count += 1;
        if (answer.trap?.misconception && !error.examples.includes(answer.trap.misconception)) error.examples.push(answer.trap.misconception);
        errorStats[type] = error;
      }
    }

    const skillMastery = Object.values(skillStats).map((item) => ({ ...item, score: percent(item.correct, item.total) })).sort((a, b) => a.score - b.score);
    const dimensions = Object.entries(dimensionStats).map(([name, item]) => ({ name, score: percent(item.correct, item.total), total: item.total })).sort((a, b) => b.score - a.score);
    const errors = Object.values(errorStats).sort((a, b) => b.count - a.count);
    const gradeEquivalent = Math.max(5, Math.min(10, session.grade + (accuracy >= 82 ? 1 : accuracy < 45 ? -1 : 0)));
    const durationSeconds = Math.max(1, Math.round(((session.answers.at(-1)?.answeredAt || Date.now()) - session.startedAt) / 1000));

    return {
      id: session.id,
      name: session.name,
      school: session.school,
      grade: session.grade,
      completedAt: Date.now(),
      correctCount,
      total: session.answers.length,
      accuracy,
      gradeEquivalent,
      durationSeconds,
      skillMastery,
      dimensions,
      errors,
    };
  }

  function durationText(seconds) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  }

  function renderReport() {
    clearInterval(timer);
    const report = currentReport || reports()[0];
    if (!report) {
      navigate("history");
      return;
    }
    currentReport = report;
    const strongest = [...report.skillMastery].sort((a, b) => b.score - a.score)[0];
    const weakest = report.skillMastery[0];
    const topError = report.errors[0];
    const summary = report.accuracy >= 80
      ? `Strong work. You are secure across most of the skills sampled, with ${escapeHtml(strongest?.name || "your strongest topic")} standing out.`
      : report.accuracy >= 55
        ? `You have a solid base. Focused practice in ${escapeHtml(weakest?.name || "the highlighted skills")} should produce the fastest improvement.`
        : `This diagnostic found useful foundation gaps. Start with ${escapeHtml(weakest?.name || "the first focus area")} before moving to harder questions.`;
    const insights = [
      weakest ? `First focus: ${escapeHtml(weakest.name)} (${weakest.score}% mastery in this session).` : "Review the questions you found most difficult.",
      topError ? `Most common error: ${escapeHtml(topError.type.replaceAll("_", " "))}${topError.examples[0] ? ` — ${escapeHtml(topError.examples[0])}.` : "."}` : "No repeated misconception pattern was detected.",
      strongest ? `Keep building on ${escapeHtml(strongest.name)}, your strongest sampled skill.` : "Practise in short, regular sessions.",
    ];

    app.innerHTML = `
      <main class="shell report-shell fade-up">
        ${topbar('<button class="btn btn-secondary" id="historyBtn">Past results</button>')}
        <section class="report-head">
          <div class="eyebrow">Diagnostic complete</div>
          <h1>${escapeHtml(report.name)}’s math profile</h1>
          <p>${summary}</p>
          <div class="report-actions"><button class="btn btn-primary" id="restartBtn">Take another assessment</button><button class="btn btn-secondary" id="printBtn">Print report</button></div>
        </section>
        <section class="score-grid">
          <article class="score-card"><span>Accuracy</span><strong>${report.accuracy}%</strong><small>${report.correctCount} of ${report.total} correct</small></article>
          <article class="score-card"><span>Current level</span><strong>Class ${report.gradeEquivalent}</strong><small>Diagnostic estimate</small></article>
          <article class="score-card"><span>Time</span><strong>${durationText(report.durationSeconds)}</strong><small>Assessment duration</small></article>
          <article class="score-card"><span>Skills sampled</span><strong>${report.skillMastery.length}</strong><small>Across Class ${report.grade}</small></article>
        </section>
        <section class="report-grid">
          <article class="report-card">
            <h2>Skill mastery</h2><p class="report-card-sub">Performance in each topic sampled by the adaptive test</p>
            <div class="metric-list">${report.skillMastery.map((skill) => `<div><div class="metric-head"><span>${escapeHtml(skill.name)}</span><strong>${skill.score}%</strong></div><div class="bar ${skill.score < 50 ? "weak" : ""}"><div style="width:${skill.score}%"></div></div></div>`).join("")}</div>
          </article>
          <div>
            <article class="report-card">
              <h2>Learning dimensions</h2><p class="report-card-sub">How you handled different kinds of mathematical thinking</p>
              <div class="metric-list">${report.dimensions.map((dimension) => `<div><div class="metric-head"><span>${escapeHtml(dimension.name)}</span><strong>${dimension.score}%</strong></div><div class="bar ${dimension.score < 50 ? "weak" : ""}"><div style="width:${dimension.score}%"></div></div></div>`).join("") || '<p class="narrative">More responses are needed for a dimension profile.</p>'}</div>
            </article>
            <article class="report-card" style="margin-top:16px">
              <h2>Your next steps</h2><p class="report-card-sub">A practical focus plan from this session</p>
              <ul class="insight-list">${insights.map((insight) => `<li>${insight}</li>`).join("")}</ul>
            </article>
          </div>
        </section>
      </main>`;

    document.getElementById("historyBtn").addEventListener("click", () => navigate("history"));
    document.getElementById("restartBtn").addEventListener("click", () => { currentReport = null; navigate("home"); });
    document.getElementById("printBtn").addEventListener("click", () => window.print());
  }

  function renderHistory() {
    clearInterval(timer);
    const history = reports();
    app.innerHTML = `
      <main class="shell history-shell fade-up">
        ${topbar('<button class="btn btn-primary" id="homeBtn">New assessment</button>')}
        <section class="history-head"><div><h1>Past results</h1><p>Reports saved privately in this browser.</p></div>${history.length ? '<button class="btn btn-danger" id="clearBtn">Clear results</button>' : ""}</section>
        <section class="history-list">${history.length ? history.map((report) => `<article class="history-item"><div><div class="history-name">${escapeHtml(report.name)} · Class ${report.grade}</div><div class="history-meta">${new Date(report.completedAt).toLocaleDateString()} · ${report.total} questions · ${durationText(report.durationSeconds)}</div></div><div class="history-score">${report.accuracy}%</div><button class="btn btn-secondary" data-report="${escapeHtml(report.id)}">View report</button></article>`).join("") : '<div class="empty-state"><strong>No reports yet</strong>Complete an assessment and your diagnostic report will appear here.</div>'}</section>
      </main>`;

    document.getElementById("homeBtn").addEventListener("click", () => navigate("home"));
    document.querySelector(".history-list").addEventListener("click", (event) => {
      const button = event.target.closest("[data-report]");
      if (!button) return;
      currentReport = history.find((report) => report.id === button.dataset.report);
      navigate("report");
    });
    document.getElementById("clearBtn")?.addEventListener("click", () => {
      if (confirm("Delete all reports saved in this browser?")) {
        localStorage.removeItem(HISTORY_KEY);
        renderHistory();
      }
    });
  }

  function route() {
    const page = location.hash.replace("#", "") || "home";
    if (page === "assessment") renderAssessment();
    else if (page === "report") renderReport();
    else if (page === "history") renderHistory();
    else renderHome();
  }

  window.addEventListener("hashchange", route);
  route();
})();
