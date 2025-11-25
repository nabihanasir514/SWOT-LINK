// Progressive reveal & animations using IntersectionObserver
const animateObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('animate-in');
      // Also support legacy CSS that expects .active on certain sections
      if (entry.target.matches('.how-it-works, .about')) {
        entry.target.classList.add('active');
      }
      animateObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });

document.querySelectorAll('[data-animate]').forEach(el => animateObserver.observe(el));

// Fallback: ensure elements become visible if intersection never fires (very small viewport / dynamic content)
setTimeout(() => {
  document.querySelectorAll('[data-animate]:not(.animate-in)').forEach(el => {
    el.classList.add('animate-in');
    if (el.matches('.how-it-works, .about')) el.classList.add('active');
  });
}, 2000);

// Stagger children utility
function applyStagger(parentSelector, childSelector = ':scope > *', baseDelay = 40) {
  const parent = document.querySelector(parentSelector);
  if (!parent) return;
  [...parent.querySelectorAll(childSelector)].forEach((child, i) => {
    child.style.setProperty('--stagger-delay', `${i * baseDelay}ms`);
    child.classList.add('stagger-item');
  });
}

applyStagger('.feature-grid');
applyStagger('.work-steps');

// Navbar scroll state
const navbar = document.querySelector('.navbar');
window.addEventListener('scroll', () => {
  if (!navbar) return;
  if (window.scrollY > 30) navbar.classList.add('scrolled'); else navbar.classList.remove('scrolled');
});


const getBtn = document.getElementById('get-startup');
const joinBtn = document.getElementById('join-startup');

const getContent = document.getElementById('get-content');
const joinContent = document.getElementById('join-content');

function switchTab(activeBtn, inactiveBtn, showEl, hideEl) {
  activeBtn.classList.add('active');
  inactiveBtn.classList.remove('active');
  showEl.style.display = 'block';
  hideEl.style.display = 'none';
  requestAnimationFrame(() => {
    showEl.classList.add('show');
    hideEl.classList.remove('show');
  });
}

getBtn?.addEventListener('click', () => switchTab(getBtn, joinBtn, getContent, joinContent));
joinBtn?.addEventListener('click', () => switchTab(joinBtn, getBtn, joinContent, getContent));

// Accessibility: keyboard navigation for toggle buttons
[getBtn, joinBtn].filter(Boolean).forEach(btn => {
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      btn.click();
    }
  });
});


// THEME TOGGLE
const themeBtn = document.getElementById("theme-toggle");

if (localStorage.getItem("theme") === "dark") {
  document.body.classList.add("dark");
  themeBtn.textContent = "☀️ Light Mode";
}

themeBtn.addEventListener("click", () => {
  document.body.classList.toggle("dark");

  if (document.body.classList.contains("dark")) {
    themeBtn.textContent = "☀️ Light Mode";
    localStorage.setItem("theme", "dark");
  } else {
    themeBtn.textContent = "🌙 Dark Mode";
    localStorage.setItem("theme", "light");
  }
});

// DROPDOWN
document.querySelector(".dropdown-btn").addEventListener("click", () => {
  document.querySelector(".dropdown").classList.toggle("show");
});
