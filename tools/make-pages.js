// Re.move: writes the ten activity pages (atv.html … paragliding.html) next to index.html.
// Each one is index.html itself under that activity's title, description and address, so …/remove-webzine/pottery
// (…/team2/pottery.html at 한경) opens the activity straight away; the page reads which one from its own address.
// Run it again after every change to index.html:  node tools/make-pages.js
'use strict';
const fs = require('fs'), path = require('path');

const DIR = path.join(__dirname, '..');
const HK = 'https://lxwebzine.hankyung.com/2026-1/team2/';   // the official copy (index.html's canonical); it needs the .html
const src = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');

const pick = (re, what) => { const m = src.match(re); if (!m) throw new Error('index.html: no ' + what); return JSON.parse(m[1]); };
const SLUG = pick(/^const SLUG = (\{.*\});$/m, 'SLUG');
const ACTS = pick(/^const ACTS = (\[.*\]);$/m, 'ACTS');

const one = s => String(s ?? '').replace(/\s*\n\s*/g, ' ').trim();
const attr = s => one(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const text = s => one(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const json = s => JSON.stringify(one(s)).slice(1, -1);
const stop = s => /[.?!…]$/.test(s) ? s : s + '.';

// each swap must find its text exactly once, so a change to index.html's <head> stops this here, not in a page
function swap(html, re, to, what) {
  const n = (html.match(new RegExp(re.source, 'g')) || []).length;
  if (n !== 1) throw new Error('index.html: ' + what + ' found ' + n + ' times');
  return html.replace(re, to);
}

let made = 0;
for (const a of ACTS) {
  const slug = SLUG[a.n]; if (!slug) continue;
  const name = one(a.ko), title = name + ' | Re.move', url = HK + slug + '.html';
  const why = (a.why || []).map(w => stop(one(w.text))).join(' ');
  const desc = a.moods.join(' · ') + '인 날 어울리는 제주 액티비티, ' + name + '. ' + why;
  const share = stop(one(a.hook)) + ' ' + stop(one((a.why || [])[0]?.text || ''));
  let html = src;
  html = swap(html, /<title>[^<]*<\/title>/, '<title>' + text(title) + '</title>', '<title>');
  html = swap(html, /(<meta name="description" content=")[^"]*(")/, '$1' + attr(desc) + '$2', 'description');
  html = swap(html, /(<link rel="canonical" href=")[^"]*(")/, '$1' + url + '$2', 'canonical');
  html = swap(html, /(<meta property="og:title" content=")[^"]*(")/, '$1' + attr(title) + '$2', 'og:title');
  html = swap(html, /(<meta property="og:description" content=")[^"]*(")/, '$1' + attr(share) + '$2', 'og:description');
  html = swap(html, /(<meta property="og:url" content=")[^"]*(")/, '$1' + url + '$2', 'og:url');
  html = swap(html, /("headline": ")[^"]*(")/, '$1' + json(title) + '$2', 'ld+json headline');
  html = swap(html, /("mainEntityOfPage": ")[^"]*(")/, '$1' + url + '$2', 'ld+json mainEntityOfPage');
  fs.writeFileSync(path.join(DIR, slug + '.html'), html);
  made++;
  console.log(slug + '.html  ' + title);
}
console.log(made + ' pages');
