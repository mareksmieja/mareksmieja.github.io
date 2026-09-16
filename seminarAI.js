// Loads seminarAI-topics.json and renders the "Propozycje tematów" list,
// grouped by section, in the order given by meta.sekcje.

const DIFFICULTY_LABELS = { latwa: 'łatwa', srednia: 'średnia', trudna: 'trudna' };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function linkLabel(url) {
  if (/arxiv\.org/i.test(url)) return 'arXiv';
  if (/openreview\.net/i.test(url)) return 'OpenReview';
  return 'alt link';
}

function buildTopic(paper, byId) {
  const li = el('li', 'topic');
  li.id = 'topic-' + paper.id;

  const title = el('span', 'topic-title');
  if (paper.url) {
    const a = el('a', null, paper.tytul);
    a.href = paper.url;
    title.appendChild(a);
  } else {
    title.textContent = paper.tytul;
  }
  if (paper.url_alt) {
    title.appendChild(document.createTextNode(' '));
    const alt = el('a', 'topic-alt-link', '(' + linkLabel(paper.url_alt) + ')');
    alt.href = paper.url_alt;
    title.appendChild(alt);
  }
  li.appendChild(title);

  const meta = el('span', 'topic-meta');
  const venue = [paper.konferencja, paper.rok].filter(Boolean).join(' ');
  meta.appendChild(document.createTextNode([paper.autorzy, venue].filter(Boolean).join(' — ')));
  if (paper.wyroznienie) meta.appendChild(el('span', 'badge', paper.wyroznienie));
  if (paper.typ === 'preprint') meta.appendChild(el('span', 'badge badge-preprint', 'Preprint'));
  if (paper.typ === 'raport') meta.appendChild(el('span', 'badge badge-raport', 'Raport firmowy'));
  li.appendChild(meta);

  if (paper.opis) li.appendChild(el('p', 'topic-desc', paper.opis));

  const footer = el('span', 'topic-footer');
  const bits = [];
  if (paper.trudnosc) bits.push('Trudność: ' + (DIFFICULTY_LABELS[paper.trudnosc] || paper.trudnosc));
  if (paper.zajete_przez) bits.push('Zajęte przez: ' + paper.zajete_przez);
  footer.appendChild(document.createTextNode(bits.join(' · ')));
  if (paper.para_z && byId.has(paper.para_z)) {
    if (bits.length) footer.appendChild(document.createTextNode(' · '));
    footer.appendChild(document.createTextNode('Zobacz też: '));
    const seeAlso = el('a', null, '#' + paper.para_z + ' ' + byId.get(paper.para_z).tytul);
    seeAlso.href = '#topic-' + paper.para_z;
    footer.appendChild(seeAlso);
  }
  li.appendChild(footer);

  return li;
}

function renderTopics(container, data) {
  const papers = data.prace || [];
  const sections = (data.meta && data.meta.sekcje) || [];
  const byId = new Map(papers.map((p) => [p.id, p]));

  container.innerHTML = '';

  sections.forEach((sectionName) => {
    const inSection = papers.filter((p) => p.sekcja === sectionName);
    if (!inSection.length) return;
    container.appendChild(el('h4', null, sectionName));
    const ul = el('ul', 'topics');
    inSection.forEach((paper) => ul.appendChild(buildTopic(paper, byId)));
    container.appendChild(ul);
  });
}

async function init() {
  const container = document.getElementById('topics-list');
  if (!container) return;
  try {
    const res = await fetch('seminarAI-topics.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!data.prace || !data.prace.length) throw new Error('brak pozycji w seminarAI-topics.json');
    renderTopics(container, data);
  } catch (err) {
    container.innerHTML = '';
    container.appendChild(el('p', 'topics-error', 'Nie udało się wczytać listy tematów z seminarAI-topics.json (' + err.message + ').'));
    console.error('seminarAI.js:', err);
  }
}

// This file is normally injected into index.html's #content via jQuery's
// .load(), which happens after DOMContentLoaded has already fired for the
// host page — so run immediately in that case instead of waiting forever.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
