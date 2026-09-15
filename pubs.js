// Loads pubs.bib (BibTeX) and renders it into <ol id="pubs-list">.
// Small hand-written parser: no dependencies, tolerant of the common BibTeX
// looseness (bare/unbraced values, missing outer braces on LaTeX accents,
// trailing commas).

const OWN_SURNAMES = ['smieja'];

const LATEX_ACCENTS = {
  "'": { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú', y: 'ý', s: 'ś', n: 'ń', z: 'ź', c: 'ć', r: 'ŕ',
         A: 'Á', E: 'É', I: 'Í', O: 'Ó', U: 'Ú', Y: 'Ý', S: 'Ś', N: 'Ń', Z: 'Ź', C: 'Ć' },
  '`': { a: 'à', e: 'è', i: 'ì', o: 'ò', u: 'ù' },
  '^': { a: 'â', e: 'ê', i: 'î', o: 'ô', u: 'û' },
  '"': { a: 'ä', o: 'ö', u: 'ü', A: 'Ä', O: 'Ö', U: 'Ü' },
  '.': { z: 'ż', e: 'ė', Z: 'Ż' },
  'k': { a: 'ą', e: 'ę', A: 'Ą', E: 'Ę' },
  'c': { c: 'ç', s: 'ş', C: 'Ç' },
  'v': { c: 'č', s: 'š', z: 'ž', C: 'Č', S: 'Š', Z: 'Ž' },
};

