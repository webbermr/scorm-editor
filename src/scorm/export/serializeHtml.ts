// Serialize a slide's content model to LMS-ready, self-contained HTML.

import type { Block, Course, Slide } from '@/types/course';

export const esc = (s: string): string =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Maps an exported media path for an image block, or '' for placeholders. */
export type MediaRef = (block: Extract<Block, { type: 'image' }>) => string;

function blocksToHtml(slide: Slide, mediaRef: MediaRef): string {
  const out: string[] = [];
  for (const b of slide.blocks ?? []) {
    switch (b.type) {
      case 'eyebrow':
        out.push(`<p class="eyebrow">${esc(b.text)}</p>`);
        break;
      case 'heading':
        out.push(`<h1>${esc(b.text)}</h1>`);
        break;
      case 'paragraph':
        out.push(`<p>${esc(b.text)}</p>`);
        break;
      case 'list':
        out.push(`<ul class="cw-list">${b.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`);
        break;
      case 'image': {
        const src = mediaRef(b);
        const img = src ? `<img src="${esc(src)}" alt="${esc(b.alt ?? '')}" />` : `<div class="cw-image-placeholder">Image</div>`;
        out.push(`<figure>${img}${b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ''}</figure>`);
        break;
      }
      case 'callout':
        out.push(`<aside class="callout callout-${b.tone}"><strong>${esc(b.title)}</strong><p>${esc(b.text)}</p></aside>`);
        break;
      case 'video':
        out.push(`<div class="cw-video"><div class="cw-video-poster">▶</div><p class="cw-video-cap">${esc(b.title)}${b.required ? ' · required' : ''} · ${esc(b.length)}</p></div>`);
        break;
      case 'rawHtml':
        out.push(`<div class="cw-raw">${b.html}</div>`);
        break;
    }
  }
  return out.join('\n      ');
}

function quizToHtml(slide: Slide, passingScore: number): string {
  const quiz = slide.quiz!;
  const data = {
    feedback: quiz.feedback,
    passingScore,
    questions: quiz.questions.map((q) => ({
      id: q.id,
      correct: q.options.find((o) => o.correct)?.id ?? '',
      feedbackCorrect: q.feedbackCorrect ?? '',
      feedbackIncorrect: q.feedbackIncorrect ?? '',
    })),
  };
  const questions = quiz.questions
    .map(
      (q, qi) => `
      <div class="cw-q" data-qid="${esc(q.id)}">
        <div class="cw-q-head"><span class="cw-q-chip">Q${qi + 1}</span><span>${esc(q.text)}</span></div>
        <div class="cw-options">
          ${q.options
            .map((o) => `<button class="cw-opt" data-qid="${esc(q.id)}" data-oid="${esc(o.id)}" data-correct="${o.correct}">${esc(o.text)}</button>`)
            .join('\n          ')}
        </div>
        <div class="cw-feedback" hidden></div>
      </div>`,
    )
    .join('\n');
  return `
      <h1>${esc(quiz.prompt)}</h1>
      <p class="cw-instruction">${esc(quiz.instruction)}</p>
      <form id="cw-quiz" data-quiz='${esc(JSON.stringify(data))}'>
        ${questions}
        <button type="button" id="cw-submit" class="cw-btn" disabled>Submit answers</button>
        <div id="cw-score" class="cw-score" hidden></div>
      </form>`;
}

function branchingToHtml(slide: Slide): string {
  const sc = slide.scenario!;
  const choices = sc.choices
    .map(
      (ch, i) => `
      <div class="cw-choice">
        <button class="cw-choice-btn" data-outcome="${esc(ch.outcome)}"><span class="cw-letter">${String.fromCharCode(65 + i)}</span><span>${esc(ch.text)}</span></button>
        <div class="cw-outcome cw-outcome-${esc(ch.outcome)}" hidden>${esc(ch.result)}</div>
      </div>`,
    )
    .join('\n');
  return `
      <p class="cw-pill">Branching scenario</p>
      <h1 class="cw-setup">${esc(sc.setup)}</h1>
      <div class="cw-choices">${choices}</div>`;
}

