// Quiz + branching scenario renderers. Interactive in Preview, editable in Edit.

function QuizView({ slide, editing, onPatch }) {
  const quiz = slide.quiz;
  const [answers, setAnswers] = React.useState({}); // qid -> oid (preview)
  const [submitted, setSubmitted] = React.useState(false);

  React.useEffect(() => { setAnswers({}); setSubmitted(false); }, [slide.id]);

  const patchQuiz = (patch) => onPatch({ quiz: { ...quiz, ...patch } });
  const patchQ = (qid, patch) =>
    patchQuiz({ questions: quiz.questions.map((q) => (q.id === qid ? { ...q, ...patch } : q)) });

  const score = () => {
    let ok = 0;
    quiz.questions.forEach((q) => {
      const correct = q.options.find((o) => o.correct);
      if (correct && answers[q.id] === correct.id) ok++;
    });
    return Math.round((ok / quiz.questions.length) * 100);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <EditText tag="h2" editing={editing} onCommit={(t) => patchQuiz({ prompt: t })} html={quiz.prompt}
          style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 700, letterSpacing: '-.02em', margin: '0 0 6px' }} />
        <EditText tag="p" editing={editing} onCommit={(t) => patchQuiz({ instruction: t })} html={quiz.instruction}
          style={{ fontSize: 15.5, color: 'var(--ink-2)', margin: 0 }} />
      </div>

      {quiz.questions.map((q, qi) => {
        const answered = answers[q.id];
        return (
          <div key={q.id} className="card" style={{ padding: 20, animation: 'riseIn .3s ease-out' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 14 }}>
              <span style={{ flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-soft)', padding: '3px 8px', borderRadius: 7 }}>Q{qi + 1}</span>
              <EditText tag="div" editing={editing} onCommit={(t) => patchQ(q.id, { text: t })} html={q.text}
                style={{ fontSize: 16.5, fontWeight: 600, lineHeight: 1.45, flex: 1 }} />
              {editing && quiz.questions.length > 1 && (
                <button className="btn btn-sm btn-icon btn-danger tip" data-tip="Delete question"
                  onClick={() => patchQuiz({ questions: quiz.questions.filter((x) => x.id !== q.id) })}>
                  <Icon name="trash" size={15} />
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {q.options.map((o) => {
                const chosen = answered === o.id;
                const showState = !editing && submitted;
                let bg = 'var(--surface)', bd = 'var(--line)', tint = 'var(--ink)';
                if (showState && o.correct) { bg = 'var(--green-soft)'; bd = 'var(--green)'; tint = 'var(--green)'; }
                else if (showState && chosen && !o.correct) { bg = 'var(--rose-soft)'; bd = 'var(--rose)'; tint = 'var(--rose)'; }
                else if (!editing && chosen) { bg = 'var(--accent-soft)'; bd = 'var(--accent)'; }
                return (
                  <div key={o.id}
                    onClick={!editing && !submitted ? () => setAnswers((a) => ({ ...a, [q.id]: o.id })) : undefined}
                    style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', borderRadius: 'var(--r-md)',
                      background: bg, border: `1.5px solid ${bd}`, cursor: !editing && !submitted ? 'pointer' : 'default',
                      transition: 'background .15s, border-color .15s' }}>
                    {/* correctness control / radio */}
                    {editing ? (
                      <button onClick={() => patchQ(q.id, { options: q.options.map((x) => ({ ...x, correct: x.id === o.id })) })}
                        className="tip" data-tip={o.correct ? 'Correct answer' : 'Mark correct'}
                        style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 99, display: 'grid', placeItems: 'center',
                          border: `2px solid ${o.correct ? 'var(--green)' : 'var(--line-strong)'}`, background: o.correct ? 'var(--green)' : 'transparent', color: '#fff' }}>
                        {o.correct && <Icon name="check" size={12} stroke={3} />}
                      </button>
                    ) : (
                      <span style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 99, border: `2px solid ${chosen ? bd : 'var(--line-strong)'}`,
                        background: chosen ? bd : 'transparent', display: 'grid', placeItems: 'center', color: '#fff' }}>
                        {showState && o.correct && <Icon name="check" size={11} stroke={3} />}
                        {chosen && !showState && <span style={{ width: 8, height: 8, borderRadius: 99, background: '#fff' }} />}
                      </span>
                    )}
                    <span contentEditable={editing} suppressContentEditableWarning spellCheck={false}
                      onBlur={editing ? (e) => patchQ(q.id, { options: q.options.map((x) => (x.id === o.id ? { ...x, text: e.target.innerText } : x)) }) : undefined}
                      style={{ flex: 1, fontSize: 15, color: tint, fontWeight: showState && o.correct ? 600 : 500 }}>{o.text}</span>
                    {editing && q.options.length > 2 && (
                      <button className="btn btn-sm btn-icon btn-ghost" onClick={() => patchQ(q.id, { options: q.options.filter((x) => x.id !== o.id) })}>
                        <Icon name="close" size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
              {editing && (
                <button className="btn btn-sm btn-ghost" style={{ alignSelf: 'flex-start', marginTop: 2 }}
                  onClick={() => patchQ(q.id, { options: [...q.options, { id: window.makeId(), text: 'New option', correct: false }] })}>
                  <Icon name="plus" size={14} /> Add option
                </button>
              )}
            </div>

            {!editing && submitted && quiz.feedback && q.feedbackCorrect && (
              <div style={{ marginTop: 13, fontSize: 14, lineHeight: 1.5, padding: '10px 13px', borderRadius: 'var(--r-md)',
                background: answers[q.id] === q.options.find((o) => o.correct)?.id ? 'var(--green-soft)' : 'var(--amber-soft)',
                color: 'var(--ink-2)' }}>
                {answers[q.id] === q.options.find((o) => o.correct)?.id ? q.feedbackCorrect : q.feedbackIncorrect}
              </div>
            )}
          </div>
        );
      })}

      {editing ? (
        <button className="btn btn-soft" style={{ alignSelf: 'flex-start' }}
          onClick={() => patchQuiz({ questions: [...quiz.questions, { id: window.makeId(), text: 'New question?', options: [{ id: window.makeId(), text: 'Option A', correct: true }, { id: window.makeId(), text: 'Option B', correct: false }] }] })}>
          <Icon name="plus" size={15} /> Add question
        </button>
      ) : !submitted ? (
        <button className="btn btn-primary"
          disabled={Object.keys(answers).length < quiz.questions.length}
          onClick={() => setSubmitted(true)}
          style={{ alignSelf: 'flex-start', opacity: Object.keys(answers).length < quiz.questions.length ? .5 : 1 }}>
          Submit answers <Icon name="arrowRight" size={16} />
        </button>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 'var(--r-lg)',
          background: score() >= 80 ? 'var(--green-soft)' : 'var(--rose-soft)', alignSelf: 'flex-start' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, color: score() >= 80 ? 'var(--green)' : 'var(--rose)' }}>{score()}%</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>{score() >= 80 ? 'Passed' : 'Not yet — try again'}</div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>Passing score is 80%</div>
          </div>
          <button className="btn btn-sm btn-soft" onClick={() => { setAnswers({}); setSubmitted(false); }} style={{ marginLeft: 8 }}>
            <Icon name="refresh" size={14} /> Retry
          </button>
        </div>
      )}
    </div>
  );
}

