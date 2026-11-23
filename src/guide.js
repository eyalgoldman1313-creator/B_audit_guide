
(function(){
  // ===== Hamburger + mobile dropdowns =====
  var hamburger = document.getElementById('hamburger');
  var navLinks = document.getElementById('navLinks');
  var navItems = document.querySelectorAll('.nav-item');

  hamburger.addEventListener('click', function(){
    var open = navLinks.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  // On mobile, tapping a nav-item link with a dropdown should toggle the dropdown
  navItems.forEach(function(item){
    var trigger = item.querySelector(':scope > a');
    var dropdown = item.querySelector(':scope > .dropdown');
    if (!dropdown) return;
    trigger.addEventListener('click', function(e){
      if (window.matchMedia('(max-width:1180px)').matches){
        e.preventDefault();
        navItems.forEach(function(other){ if (other !== item) other.classList.remove('open'); });
        item.classList.toggle('open');
      }
    });
  });

  // Close mobile menu when a leaf link is clicked
  document.querySelectorAll('.dropdown a').forEach(function(a){
    a.addEventListener('click', function(){
      if (window.matchMedia('(max-width:1180px)').matches){
        navLinks.classList.remove('open');
        hamburger.setAttribute('aria-expanded','false');
        navItems.forEach(function(item){ item.classList.remove('open'); });
      }
    });
  });
  document.querySelectorAll('.nav-item > a:only-child').forEach(function(a){
    a.addEventListener('click', function(){
      navLinks.classList.remove('open');
      hamburger.setAttribute('aria-expanded','false');
    });
  });

  // Close mobile menu on outside tap
  document.addEventListener('click', function(e){
    if (!navLinks.contains(e.target) && !hamburger.contains(e.target)){
      if (window.matchMedia('(max-width:1180px)').matches){
        navLinks.classList.remove('open');
        hamburger.setAttribute('aria-expanded','false');
      }
    }
  });

  // ===== Reveal on scroll =====
  document.querySelectorAll('.standard, .ch-head').forEach(function(el){
    if (!el.classList.contains('rv')) el.classList.add('rv');
  });

  if ('IntersectionObserver' in window){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if (e.isIntersecting){
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, {rootMargin:'0px 0px -6% 0px', threshold:0.05});
    document.querySelectorAll('.rv').forEach(function(el){ io.observe(el); });
  } else {
    document.querySelectorAll('.rv').forEach(function(el){ el.classList.add('in'); });
  }

  // ===== Active nav highlighting =====
  var sections = document.querySelectorAll('section.chapter, header.hero');
  var navAnchors = document.querySelectorAll('.nav-item > a');
  var linkByHash = {};
  navAnchors.forEach(function(a){
    var h = a.getAttribute('href');
    if (h && h.startsWith('#')) linkByHash[h.substring(1)] = a;
    (a.getAttribute('data-ch') || '').split(' ').forEach(function(c){ if (c) linkByHash[c] = a; });
  });

  if ('IntersectionObserver' in window){
    var navIo = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if (e.isIntersecting){
          var id = e.target.id;
          navAnchors.forEach(function(a){ a.classList.remove('active'); });
          var lnk = linkByHash[id];
          if (lnk) lnk.classList.add('active');
        }
      });
    }, {rootMargin:'-40% 0px -55% 0px'});
    sections.forEach(function(s){ navIo.observe(s); });
  }

  // ===== Question bank: filter chips + solutions toggle =====
  function setFilter(sec, f){
    var shown = 0;
    // data-tag holds the space-separated statuses of the card's parts: a card matches when ANY of them equals the filter
    sec.querySelectorAll('.qcase[data-tag], .qlink[data-tag]').forEach(function(el){
      var hide = f !== 'all' && (' ' + el.getAttribute('data-tag') + ' ').indexOf(' ' + f + ' ') < 0;
      el.classList.toggle('qhide', hide);
      if (!hide) shown++;
    });
    sec.querySelectorAll('.qgroup').forEach(function(g){
      var has = g.querySelector('.qcase, .qlink');
      g.classList.toggle('qhide', !!has && !g.querySelector('.qcase:not(.qhide), .qlink:not(.qhide)'));
    });
    sec.querySelectorAll('.qfilter button').forEach(function(b){
      b.setAttribute('aria-pressed', b.getAttribute('data-f') === f ? 'true' : 'false');
    });
    sec.classList.toggle('is-empty', shown === 0);
  }
  document.querySelectorAll('.qs').forEach(function(sec){
    sec.querySelectorAll('.qfilter button').forEach(function(b){
      b.addEventListener('click', function(){ setFilter(sec, b.getAttribute('data-f')); });
    });
    var tg = sec.querySelector('.qtoggle');
    if (tg) tg.addEventListener('click', function(){
      var ds = sec.querySelectorAll('.qgroup:not(.qhide) .qcase:not(.qhide) details.sol');
      var anyClosed = Array.prototype.some.call(ds, function(d){ return !d.open; });
      ds.forEach(function(d){ d.open = anyClosed; });
      tg.textContent = anyClosed ? 'סגור את כל הפתרונות' : 'פתח את כל הפתרונות';
    });
  });
  // make sure solutions are printed
  var reopen = [];
  window.addEventListener('beforeprint', function(){
    reopen = [];
    document.querySelectorAll('details.sol').forEach(function(d){ if (!d.open){ d.open = true; reopen.push(d); } });
  });
  window.addEventListener('afterprint', function(){ reopen.forEach(function(d){ d.open = false; }); reopen = []; });

  // ===== Navigation to an anchor (works through filters and content-visibility) =====
  var navToken = 0;
  function jump(t){
    try { t.scrollIntoView({block:'start', behavior:'instant'}); } catch (err) { t.scrollIntoView(true); }
  }
  function goTo(id, noHistory){
    var t = document.getElementById(id);
    if (!t) return false;
    var sec = t.closest('.qs');
    if (sec && t.closest('.qhide')) setFilter(sec, 'all');
    var rv = t.closest('.rv'); if (rv) rv.classList.add('in');
    var my = ++navToken;
    jump(t);
    // layout above the target may change (content-visibility:auto, fonts, tables) -> re-align
    [120, 400, 900].forEach(function(ms){ setTimeout(function(){ if (my === navToken) jump(t); }, ms); });
    // web fonts / lazily rendered articles can resize everything above the target after the first jump:
    // keep re-aligning for a few seconds as long as the document height changes and the user has not scrolled
    if (window.ResizeObserver){
      if (goTo._ro) goTo._ro.disconnect();
      var ro = goTo._ro = new ResizeObserver(function(){ if (my === navToken) jump(t); else ro.disconnect(); });
      ro.observe(document.body);
      setTimeout(function(){ ro.disconnect(); }, 5000);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ if (my === navToken) jump(t); });
    if (!noHistory) { try { history.replaceState(null, '', '#' + id); } catch (err) {} }
    return true;
  }
  window.goTo = goTo;
  ['wheel','touchstart','mousedown','keydown'].forEach(function(ev){
    window.addEventListener(ev, function(){ navToken++; }, {passive:true});
  });
  document.addEventListener('click', function(e){
    if (e.defaultPrevented) return;
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
    var id = decodeURIComponent(a.getAttribute('href').substring(1));
    if (id && goTo(id)) e.preventDefault();
  });
  function fromHash(){
    var id = decodeURIComponent((location.hash || '').substring(1));
    if (id) goTo(id, true);
  }
  window.addEventListener('hashchange', fromHash);
  fromHash();
  window.addEventListener('load', fromHash);

  // ===== Search =====
  var q=document.getElementById('q'), res=document.getElementById('results'), IDX=window.__INDEX__||[], sel=-1;
  function norm(s){return (s||'').toLowerCase().replace(/[֑-ׇ"'״׳]/g,'');}
  function escH(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  IDX.forEach(function(x){x._k=norm(x.t+' '+x.c+' '+x.k);x._t=norm(x.t);});
  function render(){
    var v=norm(q.value.trim()); sel=-1;
    if(!v){res.hidden=true;res.innerHTML='';return;}
    var terms=v.split(/\s+/);
    function ws(str,t){var i=str.indexOf(t);while(i>-1){if(i===0||/[\s(,.\-\/:]/.test(str[i-1]))return true;i=str.indexOf(t,i+1);}return false;}
    function score(x){var s=0;if(x._t.indexOf(v)>-1)s+=20;terms.forEach(function(t){if(ws(x._t,t))s+=6;else if(x._t.indexOf(t)>-1)s+=2;if(ws(x._k,t))s+=2;});return s;}
    var hits=IDX.filter(function(x){return terms.every(function(t){return x._k.indexOf(t)>-1;});})
      .map(function(x){return [score(x),x];}).sort(function(a,b){return b[0]-a[0];}).map(function(p){return p[1];}).slice(0,12);
    res.innerHTML=hits.length?hits.map(function(h){return '<a href="#'+escH(h.id)+'">'+(h.q?'<span class="qmark">שאלה</span> ':'')+escH(h.t)+'<small>'+escH(h.c)+'</small></a>';}).join(''):'<div class="none">לא נמצאו תוצאות</div>';
    res.hidden=false;
  }
  q.addEventListener('input',render);
  q.addEventListener('keydown',function(e){
    var as=res.querySelectorAll('a'); if(!as.length) return;
    if(e.key==='ArrowDown'){e.preventDefault();sel=Math.min(sel+1,as.length-1);}
    else if(e.key==='ArrowUp'){e.preventDefault();sel=Math.max(sel-1,0);}
    else if(e.key==='Enter'){e.preventDefault();(as[sel>-1?sel:0]).click();return;}
    else if(e.key==='Escape'){res.hidden=true;return;}
    as.forEach(function(a,i){a.classList.toggle('sel',i===sel);});
  });
  res.addEventListener('click',function(e){var a=e.target.closest('a');if(!a)return;e.preventDefault();res.hidden=true;goTo(a.getAttribute('href').slice(1));});
  document.addEventListener('click',function(e){if(!e.target.closest('.search-box'))res.hidden=true;});

  // ===== Back to top =====
  var b2t = document.getElementById('b2t');
  b2t.addEventListener('click', function(){ window.scrollTo({top:0, behavior:'smooth'}); });
  window.addEventListener('scroll', function(){
    b2t.classList.toggle('on', window.scrollY > 600);
  }, {passive:true});
})();
