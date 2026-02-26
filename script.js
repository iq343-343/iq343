(function () {
  // Tabs for Expertise Dashboard
  const tabs = document.querySelectorAll('[data-exp-tab]');
  const contents = document.querySelectorAll('[data-exp-content]');

  if (tabs.length > 0) {
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.getAttribute('data-exp-tab');

        // Toggle Tabs
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Toggle Content with transition feel
        contents.forEach(content => {
          if (content.getAttribute('data-exp-content') === target) {
            content.style.display = 'flex';
            // Simple entry animation
            content.style.opacity = '0';
            content.style.transform = 'translateY(10px)';
            requestAnimationFrame(() => {
              content.style.transition = 'all 0.4s ease';
              content.style.opacity = '1';
              content.style.transform = 'translateY(0)';
            });
          } else {
            content.style.display = 'none';
          }
        });
      });
    });
  }

  // Footer Year
  const y = document.getElementById('year');
  if (y) y.textContent = String(new Date().getFullYear());

  // Chips reveal animation
  const chips = document.querySelector('.chips');
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (chips) {
    const chipItems = Array.from(chips.querySelectorAll('.chip'));
    chipItems.forEach((chip, i) => {
      chip.style.setProperty('--delay', `${i * 70}ms`);
    });

    if (reduceMotion) {
      chips.classList.add('is-visible');
    } else if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        });
      }, { threshold: 0.35 });
      observer.observe(chips);
    } else {
      chips.classList.add('is-visible');
    }
  }

  // Push notifications reveal animation
  const pushStack = document.querySelector('.push-stack');
  if (pushStack) {
    const pushItems = Array.from(pushStack.querySelectorAll('.push-notification'));
    pushItems.forEach((pushp, i) => {
      pushp.style.transitionDelay = `${i * 150}ms`;
    });

    if (reduceMotion) {
      pushItems.forEach(p => p.classList.add('is-visible'));
    } else if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries, obs) => {
        let isAnyIntersecting = false;
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            isAnyIntersecting = true;
          }
        });

        if (isAnyIntersecting) {
          pushItems.forEach(p => p.classList.add('is-visible'));
          obs.disconnect(); // Stop observing once triggered
        }
      }, { threshold: 0.2 });

      // Observe the container itself
      observer.observe(pushStack);
    } else {
      pushItems.forEach(p => p.classList.add('is-visible'));
    }
  }

  // Dark Mode Logic
  const themeToggle = document.querySelector('.theme-toggle');
  const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');

  // 1. Check local storage or system preference
  const currentTheme = localStorage.getItem('theme');
  if (currentTheme === 'dark') {
    document.body.classList.add('dark-theme');
  } else if (currentTheme === 'light') {
    document.body.classList.remove('dark-theme');
  } else if (prefersDarkScheme.matches) {
    document.body.classList.add('dark-theme');
  }

  // 2. Toggle button click
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('dark-theme');
      const theme = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
      localStorage.setItem('theme', theme);
    });
  }

  // 3. Listen for system changes (only if no manual override)
  prefersDarkScheme.addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
      if (e.matches) {
        document.body.classList.add('dark-theme');
      } else {
        document.body.classList.remove('dark-theme');
      }
    }
  });

  // --- Lenis Smooth Scroll Setup ---
  if (typeof Lenis !== 'undefined') {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      direction: 'vertical',
      gestureDirection: 'vertical',
      smooth: true,
      mouseMultiplier: 1,
      smoothTouch: false,
      touchMultiplier: 2,
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    // Handle /products deep link
    if (window.location.pathname === '/products') {
      const productsSection = document.getElementById('products');
      if (productsSection) {
        setTimeout(() => {
          lenis.scrollTo(productsSection);
        }, 500);
      }
    }
  }

})();

// Accordion Logic
document.addEventListener('DOMContentLoaded', () => {
  const expItems = document.querySelectorAll('.exp-list-item');

  expItems.forEach(item => {
    // Add click listener to the entire item or just header?
    // Let's add to the whole item for easier clicking
    item.addEventListener('click', (e) => {
      // Check if clicking inside content to avoid closing when reading/selecting text?
      // Actually standard accordion often toggles on header click.
      // But if item wraps content, clicking content might trigger it.
      // Let's ensure we only trigger if clicking header or use logic to not close if reading.
      // For simplicity, toggle on item click, but maybe better to target header.
      // However, the structure has .exp-list-item wrapping everything.

      // If we want to allow selecting text, we should probably only toggle on header click.
      // Let's try to target header click mainly, or just handle it carefully.

      // Simplest: Close others, toggle current.
      const isHeaderClick = e.target.closest('.exp-item-header');
      if (!isHeaderClick && item.classList.contains('active')) {
        // If active and clicking content, maybe don't toggle?
        // But user asked for "expandable menu".
        return;
      }

      // Close others
      expItems.forEach(other => {
        if (other !== item && other.classList.contains('active')) {
          other.classList.remove('active');
          const content = other.querySelector('.exp-item-content');
          content.style.maxHeight = null;
        }
      });

      // Toggle current
      item.classList.toggle('active');
      const content = item.querySelector('.exp-item-content');
      if (item.classList.contains('active')) {
        content.style.maxHeight = content.scrollHeight + "px";
      } else {
        content.style.maxHeight = null;
      }
    });
  });
});