export function slideToHtml(slide: Slide, course: Course, mediaRef: MediaRef, extraHtml = ''): string {
  let body: string;
  let scriptName: string | null = null;
  if (slide.type === 'quiz' && slide.quiz) {
    body = quizToHtml(slide, course.meta.passingScore);
    scriptName = 'quiz';
  } else if (slide.type === 'branching' && slide.scenario) {
    body = branchingToHtml(slide);
    scriptName = 'branching';
  } else {
    body = blocksToHtml(slide, mediaRef);
  }

  const bodyClass = slide.type === 'title' ? 'cw-body cw-title' : 'cw-body';
  const inlineScript = scriptName === 'quiz' ? QUIZ_SCRIPT : scriptName === 'branching' ? BRANCHING_SCRIPT : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(slide.name)}</title>
  <link rel="stylesheet" href="assets/styles.css" />
  <script src="assets/scorm_api.js"></script>
</head>
<body>
  <main class="${bodyClass}">
    <div class="cw-content">
      ${body}
      ${extraHtml}
    </div>
  </main>
  ${inlineScript ? `<script>${inlineScript}</script>` : ''}
  <script>window.addEventListener('load',function(){if(window.CW_SCORM)CW_SCORM.init();});window.addEventListener('unload',function(){if(window.CW_SCORM)CW_SCORM.finish();});</script>
