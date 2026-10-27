/**
 * ============================================================================
 * ARENA DNA DO FUTEBOL — FIFA SKILL GAMES & PAINEL DE LÍDERES (NEON DB)
 * Modos de Jogo Competitivos:
 *  01. DUELO 1v1 CONTRA O ZAGUEIRO (Drible em progressão + Finalização)
 *  02. ATAQUE vs DEFESA 1v2 (Pressão de 2 marcadores + Tabelinha + Gol)
 *  03. ARTILHARIA DE PRECISÃO (Alvos móveis na trave + Voleio Acrobático)
 * ============================================================================
 */

(function () {
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const dist2D = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

  // Resolução inteligente da API backend caso a página rode em Live Server (ex: porta 5500)
  const API_BASE = (window.location.protocol === 'file:' || (window.location.port && window.location.port !== '8080'))
    ? 'http://localhost:8080'
    : '';

  const MODE_META = {
    duel1v1: {
      name: '1v1 Duelo',
      hud: 'DUELO 1v1 • DRIBLE O ZAGUEIRO',
      hint: 'Clique no gramado para conduzir e no gol para chutar!',
    },
    atkdef: {
      name: 'Ataque vs Defesa',
      hud: 'ATAQUE vs DEFESA (1v2) • TABELA',
      hint: 'Escape da pressão ou clique no alvo TABELA para furar a marcação!',
    },
    sniper: {
      name: 'Artilharia',
      hud: 'ARTILHARIA • ACERTE OS ALVOS',
      hint: 'Clique nos alvos móveis dentro da trave para finalizar ou volear!',
    },
  };

  function getMedalForScore(pts) {
    if (pts >= 1400) return '🏆 ELITE DNA';
    if (pts >= 850) return '🥇 OURO';
    if (pts >= 450) return '🥈 PRATA';
    return '🥉 BRONZE';
  }

  function initDNASkillGames() {
    const canvas = document.getElementById('dna-soccer-canvas');
    const viewport = document.getElementById('dna-soccer-viewport');
    if (!canvas || !viewport) return;

    const ctx = canvas.getContext('2d');
    let W = 600;
    let H = 430;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resizeCanvas() {
      W = viewport.clientWidth || 600;
      H = viewport.clientHeight || 430;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Elementos de UI, Abas, Form de Lead e Leaderboard
    const elTimer = document.getElementById('mg-timer');
    const elScore = document.getElementById('mg-score-points');
    const elSkillHud = document.getElementById('telemetry-skill');
    const elMedalHud = document.getElementById('telemetry-speed');
    const elControlHint = document.getElementById('mg-control-hint');

    const overlay = document.getElementById('game-lead-overlay');
    const overlayTitle = document.getElementById('overlay-main-title');
    const overlayDesc = document.getElementById('overlay-main-desc');
    const leadForm = document.getElementById('game-lead-form');
    const inputName = document.getElementById('lead-name');
    const inputPhone = document.getElementById('lead-phone');
    const btnPlayFree = document.getElementById('btn-play-free');

    const tabBtnPlay = document.getElementById('tab-btn-play');
    const tabBtnRank = document.getElementById('tab-btn-rank');
    const leaderboardView = document.getElementById('dna-leaderboard-view');
    const leaderboardList = document.getElementById('leaderboard-list');
    const btnBackToGame = document.getElementById('btn-back-to-game');

    // Recupera jogador cadastrado do LocalStorage
    let registeredPlayer = null;
    try {
      const saved = localStorage.getItem('dna_player_lead');
      if (saved) {
        registeredPlayer = JSON.parse(saved);
        if (inputName && registeredPlayer.name) inputName.value = registeredPlayer.name;
        if (inputPhone && registeredPlayer.phone) inputPhone.value = registeredPlayer.phone;
      }
    } catch (e) {}

    // Estado da Partida
    let currentMode = 'duel1v1';
    let isMatchActive = false;
    let timeRemaining = 45;
    let scorePoints = 0;
    let goalsScored = 0;
    let comboMultiplier = 1;

    // Cálculo do Fator de Dificuldade Progressiva (0 a 1+) baseado no tempo e pontuação
    function getDifficultyFactor() {
      const timeElapsed = Math.max(0, 45 - timeRemaining);
      const timeFactor = timeElapsed / 45; // 0 no início até 1 no fim
      const scoreFactor = Math.min(scorePoints / 1200, 1.2);
      return Math.min(1.8, 1.0 + timeFactor * 0.45 + scoreFactor * 0.4);
    }

    function updateHUD() {
      if (elTimer) elTimer.textContent = `${Math.ceil(timeRemaining)}s`;
      if (elScore) elScore.textContent = String(scorePoints);
      if (elMedalHud) elMedalHud.textContent = getMedalForScore(scorePoints);
      if (elSkillHud) elSkillHud.textContent = MODE_META[currentMode].hud;
      if (elControlHint) elControlHint.textContent = MODE_META[currentMode].hint;
    }

    if (inputPhone) {
      inputPhone.addEventListener('input', (e) => {
        let v = e.target.value.replace(/\D/g, '').slice(0, 11);
        if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
        if (v.length > 10) v = `${v.slice(0, 10)}-${v.slice(10)}`;
        e.target.value = v;
      });
    }

    function switchTab(tab) {
      const isPlay = tab === 'play';
      if (tabBtnPlay) tabBtnPlay.classList.toggle('is-active', isPlay);
      if (tabBtnRank) tabBtnRank.classList.toggle('is-active', !isPlay);
      if (viewport) viewport.hidden = !isPlay;
      if (leaderboardView) leaderboardView.hidden = isPlay;
      if (!isPlay) {
        fetchAndRenderLeaderboard();
      } else {
        resizeCanvas();
      }
    }

    if (tabBtnPlay) tabBtnPlay.addEventListener('click', () => switchTab('play'));
    if (tabBtnRank) tabBtnRank.addEventListener('click', () => switchTab('rank'));
    if (btnBackToGame) btnBackToGame.addEventListener('click', () => switchTab('play'));

    // Busca e Renderiza Ranking Real do Neon DB
    async function fetchAndRenderLeaderboard() {
      if (!leaderboardList) return;
      leaderboardList.innerHTML = '<div class="leaderboard-empty">Atualizando classificação ao vivo...</div>';
      try {
        const res = await fetch(`${API_BASE}/api/leaderboard`);
        const data = await res.json();
        const rows = data.leaderboard || [];
        if (rows.length === 0) {
          leaderboardList.innerHTML =
            '<div class="leaderboard-empty">Nenhum recorde registrado ainda. Seja o primeiro a entrar no topo!</div>';
          return;
        }
        leaderboardList.innerHTML = rows
          .map((r, idx) => {
            const pos = idx + 1;
            const medal = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : `${pos}º`;
            return `
              <div class="leaderboard-row ${pos === 1 ? 'leaderboard-row--top1' : ''}">
                <div class="leaderboard-row__left">
                  <div class="leaderboard-rank">${medal}</div>
                  <div class="leaderboard-player">
                    <strong>${escapeHtml(r.name)}</strong>
                    <span>Modo: ${escapeHtml(r.favorite_mode || '1v1 Duelo')} • ${r.goals || 0} gols</span>
                  </div>
                </div>
                <div class="leaderboard-score">
                  <strong>${r.best_score || 0} PTS</strong>
                  <span>${getMedalForScore(r.best_score || 0)}</span>
                </div>
              </div>
            `;
          })
          .join('');
      } catch (err) {
        leaderboardList.innerHTML =
          '<div class="leaderboard-empty">Jogue uma partida para inaugurar o Painel de Líderes!</div>';
      }
    }

    function escapeHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    // Salva Pontuação no Backend/Neon DB
    async function syncScoreToNeon() {
      if (!registeredPlayer || !registeredPlayer.phone) return;
      try {
        await fetch(`${API_BASE}/api/score`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: registeredPlayer.phone,
            score: scorePoints,
            goals: goalsScored,
            mode: MODE_META[currentMode].name,
          }),
        });
      } catch (e) {}
    }

    function startMatch() {
      scorePoints = 0;
      goalsScored = 0;
      comboMultiplier = 1;
      timeRemaining = 45;
      isMatchActive = true;
      if (overlay) overlay.classList.add('is-hidden');
      setupModeEntities(currentMode);
      updateHUD();
    }

    // Finalização da Partida
    async function finishMatch() {
      isMatchActive = false;
      await syncScoreToNeon();

      if (overlay) {
        overlay.classList.remove('is-hidden');
        const medal = getMedalForScore(scorePoints);

        if (registeredPlayer && registeredPlayer.name) {
          if (overlayTitle) {
            overlayTitle.textContent = `Treino Finalizado! ${scorePoints} PTS (${medal})`;
          }
          if (overlayDesc) {
            overlayDesc.innerHTML = `Excelente jogada, <strong>${escapeHtml(registeredPlayer.name)}</strong>! Seu resultado foi salvo automaticamente no <strong>Painel de Líderes</strong> com <strong>${goalsScored} gols</strong>.`;
          }
          const submitBtn = document.getElementById('btn-start-ranked');
          if (submitBtn) {
            submitBtn.innerHTML = '<i data-lucide="rotate-ccw"></i><span>Jogar Novamente e Bater Recorde</span>';
            if (window.lucide) window.lucide.createIcons();
          }
        } else {
          if (overlayTitle) {
            overlayTitle.textContent = `Treino Finalizado! ${scorePoints} PTS (${medal})`;
          }
          if (overlayDesc) {
            overlayDesc.innerHTML = `Você marcou <strong>${scorePoints} pontos</strong> e <strong>${goalsScored} gols</strong>! Preencha seu nome e WhatsApp para registrar seu nome no Painel de Líderes!`;
          }
        }
      }
    }

    if (leadForm) {
      leadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = inputName ? inputName.value.trim() : '';
        const phone = inputPhone ? inputPhone.value.replace(/\D/g, '') : '';
        if (!name || phone.length < 10) {
          alert('Por favor, informe seu nome e seu WhatsApp com DDD para participar do ranking.');
          return;
        }

        registeredPlayer = { name, phone };
        try {
          localStorage.setItem('dna_player_lead', JSON.stringify(registeredPlayer));
        } catch (err) {}

        try {
          await fetch(`${API_BASE}/api/lead`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name,
              phone,
              mode: MODE_META[currentMode].name,
            }),
          });
          if (scorePoints > 0) {
            await syncScoreToNeon();
          }
        } catch (err) {}

        startMatch();
      });
    }

    if (btnPlayFree) {
      btnPlayFree.addEventListener('click', () => {
        startMatch();
      });
    }

    document.querySelectorAll('.motion-skill-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-mode');
        if (!mode || !MODE_META[mode]) return;
        currentMode = mode;
        document.querySelectorAll('.motion-skill-btn').forEach((b) => {
          b.classList.toggle('is-active', b === btn);
        });
        setupModeEntities(currentMode);
        updateHUD();
      });
    });

    // ========================================================================
    // GEOMETRIA E ENTIDADES
    // ========================================================================
    const getPitch = () => ({
      goalX: W * 0.5,
      goalY: 54,
      goalW: Math.min(W * 0.44, 240),
      goalH: 34,
      boxW: Math.min(W * 0.7, 380),
      boxH: 150,
      passTargetX: W * 0.85,
      passTargetY: H * 0.45,
    });

    const player = {
      x: W * 0.5,
      y: H * 0.76,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      targetX: W * 0.5,
      targetY: H * 0.76,
      facingX: 0,
      facingY: -1,
      stridePhase: 0,
      scaleX: 1,
      scaleY: 1,
      bodyAngle: 0,
      kickSwing: 0,
      hasBall: true,
      invincibleTimer: 0,
    };

    const keeper = {
      x: W * 0.5,
      y: 62,
      vx: 0,
      diveDir: 0,
      diveTimer: 0,
      angle: 0,
    };

    const ball = {
      x: W * 0.5,
      y: H * 0.72,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      curveX: 0,
      angle: 0,
      isShot: false,
      isVolley: false,
      waitingPassReturn: false,
      trail: [],
    };

    let defenders = [];
    let sniperTargets = [];
    let sniperFeederTimer = 0;

    const shockwaves = [];
    const particles = [];
    const floatingTexts = [];
    let netWave = 0;
    let netImpactX = 0;
    let goalFlash = 0;

    function spawnShockwave(x, y, color = '#E02026', maxR = 48) {
      shockwaves.push({ x, y, r: 6, maxR, color, alpha: 1 });
    }

    function spawnParticles(x, y, z, color, count = 14, speed = 130) {
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = (0.3 + Math.random() * 0.7) * speed;
        particles.push({
          x,
          y,
          z,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd * 0.7,
          vz: 40 + Math.random() * 90,
          color,
          size: 2.5 + Math.random() * 3.5,
          life: 1,
        });
      }
    }

    function spawnFloatingText(x, y, text, subtext = '', color = '#FFFFFF') {
      floatingTexts.push({
        x: clamp(x, 95, W - 95),
        y: clamp(y, 70, H - 65),
        text,
        subtext,
        color,
        life: 1.05,
      });
    }

    function addScore(pts, title, sub = '', isGoal = false) {
      const gained = pts * comboMultiplier;
      scorePoints += gained;
      if (isGoal) {
        goalsScored++;
        comboMultiplier = Math.min(5, comboMultiplier + 1);
      }
      spawnFloatingText(
        isGoal ? W * 0.5 : player.x,
        isGoal ? 105 : player.y - 48,
        `${title} +${gained}`,
        sub || `Combo ${comboMultiplier}x`,
        isGoal ? '#FFFFFF' : '#E02026'
      );
      updateHUD();
      syncScoreToNeon();
    }

    function setupModeEntities(mode) {
      const diff = getDifficultyFactor();
      player.x = W * 0.5;
      player.y = H * 0.76;
      player.z = 0;
      player.targetX = player.x;
      player.targetY = player.y;
      player.hasBall = true;
      player.invincibleTimer = 0.8;

      ball.x = player.x;
      ball.y = player.y - 12;
      ball.z = 0;
      ball.vx = 0;
      ball.vy = 0;
      ball.vz = 0;
      ball.isShot = false;
      ball.isVolley = false;
      ball.waitingPassReturn = false;

      defenders = [];
      sniperTargets = [];

      if (mode === 'duel1v1') {
        defenders.push({
          x: W * 0.5,
          y: H * 0.46,
          homeX: W * 0.5,
          homeY: H * 0.45,
          vx: 0,
          vy: 0,
          stride: 0,
          speed: 130 * diff,
          tackleReach: 24 * Math.min(diff, 1.4),
          passed: false,
          stunTimer: 0,
        });
      } else if (mode === 'atkdef') {
        defenders.push(
          {
            x: W * 0.36,
            y: H * 0.48,
            homeX: W * 0.38,
            homeY: H * 0.46,
            vx: 0,
            vy: 0,
            stride: 0,
            speed: 122 * diff,
            tackleReach: 23 * Math.min(diff, 1.4),
            passed: false,
            stunTimer: 0,
          },
          {
            x: W * 0.64,
            y: H * 0.42,
            homeX: W * 0.62,
            homeY: H * 0.4,
            vx: 0,
            vy: 0,
            stride: 2,
            speed: 126 * diff,
            tackleReach: 23 * Math.min(diff, 1.4),
            passed: false,
            stunTimer: 0,
          }
        );
      } else if (mode === 'sniper') {
        const speedMult = Math.min(1.6, diff);
        sniperTargets = [
          {
            x: getPitch().goalX - getPitch().goalW * 0.32,
            y: getPitch().goalY - 12,
            dir: 1,
            speed: 68 * speedMult,
            r: Math.max(12, 18 / diff),
            pts: 250,
          },
          {
            x: getPitch().goalX + getPitch().goalW * 0.32,
            y: getPitch().goalY - 18,
            dir: -1,
            speed: 78 * speedMult,
            r: Math.max(10, 15 / diff),
            pts: 350,
          },
        ];
        sniperFeederTimer = 1.3;
      }
    }

    setupModeEntities(currentMode);

    function shootAtGoal(aimX) {
      const p = getPitch();
      const clampedAim = clamp(aimX, p.goalX - p.goalW * 0.45, p.goalX + p.goalW * 0.45);
      const isAirVolley = ball.z > 14 || currentMode === 'sniper';
      player.hasBall = false;

      if (isAirVolley) {
        player.z = Math.max(player.z, 32);
        player.vz = 95;
        player.bodyAngle = -1.1;
        player.kickSwing = 1.65;
        ball.isVolley = true;
      } else {
        player.kickSwing = 1.45;
        ball.isVolley = false;
      }

      player.scaleX = 1.25;
      player.scaleY = 0.8;

      ball.x = player.x;
      ball.y = player.y - 12;
      const flightTime = isAirVolley ? 0.34 : 0.42;
      ball.vx = (clampedAim - ball.x) / flightTime;
      ball.vy = (p.goalY - ball.y) / flightTime;
      ball.vz = isAirVolley ? 70 : 105;
      ball.curveX = (clampedAim > p.goalX ? 1 : -1) * 45;
      ball.isShot = true;

      // Goleiro reage mais rápido e com mais impulsão conforme a dificuldade sobe
      const diff = getDifficultyFactor();
      keeper.diveDir = clampedAim > p.goalX ? 1 : -1;
      keeper.diveTimer = 0.52;
      keeper.vx = keeper.diveDir * (175 * Math.min(1.45, diff));

      spawnShockwave(ball.x, ball.y, '#E02026', 54);
      spawnParticles(ball.x, ball.y, 10, '#E02026', 18, 160);
    }

    function executeWallPass() {
      const p = getPitch();
      if (!player.hasBall) return;

      player.hasBall = false;
      ball.waitingPassReturn = true;
      player.kickSwing = 1.1;
      player.scaleX = 1.18;
      player.scaleY = 0.86;

      const tFlight = 0.36;
      ball.vx = (p.passTargetX - ball.x) / tFlight;
      ball.vy = (p.passTargetY - ball.y) / tFlight;
      ball.vz = 40;
      ball.curveX = 0;
      ball.isShot = false;

      player.targetX = W * 0.52;
      player.targetY = H * 0.34;
      player.invincibleTimer = 1.2;

      defenders.forEach((d) => {
        d.stunTimer = 1.1;
      });

      spawnShockwave(player.x, player.y, '#FFFFFF', 34);
    }

    canvas.addEventListener('pointerdown', (e) => {
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const p = getPitch();

      // Clicou no Gol
      if (clickY < p.goalY + 70 && Math.abs(clickX - p.goalX) < p.goalW * 0.85) {
        if (player.hasBall || dist2D(player.x, player.y, ball.x, ball.y) < 68) {
          shootAtGoal(clickX);
          return;
        }
      }

      // Clicou na Tabela
      if (
        currentMode === 'atkdef' &&
        dist2D(clickX, clickY, p.passTargetX, p.passTargetY) < 48
      ) {
        executeWallPass();
        return;
      }

      // Clicou no gramado
      player.targetX = clamp(clickX, 50, W - 50);
      player.targetY = clamp(clickY, 120, H - 40);
      spawnShockwave(clickX, clickY, 'rgba(255, 255, 255, 0.45)', 24);
    });

    let lastTime = performance.now();
    let aiDemoTimer = 1.8;

    function updateGame(dt) {
      const p = getPitch();
      const diff = getDifficultyFactor();

      if (isMatchActive) {
        timeRemaining -= dt;
        if (elTimer) elTimer.textContent = `${Math.max(0, Math.ceil(timeRemaining))}s`;
        if (timeRemaining <= 0) {
          timeRemaining = 0;
          finishMatch();
          return;
        }
      } else {
        aiDemoTimer -= dt;
        if (aiDemoTimer <= 0) {
          if (player.y > H * 0.48 && player.hasBall) {
            player.targetX = W * (0.28 + Math.random() * 0.44);
            player.targetY = H * 0.38;
          } else {
            shootAtGoal(p.goalX + (Math.random() < 0.5 ? -1 : 1) * (p.goalW * 0.35));
          }
          aiDemoTimer = 1.6;
        }
      }

      if (player.invincibleTimer > 0) player.invincibleTimer -= dt;

      // 1. Jogador
      const dx = player.targetX - player.x;
      const dy = player.targetY - player.y;
      const d = Math.hypot(dx, dy);

      if (d > 4) {
        const speed = 235;
        const step = Math.min(d, speed * dt);
        player.vx = (dx / d) * speed;
        player.vy = (dy / d) * speed;
        player.x += (dx / d) * step;
        player.y += (dy / d) * step;
        player.facingX = lerp(player.facingX, dx / d, 0.22);
        player.facingY = lerp(player.facingY, dy / d, 0.22);
        player.stridePhase += dt * 16;
      } else {
        player.vx = 0;
        player.vy = 0;
      }

      if (player.z > 0 || player.vz !== 0) {
        player.z += player.vz * dt;
        player.vz -= 480 * dt;
        if (player.z <= 0) {
          player.z = 0;
          player.vz = 0;
          player.scaleX = 1.22;
          player.scaleY = 0.82;
        }
      }

      player.scaleX = lerp(player.scaleX, 1, dt * 11);
      player.scaleY = lerp(player.scaleY, 1, dt * 11);
      player.bodyAngle = lerp(player.bodyAngle, 0, dt * 7.5);
      player.kickSwing = lerp(player.kickSwing, 0, dt * 9.5);

      // 2. IA Zagueiros com Dificuldade Progressiva
      defenders.forEach((def) => {
        if (def.stunTimer > 0) {
          def.stunTimer -= dt;
          return;
        }

        const targetDefX = player.hasBall
          ? lerp(player.x, p.goalX, 0.25)
          : def.homeX;
        const targetDefY = player.hasBall
          ? clamp(player.y - 24, p.goalY + 68, H * 0.65)
          : def.homeY;

        const ddx = targetDefX - def.x;
        const ddy = targetDefY - def.y;
        const dd = Math.hypot(ddx, ddy);

        const currentSpeed = def.speed || 128;
        if (dd > 3) {
          const step = Math.min(dd, currentSpeed * dt);
          def.vx = (ddx / dd) * currentSpeed;
          def.vy = (ddy / dd) * currentSpeed;
          def.x += (ddx / dd) * step;
          def.y += (ddy / dd) * step;
          def.stride += dt * 13;
        } else {
          def.vx = 0;
          def.vy = 0;
        }

        // Drible bem sucedido
        if (player.hasBall && !def.passed && player.y < def.y - 14) {
          def.passed = true;
          addScore(150, 'DRIBLE HUMILHANTE!', 'Zagueiro batido no 1v1');
          spawnShockwave(player.x, player.y, '#FFFFFF', 40);
        }

        // Desarme do zagueiro (raio aumenta com a dificuldade)
        const reach = def.tackleReach || 23;
        if (
          player.hasBall &&
          player.invincibleTimer <= 0 &&
          dist2D(player.x, player.y, def.x, def.y) < reach
        ) {
          comboMultiplier = 1;
          spawnShockwave(def.x, def.y, '#E02026', 44);
          spawnFloatingText(def.x, def.y - 38, 'DESARMADO!', 'Mude de direção mais rápido!', '#D6D9DC');
          setupModeEntities(currentMode);
        }
      });

      // 3. Modo Artilharia
      if (currentMode === 'sniper') {
        sniperTargets.forEach((tObj) => {
          tObj.x += tObj.dir * (tObj.speed || 68) * dt;
          if (tObj.x > p.goalX + p.goalW * 0.42) tObj.dir = -1;
          if (tObj.x < p.goalX - p.goalW * 0.42) tObj.dir = 1;
        });

        if (player.hasBall) {
          sniperFeederTimer -= dt;
          if (sniperFeederTimer <= 0) {
            ball.vz = 155;
            ball.z = 8;
            sniperFeederTimer = Math.max(1.6, 2.4 / diff);
          }
        }
      }

      // 4. Bola
      if (player.hasBall) {
        const lead = d > 4 ? 13 : 9;
        ball.x = lerp(ball.x, player.x + player.facingX * lead, dt * 16);
        ball.y = lerp(ball.y, player.y + player.facingY * lead * 0.6 + 4, dt * 16);
        if (d > 4) ball.angle += dt * 12;

        if (ball.z > 0 || ball.vz !== 0) {
          ball.z += ball.vz * dt;
          ball.vz -= 480 * dt;
          if (ball.z < 0) {
            ball.z = 0;
            ball.vz = 0;
          }
        }
      } else {
        ball.vx += ball.curveX * dt;
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        ball.z += ball.vz * dt;
        ball.vz -= 460 * dt;
        ball.angle += Math.hypot(ball.vx, ball.vy) * dt * 0.05;

        if (ball.z < 0) {
          ball.z = 0;
          ball.vz = Math.abs(ball.vz) > 45 ? -ball.vz * 0.55 : 0;
        }

        if (
          ball.waitingPassReturn &&
          dist2D(ball.x, ball.y, p.passTargetX, p.passTargetY) < 28
        ) {
          ball.waitingPassReturn = false;
          addScore(150, 'TABELINHA PERFEITA!', 'Defesa envolvida no passe');
          spawnShockwave(p.passTargetX, p.passTargetY, '#E02026', 48);

          const retTime = 0.38;
          ball.vx = (player.targetX - ball.x) / retTime;
          ball.vy = (player.targetY - ball.y) / retTime;
          ball.vz = 65;
        }

        if (
          !ball.isShot &&
          !ball.waitingPassReturn &&
          dist2D(player.x, player.y, ball.x, ball.y) < 28
        ) {
          player.hasBall = true;
          ball.vx = 0;
          ball.vy = 0;
        }

        if (ball.isShot && ball.y <= p.goalY + 12) {
          const insideGoal = Math.abs(ball.x - p.goalX) < p.goalW * 0.48;

          let hitTargetBonus = 0;
          if (currentMode === 'sniper' && insideGoal) {
            sniperTargets.forEach((tObj) => {
              if (Math.abs(ball.x - tObj.x) < tObj.r + 14) {
                hitTargetBonus = tObj.pts;
                spawnShockwave(tObj.x, tObj.y, '#FFFFFF', 65);
              }
            });
          }

          // Goleiro ganha maior alcance e velocidade com o tempo/pontos
          const keeperReach = Math.min(36, 24 * diff);
          const savedByKeeper =
            currentMode !== 'sniper' &&
            insideGoal &&
            Math.abs(ball.x - keeper.x) < keeperReach &&
            !ball.isVolley;

          if (savedByKeeper) {
            ball.isShot = false;
            comboMultiplier = 1;
            spawnShockwave(ball.x, keeper.y, '#FFFFFF', 40);
            spawnFloatingText(keeper.x, keeper.y + 24, 'DEFENDEU O GOLEIRO!', 'Tire mais no canto!', '#D6D9DC');
            setTimeout(() => setupModeEntities(currentMode), 500);
          } else if (insideGoal) {
            ball.isShot = false;
            ball.vx = 0;
            ball.vy = 0;
            ball.y = p.goalY - 12;
            netWave = 1.0;
            netImpactX = ball.x;
            goalFlash = 1.0;

            player.vz = 130;
            const basePts = hitTargetBonus > 0 ? hitTargetBonus : ball.isVolley ? 300 : 250;
            const title =
              hitTargetBonus > 0
                ? 'ALVO NA GAVETA!'
                : ball.isVolley
                ? 'GOLAÇO DE VOLEIO!'
                : 'GOLAÇO!';

            spawnShockwave(ball.x, p.goalY, '#E02026', 84);
            spawnParticles(ball.x, p.goalY, 16, '#E02026', 30, 230);
            spawnParticles(ball.x, p.goalY, 16, '#FFFFFF', 18, 180);
            addScore(basePts, title, 'Finalização DNA do Futebol', true);

            setTimeout(() => setupModeEntities(currentMode), 650);
          } else {
            ball.isShot = false;
            setTimeout(() => setupModeEntities(currentMode), 450);
          }
        }
      }

      ball.trail.unshift({ x: ball.x, y: ball.y - ball.z * 0.75, hot: ball.isShot });
      if (ball.trail.length > 15) ball.trail.pop();

      // 5. Goleiro
      if (keeper.diveTimer > 0) {
        keeper.diveTimer -= dt;
        keeper.x += keeper.vx * dt;
        keeper.vx *= 0.92;
        keeper.angle = lerp(keeper.angle, keeper.diveDir * 1.1, dt * 14);
      } else {
        const targetKX = clamp(
          lerp(p.goalX, ball.x, 0.36),
          p.goalX - p.goalW * 0.34,
          p.goalX + p.goalW * 0.34
        );
        keeper.x = lerp(keeper.x, targetKX, dt * (5.5 * Math.min(1.4, diff)));
        keeper.angle = lerp(keeper.angle, 0, dt * 10);
      }
      keeper.x = clamp(keeper.x, p.goalX - p.goalW * 0.44, p.goalX + p.goalW * 0.44);

      // 6. Efeitos
      netWave = Math.max(0, netWave - dt * 1.8);
      goalFlash = Math.max(0, goalFlash - dt * 2.5);

      for (let i = shockwaves.length - 1; i >= 0; i--) {
        const s = shockwaves[i];
        s.r = lerp(s.r, s.maxR, dt * 8);
        s.alpha -= dt * 2.2;
        if (s.alpha <= 0) shockwaves.splice(i, 1);
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i];
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.z += pt.vz * dt;
        pt.vz -= 360 * dt;
        if (pt.z < 0) pt.z = 0;
        pt.life -= dt * 1.8;
        if (pt.life <= 0) particles.splice(i, 1);
      }

      for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const ft = floatingTexts[i];
        ft.y -= dt * 28;
        ft.life -= dt * 0.85;
        if (ft.life <= 0) floatingTexts.splice(i, 1);
      }
    }

    // ========================================================================
    // RENDERIZAÇÃO
    // ========================================================================
    function drawPitch(t) {
      const p = getPitch();
      ctx.clearRect(0, 0, W, H);

      const stripes = 7;
      const sh = H / stripes;
      for (let i = 0; i < stripes; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#16241B' : '#131F17';
        ctx.fillRect(0, i * sh, W, sh + 1);
      }

      const grad = ctx.createRadialGradient(W * 0.5, H * 0.45, 40, W * 0.5, H * 0.5, W * 0.75);
      grad.addColorStop(0, `rgba(192, 25, 30, ${0.08 + goalFlash * 0.28})`);
      grad.addColorStop(1, 'rgba(12, 14, 16, 0.8)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = 2;
      ctx.strokeRect(p.goalX - p.boxW / 2, p.goalY, p.boxW, p.boxH);
      ctx.strokeRect(p.goalX - p.goalW * 0.65, p.goalY, p.goalW * 1.3, 55);

      ctx.beginPath();
      ctx.arc(p.goalX, p.goalY + p.boxH, 44, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();

      const pulse = 1 + Math.sin(t * 4.5) * 0.1;
      if (currentMode === 'atkdef') {
        ctx.save();
        ctx.translate(p.passTargetX, p.passTargetY);
        ctx.strokeStyle = '#E02026';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(0, 0, 23 * pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(192, 25, 30, 0.28)';
        ctx.beginPath();
        ctx.arc(0, 0, 17, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '700 9px Poppins, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('TABELA', 0, 3);
        ctx.restore();
      }

      // Trave e Rede
      const gxL = p.goalX - p.goalW / 2;
      const gxR = p.goalX + p.goalW / 2;
      const gyT = p.goalY - p.goalH;

      ctx.save();
      ctx.strokeStyle = goalFlash > 0.1 ? 'rgba(224, 32, 38, 0.65)' : 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = 1;
      for (let c = 0; c <= 14; c++) {
        const x = lerp(gxL + 6, gxR - 6, c / 14);
        const distImp = Math.max(0, 1 - Math.abs(x - netImpactX) / 80);
        const wave = Math.sin(t * 28 + c) * 9 * netWave * distImp;
        ctx.beginPath();
        ctx.moveTo(x, p.goalY);
        ctx.quadraticCurveTo(x + wave * 0.4, gyT - 8 - wave, x, gyT);
        ctx.stroke();
      }
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(gxL, p.goalY + 4);
      ctx.lineTo(gxL, gyT);
      ctx.lineTo(gxR, gyT);
      ctx.lineTo(gxR, p.goalY + 4);
      ctx.stroke();
      ctx.restore();

      if (currentMode === 'sniper') {
        sniperTargets.forEach((tObj) => {
          ctx.save();
          ctx.translate(tObj.x, tObj.y);
          ctx.fillStyle = 'rgba(224, 32, 38, 0.35)';
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, tObj.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#E02026';
          ctx.beginPath();
          ctx.arc(0, 0, tObj.r * 0.45, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });
      } else {
        [gxL + 22, gxR - 22].forEach((tx) => {
          ctx.strokeStyle = 'rgba(224, 32, 38, 0.65)';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(tx, gyT + 14, 10 * pulse, 0, Math.PI * 2);
          ctx.stroke();
        });
      }
    }

    function drawDefender(def) {
      ctx.save();
      ctx.translate(def.x, def.y);

      ctx.strokeStyle = def.stunTimer > 0 ? 'rgba(255,255,255,0.2)' : 'rgba(224, 32, 38, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.ellipse(0, 4, 24, 12, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
      ctx.beginPath();
      ctx.ellipse(0, 5, 16, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();

      const swing = Math.sin(def.stride) * 6;

      ctx.strokeStyle = '#C68B59';
      ctx.lineWidth = 5.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-5, -9);
      ctx.lineTo(-6, 2 + swing * 0.4);
      ctx.moveTo(5, -9);
      ctx.lineTo(6, 2 - swing * 0.4);
      ctx.stroke();

      ctx.fillStyle = '#1E2226';
      ctx.strokeStyle = '#9BA1A6';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(-12, -33, 24, 20, 5);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#C68B59';
      ctx.beginPath();
      ctx.arc(0, -42, 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#111315';
      ctx.beginPath();
      ctx.arc(0, -44, 10.2, Math.PI, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    function drawGoalkeeper() {
      ctx.save();
      ctx.translate(keeper.x, keeper.y);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 4, 15, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.rotate(keeper.angle);
      ctx.fillStyle = '#343A40';
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.roundRect(-10, -24, 20, 18, 5);
      ctx.fill();
      ctx.stroke();

      const armY = keeper.diveTimer > 0 ? -24 : -14;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-17, armY, 4.5, 0, Math.PI * 2);
      ctx.arc(17, armY, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#E0AC69';
      ctx.beginPath();
      ctx.arc(0, -31, 7.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function drawPlayerBoneco(t) {
      ctx.save();
      ctx.translate(player.x, player.y);

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(0, 5, 20, 9, 0, 0, Math.PI * 2);
      ctx.stroke();

      const shadowScale = clamp(1 - player.z / 95, 0.45, 1);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.52)';
      ctx.beginPath();
      ctx.ellipse(0, 5, 17 * shadowScale, 7 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.translate(0, -player.z * 0.85);
      ctx.rotate(player.bodyAngle);
      ctx.scale(player.scaleX, player.scaleY);

      const stride = Math.sin(player.stridePhase);
      const isMoving = Math.hypot(player.vx, player.vy) > 10;
      const legL = isMoving ? stride * 8 : 0;
      const legR = player.kickSwing > 0.05 ? -player.kickSwing * 14 : isMoving ? -stride * 8 : 0;

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-6, -10);
      ctx.lineTo(-7, 2 + legL * 0.4);
      ctx.moveTo(6, -10);
      ctx.lineTo(7, 2 + legR * 0.4);
      ctx.stroke();

      ctx.fillStyle = '#E02026';
      ctx.beginPath();
      ctx.ellipse(-7, 4 + legL * 0.4, 6, 3.5, 0, 0, Math.PI * 2);
      ctx.ellipse(7, 4 + legR * 0.4, 6.5, 3.8, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#1C1F21';
      ctx.beginPath();
      ctx.roundRect(-12, -17, 24, 10, 4);
      ctx.fill();

      ctx.fillStyle = '#C0191E';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.roundRect(-13, -36, 26, 21, 6);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(4, -30);
      ctx.lineTo(-4, -24);
      ctx.moveTo(5, -24);
      ctx.lineTo(-3, -19);
      ctx.stroke();

      ctx.save();
      ctx.translate(0, -46);
      ctx.fillStyle = '#D8A06C';
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#181A1C';
      ctx.beginPath();
      ctx.arc(0, -3.5, 11.3, Math.PI * 0.92, Math.PI * 2.08);
      ctx.fill();

      ctx.fillStyle = '#C0191E';
      ctx.fillRect(-11, -5, 22, 3.6);

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-3.5, 1, 2.3, 0, Math.PI * 2);
      ctx.arc(3.5, 1, 2.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#121416';
      ctx.beginPath();
      ctx.arc(-3.5, 1, 1.2, 0, Math.PI * 2);
      ctx.arc(3.5, 1, 1.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      ctx.restore();
    }

    function drawBall() {
      if (ball.trail.length > 2) {
        for (let i = 0; i < ball.trail.length - 1; i++) {
          const pt = ball.trail[i];
          const r = 1 - i / ball.trail.length;
          ctx.fillStyle = pt.hot
            ? `rgba(224, 32, 38, ${r * 0.55})`
            : `rgba(255, 255, 255, ${r * 0.22})`;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, (pt.hot ? 8 : 5) * r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const vy = ball.y - ball.z * 0.75;
      const rad = 8.2 + clamp(ball.z * 0.03, 0, 3.5);

      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.ellipse(ball.x, ball.y + 4, 8, 3.8, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(ball.x, vy);
      ctx.rotate(ball.angle);
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(0, 0, rad, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#C0191E';
      ctx.beginPath();
      ctx.arc(0, 0, rad * 0.42, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#1C1F21';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, rad, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    function drawEffects() {
      shockwaves.forEach((s) => {
        ctx.save();
        ctx.strokeStyle = s.color;
        ctx.globalAlpha = clamp(s.alpha, 0, 1);
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, s.r, s.r * 0.55, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      });

      particles.forEach((pt) => {
        ctx.save();
        ctx.fillStyle = pt.color;
        ctx.globalAlpha = clamp(pt.life, 0, 1);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y - pt.z * 0.7, pt.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      floatingTexts.forEach((ft) => {
        ctx.save();
        ctx.globalAlpha = clamp(ft.life * 1.2, 0, 1);
        ctx.textAlign = 'center';
        ctx.font = '800 13px Organetto, Poppins, sans-serif';
        ctx.fillStyle = '#121416';
        ctx.fillText(ft.text, ft.x + 1, ft.y + 1);
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, ft.x, ft.y);
        if (ft.subtext) {
          ctx.font = '600 10px Poppins, sans-serif';
          ctx.fillStyle = '#D6D9DC';
          ctx.fillText(ft.subtext, ft.x, ft.y + 14);
        }
        ctx.restore();
      });
    }

    function loop(now) {
      requestAnimationFrame(loop);
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      const t = now / 1000;

      updateGame(dt);
      drawPitch(t);
      if (currentMode !== 'sniper') drawGoalkeeper();

      const renderables = [
        ...defenders.map((d) => ({ y: d.y, fn: () => drawDefender(d) })),
        { y: ball.y, fn: () => drawBall() },
        { y: player.y, fn: () => drawPlayerBoneco(t) },
      ].sort((a, b) => a.y - b.y);

      renderables.forEach((r) => r.fn());
      drawEffects();
    }

    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDNASkillGames);
  } else {
    initDNASkillGames();
  }
})();