/* Add class to parent when any item is active for blur effect */
document.addEventListener('DOMContentLoaded', () => {
  const expRightCol = document.querySelector('.exp-right-col');
  const expItems = document.querySelectorAll('.exp-list-item');

  if (expRightCol && expItems.length > 0) {
    expItems.forEach(item => {
      item.addEventListener('click', () => {
        // Wait for the toggle to happen (it happens in the other listener)
        // We can just check state after a microtask or rely on the other listener logic.
        // Better yet, let's just check if any item has class 'active'
        setTimeout(() => {
          const anyActive = document.querySelector('.exp-list-item.active');
          if (anyActive) {
            expRightCol.classList.add('has-active');
          } else {
            expRightCol.classList.remove('has-active');
          }
        }, 10);
      });
    });
  }
});



// Cases Accordion Logic
document.addEventListener('DOMContentLoaded', () => {
  const caseItems = document.querySelectorAll('.case-item');
  const casesList = document.querySelector('.cases-list');

  if (casesList && caseItems.length > 0) {
    caseItems.forEach(item => {
      // Click listener for the whole item
      item.addEventListener('click', (e) => {
        // Check if clicking inside content to avoid closing when reading/selecting text
        // Same logic as Expertise section
        const isHeaderClick = e.target.closest('.case-header');
        if (!isHeaderClick && item.classList.contains('active')) {
          // If active and clicking content, don't toggle
          return;
        }

        // Close others
        caseItems.forEach(other => {
          if (other !== item && other.classList.contains('active')) {
            other.classList.remove('active');
            const content = other.querySelector('.case-content');
            content.style.maxHeight = null;
          }
        });

        // Toggle current
        item.classList.toggle('active');
        const content = item.querySelector('.case-content');
        if (item.classList.contains('active')) {
          content.style.maxHeight = content.scrollHeight + "px";
        } else {
          content.style.maxHeight = null;
        }

        // Handle Blur
        updateBlurState();
      });
    });

    function updateBlurState() {
      // Wait for toggle to process
      setTimeout(() => {
        const anyActive = document.querySelector('.case-item.active');
        if (anyActive) {
          casesList.classList.add('has-active');
        } else {
          casesList.classList.remove('has-active');
        }
      }, 10);
    }
  }
});

// Carousel Logic
document.addEventListener('DOMContentLoaded', () => {
  const carousels = document.querySelectorAll('.carousel-container');

  carousels.forEach(container => {
    const track = container.querySelector('.carousel-track');
    const slides = container.querySelectorAll('.carousel-slide');
    const nextBtn = container.querySelector('.next-btn');
    const prevBtn = container.querySelector('.prev-btn');
    let currentIndex = 0;

    if (!track || slides.length === 0) return;

    function updateSlide() {
      const slideWidth = slides[0].getBoundingClientRect().width;
      track.style.transform = `translateX(-${currentIndex * slideWidth}px)`;
    }

    // Initialize size
    // Initialize size
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(updateSlide, 100);
    });

    nextBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent accordion toggle
      if (currentIndex < slides.length - 1) {
        currentIndex++;
      } else {
        currentIndex = 0; // Loop back
      }
      updateSlide();
    });

    prevBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent accordion toggle
      if (currentIndex > 0) {
        currentIndex--;
      } else {
        currentIndex = slides.length - 1; // Loop to end
      }
      updateSlide();
    });

    // Initial call to set position (though usually 0)
    setTimeout(updateSlide, 100);
  });
});
// Contact Form Logic
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('contact-form');
  const messageDiv = document.getElementById('form-message');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      messageDiv.textContent = 'Отправка...';
      messageDiv.className = 'form-message';

      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());

      // Validation
      const phoneRegex = /^[\d\+\-\(\)\s]{5,}$/;
      const telegramRegex = /^@?[a-zA-Z0-9_]{5,}$/;

      if (!phoneRegex.test(data.phone)) {
        messageDiv.textContent = 'Введите корректный номер телефона';
        messageDiv.className = 'form-message error';
        return;
      }

      if (!telegramRegex.test(data.telegram)) {
        messageDiv.textContent = 'Введите корректный ник в Telegram (например, @username)';
        messageDiv.className = 'form-message error';
        return;
      }

      try {
        const response = await fetch('/api/contact', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
          messageDiv.textContent = result.message;
          messageDiv.className = 'form-message success';
          form.reset();
        } else {
          messageDiv.textContent = result.message || 'Ошибка отправки';
          messageDiv.className = 'form-message error';
        }

      } catch (error) {
        console.error('Error:', error);
        messageDiv.textContent = 'Произошла ошибка при отправке. Попробуйте позже.';
        messageDiv.className = 'form-message error';
      }
    });

    // Formatting Telegram Input
    const telegramInput = document.getElementById('telegram');
    if (telegramInput) {
      telegramInput.addEventListener('blur', (e) => {
        let val = e.target.value.trim();
        if (val && !val.startsWith('@')) {
          e.target.value = '@' + val;
        }
      });
    }
  }
});