function decodeLatex(str) {
  if (!str) return '';
  let s = str;
  // \l \L are letters in themselves (ł / Ł), not accents on a base letter.
  s = s.replace(/\\([lL])(\{\})?/g, (_, c) => (c === 'l' ? 'ł' : 'Ł'));
  // \k{e}, {\k{e}}, {\.z}, \'e, {\'S} ... — nested-argument form first.
  s = s.replace(/\{?\\([`'^".ckv])\{([A-Za-z])\}\}?/g, (_, acc, letter) =>
    (LATEX_ACCENTS[acc] && LATEX_ACCENTS[acc][letter]) || letter);
  s = s.replace(/\{\\([`'^".ckv])([A-Za-z])\}/g, (_, acc, letter) =>
    (LATEX_ACCENTS[acc] && LATEX_ACCENTS[acc][letter]) || letter);
  s = s.replace(/\\([`'^".ckv])([A-Za-z])/g, (_, acc, letter) =>
    (LATEX_ACCENTS[acc] && LATEX_ACCENTS[acc][letter]) || letter);
  s = s.replace(/[{}]/g, '');
  return s;
}

function foldDiacritics(str) {
  return str
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l').replace(/Ł/g, 'L')
    .toLowerCase();
}

function parseBibtex(text) {
  const entries = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    if (text[i] === '@') {
      let j = i + 1;
      while (j < n && /[A-Za-z]/.test(text[j])) j++;
      const type = text.slice(i + 1, j).toLowerCase();
      while (j < n && /\s/.test(text[j])) j++;
      if (text[j] !== '{') { i = j; continue; }
      let depth = 1;
      j++;
      const start = j;
      while (j < n && depth > 0) {
        if (text[j] === '{') depth++;
        else if (text[j] === '}') depth--;
        if (depth > 0) j++;
      }
      const body = text.slice(start, j);
      i = j + 1;
      if (type !== 'comment' && type !== 'string' && type !== 'preamble') {
        entries.push(parseEntryBody(type, body));
      }
    } else {
      i++;
    }
  }
  return entries;
}

function parseEntryBody(type, body) {
  const commaIdx = body.indexOf(',');
  const key = (commaIdx >= 0 ? body.slice(0, commaIdx) : body).trim();
  const rest = commaIdx >= 0 ? body.slice(commaIdx + 1) : '';
  const fields = {};
  let k = 0;
  const m = rest.length;
  while (k < m) {
    while (k < m && /[\s,]/.test(rest[k])) k++;
    if (k >= m) break;
    const nameStart = k;
    while (k < m && /[A-Za-z0-9_]/.test(rest[k])) k++;
    const fname = rest.slice(nameStart, k).toLowerCase();
    while (k < m && /\s/.test(rest[k])) k++;
    if (rest[k] !== '=') {
      while (k < m && rest[k] !== ',') k++;
      continue;
    }
    k++;
    while (k < m && /\s/.test(rest[k])) k++;
    let value = '';
    if (rest[k] === '{') {
      let depth = 1;
      k++;
      const vs = k;
      while (k < m && depth > 0) {
        if (rest[k] === '{') depth++;
        else if (rest[k] === '}') depth--;
        if (depth > 0) k++;
      }
      value = rest.slice(vs, k);
      k++;
    } else if (rest[k] === '"') {
      k++;
      const vs = k;
      while (k < m && rest[k] !== '"') k++;
      value = rest.slice(vs, k);
      k++;
    } else {
      const vs = k;
      while (k < m && rest[k] !== ',') k++;
      value = rest.slice(vs, k).trim();
    }
    if (fname) fields[fname] = value;
    while (k < m && /\s/.test(rest[k])) k++;
    if (rest[k] === ',') k++;
  }
  return { type, key, fields };
}

function formatAuthor(raw) {
  const decoded = decodeLatex(raw.trim());
  let last, first;
  if (decoded.includes(',')) {
    [last, first] = decoded.split(',').map((s) => s.trim());
  } else {
    const parts = decoded.split(/\s+/);
    last = parts.pop();
    first = parts.join(' ');
  }
  const initials = first
    ? first.split(/[\s.-]+/).filter(Boolean).map((w) => w[0].toUpperCase() + '.').join(' ')
    : '';
  return { text: initials ? `${initials} ${last}` : last, surname: last };
}

function venueOf(fields, type) {
  if (fields.journal) return decodeLatex(fields.journal);
  if (fields.booktitle) return decodeLatex(fields.booktitle);
  if (type === 'phdthesis') return 'PhD thesis';
  return '';
}

function linksOf(fields) {
  const links = [];
  if (fields.url) {
    const url = fields.url.trim();
    let label = 'PDF';
    if (/arxiv\.org/i.test(url)) label = 'arXiv';
    else if (/openreview\.net/i.test(url)) label = 'OpenReview';
    links.push({ label, href: url });
  }
  if (fields.doi) {
    let doi = fields.doi.trim().replace(/^ttps:\/\//, 'https://');
    if (!/^https?:\/\//i.test(doi)) doi = 'https://doi.org/' + doi.replace(/^doi:/i, '');
    links.push({ label: 'DOI', href: doi });
  }
  return links;
}

function buildEntry(entry) {
  const li = document.createElement('li');
  const f = entry.fields;

  const title = document.createElement('span');
  title.className = 'pub-title';
  title.textContent = decodeLatex(f.title || '(untitled)');
  li.appendChild(title);

  const authorsEl = document.createElement('span');
  authorsEl.className = 'pub-authors';
  if (f.author) {
    const names = f.author.split(/\s+and\s+/i).map(formatAuthor);
    names.forEach((name, idx) => {
      if (idx > 0) authorsEl.appendChild(document.createTextNode(', '));
      const isOwn = OWN_SURNAMES.includes(foldDiacritics(name.surname));
      const node = document.createElement(isOwn ? 'strong' : 'span');
      node.textContent = name.text;
      authorsEl.appendChild(node);
    });
  }
  li.appendChild(authorsEl);

  const venueEl = document.createElement('span');
  venueEl.className = 'pub-venue';
  const venue = venueOf(f, entry.type);
  const year = f.year || '';
  venueEl.appendChild(document.createTextNode([venue, year].filter(Boolean).join(', ')));
  const links = linksOf(f);
  links.forEach((link) => {
    venueEl.appendChild(document.createTextNode(' · '));
    const a = document.createElement('a');
    a.href = link.href;
    a.textContent = link.label;
    venueEl.appendChild(a);
  });
  li.appendChild(venueEl);

  return li;
}

function isSelected(fields) {
  const v = (fields.selected || '').trim().toLowerCase();
  return v !== '' && v !== 'false' && v !== '0' && v !== 'no';
}

function sortEntries(entries) {
  return entries
    .map((e, idx) => ({ e, idx, year: parseInt(e.fields.year, 10) || 0 }))
    .sort((a, b) => b.year - a.year || a.idx - b.idx)
    .map((x) => x.e);
}

const DEFAULT_VISIBLE_COUNT = 10;

function renderPubs(list, entries) {
  const sorted = sortEntries(entries);
  const anySelected = sorted.some((e) => isSelected(e.fields));

  list.innerHTML = '';

  const shown = anySelected
    ? sorted.filter((e) => isSelected(e.fields))
    : sorted.slice(0, DEFAULT_VISIBLE_COUNT);
  const rest = anySelected
    ? sorted.filter((e) => !isSelected(e.fields))
    : sorted.slice(DEFAULT_VISIBLE_COUNT);

  shown.forEach((entry) => list.appendChild(buildEntry(entry)));

  if (rest.length) {
    const moreBtn = document.createElement('button');
    moreBtn.type = 'button';
    moreBtn.className = 'pubs-more';
    moreBtn.textContent = 'Show remaining publications';
    moreBtn.addEventListener('click', () => {
      rest.forEach((entry) => list.appendChild(buildEntry(entry)));
      moreBtn.remove();
    });
    list.insertAdjacentElement('afterend', moreBtn);
  }
}

async function init() {
  const list = document.getElementById('pubs-list');
  if (!list) return;
  try {
    const res = await fetch('pubs.bib');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    const entries = parseBibtex(text);
    if (!entries.length) throw new Error('no entries found in pubs.bib');
    renderPubs(list, entries);
  } catch (err) {
    list.innerHTML = '';
    const li = document.createElement('li');
    li.className = 'pubs-error';
    li.textContent = 'Could not load publications from pubs.bib (' + err.message + '). See Google Scholar instead.';
    list.appendChild(li);
    console.error('pubs.js:', err);
  }
}

document.addEventListener('DOMContentLoaded', init);