</body>
</html>`;
}

/** Render extracted source media (images + narration audio) as an editable-looking block. */
export function mediaSectionHtml(images: string[], audio: string[]): string {
  if (!images.length && !audio.length) return '';
  const imgs = images.map((src) => `<figure class="cw-media-fig"><img src="${esc(src)}" alt="" loading="lazy" /></figure>`).join('\n      ');
  const auds = audio
    .map((src) => `<div class="cw-audio"><span class="cw-audio-label">▶ Narration</span><audio controls preload="none" src="${esc(src)}"></audio></div>`)
    .join('\n      ');
  return `<div class="cw-media">
      ${imgs}
      ${auds}
    </div>`;
}

// ---- shared assets ----

export const SHARED_CSS = `:root{--accent:#6d4ee0;--accent-soft:#efe9ff;--ink:#2a2620;--ink-2:#5c554b;--ink-3:#8c8377;--paper:#f5f1ea;--surface:#fff;--surface-2:#faf7f2;--line:#e7e0d5;--green:#2f9e63;--green-soft:#e3f4ea;--rose:#d6504e;--rose-soft:#fbe6e5;--amber:#d98a2b;--amber-soft:#fbeed8;--blue:#2f7fd9;--blue-soft:#e3eefb;}
*{box-sizing:border-box}body{margin:0;font-family:'Hanken Grotesk',system-ui,sans-serif;background:var(--paper);color:var(--ink)}
.cw-body{max-width:820px;margin:0 auto;padding:48px 28px}.cw-title .cw-content{text-align:center}
.cw-content{display:flex;flex-direction:column;gap:18px}
h1{font-family:'Bricolage Grotesque',system-ui,sans-serif;font-size:34px;letter-spacing:-.02em;margin:0}
.cw-title h1{font-size:46px}
p{font-size:17px;line-height:1.6;color:var(--ink-2);margin:0;max-width:62ch}
.eyebrow{font-size:12.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--accent)}
.cw-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:11px}
.cw-list li{position:relative;padding-left:34px;font-size:16.5px;line-height:1.5;color:var(--ink)}
.cw-list li::before{content:'✓';position:absolute;left:0;top:0;width:22px;height:22px;border-radius:7px;background:var(--accent-soft);color:var(--accent);display:grid;place-items:center;font-size:13px;font-weight:700}
figure{margin:0}figure img{width:100%;border-radius:16px;display:block}
figcaption{font-size:13px;color:var(--ink-3);margin-top:8px;font-style:italic}
.cw-image-placeholder{width:100%;aspect-ratio:16/9;border-radius:16px;background:linear-gradient(135deg,#6d4ee0,#9b6cff);display:grid;place-items:center;color:#fff;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.callout{display:flex;flex-direction:column;gap:4px;padding:16px;border-radius:16px}
.callout-info{background:var(--blue-soft);border:1px solid rgba(47,127,217,.22)}
.callout-warning{background:var(--amber-soft);border:1px solid rgba(217,138,43,.22)}
.callout strong{font-size:15px}.callout p{font-size:14.5px}
.cw-video{position:relative}.cw-video-poster{aspect-ratio:16/9;border-radius:16px;background:linear-gradient(135deg,#1c1a26,#3a2f4d);display:grid;place-items:center;color:#fff;font-size:40px}
.cw-video-cap{font-size:13px;color:var(--ink-3);margin-top:8px}
.cw-instruction{font-size:15.5px;color:var(--ink-2)}
.cw-q{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:20px;margin:16px 0}
.cw-q-head{display:flex;gap:10px;align-items:flex-start;margin-bottom:14px;font-size:16.5px;font-weight:600}
.cw-q-chip{font-family:'Space Mono',monospace;font-size:12px;font-weight:700;color:var(--accent);background:var(--accent-soft);padding:3px 8px;border-radius:7px}
.cw-options{display:flex;flex-direction:column;gap:9px}
.cw-opt{text-align:left;padding:11px 13px;border-radius:12px;background:var(--surface);border:1.5px solid var(--line);font-size:15px;cursor:pointer}
.cw-opt.sel{background:var(--accent-soft);border-color:var(--accent)}
.cw-opt.correct{background:var(--green-soft);border-color:var(--green);color:var(--green);font-weight:600}
.cw-opt.wrong{background:var(--rose-soft);border-color:var(--rose);color:var(--rose)}
.cw-feedback{margin-top:13px;font-size:14px;padding:10px 13px;border-radius:12px;background:var(--green-soft);color:var(--ink-2)}
.cw-btn{margin-top:8px;padding:0 16px;height:40px;border-radius:12px;background:var(--accent);color:#fff;font-weight:600;font-size:14px;cursor:pointer;border:none}
.cw-btn:disabled{opacity:.5;cursor:default}
.cw-score{margin-top:16px;padding:14px 18px;border-radius:16px;font-weight:700}
.cw-score.pass{background:var(--green-soft);color:var(--green)}.cw-score.fail{background:var(--rose-soft);color:var(--rose)}
.cw-pill{display:inline-block;padding:5px 12px;border-radius:99px;background:var(--accent-soft);color:var(--accent);font-size:12.5px;font-weight:700}
.cw-setup{font-size:26px;max-width:40ch}
.cw-choices{display:flex;flex-direction:column;gap:11px}
.cw-choice-btn{display:flex;gap:13px;align-items:center;width:100%;text-align:left;padding:15px 17px;border-radius:16px;background:var(--surface);border:1.5px solid var(--line);font-size:15.5px;cursor:pointer}
.cw-letter{width:30px;height:30px;border-radius:9px;background:var(--surface-2);display:grid;place-items:center;font-family:'Space Mono',monospace;font-weight:700}
.cw-outcome{margin-top:9px;padding:13px 16px;border-radius:12px;font-size:14.5px}
.cw-outcome-correct{background:var(--green-soft)}.cw-outcome-partial{background:var(--amber-soft)}.cw-outcome-incorrect{background:var(--rose-soft)}
.cw-raw{border:1px solid var(--line);border-radius:12px;padding:16px;background:var(--surface-2)}
.cw-media{display:flex;flex-direction:column;gap:16px;margin-top:8px}
.cw-media-fig{margin:0}.cw-media-fig img{width:100%;max-width:760px;border-radius:16px;display:block;box-shadow:0 2px 6px rgba(42,38,32,.08)}
.cw-audio{display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:var(--surface-2)}
.cw-audio-label{font-size:13px;font-weight:700;color:var(--accent)}.cw-audio audio{flex:1}`;

export const QUIZ_SCRIPT = `(function(){var f=document.getElementById('cw-quiz');if(!f)return;var cfg=JSON.parse(f.getAttribute('data-quiz'));var ans={};var submit=document.getElementById('cw-submit');
f.querySelectorAll('.cw-opt').forEach(function(b){b.addEventListener('click',function(){if(f.dataset.done)return;var q=b.dataset.qid;ans[q]=b.dataset.oid;f.querySelectorAll('.cw-opt[data-qid="'+q+'"]').forEach(function(x){x.classList.remove('sel')});b.classList.add('sel');if(Object.keys(ans).length>=cfg.questions.length)submit.disabled=false;});});
submit.addEventListener('click',function(){f.dataset.done='1';var ok=0;cfg.questions.forEach(function(q){var chosen=ans[q.id];f.querySelectorAll('.cw-opt[data-qid="'+q.id+'"]').forEach(function(x){if(x.dataset.oid===q.correct)x.classList.add('correct');else if(x.dataset.oid===chosen)x.classList.add('wrong');});var fb=f.querySelector('.cw-q[data-qid="'+q.id+'"] .cw-feedback');if(cfg.feedback&&fb){fb.hidden=false;fb.textContent=(chosen===q.correct)?q.feedbackCorrect:q.feedbackIncorrect;}if(chosen===q.correct)ok++;});var pct=Math.round(ok/cfg.questions.length*100);var pass=pct>=cfg.passingScore;var s=document.getElementById('cw-score');s.hidden=false;s.className='cw-score '+(pass?'pass':'fail');s.textContent=pct+'% — '+(pass?'Passed':'Not yet')+' (need '+cfg.passingScore+'%)';submit.disabled=true;if(window.CW_SCORM)CW_SCORM.setScore(pct,pass);});})();`;

export const BRANCHING_SCRIPT = `(function(){document.querySelectorAll('.cw-choice-btn').forEach(function(b){b.addEventListener('click',function(){var o=b.parentNode.querySelector('.cw-outcome');document.querySelectorAll('.cw-outcome').forEach(function(x){x.hidden=true});if(o)o.hidden=false;if(window.CW_SCORM)CW_SCORM.setComplete();});});})();`;

export function scormApiJs(version: '1.2' | '2004'): string {
  // Minimal runtime SCORM API discovery + reporting wrapper.
  if (version === '1.2') {
    return `window.CW_SCORM=(function(){var api=null;function find(w){var n=0;while(w&&!w.API&&w.parent&&w.parent!==w&&n++<10)w=w.parent;return w&&w.API||null;}try{api=find(window);if(!api&&window.opener)api=find(window.opener);}catch(e){}return{init:function(){if(api){api.LMSInitialize('');api.LMSSetValue('cmi.core.lesson_status','incomplete');api.LMSCommit('');}},setScore:function(p,pass){if(api){api.LMSSetValue('cmi.core.score.raw',String(p));api.LMSSetValue('cmi.core.lesson_status',pass?'passed':'failed');api.LMSCommit('');}},setComplete:function(){if(api){api.LMSSetValue('cmi.core.lesson_status','completed');api.LMSCommit('');}},finish:function(){if(api){api.LMSFinish('');}}};})();`;
  }
  return `window.CW_SCORM=(function(){var api=null;function find(w){var n=0;while(w&&!w.API_1484_11&&w.parent&&w.parent!==w&&n++<10)w=w.parent;return w&&w.API_1484_11||null;}try{api=find(window);if(!api&&window.opener)api=find(window.opener);}catch(e){}return{init:function(){if(api){api.Initialize('');api.SetValue('cmi.completion_status','incomplete');api.Commit('');}},setScore:function(p,pass){if(api){api.SetValue('cmi.score.scaled',String(p/100));api.SetValue('cmi.score.raw',String(p));api.SetValue('cmi.success_status',pass?'passed':'failed');api.SetValue('cmi.completion_status','completed');api.Commit('');}},setComplete:function(){if(api){api.SetValue('cmi.completion_status','completed');api.Commit('');}},finish:function(){if(api){api.Terminate('');}}};})();`;
}
