/* ============================================================
   RUME — shared interactions (multi-page)
   Cart + light mood persist across pages via sessionStorage.
   ============================================================ */
(function () {
  'use strict';
  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const KRW = (n) => '₩ ' + n.toLocaleString('en-US');

  /* ---------- catalogue ---------- */
  const CATALOG = {
    L: { title: 'Rume - L', price: 99000, color: 'red',   img: 'assets/lamp-red-square.jpg' },
    M: { title: 'Rume - M', price: 79000, color: 'cream', img: 'assets/lamp-cream-gray.jpg' },
    S: { title: 'Rume - S', price: 59000, color: 'brown', img: 'assets/lamp-brown-gray.jpg' }
  };
  const COLOR_IMG   = { red: 'assets/lamp-red-square.jpg', cream: 'assets/lamp-cream-gray.jpg', brown: 'assets/lamp-brown-gray.jpg' };
  const COLOR_THUMB = { red: 'assets/shop-red.jpg', cream: 'assets/shop-cream.jpg', brown: 'assets/shop-brown.jpg' };
  const COLOR_LABEL = { red: 'Red', cream: 'Cream', brown: 'Brown' };

  const state = { size: 'L', color: 'red', liked: false, cart: loadCart() };

  function loadCart() {
    try { return JSON.parse(sessionStorage.getItem('rume_cart') || '[]'); }
    catch (e) { return []; }
  }
  function saveCart() {
    try { sessionStorage.setItem('rume_cart', JSON.stringify(state.cart)); } catch (e) {}
  }

  /* ---------- header shadow ---------- */
  const header = $('.site-header');
  if (header) {
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- scroll reveal ---------- */
  const revealEls = $$('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach((el) => io.observe(el));
  } else { revealEls.forEach((el) => el.classList.add('in')); }

  /* ---------- parallax ---------- */
  const pxEls = $$('.parallax');
  const reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  if (pxEls.length && !reduce) {
    let ticking = false;
    const update = () => {
      const vh = window.innerHeight;
      pxEls.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        const progress = (r.top + r.height / 2 - vh / 2) / vh;
        const amt = parseFloat(el.dataset.px || '26');
        const scale = el.dataset.scale || '1.08';
        el.style.transform = 'translate3d(0,' + (-progress * amt).toFixed(1) + 'px,0) scale(' + scale + ')';
      });
      ticking = false;
    };
    window.addEventListener('scroll', () => { if (!ticking) { requestAnimationFrame(update); ticking = true; } }, { passive: true });
    update();
  }

  /* ============================================================
     TOAST
     ============================================================ */
  const toastEl = document.createElement('div');
  toastEl.className = 'toast';
  toastEl.innerHTML = '<span class="dotred" style="width:8px;height:8px;border-radius:50%;background:var(--red);display:inline-block;margin-right:8px"></span><span class="toast-msg"></span>';
  document.body.appendChild(toastEl);
  const toastMsg = $('.toast-msg', toastEl);
  let toastT;
  function toast(msg) {
    toastMsg.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('show'), 2400);
  }
  window.rumeToast = toast;

  /* ============================================================
     CART DRAWER  (injected once per page)
     ============================================================ */
  const scrim = document.createElement('div');
  scrim.className = 'cart-scrim';
  const drawer = document.createElement('aside');
  drawer.className = 'cart-drawer';
  drawer.setAttribute('aria-label', 'Shopping cart');
  drawer.setAttribute('aria-hidden', 'true');
  drawer.innerHTML =
    '<div class="cd-head"><h2>Your Cart</h2><button class="cd-close" aria-label="Close cart">&times;</button></div>' +
    '<div class="cart-items"></div>' +
    '<div class="cart-foot">' +
      '<div class="cf-sum"><span>Subtotal</span><span class="cf-subtotal">₩ 0</span></div>' +
      '<button class="btn btn-solid cf-checkout">Checkout</button>' +
      '<div class="cf-note">Crafted with light, form, and timeless simplicity.</div>' +
    '</div>';
  document.body.appendChild(scrim);
  document.body.appendChild(drawer);

  const cartItemsEl = $('.cart-items', drawer);
  const cfSubtotal = $('.cf-subtotal', drawer);

  function cartQty() { return state.cart.reduce((a, i) => a + i.qty, 0); }
  function cartTotal() { return state.cart.reduce((a, i) => a + CATALOG[i.size].price * i.qty, 0); }

  function renderCart() {
    $$('[data-cart-count]').forEach((el) => { el.textContent = cartQty(); });
    if (!state.cart.length) {
      cartItemsEl.innerHTML = '<p class="cart-empty">Your cart is empty.</p>';
    } else {
      cartItemsEl.innerHTML = state.cart.map((i, idx) =>
        '<div class="cart-line">' +
          '<span class="cl-thumb"><img src="' + (COLOR_THUMB[i.color] || COLOR_THUMB.red) + '" alt=""></span>' +
          '<span class="cl-info">' +
            '<span class="cl-name">' + CATALOG[i.size].title + '</span>' +
            '<span class="cl-meta">Size ' + i.size + ' · ' + (COLOR_LABEL[i.color] || i.color) + ' · Qty ' + i.qty + '</span>' +
            '<span class="cl-price">' + KRW(CATALOG[i.size].price * i.qty) + '</span><br>' +
            '<button class="cl-x" data-idx="' + idx + '">Remove</button>' +
          '</span>' +
        '</div>'
      ).join('');
    }
    cfSubtotal.textContent = KRW(cartTotal());
    saveCart();
  }

  function addToCart(size, color) {
    const ex = state.cart.find((i) => i.size === size && i.color === color);
    if (ex) ex.qty++; else state.cart.push({ size, color, qty: 1 });
    renderCart();
    updateOrder();
  }
  window.rumeAddToCart = (size, color) => addToCart(size || state.size, color || state.color);

  cartItemsEl.addEventListener('click', (e) => {
    const x = e.target.closest('.cl-x');
    if (x) { state.cart.splice(+x.dataset.idx, 1); renderCart(); updateOrder(); }
  });

  function openCart() { drawer.classList.add('open'); scrim.classList.add('open'); drawer.setAttribute('aria-hidden', 'false'); }
  function closeCart() { drawer.classList.remove('open'); scrim.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); }
  window.rumeOpenCart = openCart;

  $$('[data-cart-open]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); openCart(); }));
  $('.cd-close', drawer).addEventListener('click', closeCart);
  scrim.addEventListener('click', closeCart);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCart(); });
  $('.cf-checkout', drawer).addEventListener('click', () => {
    if (!state.cart.length) { toast('Your cart is empty'); return; }
    toast('Order confirmed — thank you ♥');
    state.cart = []; renderCart(); updateOrder();
    setTimeout(closeCart, 700);
  });

  /* ============================================================
     PRODUCT PAGE — size / color / price / image / order
     ============================================================ */
  const titleEl = $('[data-title]');
  const priceEl = $('[data-price]');
  const imgEl = $('[data-pdp-img]');
  const orderEl = $('[data-order-total]');

  function updateOrder() {
    if (!orderEl) return;
    const q = state.cart.filter((i) => i.size === state.size).reduce((a, i) => a + i.qty, 0);
    orderEl.textContent = KRW(CATALOG[state.size].price * q).replace('₩ ', '₩') + ' (' + q + ')';
  }

  function selectSize(size) {
    if (!CATALOG[size]) return;
    state.size = size;
    state.color = CATALOG[size].color;
    const item = CATALOG[size];
    if (titleEl) titleEl.textContent = item.title;
    if (priceEl) priceEl.textContent = KRW(item.price);
    if (imgEl) imgEl.src = item.img;
    $$('.size').forEach((b) => b.classList.toggle('active', b.dataset.size === size));
    $$('.swatch').forEach((b) => b.classList.toggle('active', b.dataset.color === state.color));
    updateOrder();
  }
  window.rumeSelectSize = selectSize;

  $$('.sizes .size').forEach((b) => b.addEventListener('click', () => selectSize(b.dataset.size)));
  $$('.swatches .swatch').forEach((b) => b.addEventListener('click', () => {
    state.color = b.dataset.color;
    $$('.swatch').forEach((s) => s.classList.toggle('active', s === b));
    if (imgEl && COLOR_IMG[state.color]) {
      imgEl.style.opacity = '0';
      setTimeout(() => { imgEl.src = COLOR_IMG[state.color]; imgEl.style.opacity = '1'; }, 200);
    }
  }));

  /* product cards / recs navigate (with preselected size) */
  $$('[data-product]').forEach((card) => card.addEventListener('click', () => {
    const id = card.getAttribute('data-product');
    try { sessionStorage.setItem('rume_size', id); } catch (err) {}
  }));
  if (titleEl) {
    let want = 'L';
    try { want = sessionStorage.getItem('rume_size') || 'L'; } catch (e) {}
    selectSize(CATALOG[want] ? want : 'L');
  }

  /* heart */
  $$('[data-heart]').forEach((btn) => btn.addEventListener('click', () => {
    state.liked = !state.liked;
    btn.classList.toggle('active', state.liked);
    btn.innerHTML = state.liked ? '♥' : '♡';
    toast(state.liked ? 'Saved to wishlist' : 'Removed from wishlist');
  }));

  /* add to cart */
  $$('[data-add-cart]').forEach((btn) => btn.addEventListener('click', (e) => {
    if (btn.tagName === 'A') e.preventDefault();
    addToCart(state.size, state.color);
    toast(CATALOG[state.size].title + ' added to cart');
  }));

  /* buy -> add + open drawer */
  $$('[data-buy]').forEach((btn) => btn.addEventListener('click', () => {
    addToCart(state.size, state.color);
    openCart();
    toast('Ready to checkout — ' + cartQty() + ' item(s)');
  }));

  /* ============================================================
     ACCORDION (Notice / Delivery)
     ============================================================ */
  $$('.acc-head').forEach((h) => {
    const body = document.getElementById(h.getAttribute('aria-controls'));
    function set(open) {
      h.setAttribute('aria-expanded', String(open));
      if (body) { body.classList.toggle('open', open); body.style.maxHeight = open ? body.scrollHeight + 'px' : '0px'; }
    }
    set(h.getAttribute('aria-expanded') === 'true');
    h.addEventListener('click', () => set(h.getAttribute('aria-expanded') !== 'true'));
  });

  /* ============================================================
     GLOBAL LIGHT MOOD  —  body.light-on / body.light-off
     Toggled from any [data-light-toggle]; persists across pages.
     Homepage hand-lamp also cycles 3 brightness levels.
     ============================================================ */
  function getLight() { try { return sessionStorage.getItem('rume_light') !== 'off'; } catch (e) { return true; } }
  function setLightPref(on) { try { sessionStorage.setItem('rume_light', on ? 'on' : 'off'); } catch (e) {} }

  let lightOn = getLight();
  let lvl = 2;
  const stage = $('#lightStage');

  function applyLight() {
    document.body.classList.toggle('light-on', lightOn);
    document.body.classList.toggle('light-off', !lightOn);
    $$('[data-light-toggle]').forEach((t) => t.setAttribute('aria-pressed', String(lightOn)));
    if (stage) {
      stage.classList.toggle('on', lightOn);
      stage.classList.toggle('off', !lightOn);
      stage.classList.toggle('dim', !lightOn);
      stage.dataset.lvl = lightOn ? lvl : 0;
      const label = $('[data-light-level]');
      if (label) label.textContent = lightOn ? ('Brightness · level ' + lvl + ' of 3') : 'Light off';
    }
  }

  $$('[data-light-toggle]').forEach((t) => t.addEventListener('click', (e) => {
    e.stopPropagation();
    lightOn = !lightOn;
    if (lightOn) lvl = 1;
    setLightPref(lightOn);
    applyLight();
    toast(lightOn ? 'Light on — warm mood' : 'Light off');
  }));

  if (stage) {
    stage.addEventListener('click', (e) => {
      if (e.target.closest('[data-light-toggle]')) return;
      if (!lightOn) { lightOn = true; lvl = 1; } else { lvl = lvl >= 3 ? 1 : lvl + 1; }
      setLightPref(lightOn);
      applyLight();
    });
  }
  applyLight();

  /* ---------- init ---------- */
  renderCart();
  updateOrder();
})();
