// Pulsar site: header state, scroll reveals and the copy-email button.
document.documentElement.classList.add('js');

const bar = document.querySelector('.top');
const onScroll = () => bar && bar.classList.toggle('solid', window.scrollY > 24);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

const rises = document.querySelectorAll('.rise');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px' });
  rises.forEach(el => io.observe(el));
} else {
  rises.forEach(el => el.classList.add('in'));
}

document.querySelectorAll('[data-copy]').forEach(btn => btn.addEventListener('click', async () => {
  const text = btn.dataset.copy;
  try { await navigator.clipboard.writeText(text); btn.textContent = 'Copied'; }
  catch (e) {
    const r = document.createRange(); r.selectNodeContents(document.querySelector('.mail a'));
    const s = getSelection(); s.removeAllRanges(); s.addRange(r); btn.textContent = 'Selected';
  }
  setTimeout(() => { btn.textContent = 'Copy'; }, 1800);
}));
