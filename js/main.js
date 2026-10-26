/**
 * ============================================================================
 * DNA DO FUTEBOL — POR PAULO VITOR
 * Script Principal: Pre-loader SVG Animado, Smooth Scroll (Lenis),
 * ScrollTrigger (GSAP), Interatividade 3D Tilt, Botões Magnéticos e GTM DataLayer
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Inicializa Ícones Lucide
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // 2. Registra Plugins GSAP
  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
  }

  // 3. PRE-LOADER ANIMADO DA LOGO EM SVG
  initPreloader();

  // 4. TOPBAR & BARRA DE PROGRESSO DE SCROLL (RÁPIDO E RESPONSIVO)
  initTopbarAndScrollProgress();

  // 5. EFEITO DE PROFUNDIDADE 3D TILT NOS CARDS E BOTÕES MAGNÉTICOS
  initInteractiveDepth();

  // 6. CUSTOM CURSOR FOLLOWER
  initCustomCursor();

  // 7. RASTREAMENTO GOOGLE TAG MANAGER (GTM DataLayer)
  initGTMTracking();

  // 8. GERENCIADOR DE FAVICON DINÂMICO (Tema Claro / Escuro)
  initDynamicFavicon();
});

/**
 * Atualiza e monitora a preferência de cor do sistema/navegador
 * para chavear o Favicon Dinâmico SVG em tempo real.
 */
function initDynamicFavicon() {
  const favicon = document.getElementById('dynamic-favicon');
  if (!favicon) return;

  const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const updateFavicon = (isDark) => {
    // Adiciona timestamp de cache-busting sutil ao alternar
    const theme = isDark ? 'dark' : 'light';
    favicon.href = `img/favicon.svg?v=${theme}`;
  };

  updateFavicon(darkModeQuery.matches);

  if (darkModeQuery.addEventListener) {
    darkModeQuery.addEventListener('change', (e) => updateFavicon(e.matches));
  } else if (darkModeQuery.addListener) {
    darkModeQuery.addListener((e) => updateFavicon(e.matches));
  }
}

/**
 * Animação Coreografada do Símbolo SVG no Pre-loader:
 * - Desenha as duas hastes em formato de raio (energia e movimento)
 * - Revela em escada os 3 degraus internos (Físico -> Técnico -> Tático)
 * - Atualiza contador percentual e libera a Hero Section com transição suave
 */
function initPreloader() {
  const preloader = document.getElementById('preloader');
  const bar = document.getElementById('preloader-bar');
  const counter = document.getElementById('preloader-counter');
  const pillars = document.querySelectorAll('.preloader__pillar');

  if (!preloader || !window.gsap) {
    document.body.classList.remove('is-loading');
    if (preloader) preloader.style.display = 'none';
    initScrollAnimations();
    return;
  }

  const wingTop = document.querySelector('.dna-path--wing-top');
  const wingBottom = document.querySelector('.dna-path--wing-bottom');
  const rung1 = document.querySelector('.dna-path--rung-1');
  const rung2 = document.querySelector('.dna-path--rung-2');
  const rung3 = document.querySelector('.dna-path--rung-3');

  // Configura estado inicial dos elementos do SVG
  gsap.set([wingTop, wingBottom], {
    opacity: 0,
    scale: 0.82,
    transformOrigin: '50% 50%',
  });
  gsap.set(wingTop, { x: -45, y: -30 });
  gsap.set(wingBottom, { x: 45, y: 30 });

  gsap.set([rung1, rung2, rung3], {
    opacity: 0,
    scaleX: 0,
    transformOrigin: '0% 50%',
  });

  gsap.set(['.preloader__brand', '.preloader__pillars'], {
    opacity: 0,
    y: 14,
  });

  const progressObj = { value: 0 };

  const tl = gsap.timeline({
    defaults: { ease: 'power3.out' },
    onComplete: () => {
      document.body.classList.remove('is-loading');
      preloader.style.display = 'none';
      initScrollAnimations();
    },
  });

  // 1. Entrada das duas hastes em raio (Velocidade e Energia)
  tl.to([wingTop, wingBottom], {
    opacity: 1,
    x: 0,
    y: 0,
    scale: 1,
    duration: 0.75,
    stagger: 0.14,
    ease: 'expo.out',
  })
  // 2. Revela o Nome da Marca e os Pilares
  .to(
    ['.preloader__brand', '.preloader__pillars'],
    {
      opacity: 1,
      y: 0,
      duration: 0.5,
      stagger: 0.1,
    },
    '-=0.45'
  )
  // 3. Escada Progressiva dos 3 Degraus Internos (Físico -> Técnico -> Tático)
  .to(
    rung1,
    {
      opacity: 1,
      scaleX: 1,
      duration: 0.32,
      onStart: () => pillars[0]?.classList.add('is-active'),
    },
    '-=0.2'
  )
  .to(rung2, {
    opacity: 1,
    scaleX: 1,
    duration: 0.32,
    onStart: () => pillars[1]?.classList.add('is-active'),
  })
  .to(rung3, {
    opacity: 1,
    scaleX: 1,
    duration: 0.32,
    onStart: () => pillars[2]?.classList.add('is-active'),
  })
  // 4. Pulso de Energia no Símbolo Completo
  .to('.preloader__logo-svg', {
    scale: 1.06,
    duration: 0.25,
    yoyo: true,
    repeat: 1,
    ease: 'power2.inOut',
  });

  // Animação simultânea da barra de progresso (0% a 100%)
  gsap.to(progressObj, {
    value: 100,
    duration: 1.85,
    ease: 'power2.inOut',
    onUpdate: () => {
      const val = Math.round(progressObj.value);
      if (bar) bar.style.width = `${val}%`;
      if (counter) counter.textContent = `${val}%`;
    },
  });

  // 5. Cortina de saída elegante do Preloader
  tl.to('.preloader__content', {
    y: -30,
    opacity: 0,
    duration: 0.45,
    ease: 'power3.in',
    delay: 0.15,
  }).to(
    preloader,
    {
      yPercent: -100,
      duration: 0.75,
      ease: 'expo.inOut',
    },
    '-=0.15'
  );
}

