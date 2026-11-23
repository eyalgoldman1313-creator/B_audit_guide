(function(){
  var bar=document.querySelector('.progress i');
  function prog(){var h=document.documentElement;var p=h.scrollTop/((h.scrollHeight-h.clientHeight)||1);if(bar)bar.style.width=(p*100)+'%';}
  addEventListener('scroll',prog,{passive:true});prog();
  var body=document.body;
  function close(){body.classList.remove('sheet-open');}
  function go(id){ if(window.goTo) window.goTo(id); else { var t=document.getElementById(id); if(t) t.scrollIntoView({block:'start'}); } }
  function curChapter(){var cur=null;document.querySelectorAll('section.chapter').forEach(function(s){if(s.getBoundingClientRect().top<200)cur=s.id;});return cur;}
  document.querySelectorAll('[data-sheet]').forEach(function(b){b.addEventListener('click',function(){
    var cur=curChapter();
    document.querySelectorAll('.msheet details').forEach(function(d){d.open=d.dataset.ch===cur;});
    body.classList.add('sheet-open');
  });});
  var scrim=document.querySelector('.mscrim');if(scrim)scrim.addEventListener('click',close);
  document.querySelectorAll('.msheet a').forEach(function(a){a.addEventListener('click',function(e){
    var id=a.getAttribute('href').slice(1);
    if(document.getElementById(id)){e.preventDefault();e.stopPropagation();close();setTimeout(function(){go(id);},250);}
  },true);});
  var s=document.querySelector('[data-search]');if(s)s.addEventListener('click',function(){var q=document.getElementById('q');scrollTo({top:0,behavior:'smooth'});setTimeout(function(){if(q)q.focus();},350);});
  var t=document.querySelector('[data-top]');if(t)t.addEventListener('click',function(){scrollTo({top:0,behavior:'smooth'});});
  // "questions" button: question bank of the current chapter, else first one, else the mapping page
  var qb=document.querySelector('[data-qs]');
  if(qb)qb.addEventListener('click',function(){
    var cur=curChapter(), id=null;
    if(cur==='submit'&&document.getElementById('qs-submit'))id='qs-submit';
    if(!id&&cur&&cur.indexOf('ch-')===0&&document.getElementById('qs-'+cur.slice(3)))id='qs-'+cur.slice(3);
    if(!id){var first=document.querySelector('.qs');if(first)id=first.id;}
    if(!id&&document.getElementById('mapping'))id='mapping';
    if(id)go(id);
  });
  addEventListener('keydown',function(e){if(e.key==='Escape')close();});
})();
