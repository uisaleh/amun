/* Amun Organics theme script */
(function () {
  'use strict';
  var A = window.Amun || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  /* ---------- Money ---------- */
  function money(cents) {
    cents = Math.round(Number(cents) || 0);
    var fmt = A.moneyFormat || '${{amount}}';
    function withDelims(n, prec, th, dec) {
      th = th || ','; dec = dec || '.';
      var parts = (n / 100).toFixed(prec).split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, th);
      return parts.join(dec);
    }
    return fmt.replace(/\{\{\s*(\w+)\s*\}\}/, function (_, k) {
      switch (k) {
        case 'amount_no_decimals': return withDelims(cents, 0);
        case 'amount_with_comma_separator': return withDelims(cents, 2, '.', ',');
        case 'amount_no_decimals_with_comma_separator': return withDelims(cents, 0, '.', ',');
        default: return withDelims(cents, 2);
      }
    });
  }
  function moneyShort(cents) { return money(cents).replace(/\.00(?=\D*$)/, ''); }
  function titleCase(s) {
    return String(s || '').toLowerCase().replace(/(^|\s)(\S)/g, function (m, a, b) { return a + b.toUpperCase(); })
      .replace(/ (And|Of|The) /g, function (m) { return m.toLowerCase(); }).replace(/(\w)’S\b/g, '$1’s').replace(/(\w)'S\b/g, "$1's");
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function design(handle) { return (A.design && A.design[handle]) || null; }

  /* ---------- Overlays ---------- */
  var openOverlay = null;
  function show(el) {
    if (!el) return;
    el.hidden = false; document.body.classList.add('no-scroll'); openOverlay = el;
    var f = el.querySelector('input[type="search"], button, a'); if (f) setTimeout(function () { f.focus(); }, 30);
  }
  function hide(el) {
    if (!el) return;
    el.hidden = true; if (openOverlay === el) openOverlay = null;
    if (!$$('.overlay:not([hidden]), [data-popup]:not([hidden])').length) document.body.classList.remove('no-scroll');
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { $$('.overlay:not([hidden])').forEach(hide); closePopup(); }
  });

  function bind(sel, fn) { document.addEventListener('click', function (e) { var t = e.target.closest(sel); if (t) fn(e, t); }); }
  bind('[data-open-menu]', function () { show($('[data-menu]')); });
  bind('[data-close-menu]', function () { hide($('[data-menu]')); });
  bind('[data-open-search]', function () { show($('[data-search]')); });
  bind('[data-close-search]', function () { hide($('[data-search]')); });
  bind('[data-open-cart]', function (e) { e.preventDefault(); openCart(); });
  bind('[data-close-cart]', function () { hide($('[data-cart]')); });

  /* ---------- Predictive search ---------- */
  var searchTimer;
  document.addEventListener('input', function (e) {
    if (!e.target.matches('[data-search-input]')) return;
    var q = e.target.value.trim(); clearTimeout(searchTimer);
    searchTimer = setTimeout(function () { runSearch(q); }, 60);
  });
  function runSearch(q) {
    var head = $('[data-search-heading]'), items = $$('[data-search-item]'), empty = $('[data-search-empty]'), all = $('[data-search-all]');
    if (!items.length) return;
    var words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) {
      head.textContent = 'Popular products'; head.hidden = false;
      items.forEach(function (el, i) { el.hidden = i > 3; });
      if (empty) empty.hidden = true; if (all) all.hidden = true; return;
    }
    var shown = 0;
    items.forEach(function (el) {
      var t = el.getAttribute('data-terms') || '';
      var ok = words.every(function (w) { return t.indexOf(w) !== -1 || (w.length > 3 && t.indexOf(w.replace(/s$/, '')) !== -1); });
      el.hidden = !ok; if (ok) shown++;
    });
    head.textContent = shown ? 'Results for “' + q + '”' : '';
    head.hidden = !shown;
    if (empty) { empty.hidden = !!shown; empty.textContent = 'No products match “' + q + '”. Try shampoo, conditioner, pomade, lotion or bundle.'; }
    if (all) all.hidden = !shown;
  }

  /* ---------- Cart ---------- */
  var cartState = null;
  function setCount(n) {
    $$('[data-cart-count]').forEach(function (el) { el.textContent = n; });
    $$('[data-cart-icon]').forEach(function (el) { el.setAttribute('aria-label', 'Cart, ' + n + ' items'); });
  }
  function bump() {
    var ic = $('[data-cart-icon]'); if (!ic) return;
    ic.classList.add('cart-bump'); setTimeout(function () { ic.classList.remove('cart-bump'); }, 220);
  }
  function getCart() { return fetch((A.routes.cart || '/cart') + '.js', { headers: { Accept: 'application/json' } }).then(function (r) { return r.json(); }); }
  function post(url, body) {
    return fetch(url + '.js', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw j; return j; }); });
  }
  function shipChoice() { return store.get('amun-ship') || 'standard'; }
  function renderCart(cart) {
    cartState = cart; setCount(cart.item_count);
    var body = $('[data-cart-body]'), foot = $('[data-cart-foot]'); if (!body) return;
    var sub = cart.items_subtotal_price, free = A.freeShip || 15000;
    var left = Math.max(free - sub, 0);
    $('[data-ship-msg]').textContent = cart.item_count === 0 ? 'Free standard shipping on orders ' + moneyShort(free) + '+' : (left > 0 ? 'You’re ' + money(left) + ' away from free standard shipping' : 'You’ve unlocked free standard shipping');
    $('[data-ship-bar]').style.width = Math.min(100, Math.round(sub / free * 100)) + '%';
    if (!cart.items.length) {
      body.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;gap:18px;padding:72px 0;text-align:center"><p style="margin:0;font-size:16px;line-height:22.4px">Your cart is empty</p><a href="' + esc(A.routes.allProducts || '/collections/all') + '" class="atc-dark" style="display:inline-flex;align-items:center;justify-content:center;height:50px;min-width:200px;padding:0 24px;background:#585128;color:#ffffff;font-size:14px;text-decoration:none">Shop All</a></div>';
      foot.hidden = true; return;
    }
    body.innerHTML = cart.items.map(function (it) {
      var dz = design(it.handle) || {};
      var img = dz.img || (it.image ? it.image.replace(/(\.[a-z]+)(\?|$)/i, '$1$2') : '');
      var name = dz.name || titleCase(it.product_title);
      var meta = [];
      if (!it.product_has_only_default_variant && it.variant_title) meta.push(esc(it.variant_title));
      if (it.selling_plan_allocation) meta.push(esc(it.selling_plan_allocation.selling_plan.name));
      return '<div class="cart-line"><a href="' + esc(it.url) + '" style="flex:0 0 84px">' + (img ? '<img src="' + esc(img) + '" alt="' + esc(name) + '" style="display:block;width:84px;height:105px;object-fit:cover;background:#efefea">' : '') + '</a>' +
        '<div style="flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:8px">' +
        '<div style="display:flex;justify-content:space-between;gap:10px"><a href="' + esc(it.url) + '" style="font-size:14px;line-height:19.6px">' + esc(name) + '</a><span style="font-size:14px;line-height:19.6px;white-space:nowrap">' + money(it.final_line_price) + '</span></div>' +
        '<span style="font-size:12px;line-height:16.8px">' + money(it.final_price) + ' each' + (meta.length ? ' · ' + meta.join(' · ') : '') + '</span>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:auto"><div class="qty"><button type="button" data-line-qty="' + esc(it.key) + '" data-q="' + (it.quantity - 1) + '" aria-label="Decrease quantity of ' + esc(name) + '">−</button><span aria-live="polite">' + it.quantity + '</span><button type="button" data-line-qty="' + esc(it.key) + '" data-q="' + (it.quantity + 1) + '" aria-label="Increase quantity of ' + esc(name) + '">+</button></div>' +
        '<button type="button" class="link-btn" data-line-qty="' + esc(it.key) + '" data-q="0">Remove</button></div></div></div>';
    }).join('');
    foot.hidden = false;
    var choice = shipChoice(), rates = A.shipRates || [];
    var shipCost = 0, shipName = '';
    $('[data-ship-opts]').innerHTML = rates.map(function (r) {
      var price = r.freeOver && sub >= free ? 0 : r.price;
      var on = r.id === choice; if (on) { shipCost = price; shipName = r.label; }
      return '<label class="ship-opt' + (on ? ' is-on' : '') + '"><input type="radio" name="shipmethod" value="' + r.id + '"' + (on ? ' checked' : '') + ' data-ship-pick style="margin:0;width:16px;height:16px;accent-color:#585128"><span style="flex:1 1 auto;display:flex;flex-direction:column"><span>' + esc(r.label) + '</span><span style="font-size:12px;line-height:16.8px;color:#4a4a40">' + esc(r.eta) + '</span></span><span style="white-space:nowrap">' + (price === 0 ? 'Free' : money(price)) + '</span></label>';
    }).join('');
    var disc = cart.total_discount || 0;
    var codes = (cart.discount_codes || []).filter(function (c) { return c.applicable; });
    $('[data-subtotal]').textContent = money(cart.original_total_price || sub);
    $('[data-ship-name]').textContent = shipName;
    $('[data-ship-price]').textContent = shipCost === 0 ? 'Free' : money(shipCost);
    var drow = $('[data-discount-row]');
    if (disc > 0 || codes.length) {
      drow.hidden = false;
      $('[data-discount-code]').textContent = codes.length ? codes.map(function (c) { return c.code; }).join(', ') : 'Savings';
      $('[data-remove-code]').hidden = !codes.length;
      $('[data-discount-amt]').textContent = '−' + money(disc);
    } else { drow.hidden = true; }
    var total = cart.total_price + shipCost;
    $('[data-total]').textContent = money(total);
    $('[data-klarna]').textContent = money(Math.round(cart.total_price / 4));
  }
  function refreshCart() { return getCart().then(renderCart); }
  function openCart() { show($('[data-cart]')); refreshCart(); }
  document.addEventListener('change', function (e) {
    if (e.target.matches('[data-ship-pick]')) { store.set('amun-ship', e.target.value); if (cartState) renderCart(cartState); }
  });
  bind('[data-line-qty]', function (e, b) {
    b.disabled = true;
    post(A.routes.cartChange || '/cart/change', { id: b.getAttribute('data-line-qty'), quantity: Number(b.getAttribute('data-q')) })
      .then(renderCart).catch(function () { refreshCart(); });
  });
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (!f.matches('[data-code-form]')) return;
    e.preventDefault();
    var code = (f.code.value || '').trim().toUpperCase(), err = $('[data-code-error]');
    err.hidden = true;
    if (!code) { err.textContent = 'Enter a discount code.'; err.hidden = false; return; }
    applyCode(code).then(function (cart) {
      var ok = (cart.discount_codes || []).some(function (c) { return c.code.toUpperCase() === code && c.applicable; });
      if (!ok) { err.textContent = 'That code isn’t valid for this cart.'; err.hidden = false; }
      else { f.code.value = ''; }
    }).catch(function () { err.textContent = 'We couldn’t apply that code. You can also enter it at checkout.'; err.hidden = false; });
  });
  function applyCode(code) {
    var existing = cartState ? (cartState.discount_codes || []).map(function (c) { return c.code; }) : [];
    if (existing.indexOf(code) === -1) existing.push(code);
    return post(A.routes.cartUpdate || '/cart/update', { discount: existing.join(',') }).then(function (c) { renderCart(c); return c; });
  }
  bind('[data-remove-code]', function () { post(A.routes.cartUpdate || '/cart/update', { discount: '' }).then(renderCart); });

  /* ---------- Add to cart + flight ---------- */
  function fly(fromEl, img) {
    var dot = $('[data-fly]'), target = $('[data-cart-icon]');
    if (!dot || !target || !fromEl) return;
    var a = fromEl.getBoundingClientRect(), b = target.getBoundingClientRect();
    var x = a.left + a.width / 2 - 23, y = a.top + a.height / 2 - 23;
    var dx = b.left + b.width / 2 - 23 - x, dy = b.top + b.height / 2 - 23 - y;
    var pic = $('[data-fly-img]', dot), inner = $('.fly__dot', dot);
    if (img) { pic.src = img; pic.hidden = false; } else { pic.hidden = true; }
    dot.style.transition = 'none'; inner.style.transition = 'none';
    dot.style.transform = 'translate(' + x + 'px,' + y + 'px)'; inner.style.transform = 'none'; inner.style.opacity = '1';
    dot.hidden = false; void dot.offsetWidth;
    dot.style.transition = ''; inner.style.transition = '';
    requestAnimationFrame(function () {
      dot.style.transform = 'translate(' + (x + dx) + 'px,' + y + 'px)';
      inner.style.transform = 'translateY(' + dy + 'px) scale(0.3)'; inner.style.opacity = '0.85';
    });
    setTimeout(function () { dot.hidden = true; bump(); }, 780);
  }
  function addItems(items, btn, img) {
    if (btn) { btn.disabled = true; }
    return post(A.routes.cartAdd || '/cart/add', { items: items })
      .then(function () {
        fly(btn, img);
        return getCart();
      })
      .then(function (cart) { renderCart(cart); setTimeout(function () { if (btn) btn.disabled = false; }, 400); return cart; })
      .catch(function (err) {
        if (btn) btn.disabled = false;
        throw err;
      });
  }
  bind('[data-add]', function (e, b) {
    e.preventDefault();
    var card = b.closest('.pcard, [data-routine]') || b.parentElement.parentElement;
    var im = card && card.querySelector('[data-card-img]');
    var label = b.innerHTML;
    addItems([{ id: Number(b.getAttribute('data-add')), quantity: 1 }], b, im ? im.currentSrc || im.src : '')
      .then(function () { b.textContent = 'Added to Cart'; setTimeout(function () { b.innerHTML = label; }, 1400); })
      .catch(function (err) { alertInline(b, err && err.description || 'Sorry, this item couldn’t be added.'); });
  });
  function alertInline(near, msg) {
    var p = document.createElement('p'); p.className = 'form-msg form-msg--error'; p.setAttribute('role', 'alert'); p.textContent = msg;
    near.insertAdjacentElement('afterend', p); setTimeout(function () { p.remove(); }, 4000);
  }

  /* ---------- Sliders ---------- */
  function initSlider(root) {
    var view = $('[data-slider-view]', root); if (!view) return;
    var prev = $('[data-slider-prev]', root), next = $('[data-slider-next]', root);
    function step() { var c = view.querySelector('.slider__track > *'); if (!c) return view.clientWidth; var gap = parseFloat(getComputedStyle(c.parentElement).columnGap || getComputedStyle(c.parentElement).gap) || 0; return c.getBoundingClientRect().width + gap; }
    function state() {
      var max = view.scrollWidth - view.clientWidth - 2;
      var loop = root.classList.contains('ig') || !root.classList.contains('slider--videos');
      if (prev) prev.disabled = !loop && view.scrollLeft <= 2;
      if (next) next.disabled = !loop && view.scrollLeft >= max;
      if (max <= 0) { if (prev) prev.style.visibility = 'hidden'; if (next) next.style.visibility = 'hidden'; }
      else { if (prev) prev.style.visibility = ''; if (next) next.style.visibility = ''; }
    }
    function go(dir) {
      var max = view.scrollWidth - view.clientWidth - 2, loop = !root.classList.contains('slider--videos');
      if (loop && dir > 0 && view.scrollLeft >= max) { view.scrollTo({ left: 0, behavior: 'smooth' }); return; }
      if (loop && dir < 0 && view.scrollLeft <= 2) { view.scrollTo({ left: view.scrollWidth, behavior: 'smooth' }); return; }
      view.scrollBy({ left: dir * step(), behavior: 'smooth' });
    }
    if (prev) prev.addEventListener('click', function () { go(-1); });
    if (next) next.addEventListener('click', function () { go(1); });
    function center() {
      if (!root.classList.contains('slider') || root.classList.contains('slider--videos')) return;
      var c = view.scrollLeft + view.clientWidth / 2, best = null, bd = 1e9;
      $$('.slider__track > *', view).forEach(function (el) { var d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - c); if (d < bd) { bd = d; best = el; } });
      $$('.slider__track > *', view).forEach(function (el) { el.classList.toggle('is-on', el === best); });
    }
    view.addEventListener('scroll', function () { window.requestAnimationFrame(function () { state(); center(); }); }, { passive: true });
    center();
    window.addEventListener('resize', state);
    state();
  }

  /* ---------- Lazy videos ---------- */
  function initVideos() {
    var vids = $$('video[data-src]'); if (!vids.length) return;
    function load(v) {
      if (v.getAttribute('src')) return;
      v.src = v.getAttribute('data-src'); v.preload = 'metadata';
      if (v.hasAttribute('data-autoplay')) { v.autoplay = true; var p = v.play(); if (p && p.catch) p.catch(function () {}); }
    }
    if (!('IntersectionObserver' in window)) { vids.forEach(load); return; }
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) { if (en.isIntersecting) { load(en.target); io.unobserve(en.target); } });
    }, { rootMargin: '300px 600px' });
    vids.forEach(function (v) { io.observe(v); });
  }

  /* ---------- Product page ---------- */
  function initProduct(root) {
    var form = $('[data-product-form]', root);
    var pjson = $('[data-product-json]', root);
    var product = pjson ? JSON.parse(pjson.textContent) : null;
    var idInput = $('[data-variant-id]', root), planInput = $('[data-selling-plan]', root);
    var qtyInput = $('[data-qty]', root), atc = $('[data-atc]', root);

    // Gallery
    var thumbs = $$('[data-gal-thumb]', root), main = $('[data-gal-main]', root), peek = $('[data-gal-peek]', root), idx = 0;
    function pick(i) {
      if (!thumbs.length) return;
      idx = (i + thumbs.length) % thumbs.length;
      var t = thumbs[idx];
      thumbs.forEach(function (b, j) { b.setAttribute('aria-pressed', j === idx ? 'true' : 'false'); });
      if (main) { main.src = t.getAttribute('data-src'); main.removeAttribute('srcset'); main.alt = t.getAttribute('data-alt') || ''; main.style.transform = t.getAttribute('data-zoom') || 'none'; }
      t.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      if (peek && peek.offsetParent) { var it = peek.children[idx]; if (it) peek.scrollTo({ left: it.offsetLeft - (peek.clientWidth - it.clientWidth) / 2, behavior: 'smooth' }); }
    }
    thumbs.forEach(function (b, j) { b.addEventListener('click', function () { pick(j); }); });
    $$('[data-gal-prev]', root).forEach(function (b) { b.addEventListener('click', function () { pick(idx - 1); }); });
    $$('[data-gal-next]', root).forEach(function (b) { b.addEventListener('click', function () { pick(idx + 1); }); });
    if (peek) peek.addEventListener('scroll', function () {
      var c = peek.scrollLeft + peek.clientWidth / 2, best = 0, bd = 1e9;
      Array.prototype.forEach.call(peek.children, function (el, j) { var d = Math.abs(el.offsetLeft + el.clientWidth / 2 - c); if (d < bd) { bd = d; best = j; } });
      idx = best;
    }, { passive: true });

    // Read more
    var desc = $('[data-desc]', root), dt = $('[data-desc-toggle]', root);
    if (desc && dt) {
      var needs = desc.scrollHeight > desc.clientHeight + 4;
      if (!needs) { dt.hidden = true; desc.classList.add('is-open'); }
      dt.addEventListener('click', function () {
        var open = desc.classList.toggle('is-open');
        dt.textContent = open ? 'Read less' : 'Read more'; dt.setAttribute('aria-expanded', open);
      });
    }

    // Accordions
    $$('[data-acc]', root).forEach(function (acc) {
      var b = $('[data-acc-btn]', acc), body = $('[data-acc-body]', acc), mark = $('[data-acc-mark]', acc);
      b.addEventListener('click', function () { var open = body.hidden; body.hidden = !open; b.setAttribute('aria-expanded', open); mark.textContent = open ? '−' : '+'; });
    });

    // Variant / plan / qty / price
    function variant() { return product && product.variants.filter(function (v) { return String(v.id) === String(idInput.value); })[0]; }
    function subOn() { var s = $('[data-buy-sub]', root); return !!(s && s.checked); }
    function unitPrice() {
      var v = variant(); if (!v) return 0;
      if (subOn() && planInput.value) {
        var al = (v.selling_plan_allocations || []).filter(function (a) { return String(a.selling_plan_id) === String(planInput.value); })[0];
        if (al) return al.price;
      }
      return v.price;
    }
    function qty() { return Math.max(1, parseInt(qtyInput.value, 10) || 1); }
    function refresh() {
      var v = variant(); if (!v) return;
      var planSel = $('[data-plan-select]', root);
      planInput.value = subOn() && planSel ? planSel.value : '';
      var subOpts = $('[data-sub-opts]', root); if (subOpts) subOpts.hidden = !subOn();
      var p = unitPrice();
      var pe = $('[data-price]', root); if (pe) pe.textContent = money(p);
      var kl = $('[data-klarna-pdp]', root); if (kl) kl.textContent = money(Math.round(p * qty() / 4));
      var sp = $('[data-sticky-price]', root); if (sp) sp.textContent = money(p);
      if (planSel && v.selling_plan_allocations) {
        $$('option', planSel).forEach(function (o) { var al = v.selling_plan_allocations.filter(function (a) { return String(a.selling_plan_id) === o.value; })[0]; if (al) o.setAttribute('data-price', money(al.price)); });
        var subPrice = $('[data-sub-price]', root), cur = planSel.options[planSel.selectedIndex]; if (subPrice && cur) subPrice.textContent = cur.getAttribute('data-price');
      }
      if (atc) { atc.disabled = !v.available; atc.textContent = v.available ? 'Add to Cart - ' + moneyShort(p * qty()) : 'Sold Out'; }
    }
    var vs = $('[data-variant-select]', root);
    if (vs) vs.addEventListener('change', function () { idInput.value = vs.value; refresh(); });
    $$('[data-buy-once], [data-buy-sub], [data-plan-select]', root).forEach(function (el) { el.addEventListener('change', refresh); });
    var dec = $('[data-qty-dec]', root), inc = $('[data-qty-inc]', root);
    if (dec) dec.addEventListener('click', function () { qtyInput.value = Math.max(1, qty() - 1); refresh(); });
    if (inc) inc.addEventListener('click', function () { qtyInput.value = qty() + 1; refresh(); });
    if (qtyInput) qtyInput.addEventListener('change', refresh);
    refresh();

    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      var err = $('[data-form-error]', root); if (err) err.hidden = true;
      var item = { id: Number(idInput.value), quantity: qty() };
      if (planInput.value) item.selling_plan = Number(planInput.value);
      var img = main ? main.currentSrc || main.src : '';
      var original = atc.textContent;
      addItems([item], atc, img).then(function () {
        atc.textContent = 'Added to Cart'; setTimeout(function () { refresh(); }, 1400);
      }).catch(function (er) {
        atc.textContent = original;
        if (err) { err.textContent = (er && er.description) || 'Sorry, this item couldn’t be added.'; err.hidden = false; }
      });
    });

    // Sticky add to cart (mobile)
    var sticky = $('[data-sticky-atc]', root);
    if (sticky && atc) {
      var onScroll = function () {
        var r = atc.getBoundingClientRect();
        var on = r.bottom < 0 && window.innerWidth <= 860;
        sticky.classList.toggle('is-on', on); sticky.setAttribute('aria-hidden', on ? 'false' : 'true');
        var sb = $('[data-sticky-btn]', sticky); if (sb) sb.tabIndex = on ? 0 : -1;
      };
      window.addEventListener('scroll', onScroll, { passive: true }); window.addEventListener('resize', onScroll); onScroll();
      $('[data-sticky-btn]', sticky).addEventListener('click', function () {
        var b = this, item = { id: Number(idInput.value), quantity: qty() };
        if (planInput.value) item.selling_plan = Number(planInput.value);
        addItems([item], b, main ? main.currentSrc || main.src : '').then(function () {
          b.textContent = 'Added'; setTimeout(function () { b.textContent = 'Add to Cart'; }, 1400);
        }).catch(function () {});
      });
    }
  }

  /* ---------- Key ingredients tabs ---------- */
  function initIngredients(root) {
    var tabs = $$('[data-ing-tab]', root), panels = $$('[data-ing-panel]', root), cur = 0;
    function go(i) {
      cur = (i + tabs.length) % tabs.length;
      tabs.forEach(function (t, j) { t.setAttribute('aria-selected', j === cur ? 'true' : 'false'); });
      panels.forEach(function (p, j) { p.hidden = j !== cur; });
    }
    tabs.forEach(function (t, j) { t.addEventListener('click', function () { go(j); }); });
    $$('[data-ing-prev]', root).forEach(function (b) { b.addEventListener('click', function () { go(cur - 1); }); });
    $$('[data-ing-next]', root).forEach(function (b) { b.addEventListener('click', function () { go(cur + 1); }); });
  }

  /* ---------- Reviews ---------- */
  function initReviews(root) {
    var panel = $('[data-review-panel]', root);
    $$('[data-review-toggle]', root).forEach(function (b) {
      b.addEventListener('click', function () {
        if (!panel) return;
        panel.hidden = !panel.hidden;
        $$('[data-review-toggle][aria-expanded]', root).forEach(function (x) { x.setAttribute('aria-expanded', !panel.hidden); x.textContent = panel.hidden ? 'Write A Review' : 'Close'; });
        if (!panel.hidden) { var f = panel.querySelector('input:not([type="hidden"])'); if (f) f.focus(); }
      });
    });
    var stars = $$('[data-star]', root), ri = $('[data-rating-input]', root);
    function paint(n) { stars.forEach(function (s) { var on = Number(s.getAttribute('data-star')) <= n; s.textContent = on ? '★' : '☆'; s.setAttribute('aria-checked', Number(s.getAttribute('data-star')) === n ? 'true' : 'false'); }); }
    stars.forEach(function (s) { s.addEventListener('click', function () { var n = Number(s.getAttribute('data-star')); if (ri) ri.value = n; paint(n); }); });
    if (stars.length) paint(5);
    var more = $('[data-rev-more]', root);
    if (more) more.addEventListener('click', function () {
      var hidden = $$('.rev-card.is-hidden', root);
      hidden.slice(0, 4).forEach(function (c) { c.classList.remove('is-hidden'); });
      if (hidden.length <= 4) more.hidden = true;
    });
    if (/[?&]contact_posted=true/.test(location.search) && /ReviewForm/.test(location.hash)) {
      setTimeout(function () { root.scrollIntoView({ behavior: 'smooth' }); }, 200);
    }
  }

  /* ---------- Collection filter ---------- */
  function initFilter() {
    var tog = $('[data-filter-toggle]'), bar = $('[data-filter-bar]'); if (!tog || !bar) return;
    tog.addEventListener('click', function () { bar.hidden = !bar.hidden; tog.setAttribute('aria-expanded', !bar.hidden); tog.textContent = bar.hidden ? 'Filter +' : 'Filter −'; });
    $$('[data-filter]', bar).forEach(function (b) {
      b.addEventListener('click', function () {
        var c = b.getAttribute('data-filter');
        $$('[data-filter]', bar).forEach(function (x) { var on = x === b; x.setAttribute('aria-pressed', on); x.style.background = on ? '#000' : '#fff'; x.style.color = on ? '#fff' : '#000'; });
        $$('[data-cat]').forEach(function (cell) { cell.style.display = c === 'All' || cell.getAttribute('data-cat') === c ? 'flex' : 'none'; });
      });
    });
  }

  /* ---------- Newsletter + popup ---------- */
  var popup = $('[data-popup]');
  function closePopup() { if (popup && !popup.hidden) { popup.hidden = true; store.set('amun-popup-seen', '1'); hide(null); document.body.classList.remove('no-scroll'); } }
  function openPopup() { if (!popup) return; popup.hidden = false; document.body.classList.add('no-scroll'); var i = popup.querySelector('input[type="email"], [data-copy-code]'); if (i) setTimeout(function () { i.focus(); }, 50); }
  bind('[data-close-popup]', function () { closePopup(); });
  if (popup) popup.addEventListener('click', function (e) { if (e.target === popup) closePopup(); });

  function initNewsletter() {
    var posted = /[?&]customer_posted=true/.test(location.search);
    var code = A.coupon || 'WELCOME10';
    if (posted) {
      store.set('amun-nl', '1'); store.set('amun-coupon', code); store.set('amun-popup-seen', '1');
      fetch('/discount/' + encodeURIComponent(code), { credentials: 'same-origin' }).then(function () { return applyCode(code); }).catch(function () {});
    }
    if (popup) {
      var done = popup.querySelector('[data-nl-done]');
      if (done) {
        var intro = popup.querySelector('[data-popup-intro]'); if (intro) intro.hidden = true;
        var nt = popup.querySelector('[data-popup-nothanks]');
        if (nt) { nt.textContent = 'Start Shopping'; nt.removeAttribute('style'); nt.className = 'atc-dark'; nt.style.cssText = 'height:48px;background:#585128;color:#ffffff;border:1px solid #585128;border-radius:0;font-size:14px;cursor:pointer'; }
      }
      var popErr = popup.querySelector('[data-nl-error]:not([hidden])');
      if ((posted && /NewsletterPopup/.test(location.hash)) || popErr) { openPopup(); }
      else if (A.popupEnabled && !store.get('amun-popup-seen') && !store.get('amun-nl') && !posted) {
        setTimeout(function () { if (!$$('.overlay:not([hidden])').length) { openPopup(); store.set('amun-popup-seen', '1'); } }, A.popupDelay || 2500);
      }
    }
    document.addEventListener('submit', function (e) {
      var f = e.target; if (!f.matches('.nl-form')) return;
      var input = f.querySelector('input[type="email"]'), err = f.querySelector('[data-nl-error]');
      var v = input ? input.value.trim() : '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
        e.preventDefault();
        if (err) { err.textContent = v ? 'Please enter a valid email address.' : 'Please enter your email address.'; err.hidden = false; }
        if (input) input.focus();
      }
    });
  }
  bind('[data-copy-code]', function (e, b) {
    var code = b.getAttribute('data-copy-code');
    var done = function () { b.textContent = 'Copied!'; setTimeout(function () { b.textContent = 'Copy Code'; }, 1600); };
    if (navigator.clipboard) navigator.clipboard.writeText(code).then(done, done); else done();
  });

  /* ---------- Recommendations (fallback) ---------- */
  function initRecs() {
    $$('[data-recs-url]').forEach(function (sec) {
      fetch(sec.getAttribute('data-recs-url')).then(function (r) { return r.text(); }).then(function (html) {
        var d = document.createElement('div'); d.innerHTML = html;
        var track = d.querySelector('.slider__track'), mine = sec.querySelector('.slider__track');
        if (track && track.children.length && mine) { mine.innerHTML = track.innerHTML; initSlider(sec.querySelector('[data-slider]')); }
        else { sec.hidden = true; }
      }).catch(function () { sec.hidden = true; });
    });
  }

  /* ---------- Header: show when scrolling up ---------- */
  function initHeader() {
    var wrap = $('.header-section'); if (!wrap) return;
    var lastY = window.pageYOffset, ticking = false;
    function update() {
      var y = window.pageYOffset, h = wrap.offsetHeight;
      wrap.style.setProperty('--hdr-hide', (-h - 2) + 'px');
      var anyOpen = $$('.overlay:not([hidden])').length > 0;
      if (anyOpen || y <= h) wrap.classList.remove('is-hidden');
      else if (y > lastY + 6) wrap.classList.add('is-hidden');
      else if (y < lastY - 6) wrap.classList.remove('is-hidden');
      if (Math.abs(y - lastY) > 6 || y <= h) lastY = y;
      ticking = false;
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    wrap.addEventListener('focusin', function () { wrap.classList.remove('is-hidden'); });
    update();
  }

  /* ---------- Boot ---------- */
  function boot() {
    initHeader();
    $$('[data-slider]').forEach(initSlider);
    initVideos();
    $$('[data-product]').forEach(initProduct);
    $$('[data-ings]').forEach(initIngredients);
    $$('#reviews').forEach(initReviews);
    initFilter();
    initNewsletter();
    initRecs();
    getCart().then(function (c) { cartState = c; setCount(c.item_count); }).catch(function () {});
    if (/[?&]cart=open/.test(location.search)) openCart();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