function BranchingView({ slide, editing, onPatch }) {
  const sc = slide.scenario;
  const [picked, setPicked] = React.useState(null);
  React.useEffect(() => { setPicked(null); }, [slide.id]);
  const patchSc = (patch) => onPatch({ scenario: { ...sc, ...patch } });
  const tones = { correct: ['green', 'Best choice'], partial: ['amber', 'Risky'], incorrect: ['rose', 'Unsafe'] };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, alignSelf: 'flex-start', padding: '5px 12px', borderRadius: 99, background: 'var(--accent-soft)', color: 'var(--accent-ink)', fontSize: 12.5, fontWeight: 700 }}>
        <Icon name="branching" size={15} /> Branching scenario
      </div>
      <EditText tag="div" editing={editing} onCommit={(t) => patchSc({ setup: t })} html={sc.setup}
        style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, lineHeight: 1.3, letterSpacing: '-.01em', maxWidth: '40ch' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        {sc.choices.map((ch, i) => {
          const [tone, lbl] = tones[ch.outcome] || tones.partial;
          const active = picked === ch.id;
          return (
            <div key={ch.id}>
              <div onClick={!editing ? () => setPicked(ch.id) : undefined}
                style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '15px 17px', borderRadius: 'var(--r-lg)', cursor: editing ? 'default' : 'pointer',
                  background: active ? `var(--${tone}-soft)` : 'var(--surface)', border: `1.5px solid ${active ? `var(--${tone})` : 'var(--line)'}`,
                  transition: 'all .15s', boxShadow: 'var(--sh-sm)' }}>
                <span style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 9, background: 'var(--surface-sunk)', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-mono)' }}>{String.fromCharCode(65 + i)}</span>
                <span contentEditable={editing} suppressContentEditableWarning spellCheck={false}
                  onBlur={editing ? (e) => patchSc({ choices: sc.choices.map((x) => (x.id === ch.id ? { ...x, text: e.target.innerText } : x)) }) : undefined}
                  style={{ flex: 1, fontSize: 15.5, fontWeight: 500 }}>{ch.text}</span>
                {editing && (
                  <select value={ch.outcome} onChange={(e) => patchSc({ choices: sc.choices.map((x) => (x.id === ch.id ? { ...x, outcome: e.target.value } : x)) })}
                    className="field" style={{ width: 'auto', padding: '5px 8px', fontSize: 12.5, height: 'auto' }} onClick={(e) => e.stopPropagation()}>
                    <option value="correct">Best</option><option value="partial">Risky</option><option value="incorrect">Unsafe</option>
                  </select>
                )}
              </div>
              {!editing && active && (
                <div style={{ marginTop: 9, padding: '13px 16px', borderRadius: 'var(--r-md)', background: `var(--${tone}-soft)`, border: `1px solid color-mix(in srgb, var(--${tone}) 25%, transparent)`, animation: 'riseIn .25s ease-out' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: 13, color: `var(--${tone})`, marginBottom: 4 }}>
                    <Icon name={ch.outcome === 'correct' ? 'check' : 'warning'} size={15} /> {lbl}
                  </div>
                  <div style={{ fontSize: 14.5, lineHeight: 1.5, color: 'var(--ink-2)' }}>{ch.result}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { QuizView, BranchingView });
