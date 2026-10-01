/* ============================================================
   Логика модального окна записи
   1) Клик по .js-open-modal — открыть окно.
   2) Клик по .modal__close или .modal__overlay — закрыть.
   3) Клавиша Escape — закрыть.
   Дополнительно: блокировка фона от прокрутки, возврат фокуса
   на кнопку, с которой открыли окно, и ленивая загрузка Яндекс Формы.
   ============================================================ */

(function () {
  "use strict";

  const modal = document.getElementById("modal-form");

  // Защита: если разметка модалки отсутствует — не выполняем ничего.
  if (!modal) {
    return;
  }

  const overlay = modal.querySelector(".modal__overlay");
  const closeBtn = modal.querySelector(".modal__close");
  const focusables =
    'button, [href], input, select, textarea, iframe, [tabindex]:not([tabindex="-1"])';

  // Что открыло окно — чтобы потом вернуть туда фокус.
  let lastTrigger = null;

  // ---------- Открытие ----------
  function openModal(trigger) {
    lastTrigger = trigger || document.activeElement;

    modal.classList.add("modal--open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden"; // блокируем прокрутку страницы

    // Заголовок и подзаголовок окна соответствуют нажатой кнопке.
    const modalTitle = modal.querySelector("#modal-title");
    const modalSubtitle = modal.querySelector(".modal__subtitle");
    if (trigger && trigger.dataset.modalTitle && modalTitle) {
      modalTitle.textContent = trigger.dataset.modalTitle;
    }
    // Подзаголовок тоже можно переопределить (data-modal-subtitle="");
    // если атрибута нет — остаётся дефолтный текст из разметки.
    if (trigger && trigger.dataset.modalSubtitle !== undefined && modalSubtitle) {
      modalSubtitle.textContent = trigger.dataset.modalSubtitle;
    }

    loadForm(); // Яндекс Форма грузится лениво, при первом открытии

    closeBtn.focus();
  }

  // ---------- Закрытие ----------
  function closeModal() {
    modal.classList.remove("modal--open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = ""; // снимаем блокировку прокрутки

    // Возвращаем фокус туда, откуда открыли окно.
    if (lastTrigger && typeof lastTrigger.focus === "function") {
      lastTrigger.focus();
    }
  }

  // ---------- Обработчики ----------
  // Все кнопки «Записаться» открывают модалку, а не скроллят страницу.
  document.querySelectorAll(".js-open-modal").forEach(function (trigger) {
    trigger.addEventListener("click", function (event) {
      event.preventDefault(); // на случай <a href="#..."> сверху
      openModal(trigger);
    });
  });

  closeBtn.addEventListener("click", closeModal);
  overlay.addEventListener("click", closeModal);

  // Escape закрывает окно.
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && modal.classList.contains("modal--open")) {
      closeModal();
    }
  });

  // Удержание фокуса внутри окна (простой focus trap).
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Tab" || !modal.classList.contains("modal--open")) {
      return;
    }

    const items = Array.from(modal.querySelectorAll(focusables)).filter(
      (item) => item.offsetParent !== null && !item.disabled
    );

    if (items.length === 0) {
      return;
    }

    const first = items[0];
    const last = items[items.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  // ---------- Яндекс Форма: ленивая загрузка iframe ----------
  // Форма грузится при первом открытии модалки; спиннер гаснет по событию
  // load. Если за timeout форма не пришла — показываем аварийную ссылку
  // «откройте в новой вкладке».
  const frame = modal.querySelector(".lm-frame");
  const iframeEl = frame ? frame.querySelector("iframe") : null;
  const fallback = modal.querySelector(".lm__fallback");
  const fallbackLink = fallback ? fallback.querySelector("a") : null;
  const timeoutMs =
    parseInt(modal.getAttribute("data-lm-timeout") || "0", 10) || 12000;
  let formStarted = false;

  // Аварийная ссылка всегда ведёт на ту же форму, что и iframe.
  const formUrl = iframeEl ? (iframeEl.getAttribute("data-src") || "") : "";
  if (formUrl && fallbackLink && !fallbackLink.getAttribute("data-manual")) {
    fallbackLink.setAttribute("href", formUrl);
  }

  function loadForm() {
    if (formStarted || !iframeEl || !frame) {
      return;
    }
    formStarted = true;

    function markLoaded() {
      frame.classList.add("is-loaded");
      frame.classList.remove("is-failed");
      if (fallback) {
        fallback.hidden = true;
      }
    }

    function markFailed() {
      frame.classList.add("is-failed");
      if (fallback) {
        fallback.hidden = false;
      }
    }

    // Обработчики вешаем ДО установки src — иначе событие load
    // при попадании в кэш пролетает мимо и спиннер не гаснет.
    iframeEl.addEventListener("load", markLoaded);
    iframeEl.addEventListener("error", markFailed);

    window.setTimeout(function () {
      if (!frame.classList.contains("is-loaded")) {
        markFailed();
      }
    }, timeoutMs);

    const src = iframeEl.getAttribute("data-src");
    if (src) {
      iframeEl.src = src;
    }
  }

  // ---------- Слайдер отзывов ----------
  const slider = document.querySelector(".slider-wrapper");

  if (slider) {
    const slides = Array.from(slider.querySelectorAll(".review-bubble"));
    const nextBtn = slider.querySelector(".slider-btn--next");
    const prevBtn = slider.querySelector(".slider-btn--prev");
    const track = slider.querySelector(".reviews__slider");
    let currentSlide = slides.findIndex((slide) =>
      slide.classList.contains("active")
    );
    if (currentSlide < 0) {
      currentSlide = 0;
    }

    if (slides.length > 0 && nextBtn && prevBtn) {
      // Точки-пагинация: создаются автоматически под количество отзывов.
      const dotsNav = document.createElement("div");
      dotsNav.className = "reviews__dots";
      dotsNav.setAttribute("aria-label", "Выбор отзыва");

      const dots = slides.map(function (_, index) {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "reviews__dot";
        dot.setAttribute("aria-label", "Отзыв " + (index + 1));
        dot.addEventListener("click", function () {
          currentSlide = index;
          showSlide(currentSlide);
        });
        dotsNav.appendChild(dot);
        return dot;
      });

      if (track) {
        track.appendChild(dotsNav);
      }

      function showSlide(index) {
        slides.forEach(function (slide, i) {
          slide.classList.toggle("active", i === index);
        });
        dots.forEach(function (dot, i) {
          dot.classList.toggle("active", i === index);
          if (i === index) {
            dot.setAttribute("aria-current", "true");
          } else {
            dot.removeAttribute("aria-current");
          }
        });
      }

      // Первый показ: синхронизируем слайды и точки.
      showSlide(currentSlide);

      // Переключение вперед: после последнего слайда — первый.
      nextBtn.addEventListener("click", function () {
        currentSlide = (currentSlide + 1) % slides.length;
        showSlide(currentSlide);
      });

      // Переключение назад: из первого — на последний.
      prevBtn.addEventListener("click", function () {
        currentSlide = (currentSlide - 1 + slides.length) % slides.length;
        showSlide(currentSlide);
      });
    }
  }

  // ---------- Мягкое появление блоков при скролле ----------
  const revealTargets = document.querySelectorAll(
    ".hero__content, .hero__image, .card-pair, .about__text, .about__borders, .price-card, .faq__item"
  );
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  if (revealTargets.length > 0 && "IntersectionObserver" in window && !prefersReducedMotion) {
    // Класс добавляется из JS, поэтому без него контент всегда виден.
    revealTargets.forEach((el) => el.classList.add("reveal"));

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    revealTargets.forEach((el) => observer.observe(el));
  }
})();