/**
 * Animações de Entrada e Scroll (Hero Nativo, Divisória e Seções)
 */
function initScrollAnimations() {
  if (!window.gsap || !window.ScrollTrigger) return;

  // Animação de entrada dos blocos do Hero Nativo
  gsap.fromTo(
    ['.hero__brand-lockup', '.hero__headline-block', '.hero__actions-wrap'],
    { y: 36, opacity: 0 },
    {
      y: 0,
      opacity: 1,
      duration: 0.95,
      stagger: 0.14,
      ease: 'power3.out',
    }
  );

  // Revelação dos elementos com classe .reveal-up nas seções abaixo
  gsap.utils.toArray('.reveal-up').forEach((el) => {
    if (el.closest('.hero')) return; // já animado na entrada do Hero
    gsap.fromTo(
      el,
      { y: 48, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 86%',
          toggleActions: 'play none none none',
        },
      }
    );
  });

  // Revelação lateral esquerda (.reveal-left)
  gsap.utils.toArray('.reveal-left').forEach((el) => {
    gsap.fromTo(
      el,
      { x: -50, opacity: 0 },
      {
        x: 0,
        opacity: 1,
        duration: 0.95,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 84%',
        },
      }
    );
  });

  // Revelação lateral direita (.reveal-right)
  gsap.utils.toArray('.reveal-right').forEach((el) => {
    gsap.fromTo(
      el,
      { x: 50, opacity: 0 },
      {
        x: 0,
        opacity: 1,
        duration: 0.95,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 84%',
        },
      }
    );
  });
}

/**
 * Controle de estado da Topbar e Barra de Progresso no Scroll (Nativo, Rápido e Fluido)
 */
function initTopbarAndScrollProgress() {
  const topbar = document.getElementById('topbar');
  const progressBar = document.getElementById('scroll-progress-bar');

  const handleScroll = () => {
    const scrollY = window.scrollY || window.pageYOffset;

    if (topbar) {
      if (scrollY > 40) {
        topbar.classList.add('is-scrolled');
      } else {
        topbar.classList.remove('is-scrolled');
      }
    }

    if (progressBar) {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docHeight > 0 ? Math.min(100, Math.max(0, (scrollY / docHeight) * 100)) : 0;
      progressBar.style.width = `${pct}%`;
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();
}

/**
 * Efeito de Profundidade 3D nos Cards ([data-tilt]) e Botões Magnéticos (.magnetic-btn)
 */
function initInteractiveDepth() {
  const isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches;
  if (isTouch) return;

  // 3D Card Tilt
  const tiltCards = document.querySelectorAll('[data-tilt]');
  tiltCards.forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = ((y - centerY) / centerY) * -5;
      const rotateY = ((x - centerX) / centerX) * 5;

      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-6px)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)';
    });
  });

  // Magnetic Buttons
  const magneticBtns = document.querySelectorAll('.magnetic-btn');
  magneticBtns.forEach((btn) => {
    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      btn.style.transform = `translate(${x * 0.16}px, ${y * 0.22}px)`;
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'translate(0px, 0px)';
    });
  });
}

/**
 * Cursor Personalizado Interativo (Desktop)
 */
function initCustomCursor() {
  const dot = document.getElementById('cursor-dot');
  const ring = document.getElementById('cursor-ring');
  const isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches;

  if (!dot || !ring || isTouch) return;

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let ringX = mouseX;
  let ringY = mouseY;

  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    dot.style.left = `${mouseX}px`;
    dot.style.top = `${mouseY}px`;
  });

  const renderCursor = () => {
    ringX += (mouseX - ringX) * 0.18;
    ringY += (mouseY - ringY) * 0.18;
    ring.style.left = `${ringX}px`;
    ring.style.top = `${ringY}px`;
    requestAnimationFrame(renderCursor);
  };
  requestAnimationFrame(renderCursor);

  const interactiveElements = document.querySelectorAll('a, button, [data-tilt], .quick-chip');
  interactiveElements.forEach((el) => {
    el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
    el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
  });
}

/**
 * Disparo de Eventos no dataLayer para o Google Tag Manager (GTM)
 */
function initGTMTracking() {
  window.dataLayer = window.dataLayer || [];

  const trackedButtons = document.querySelectorAll('[data-gtm-event]');
  trackedButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const eventName = btn.getAttribute('data-gtm-event');
      const eventLabel = btn.getAttribute('data-gtm-label') || btn.textContent.trim();
      const eventLocation = btn.getAttribute('data-gtm-location') || 'page';

      window.dataLayer.push({
        event: eventName,
        cta_label: eventLabel,
        cta_location: eventLocation,
        destination_url: btn.getAttribute('href'),
        timestamp: new Date().toISOString(),
      });
    });
  });
}
