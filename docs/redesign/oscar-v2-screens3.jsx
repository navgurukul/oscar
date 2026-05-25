// oscar-v2-screens3.jsx — Wave 3: the rest of the product.
// Daily-driver gaps · Teams workspace · Account/data flows ·
// Mobile capture flow · Desktop context labels + states + update ·
// Legal template · Remaining overlays.

const v2          = window.v2;
const v2Sans      = window.v2Sans;
const v2Serif     = window.v2Serif;
const v2Mono      = window.v2Mono;
const V2Mono      = window.V2Mono;
const V2Caps      = window.V2Caps;
const V2Wordmark  = window.V2Wordmark;
const V2Avatar    = window.V2Avatar;
const V2Source    = window.V2Source;
const V2WebHeader = window.V2WebHeader;
const V2WinChrome = window.V2WinChrome;
const V2DeskSidebar = window.V2DeskSidebar;

// ─── reusable bits ───────────────────────────────────────────────────────
function MonoArrow() {
  return <V2Mono style={{ fontSize: 13, color: v2.inkFaint }}>→</V2Mono>;
}

// ═══ DAILY-DRIVER GAPS ════════════════════════════════════════════════════

// 1. Search results
function V2WebSearchResults() {
  const hits = [
    { d: 'MON · 11:00', s: 'MINUTES · 45m', t: 'Roshni Jha · pricing review',
      ctx: '…they want a team plan with shared Minutes. \u003Cmark\u003EPricing\u003C/mark\u003E-sensitive but not deal-breaker. Two integration asks: Slack channel posting…' },
    { d: 'MON · 17:21', s: 'SCRIBBLE',      t: 'Pricing experiments — what we learned',
      ctx: '…so the big thing from last month is that we ran four \u003Cmark\u003Epricing\u003C/mark\u003E experiments and only two of them actually moved a metric…' },
    { d: 'TUE · 12:18', s: 'NOTION',        t: 'Pricing thoughts on tiers',
      ctx: 'Two tiers feels right. Free needs a real limit so Pro is an obvious next step. \u003Cmark\u003EPricing\u003C/mark\u003E range $12-18/seat acceptable.' },
    { d: 'WED · 09:42', s: 'GMAIL',         t: 'Reply about pricing page rewrite',
      ctx: '…the \u003Cmark\u003Epricing\u003C/mark\u003E page rewrite is ready to ship after Komal’s analytics review. Aiming for next Wednesday.' },
    { d: 'FRI · 14:00', s: 'STANDUP · 27m', t: 'North stars · pricing analytics',
      ctx: '…Roshni pulls \u003Cmark\u003Epricing\u003C/mark\u003E analytics for the last 30 days. Komal preps the team plan spec. Sanjna handles the standup format change.' },
  ];
  function Hit({ d, s, t, ctx }) {
    const parts = ctx.split(/<\/?mark>/);
    return (
      <article className="grid grid-cols-12 gap-10 py-7" style={{ borderTop: `1px solid ${v2.rule}` }}>
        <div className="col-span-2">
          <V2Mono style={{ fontSize: 12, color: v2.ink }}>{d}</V2Mono>
          <div className="mt-1"><V2Source name={s} /></div>
        </div>
        <div className="col-span-10">
          <h3 style={{ fontFamily: v2Serif, fontSize: 22, fontWeight: 500, color: v2.ink, letterSpacing: '-0.01em', lineHeight: 1.25 }}>{t}</h3>
          <p className="mt-2 text-[14px] leading-relaxed" style={{ color: v2.inkSoft, maxWidth: 760 }}>
            {parts.map((p, i) => (i % 2 === 1
              ? <strong key={i} style={{ background: v2.accentSoft, color: v2.ink, padding: '0 3px', borderRadius: 2, fontWeight: 500 }}>{p}</strong>
              : <React.Fragment key={i}>{p}</React.Fragment>))}
          </p>
        </div>
      </article>
    );
  }
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      <V2WebHeader active="LIBRARY" />
      <section className="px-14 pt-16 pb-10">
        <V2Caps>5 RESULTS · IN 86 SCRIBBLES · 0.4 SEC</V2Caps>
        <h1 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 64, lineHeight: 0.98, letterSpacing: '-0.025em', fontWeight: 500 }}>
          Everything you said about<br /><em style={{ fontStyle: 'italic', color: v2.accent }}>&ldquo;pricing&rdquo;</em>.
        </h1>
        <div className="mt-7 flex items-center gap-4 max-w-2xl" style={{ background: v2.cream2, border: `1px solid ${v2.rule}`, borderRadius: 999, padding: '13px 22px' }}>
          <V2Mono style={{ fontSize: 11, color: v2.inkFaint }}>SEARCH</V2Mono>
          <span className="flex-1" style={{ fontSize: 15, color: v2.ink, fontFamily: v2Sans }}>pricing</span>
          <V2Mono style={{ fontSize: 11, color: v2.inkFaint }}>5 hits · clear</V2Mono>
        </div>
      </section>
      <section className="px-14 pb-20">
        {hits.map((h, i) => <Hit key={i} {...h} />)}
      </section>
    </div>
  );
}

// 2. Folder detail
function V2WebFolderDetail() {
  const items = [
    { d: 'MON · 17:21', s: 'SCRIBBLE · 12m', t: 'Pricing experiments — what we learned',  p: '4 experiments. Two won, two didn’t. Push the winners harder next month.' },
    { d: 'TUE · 12:18', s: 'NOTION',          t: 'Pricing thoughts on tiers',               p: 'Two tiers feels right. Free needs a real limit so Pro is an obvious next step.' },
    { d: 'WED · 09:42', s: 'GMAIL',           t: 'Reply about pricing page rewrite',        p: 'Pricing page rewrite is ready to ship after Komal’s analytics review.' },
    { d: 'FRI · 11:30', s: 'STANDUP · 27m',   t: 'Pricing analytics — Roshni’s pull', p: 'Saw a 4-point lift on annual ratio after the save % bump.' },
    { d: 'MON · 11:00', s: 'MINUTES · 45m',   t: 'Roshni Jha · pricing review',             p: 'Team plan with shared Minutes. Two integration asks: Slack, Notion.' },
    { d: 'WED · 16:14', s: 'SCRIBBLE · 4m',   t: 'Pricing page copy variants',              p: 'Three new headlines to test. &ldquo;For teams&rdquo; still the front-runner.' },
    { d: 'THU · 10:02', s: 'GMAIL',           t: 'Forward to legal · refund policy',        p: 'Need legal sign-off on the new annual refund language before push.' },
    { d: 'TUE · 15:48', s: 'CURSOR',          t: 'Pricing JSON schema thoughts',            p: 'Move plan IDs to enums. Tax surcharge calc as a util, not inline.' },
  ];
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      <V2WebHeader active="LIBRARY" />
      <section className="px-14 pt-16 pb-10">
        <V2Caps>LIBRARY · FOLDER</V2Caps>
        <h1 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 84, lineHeight: 0.96, letterSpacing: '-0.025em', fontWeight: 500 }}>
          <em style={{ fontStyle: 'italic', color: v2.accent }}>Pricing</em>.
        </h1>
        <p className="mt-5 max-w-xl text-[16px] leading-relaxed" style={{ color: v2.inkSoft }}>
          12 Scribbles. Across 2 months. Mostly meetings and Cursor notes. Oscar files things here automatically when it hears the word.
        </p>

        <div className="mt-10 flex items-center gap-5" style={{ borderTop: `1px solid ${v2.rule}`, paddingTop: 20 }}>
          <V2Caps>FOLDER · 12 SCRIBBLES · 2H 14M OF AUDIO</V2Caps>
          <span style={{ marginLeft: 'auto', fontSize: 13, color: v2.inkSoft }}>Sorted by recent</span>
          <button className="text-[12px] rounded-full px-4 py-2" style={{ border: `1px solid ${v2.rule}`, color: v2.inkSoft }}>Edit folder</button>
        </div>
      </section>
      <section className="px-14 pb-20">
        {items.map((s, i) => (
          <article key={i} className="grid grid-cols-12 gap-10 py-6" style={{ borderTop: `1px solid ${v2.rule}` }}>
            <div className="col-span-2">
              <V2Mono style={{ fontSize: 12, color: v2.ink }}>{s.d}</V2Mono>
              <div className="mt-1"><V2Source name={s.s} /></div>
            </div>
            <div className="col-span-10">
              <h3 style={{ fontFamily: v2Serif, fontSize: 21, fontWeight: 500, color: v2.ink, letterSpacing: '-0.005em' }}>{s.t}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: v2.inkSoft, maxWidth: 720 }}>{s.p}</p>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

// 3. Empty library
function V2WebLibraryEmpty() {
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <V2WebHeader active="LIBRARY" />
      <main className="flex-1 flex items-center justify-center px-14 pt-10 pb-20">
        <div style={{ maxWidth: 640 }}>
          <V2Caps color={v2.accent}>YOUR LIBRARY · DAY ONE</V2Caps>
          <h1 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 84, lineHeight: 0.96, letterSpacing: '-0.025em', fontWeight: 500 }}>
            Nothing here<br /><em style={{ fontStyle: 'italic', color: v2.accent }}>yet</em>.
          </h1>
          <p className="mt-7 text-[17px] leading-relaxed" style={{ color: v2.inkSoft, maxWidth: 540 }}>
            This is where your Scribbles will live — every dictation, every meeting, every voice note. Make your first one now.
          </p>

          <div className="mt-12 grid grid-cols-3 gap-6">
            {[
              ['01', 'On desktop',  'Hold Ctrl + Space anywhere. Oscar will paste into the app you’re in.'],
              ['02', 'On web',      'Press the big record button. Oscar shapes the result into a Scribble.'],
              ['03', 'In a meeting', 'Click record before your call. Get decisions and actions afterward.'],
            ].map(([n, t, d]) => (
              <article key={n}>
                <V2Mono style={{ fontSize: 11, color: v2.accent, letterSpacing: '0.18em' }}>{n}</V2Mono>
                <h3 className="mt-2" style={{ fontFamily: v2Serif, fontSize: 22, fontWeight: 500, color: v2.ink, letterSpacing: '-0.005em' }}>{t}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: v2.inkSoft }}>{d}</p>
              </article>
            ))}
          </div>

          <div className="mt-12 flex items-center gap-4">
            <button className="rounded-full px-6 py-3.5 text-[14px] font-medium inline-flex items-center gap-2.5" style={{ background: v2.ink, color: v2.cream }}>
              <span className="inline-block rounded-full" style={{ height: 7, width: 7, background: v2.accent }} />
              Make your first Scribble
            </button>
            <a className="text-[13px]" style={{ color: v2.inkSoft }}>Or watch the 90-second tour →</a>
          </div>
        </div>
      </main>
    </div>
  );
}

// 4. Single Minutes — public/share view
function V2WebMinutesShare() {
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      <header className="flex items-center justify-between px-14 py-5" style={{ borderBottom: `1px solid ${v2.rule}` }}>
        <V2Wordmark />
        <V2Caps>SHARED MINUTES · PUBLIC LINK</V2Caps>
        <div className="flex items-center gap-2.5">
          <button className="text-[12px] rounded-full px-4 py-2" style={{ border: `1px solid ${v2.rule}`, color: v2.inkSoft }}>Copy link</button>
          <button className="text-[12px] rounded-full px-4 py-2 font-medium" style={{ background: v2.ink, color: v2.cream }}>Try Oscar free</button>
        </div>
      </header>

      <article className="px-14 py-14 mx-auto" style={{ maxWidth: 1080 }}>
        <V2Caps>SHARED BY SOUVIK DEB · MAY 20 · 13:42 · 27 MIN</V2Caps>
        <h1 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 76, lineHeight: 0.96, letterSpacing: '-0.025em', fontWeight: 500 }}>
          North stars for the quarter — and <em style={{ fontStyle: 'italic', color: v2.accent }}>who&rsquo;s carrying</em> what.
        </h1>

        <div className="mt-9 flex items-center gap-5 flex-wrap">
          {['Souvik Deb', 'Mira Patel', 'Roshni Jha', 'Komal Ahire', 'Sanjna Panwar'].map((a) => (
            <div key={a} className="flex items-center gap-2.5">
              <span style={{ display: 'inline-block', height: 28, width: 28, borderRadius: 999, background: v2.cream2, color: v2.ink, fontFamily: v2Serif, fontWeight: 500, fontSize: 13, textAlign: 'center', lineHeight: '28px' }}>{a[0]}</span>
              <span style={{ fontSize: 13, color: v2.ink }}>{a}</span>
            </div>
          ))}
        </div>

        <section className="mt-14 pt-10" style={{ borderTop: `1px solid ${v2.rule}` }}>
          <V2Caps color={v2.accent}>DECISIONS · 3</V2Caps>
          <ol className="mt-5 space-y-5 max-w-3xl">
            {[
              'Souvik picks up the desktop pill polish for the next two weeks. Settings popover lands by Friday.',
              'Mira drives the Scribble editor redesign — mode toolbar, AI feedback bar, mobile pass.',
              'Standup format shifts to async on Mondays. Live sync on Tuesdays and Thursdays only.',
            ].map((d, i) => (
              <li key={i} className="flex gap-4">
                <V2Mono style={{ fontSize: 12, color: v2.accent }}>0{i + 1}</V2Mono>
                <span style={{ fontFamily: v2Serif, fontSize: 22, lineHeight: 1.45, color: v2.ink, letterSpacing: '-0.005em' }}>{d}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-14 pt-10" style={{ borderTop: `1px solid ${v2.rule}` }}>
          <V2Caps>ACTIONS · 7</V2Caps>
          <ul className="mt-5 grid grid-cols-2 gap-x-12 gap-y-4 max-w-4xl">
            {[
              ['Mira',   'Settings popover spec by Wednesday'],
              ['Roshni', 'Pull pricing analytics for the last 30 days'],
              ['Komal',  'Spec the team plan — start with Minutes sharing'],
              ['Sanjna', 'Move standups to async on Notion'],
              ['Souvik', 'Ship the pill settings popover'],
              ['Mira',   'Mode toolbar spec by Friday'],
              ['Komal',  'Prep the board update doc'],
            ].map(([owner, task], i) => (
              <li key={i} className="flex items-start gap-3 pb-3" style={{ borderBottom: `1px solid ${v2.rule}` }}>
                <span style={{ display: 'inline-block', height: 24, width: 24, borderRadius: 999, background: v2.accentSoft, color: v2.ink, fontFamily: v2Serif, fontSize: 12, textAlign: 'center', lineHeight: '24px', fontWeight: 500, marginTop: 2 }}>{owner[0]}</span>
                <div>
                  <V2Caps>{owner.toUpperCase()}</V2Caps>
                  <div style={{ fontSize: 14, color: v2.ink, marginTop: 2, lineHeight: 1.4 }}>{task}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14 pt-10" style={{ borderTop: `1px solid ${v2.rule}` }}>
          <V2Caps>FOLLOW-UPS</V2Caps>
          <ul className="mt-5 space-y-3 text-[15px] leading-relaxed max-w-2xl" style={{ color: v2.ink, fontFamily: v2Serif }}>
            <li>· Hinglish edge cases — Sanjna collecting examples</li>
            <li>· Linear integration — scope before next sprint</li>
            <li>· Pricing page rewrite — after Komal&rsquo;s analytics review</li>
          </ul>
        </section>

        {/* CTA strip */}
        <div className="mt-20 rounded-2xl p-10" style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}>
          <V2Caps color={v2.accent}>MADE WITH OSCAR</V2Caps>
          <div className="mt-3 flex items-end justify-between gap-8">
            <h2 style={{ fontFamily: v2Serif, fontSize: 36, lineHeight: 1.0, letterSpacing: '-0.025em', fontWeight: 500, maxWidth: 600 }}>
              Your meetings can <em style={{ fontStyle: 'italic', color: v2.accent }}>do this too</em>.
            </h2>
            <button className="rounded-full px-6 py-3.5 text-[14px] font-medium" style={{ background: v2.ink, color: v2.cream, whiteSpace: 'nowrap' }}>Try Oscar free</button>
          </div>
        </div>
      </article>
    </div>
  );
}

// ═══ TEAMS WORKSPACE ══════════════════════════════════════════════════════

function V2TeamHeader({ active, org = 'NavGurukul · Product' }) {
  return (
    <header className="flex items-center justify-between px-14 py-6" style={{ borderBottom: `1px solid ${v2.rule}` }}>
      <div className="flex items-center gap-6">
        <V2Wordmark />
        <div className="flex items-center gap-2.5 rounded-full pl-2 pr-3 py-1" style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}>
          <div style={{ height: 22, width: 22, borderRadius: 5, background: v2.accent, color: v2.cream, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: v2Serif, fontWeight: 500, fontSize: 12 }}>N</div>
          <span style={{ fontSize: 13, color: v2.ink, fontWeight: 500 }}>{org}</span>
          <V2Mono style={{ fontSize: 11, color: v2.inkFaint }}>↓</V2Mono>
        </div>
      </div>
      <nav className="flex items-center gap-8">
        {['FEED', 'DOCS', 'MEMBERS', 'SETTINGS'].map(label =>
          label === active
            ? <span key={label} style={{ fontFamily: v2Mono, fontSize: 11, letterSpacing: '0.18em', color: v2.ink, borderBottom: `1px solid ${v2.ink}`, paddingBottom: 2 }}>{label}</span>
            : <V2Caps key={label}>{label}</V2Caps>
        )}
      </nav>
      <div className="flex items-center gap-3">
        <V2Caps>YOU · SOUVIK</V2Caps>
        <V2Avatar size={32} />
      </div>
    </header>
  );
}

// 5. Team feed
function V2WebTeamFeed() {
  const items = [
    { who: 'Mira Patel',   when: '12 MIN AGO', kind: 'PUBLISHED', what: 'Scribble editor — mode toolbar spec', body: 'A 3-mode picker (Conversational / Coding / Note) with persistent state per app. Hands-off when context-aware kicks in.', tag: 'DOCS' },
    { who: 'Roshni Jha',   when: '38 MIN AGO', kind: 'POSTED',    what: 'Pricing analytics · last 30 days', body: 'Annual ratio is up 4pt since the save percentage bump. Free-to-Pro conversion stable at 8.2%.', tag: 'MINUTES · 12 MIN AGO' },
    { who: 'Komal Ahire',  when: '2 HRS AGO',  kind: 'POSTED',    what: 'Team plan spec — first draft', body: 'Shared Minutes, shared vocabulary, posted to Slack/Notion. $12/seat starting, $18 at 50+ seats.', tag: 'DOCS' },
    { who: 'Sanjna Panwar', when: 'YESTERDAY',  kind: 'COMMENTED', what: 'on Brand voice guide v4',         body: '&ldquo;Can we lock down whether we’re calling it Scribble or Note in the marketing site? Currently inconsistent.&rdquo;', tag: 'COMMENT' },
    { who: 'Souvik Deb',   when: 'YESTERDAY',  kind: 'PUBLISHED', what: 'Standup — north stars for the quarter', body: '3 decisions locked. 7 actions assigned. Standups go async on Mondays.', tag: 'MINUTES · 27 MIN' },
    { who: 'Mira Patel',   when: '2 DAYS AGO', kind: 'JOINED',    what: 'the Product workspace',           body: '', tag: '' },
  ];
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      <V2TeamHeader active="FEED" />
      <div className="grid grid-cols-12 gap-10 px-14 py-14">
        <aside className="col-span-3">
          <V2Caps>WORKSPACE</V2Caps>
          <div className="mt-4 space-y-3 text-[13px]">
            {[
              ['Feed', null, true],
              ['All docs', 24, false],
              ['Minutes', 12, false],
              ['My drafts', 3, false],
            ].map(([label, count, active]) => (
              <div key={label} className="flex items-center justify-between">
                <span style={{ color: active ? v2.ink : v2.inkSoft, fontWeight: active ? 500 : 400 }}>{active && '→ '}{label}</span>
                {count !== null && <V2Mono style={{ fontSize: 11, color: v2.inkFaint }}>{count}</V2Mono>}
              </div>
            ))}
          </div>

          <div className="mt-9 pt-6" style={{ borderTop: `1px solid ${v2.rule}` }}>
            <V2Caps>FOLDERS · WORKSPACE</V2Caps>
            <div className="mt-4 space-y-2 text-[13px]" style={{ color: v2.inkSoft }}>
              <div className="flex justify-between"><span>Pricing</span><V2Mono style={{ fontSize: 11, color: v2.inkFaint }}>8</V2Mono></div>
              <div className="flex justify-between"><span>Brand</span><V2Mono style={{ fontSize: 11, color: v2.inkFaint }}>5</V2Mono></div>
              <div className="flex justify-between"><span>Engineering</span><V2Mono style={{ fontSize: 11, color: v2.inkFaint }}>11</V2Mono></div>
            </div>
          </div>

          <div className="mt-9 pt-6" style={{ borderTop: `1px solid ${v2.rule}` }}>
            <V2Caps>MEMBERS · 12</V2Caps>
            <div className="mt-4 flex flex-wrap gap-2">
              {['S', 'M', 'R', 'K', 'P', 'A', 'D', 'N'].map((l, i) => (
                <span key={i} style={{ display: 'inline-block', height: 26, width: 26, borderRadius: 999, background: v2.cream2, color: v2.ink, fontFamily: v2Serif, fontWeight: 500, fontSize: 12, textAlign: 'center', lineHeight: '26px', border: `1px solid ${v2.rule}` }}>{l}</span>
              ))}
              <span style={{ display: 'inline-block', height: 26, lineHeight: '26px', fontSize: 11, color: v2.inkFaint, fontFamily: v2Mono }}>+4</span>
            </div>
          </div>
        </aside>

        <main className="col-span-9">
          <V2Caps>NAVGURUKUL · PRODUCT · FEED</V2Caps>
          <h1 className="mt-2" style={{ fontFamily: v2Serif, fontSize: 56, lineHeight: 0.98, letterSpacing: '-0.025em', fontWeight: 500 }}>
            What the team <em style={{ fontStyle: 'italic', color: v2.accent }}>shipped</em> today.
          </h1>

          <div className="mt-10">
            {items.map((it, i) => (
              <article key={i} className="grid grid-cols-12 gap-6 py-6" style={{ borderTop: `1px solid ${v2.rule}` }}>
                <div className="col-span-3">
                  <div className="flex items-center gap-2.5">
                    <span style={{ display: 'inline-block', height: 28, width: 28, borderRadius: 999, background: v2.cream2, color: v2.ink, fontFamily: v2Serif, fontWeight: 500, fontSize: 13, textAlign: 'center', lineHeight: '28px' }}>{it.who[0]}</span>
                    <span style={{ fontSize: 13, color: v2.ink }}>{it.who}</span>
                  </div>
                  <V2Caps>{it.when} · {it.kind}</V2Caps>
                </div>
                <div className="col-span-9">
                  <h3 style={{ fontFamily: v2Serif, fontSize: 22, fontWeight: 500, color: v2.ink, letterSpacing: '-0.005em', lineHeight: 1.25 }} dangerouslySetInnerHTML={{ __html: it.what }} />
                  {it.body && <p className="mt-2 text-[14px] leading-relaxed" style={{ color: v2.inkSoft, maxWidth: 720 }} dangerouslySetInnerHTML={{ __html: it.body }} />}
                  {it.tag && <div className="mt-3"><V2Caps>{it.tag}</V2Caps></div>}
                </div>
              </article>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

// 6. Workspace docs list
function V2WebTeamDocs() {
  const docs = [
    { d: 'TUE · 14:08', who: 'Mira',   t: 'Scribble editor — mode toolbar spec',           tags: ['design', 'editor'], folder: 'Engineering', size: '2.4k words', updated: '12 min ago' },
    { d: 'TUE · 11:30', who: 'Komal',  t: 'Team plan spec — first draft',                  tags: ['pricing'],          folder: 'Pricing',     size: '1.8k words', updated: '2 hrs ago' },
    { d: 'MON · 17:21', who: 'Souvik', t: 'Standup — north stars for the quarter',         tags: ['minutes'],          folder: 'Pricing',     size: '780 words',  updated: 'yesterday' },
    { d: 'MON · 11:00', who: 'Souvik', t: 'Roshni Jha · pricing review',                    tags: ['minutes', 'pricing'], folder: 'Pricing',    size: '1.2k words', updated: 'yesterday' },
    { d: 'FRI · 16:00', who: 'Mira',   t: 'Office hours · Mira & Souvik',                   tags: ['minutes'],          folder: 'Engineering', size: '510 words',  updated: '3 days ago' },
    { d: 'THU · 09:30', who: 'Komal',  t: 'Quarterly planning — marketing',                 tags: ['planning'],         folder: 'Brand',       size: '3.1k words', updated: '4 days ago' },
    { d: 'WED · 14:00', who: 'Souvik', t: 'Engineering sync — context-aware phase 6',       tags: ['engineering'],      folder: 'Engineering', size: '2.0k words', updated: '5 days ago' },
    { d: 'TUE · 17:00', who: 'Sanjna', t: 'Brand voice guide v4',                            tags: ['brand', 'voice'],   folder: 'Brand',       size: '4.6k words', updated: '6 days ago' },
    { d: 'TUE · 09:14', who: 'Roshni', t: 'Pricing experiments — running tally',             tags: ['pricing'],          folder: 'Pricing',     size: '1.4k words', updated: '6 days ago' },
    { d: 'MON · 11:21', who: 'Mira',   t: 'Onboarding research · Q2',                        tags: ['research'],         folder: 'Engineering', size: '2.7k words', updated: 'a week ago' },
  ];
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      <V2TeamHeader active="DOCS" />

      <section className="px-14 pt-14 pb-10">
        <V2Caps>WORKSPACE DOCS · 24</V2Caps>
        <h1 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 68, lineHeight: 0.96, letterSpacing: '-0.025em', fontWeight: 500 }}>
          Everything we&rsquo;ve <em style={{ fontStyle: 'italic', color: v2.accent }}>written</em> together.
        </h1>
        <div className="mt-8 flex items-center gap-4">
          <button className="text-[13px] rounded-full px-5 py-2.5 font-medium inline-flex items-center gap-2" style={{ background: v2.ink, color: v2.cream }}>
            + New doc
          </button>
          <span style={{ fontSize: 13, color: v2.ink, borderBottom: `1px solid ${v2.ink}`, paddingBottom: 1 }}>All</span>
          <span style={{ fontSize: 13, color: v2.inkSoft }}>Pricing</span>
          <span style={{ fontSize: 13, color: v2.inkSoft }}>Brand</span>
          <span style={{ fontSize: 13, color: v2.inkSoft }}>Engineering</span>
          <span style={{ marginLeft: 'auto', fontSize: 13, color: v2.inkSoft }}>Sorted by recent</span>
        </div>
      </section>

      <section className="px-14 pb-20">
        {docs.map((doc, i) => (
          <article key={i} className="grid grid-cols-12 gap-6 py-5" style={{ borderTop: `1px solid ${v2.rule}` }}>
            <div className="col-span-2 flex items-center gap-2.5">
              <span style={{ display: 'inline-block', height: 22, width: 22, borderRadius: 999, background: v2.cream2, color: v2.ink, fontFamily: v2Serif, fontWeight: 500, fontSize: 12, textAlign: 'center', lineHeight: '22px' }}>{doc.who[0]}</span>
              <V2Mono style={{ fontSize: 11, color: v2.ink }}>{doc.d}</V2Mono>
            </div>
            <div className="col-span-7">
              <h3 style={{ fontFamily: v2Serif, fontSize: 19, fontWeight: 500, color: v2.ink, letterSpacing: '-0.005em' }}>{doc.t}</h3>
              <div className="mt-1 flex items-center gap-3">
                {doc.tags.map(t => (
                  <span key={t} style={{ fontSize: 11, color: v2.accent }}>#{t}</span>
                ))}
              </div>
            </div>
            <div className="col-span-2"><V2Caps>{doc.folder.toUpperCase()}</V2Caps></div>
            <div className="col-span-1 text-right"><V2Mono style={{ fontSize: 11, color: v2.inkFaint }}>{doc.updated}</V2Mono></div>
          </article>
        ))}
      </section>
    </div>
  );
}

// 7. Single workspace doc
function V2WebTeamDocSingle() {
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      <V2TeamHeader active="DOCS" />
      <article className="mx-auto px-14 py-14" style={{ maxWidth: 1080 }}>
        <V2Caps>← BACK TO DOCS · PRICING · WORKSPACE</V2Caps>
        <h1 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 64, lineHeight: 0.96, letterSpacing: '-0.025em', fontWeight: 500 }}>
          Team plan spec — <em style={{ fontStyle: 'italic', color: v2.accent }}>first draft</em>.
        </h1>

        <div className="mt-5 flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <span style={{ display: 'inline-block', height: 26, width: 26, borderRadius: 999, background: v2.cream2, color: v2.ink, fontFamily: v2Serif, fontWeight: 500, fontSize: 12, textAlign: 'center', lineHeight: '26px' }}>K</span>
            <span style={{ fontSize: 13, color: v2.ink }}>Komal Ahire</span>
          </div>
          <V2Caps>POSTED 2 HRS AGO · 1.8K WORDS · 6 MIN READ</V2Caps>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="text-[12px] rounded-full px-3 py-1.5" style={{ border: `1px solid ${v2.rule}`, color: v2.inkSoft }}>Comment</button>
            <button className="text-[12px] rounded-full px-3 py-1.5" style={{ border: `1px solid ${v2.rule}`, color: v2.inkSoft }}>Share</button>
          </span>
        </div>

        <div className="mt-12 grid grid-cols-12 gap-10">
          <div className="col-span-8">
            <p style={{ fontFamily: v2Serif, fontSize: 24, lineHeight: 1.45, color: v2.ink, letterSpacing: '-0.005em' }}>
              The case for a Teams tier — based on six pricing-review calls over the last month, three of them with prospects ready to buy if it existed.
            </p>
            <h2 className="mt-10" style={{ fontFamily: v2Serif, fontSize: 28, fontWeight: 500, letterSpacing: '-0.015em' }}>What we&rsquo;re selling</h2>
            <p className="mt-3 text-[16px] leading-relaxed" style={{ color: v2.ink }}>
              A shared workspace where Minutes from any call are visible to the whole team. Shared vocabulary (org names, codenames) trains Oscar for everyone at once. Slack and Notion post targets are configurable per channel.
            </p>
            <h2 className="mt-10" style={{ fontFamily: v2Serif, fontSize: 28, fontWeight: 500, letterSpacing: '-0.015em' }}>What we&rsquo;re not</h2>
            <p className="mt-3 text-[16px] leading-relaxed" style={{ color: v2.ink }}>
              A full DMS or knowledge base. We&rsquo;re not competing with Notion or Slite. We&rsquo;re the layer between voice and those tools — the dictation, the cleanup, the publish.
            </p>
            <h2 className="mt-10" style={{ fontFamily: v2Serif, fontSize: 28, fontWeight: 500, letterSpacing: '-0.015em' }}>Pricing</h2>
            <p className="mt-3 text-[16px] leading-relaxed" style={{ color: v2.ink }}>
              ₹599/seat/month, billed annually. Minimum 3 seats. Volume discount kicks in at 25 seats (₹499) and 50 seats (₹449).
            </p>
          </div>
          <aside className="col-span-4" style={{ borderLeft: `1px solid ${v2.rule}`, paddingLeft: 30 }}>
            <V2Caps color={v2.accent}>FROM AN OSCAR MINUTES</V2Caps>
            <p className="mt-3" style={{ fontFamily: v2Serif, fontSize: 17, lineHeight: 1.5, color: v2.ink }}>
              &ldquo;They want a team plan with shared Minutes. Pricing-sensitive but not deal-breaker.&rdquo;
            </p>
            <V2Caps>— ROSHNI JHA · PRICING REVIEW · MAY 19</V2Caps>

            <div className="mt-10">
              <V2Caps>COMMENTS · 3</V2Caps>
              <div className="mt-3 space-y-4">
                {[
                  ['Mira',  'Should we include a free tier for teams under 5? Worth asking.'],
                  ['Souvik','Engineering scope for shared vocab is bigger than it sounds.'],
                  ['Sanjna','Naming nit: “Workspace” throughout, not “team”.'],
                ].map(([who, txt], i) => (
                  <div key={i} className="pb-3" style={{ borderBottom: `1px solid ${v2.rule}` }}>
                    <V2Caps>{who.toUpperCase()}</V2Caps>
                    <p className="mt-1 text-[13px] leading-relaxed" style={{ color: v2.ink }}>{txt}</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </article>
    </div>
  );
}

// 8. Org settings · details
function V2WebOrgDetails() {
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      <V2TeamHeader active="SETTINGS" />
      <div className="grid grid-cols-12 px-14 py-14 gap-10">
        <aside className="col-span-3">
          <V2Caps>ORG SETTINGS</V2Caps>
          <nav className="mt-5 space-y-5">
            {[['Details', true], ['Members & roles', false], ['Invites', false], ['Plan', false], ['Integrations', false], ['SSO', false]].map(([label, active], i) => (
              <div key={i} style={{ borderLeft: active ? `2px solid ${v2.accent}` : '2px solid transparent', paddingLeft: 14 }}>
                <div style={{ fontFamily: v2Serif, fontSize: 18, fontWeight: 500, color: active ? v2.ink : v2.inkSoft, letterSpacing: '-0.005em' }}>{label}</div>
              </div>
            ))}
          </nav>
        </aside>
        <main className="col-span-9">
          <V2Caps>SETTINGS · ORG DETAILS</V2Caps>
          <h1 className="mt-2" style={{ fontFamily: v2Serif, fontSize: 52, lineHeight: 0.98, letterSpacing: '-0.025em', fontWeight: 500 }}>
            How the workspace <em style={{ fontStyle: 'italic', color: v2.accent }}>shows up</em>.
          </h1>

          <section className="mt-12 grid grid-cols-12 gap-10" style={{ borderTop: `1px solid ${v2.rule}`, paddingTop: 32 }}>
            <div className="col-span-3"><V2Caps>IDENTITY</V2Caps></div>
            <div className="col-span-9">
              {[
                ['ORG NAME',     'NavGurukul'],
                ['WORKSPACE',    'Product'],
                ['SLUG',         'navgurukul-product'],
                ['DESCRIPTION',  'Where the Oscar product team lives.'],
                ['HOMEPAGE',     'oscar.so/team/navgurukul'],
              ].map(([label, value], i) => (
                <div key={i} className="flex items-center justify-between py-4" style={{ borderBottom: `1px solid ${v2.rule}` }}>
                  <V2Caps>{label}</V2Caps>
                  <span style={{ fontSize: 14, color: v2.ink, fontFamily: v2Sans }}>{value}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-12 grid grid-cols-12 gap-10" style={{ borderTop: `1px solid ${v2.rule}`, paddingTop: 32 }}>
            <div className="col-span-3"><V2Caps>WORKSPACE MARK</V2Caps></div>
            <div className="col-span-9 flex items-center gap-6">
              <div style={{ height: 64, width: 64, borderRadius: 14, background: v2.accent, color: v2.cream, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: v2Serif, fontWeight: 500, fontSize: 32 }}>N</div>
              <div>
                <button className="text-[12px] rounded-full px-3.5 py-1.5" style={{ border: `1px solid ${v2.rule}`, color: v2.inkSoft }}>Upload an image</button>
                <p className="mt-2 text-[12px]" style={{ color: v2.inkSoft }}>Square PNG or SVG. Used in the org switcher and shared Minutes.</p>
              </div>
            </div>
          </section>

          <section className="mt-12 grid grid-cols-12 gap-10" style={{ borderTop: `1px solid ${v2.rule}`, paddingTop: 32 }}>
            <div className="col-span-3"><V2Caps>DANGER</V2Caps></div>
            <div className="col-span-9 rounded-md p-5 flex items-center justify-between" style={{ border: '1px solid #d6b3a8' }}>
              <div>
                <div style={{ fontFamily: v2Serif, fontSize: 18, fontWeight: 500, color: '#8c2f25' }}>Delete this workspace</div>
                <p className="mt-1 text-[12px] leading-relaxed" style={{ color: v2.inkSoft }}>Removes the workspace, every doc, every Minutes. Cannot be undone. 30 day soft-delete; after that, permanent.</p>
              </div>
              <button className="text-[12px] rounded-full px-4 py-2" style={{ color: '#8c2f25', border: '1px solid #d6b3a8' }}>Delete workspace</button>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

// 9. Members & roles
function V2WebOrgMembers() {
  const members = [
    { name: 'Souvik Deb',    email: 'souvik@navgurukul.org',  role: 'Owner',  joined: 'May 2024', here: true },
    { name: 'Mira Patel',    email: 'mira@navgurukul.org',    role: 'Admin',  joined: 'Aug 2024' },
    { name: 'Komal Ahire',   email: 'komal@navgurukul.org',   role: 'Editor', joined: 'Oct 2024' },
    { name: 'Roshni Jha',    email: 'roshni@navgurukul.org',  role: 'Editor', joined: 'Dec 2024' },
    { name: 'Sanjna Panwar', email: 'sanjna@navgurukul.org',  role: 'Editor', joined: 'Jan 2025' },
    { name: 'Aniket Devkar', email: 'aniket@navgurukul.org',  role: 'Member', joined: 'Mar 2025' },
    { name: 'Devansh Rao',   email: 'devansh@navgurukul.org', role: 'Member', joined: 'Apr 2025' },
    { name: 'Priya Iyer',    email: 'priya@navgurukul.org',   role: 'Member', joined: 'Apr 2025' },
  ];
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      <V2TeamHeader active="MEMBERS" />
      <section className="px-14 pt-14 pb-10">
        <V2Caps>MEMBERS · 12 · ACTIVE</V2Caps>
        <h1 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 56, lineHeight: 0.98, letterSpacing: '-0.025em', fontWeight: 500 }}>
          The people <em style={{ fontStyle: 'italic', color: v2.accent }}>here</em>.
        </h1>
        <div className="mt-7 flex items-center gap-3">
          <button className="text-[13px] rounded-full px-5 py-2.5 font-medium" style={{ background: v2.ink, color: v2.cream }}>Invite by email</button>
          <button className="text-[13px] rounded-full px-5 py-2.5" style={{ border: `1px solid ${v2.rule}`, color: v2.inkSoft }}>Share invite link</button>
        </div>
      </section>

      <section className="px-14 pb-20">
        <div className="grid grid-cols-12 gap-4 py-3" style={{ borderTop: `1px solid ${v2.rule}`, borderBottom: `1px solid ${v2.rule}` }}>
          <div className="col-span-4"><V2Caps>NAME</V2Caps></div>
          <div className="col-span-4"><V2Caps>EMAIL</V2Caps></div>
          <div className="col-span-2"><V2Caps>ROLE</V2Caps></div>
          <div className="col-span-2 text-right"><V2Caps>SINCE</V2Caps></div>
        </div>
        {members.map((m, i) => (
          <div key={i} className="grid grid-cols-12 gap-4 py-4 items-center" style={{ borderBottom: `1px solid ${v2.rule}` }}>
            <div className="col-span-4 flex items-center gap-3">
              <span style={{ display: 'inline-block', height: 30, width: 30, borderRadius: 999, background: v2.cream2, color: v2.ink, fontFamily: v2Serif, fontWeight: 500, fontSize: 13, textAlign: 'center', lineHeight: '30px' }}>{m.name[0]}</span>
              <span style={{ fontSize: 14, color: v2.ink }}>{m.name}</span>
              {m.here && <V2Mono style={{ fontSize: 10, color: v2.accent, letterSpacing: '0.16em' }}>YOU</V2Mono>}
            </div>
            <V2Mono className="col-span-4" style={{ fontSize: 12, color: v2.inkSoft }}>{m.email}</V2Mono>
            <div className="col-span-2 flex items-center gap-1.5">
              <span style={{ fontSize: 13, color: m.role === 'Owner' ? v2.accent : v2.ink, fontWeight: m.role === 'Owner' ? 500 : 400 }}>{m.role}</span>
              <V2Mono style={{ fontSize: 11, color: v2.inkFaint }}>↓</V2Mono>
            </div>
            <div className="col-span-2 text-right"><V2Mono style={{ fontSize: 11, color: v2.inkFaint }}>{m.joined.toUpperCase()}</V2Mono></div>
          </div>
        ))}
      </section>
    </div>
  );
}

// 10. Invites
function V2WebOrgInvites() {
  const pending = [
    { email: 'anand@navgurukul.org',  role: 'Editor', sent: '2 days ago' },
    { email: 'nidhi@navgurukul.org',  role: 'Member', sent: '3 days ago' },
    { email: 'rohan@navgurukul.org',  role: 'Member', sent: '5 days ago' },
  ];
  const history = [
    { email: 'priya@navgurukul.org',  role: 'Member', accepted: 'Apr 14' },
    { email: 'devansh@navgurukul.org', role: 'Member', accepted: 'Apr 02' },
  ];
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      <V2TeamHeader active="SETTINGS" />
      <div className="grid grid-cols-12 px-14 py-14 gap-10">
        <aside className="col-span-3">
          <V2Caps>ORG SETTINGS</V2Caps>
          <nav className="mt-5 space-y-5">
            {[['Details', false], ['Members & roles', false], ['Invites', true], ['Plan', false], ['Integrations', false], ['SSO', false]].map(([label, active], i) => (
              <div key={i} style={{ borderLeft: active ? `2px solid ${v2.accent}` : '2px solid transparent', paddingLeft: 14 }}>
                <div style={{ fontFamily: v2Serif, fontSize: 18, fontWeight: 500, color: active ? v2.ink : v2.inkSoft, letterSpacing: '-0.005em' }}>{label}</div>
              </div>
            ))}
          </nav>
        </aside>
        <main className="col-span-9">
          <V2Caps>SETTINGS · INVITES</V2Caps>
          <h1 className="mt-2" style={{ fontFamily: v2Serif, fontSize: 52, lineHeight: 0.98, letterSpacing: '-0.025em', fontWeight: 500 }}>
            Who&rsquo;s next <em style={{ fontStyle: 'italic', color: v2.accent }}>to join</em>.
          </h1>

          <section className="mt-10 rounded-lg p-7" style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}>
            <V2Caps>SEND AN INVITE</V2Caps>
            <div className="mt-3 flex items-center gap-3">
              <input placeholder="name@work.com" className="flex-1 bg-transparent outline-none py-3 px-4 text-[14px] rounded-md" style={{ border: `1px solid ${v2.rule}`, background: v2.cream, color: v2.ink, fontFamily: v2Sans }} />
              <select className="bg-transparent text-[13px] py-3 px-4 rounded-md" style={{ border: `1px solid ${v2.rule}`, background: v2.cream, color: v2.ink, fontFamily: v2Sans }}>
                <option>Member</option>
                <option>Editor</option>
                <option>Admin</option>
              </select>
              <button className="text-[13px] rounded-full px-5 py-3 font-medium" style={{ background: v2.ink, color: v2.cream }}>Send</button>
            </div>
            <p className="mt-3 text-[12px]" style={{ color: v2.inkSoft }}>Or share a link: <span style={{ fontFamily: v2Mono, color: v2.accent }}>oscar.so/i/n4P-xa2L</span> · <button style={{ color: v2.inkSoft, textDecoration: 'underline' }}>Copy</button></p>
          </section>

          <section className="mt-12">
            <V2Caps>PENDING · 3</V2Caps>
            <div className="mt-3">
              {pending.map((p, i) => (
                <div key={i} className="grid grid-cols-12 gap-4 py-4 items-center" style={{ borderBottom: `1px solid ${v2.rule}` }}>
                  <V2Mono className="col-span-5" style={{ fontSize: 13, color: v2.ink }}>{p.email}</V2Mono>
                  <span className="col-span-3" style={{ fontSize: 13, color: v2.inkSoft }}>{p.role}</span>
                  <V2Caps>SENT {p.sent.toUpperCase()}</V2Caps>
                  <div className="col-span-2 text-right">
                    <button className="text-[11px] mr-3" style={{ color: v2.accent }}>Resend</button>
                    <button className="text-[11px]" style={{ color: v2.inkFaint }}>Revoke</button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-12">
            <V2Caps>ACCEPTED · LAST 30 DAYS</V2Caps>
            <div className="mt-3">
              {history.map((p, i) => (
                <div key={i} className="grid grid-cols-12 gap-4 py-3 items-center" style={{ borderBottom: `1px solid ${v2.rule}` }}>
                  <V2Mono className="col-span-5" style={{ fontSize: 13, color: v2.ink }}>{p.email}</V2Mono>
                  <span className="col-span-3" style={{ fontSize: 13, color: v2.inkSoft }}>{p.role}</span>
                  <V2Caps>JOINED {p.accepted.toUpperCase()}</V2Caps>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

// 11. Invite acceptance
function V2WebInviteAccept() {
  return (
    <div className="grid grid-cols-12" style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      <div className="col-span-7 px-16 py-12 flex flex-col">
        <V2Wordmark />
        <div className="flex-1 flex flex-col justify-center" style={{ maxWidth: 540 }}>
          <V2Caps>YOU&rsquo;VE BEEN INVITED</V2Caps>
          <h1 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 56, lineHeight: 0.98, letterSpacing: '-0.025em', fontWeight: 500 }}>
            Souvik invited you to<br /><em style={{ fontStyle: 'italic', color: v2.accent }}>NavGurukul · Product</em>.
          </h1>
          <p className="mt-6 text-[16px] leading-relaxed" style={{ color: v2.inkSoft }}>
            You&rsquo;ll get access to the team&rsquo;s shared Minutes, docs, and a workspace vocabulary that already knows how to spell &ldquo;NavGurukul&rdquo;.
          </p>

          <div className="mt-9 flex items-center gap-3">
            <div style={{ height: 44, width: 44, borderRadius: 8, background: v2.accent, color: v2.cream, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: v2Serif, fontWeight: 500, fontSize: 22 }}>N</div>
            <div>
              <div style={{ fontSize: 15, color: v2.ink, fontWeight: 500 }}>NavGurukul · Product</div>
              <V2Caps>12 MEMBERS · 24 DOCS · 12 MINUTES</V2Caps>
            </div>
          </div>

          <div className="mt-9 flex items-center gap-3">
            <button className="rounded-full px-6 py-3.5 text-[14px] font-medium" style={{ background: v2.ink, color: v2.cream }}>Accept and join</button>
            <button className="text-[13px]" style={{ color: v2.inkSoft }}>Maybe later</button>
          </div>

          <p className="mt-7 text-[12px]" style={{ color: v2.inkFaint }}>You&rsquo;re joining as <strong style={{ color: v2.ink, fontWeight: 500 }}>Editor</strong>. Your personal Scribbles stay yours.</p>
        </div>
        <V2Caps>OSCAR · WORKSPACES</V2Caps>
      </div>

      <div className="col-span-5 px-12 py-12 flex flex-col" style={{ background: '#0f0d0a', color: v2.cream }}>
        <V2Caps color="#7a7670">THE TEAM, IN THEIR OWN WORDS</V2Caps>
        <div className="flex-1 flex flex-col justify-center space-y-9" style={{ maxWidth: 460 }}>
          {[
            ['It’s the only place our meeting notes don’t go to die.', 'MIRA · DESIGNER'],
            ['I used to dread post-call. Now Oscar does it.', 'ROSHNI · PM'],
            ['Felt natural from day one. The vocabulary thing alone won me over.', 'KOMAL · MARKETING'],
          ].map(([q, who], i) => (
            <div key={i}>
              <p style={{ fontFamily: v2Serif, fontSize: 22, lineHeight: 1.4, color: v2.cream, letterSpacing: '-0.005em' }}>&ldquo;{q}&rdquo;</p>
              <V2Caps color="#7a7670">{who}</V2Caps>
            </div>
          ))}
        </div>
        <V2Caps color="#7a7670">© NAVGURUKUL · ON OSCAR SINCE MAY 2024</V2Caps>
      </div>
    </div>
  );
}

// 12. Create workspace
function V2WebCreateWorkspace() {
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <header className="flex items-center justify-between px-14 py-7">
        <V2Wordmark />
        <V2Caps>STEP 1 OF 2 · CREATE WORKSPACE</V2Caps>
        <button className="text-[12px]" style={{ color: v2.inkSoft }}>Cancel</button>
      </header>
      <main className="flex-1 flex items-center justify-center px-14 pt-10 pb-20">
        <div style={{ maxWidth: 600 }}>
          <V2Caps color={v2.accent}>NEW WORKSPACE</V2Caps>
          <h1 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 56, lineHeight: 0.98, letterSpacing: '-0.025em', fontWeight: 500 }}>
            What&rsquo;s the<br /><em style={{ fontStyle: 'italic', color: v2.accent }}>name</em> of it?
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed" style={{ color: v2.inkSoft }}>
            Pick a name for your workspace. You can change it later. This becomes the home for your team&rsquo;s shared Minutes, docs, and vocabulary.
          </p>

          <div className="mt-10">
            <V2Caps>WORKSPACE NAME</V2Caps>
            <input placeholder="e.g. NavGurukul · Product" className="mt-2 w-full bg-transparent outline-none py-3 text-[20px]" style={{ borderBottom: `1px solid ${v2.ink}`, color: v2.ink, fontFamily: v2Serif, fontWeight: 500 }} />
            <p className="mt-2 text-[12px]" style={{ color: v2.inkFaint }}>This will appear in the org switcher and on shared Minutes.</p>
          </div>

          <div className="mt-9">
            <V2Caps>SLUG · USED IN LINKS</V2Caps>
            <div className="mt-2 flex items-baseline gap-2">
              <V2Mono style={{ fontSize: 14, color: v2.inkFaint }}>oscar.so/team/</V2Mono>
              <input placeholder="navgurukul-product" className="flex-1 bg-transparent outline-none py-3 text-[16px]" style={{ borderBottom: `1px solid ${v2.ink}`, color: v2.ink, fontFamily: v2Mono }} />
            </div>
          </div>

          <div className="mt-9">
            <V2Caps>WHAT WILL YOU USE IT FOR?</V2Caps>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {['Product team', 'Customer calls', 'Research interviews', 'Founder journals', 'Engineering syncs', 'Something else'].map((t, i) => (
                <button key={t} className="rounded-md py-3 px-4 text-left text-[13px]" style={{ background: i === 0 ? v2.cream2 : 'transparent', border: i === 0 ? `1px solid ${v2.accent}` : `1px solid ${v2.rule}`, color: v2.ink, fontWeight: i === 0 ? 500 : 400 }}>{t}</button>
              ))}
            </div>
          </div>

          <div className="mt-12 flex items-center gap-3">
            <button className="rounded-full px-7 py-3.5 text-[14px] font-medium" style={{ background: v2.ink, color: v2.cream }}>Create workspace</button>
            <button className="text-[13px]" style={{ color: v2.inkSoft }}>← Back</button>
          </div>
        </div>
      </main>
    </div>
  );
}

// ═══ ACCOUNT / DATA FLOWS ═════════════════════════════════════════════════

// 13. Desktop callback handoff (three states stacked)
function V2WebDesktopCallback() {
  function Card({ tag, status, h, body, glyph, cta }) {
    return (
      <div className="rounded-lg p-9" style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}>
        <V2Caps color={status === 'success' ? v2.accent : status === 'error' ? '#8c2f25' : v2.inkFaint}>{tag}</V2Caps>
        <div className="mt-6">{glyph}</div>
        <h2 className="mt-6" style={{ fontFamily: v2Serif, fontSize: 30, lineHeight: 1.05, fontWeight: 500, letterSpacing: '-0.015em' }}>{h}</h2>
        <p className="mt-3 text-[13px] leading-relaxed" style={{ color: v2.inkSoft, maxWidth: 360 }}>{body}</p>
        {cta && <div className="mt-6"><button className="text-[12px] rounded-full px-4 py-2 font-medium" style={{ background: v2.ink, color: v2.cream }}>{cta}</button></div>}
      </div>
    );
  }
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      <div className="px-14 pt-14 pb-8">
        <V2Caps>/auth/desktop-callback · THREE STATES</V2Caps>
        <h1 className="mt-2" style={{ fontFamily: v2Serif, fontSize: 56, lineHeight: 0.98, letterSpacing: '-0.025em', fontWeight: 500 }}>
          Handing you back to <em style={{ fontStyle: 'italic', color: v2.accent }}>Oscar</em>.
        </h1>
        <p className="mt-4 max-w-xl text-[14px] leading-relaxed" style={{ color: v2.inkSoft }}>The browser intermediates auth and bounces you back to the desktop app. Here are the three things you might see.</p>
      </div>
      <div className="grid grid-cols-3 gap-5 px-14 pb-14">
        <Card
          tag="01 · WAITING" status="info"
          h="Logging you in…"
          body="Holding open a secure handoff to the desktop app. Should take less than a second."
          glyph={<div className="flex items-center gap-1.5" style={{ height: 14 }}>{Array.from({ length: 12 }).map((_, i) => <span key={i} className="rounded-full" style={{ width: 3, height: 6 + (i % 3) * 4, background: i < 4 ? v2.accent : v2.ruleHard }} />)}</div>}
        />
        <Card
          tag="02 · SUCCESS" status="success"
          h="You’re in. Switch to Oscar."
          body="The desktop app picked up the handoff. You can close this tab — Oscar is signed in."
          glyph={<svg width="44" height="44" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="11" stroke={v2.accent} strokeWidth="1.3" /><path d="M7 12l3.5 3.5L17 9" stroke={v2.accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          cta="Back to Oscar"
        />
        <Card
          tag="03 · COULDN’T HAND OFF" status="error"
          h="Oscar didn’t hear back."
          body="The desktop app may not be running. Open Oscar and try signing in again from inside the app."
          glyph={<svg width="44" height="44" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="11" stroke="#8c2f25" strokeWidth="1.3" /><path d="M12 7v6M12 16v0.5" stroke="#8c2f25" strokeWidth="2.4" strokeLinecap="round" /></svg>}
          cta="Try again"
        />
      </div>
    </div>
  );
}

// 14. Export data (three steps stacked)
function V2WebExportData() {
  function Step({ n, status, h, body, glyph, cta }) {
    const isActive = status === 'active';
    return (
      <div className="rounded-lg p-7" style={{ background: isActive ? v2.cream2 : 'transparent', border: isActive ? `1px solid ${v2.accent}` : `1px solid ${v2.rule}`, opacity: status === 'pending' ? 0.6 : 1 }}>
        <div className="flex items-center justify-between">
          <V2Mono style={{ fontSize: 11, color: isActive ? v2.accent : v2.inkFaint, letterSpacing: '0.18em' }}>0{n} · {status === 'done' ? 'DONE' : status === 'active' ? 'NOW' : 'NEXT'}</V2Mono>
          {status === 'done' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke={v2.accent} strokeWidth="2.5" strokeLinecap="round" /></svg>}
        </div>
        <h3 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 26, lineHeight: 1.0, fontWeight: 500, letterSpacing: '-0.015em' }}>{h}</h3>
        <p className="mt-3 text-[13px] leading-relaxed" style={{ color: v2.inkSoft }}>{body}</p>
        {glyph && <div className="mt-5">{glyph}</div>}
        {cta && status !== 'done' && <button className="mt-5 text-[12px] rounded-full px-4 py-2 font-medium" style={{ background: v2.ink, color: v2.cream }}>{cta}</button>}
      </div>
    );
  }
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      <V2WebHeader active="SETTINGS" />
      <article className="px-14 pt-14 pb-16">
        <V2Caps>SETTINGS · DATA & PRIVACY · EXPORT</V2Caps>
        <h1 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 56, lineHeight: 0.98, letterSpacing: '-0.025em', fontWeight: 500 }}>
          Take <em style={{ fontStyle: 'italic', color: v2.accent }}>everything</em> with you.
        </h1>
        <p className="mt-5 max-w-xl text-[15px] leading-relaxed" style={{ color: v2.inkSoft }}>
          A ZIP of every Scribble, every Minutes, every vocabulary entry. Markdown for the prose, JSON for the structured data. Yours to keep, forever.
        </p>

        <div className="mt-12 grid grid-cols-3 gap-5">
          <Step n="1" status="done"
            h="Confirm scope"
            body="Everything in your account · 86 Scribbles, 12 Minutes, 48 vocabulary entries, 4 folders. ~12 MB."
          />
          <Step n="2" status="active"
            h="Preparing the archive"
            body="We’re bundling the markdown files, the JSON manifest, and a README. You can close this tab — we’ll email when it’s ready."
            glyph={<div style={{ background: v2.cream, height: 6, width: '100%', borderRadius: 999, overflow: 'hidden', border: `1px solid ${v2.rule}` }}><div style={{ background: v2.accent, height: '100%', width: '63%' }} /></div>}
          />
          <Step n="3" status="pending"
            h="Download the ZIP"
            body="Link arrives by email and shows up here. Valid for 24 hours."
            cta="Download"
          />
        </div>

        <div className="mt-12 rounded-md p-5" style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}>
          <V2Caps>WHAT’S INSIDE THE ZIP</V2Caps>
          <div className="mt-3 grid grid-cols-2 gap-x-10 gap-y-2 text-[12px]" style={{ color: v2.ink, fontFamily: v2Mono }}>
            <span>oscar-export-2026-05-20.zip</span><V2Mono style={{ color: v2.inkFaint, textAlign: 'right' }}>12.4 MB</V2Mono>
            <span>├── scribbles/ (86 .md)</span><V2Mono style={{ color: v2.inkFaint, textAlign: 'right' }}>4.2 MB</V2Mono>
            <span>├── minutes/ (12 .md)</span><V2Mono style={{ color: v2.inkFaint, textAlign: 'right' }}>3.8 MB</V2Mono>
            <span>├── vocabulary.json</span><V2Mono style={{ color: v2.inkFaint, textAlign: 'right' }}>22 KB</V2Mono>
            <span>├── folders.json</span><V2Mono style={{ color: v2.inkFaint, textAlign: 'right' }}>14 KB</V2Mono>
            <span>├── manifest.json</span><V2Mono style={{ color: v2.inkFaint, textAlign: 'right' }}>8 KB</V2Mono>
            <span>└── README.md</span><V2Mono style={{ color: v2.inkFaint, textAlign: 'right' }}>3 KB</V2Mono>
          </div>
        </div>
      </article>
    </div>
  );
}

// 15. Delete account (confirm + goodbye, stacked)
function V2WebDeleteAccount() {
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      <V2WebHeader active="SETTINGS" />
      <div className="grid grid-cols-2 px-14 pt-14 pb-16 gap-10">
        {/* Confirm */}
        <article>
          <V2Caps color="#8c2f25">CONFIRM · DELETE ACCOUNT</V2Caps>
          <h1 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 48, lineHeight: 0.98, letterSpacing: '-0.025em', fontWeight: 500 }}>
            Are you <em style={{ fontStyle: 'italic', color: '#8c2f25' }}>sure</em>?
          </h1>
          <p className="mt-5 text-[14px] leading-relaxed" style={{ color: v2.inkSoft }}>
            You&rsquo;ll lose 86 Scribbles, 12 Minutes, 48 vocabulary entries, 4 folders. Your subscription will be canceled. No refunds for the remainder of the period.
          </p>

          <div className="mt-7 rounded-md p-5" style={{ background: '#fbeae6', border: '1px solid #d6b3a8' }}>
            <V2Caps color="#8c2f25">FIRST · EXPORT YOUR DATA</V2Caps>
            <p className="mt-2 text-[13px] leading-relaxed" style={{ color: v2.inkSoft }}>You haven’t exported in 30 days. Once deletion runs, we can&rsquo;t recover your Scribbles.</p>
            <button className="mt-3 text-[12px] rounded-full px-4 py-2 font-medium" style={{ background: v2.ink, color: v2.cream }}>Export first</button>
          </div>

          <div className="mt-9">
            <V2Caps>TYPE &ldquo;DELETE&rdquo; TO CONFIRM</V2Caps>
            <input placeholder="DELETE" className="mt-2 w-full bg-transparent outline-none py-3 text-[16px] font-mono" style={{ borderBottom: `1px solid ${v2.ink}`, color: v2.ink, letterSpacing: '0.1em' }} />
          </div>

          <div className="mt-9 flex items-center gap-3">
            <button className="rounded-full px-6 py-3 text-[14px] font-medium" style={{ background: '#8c2f25', color: '#fff' }}>Permanently delete</button>
            <button className="text-[13px]" style={{ color: v2.inkSoft }}>Never mind</button>
          </div>
        </article>

        {/* Goodbye */}
        <article style={{ borderLeft: `1px solid ${v2.rule}`, paddingLeft: 40 }}>
          <V2Caps color={v2.accent}>AFTER DELETION · GOODBYE</V2Caps>
          <h1 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 48, lineHeight: 0.98, letterSpacing: '-0.025em', fontWeight: 500 }}>
            Thank you for <em style={{ fontStyle: 'italic', color: v2.accent }}>listening</em>.
          </h1>
          <p className="mt-5 text-[14px] leading-relaxed" style={{ color: v2.inkSoft }}>
            Your account is gone. Your data is being purged from our servers and backups over the next 30 days. After that, nothing of yours remains.
          </p>

          <div className="mt-9 space-y-5">
            <div>
              <V2Caps>HOW MANY MINUTES YOU SPOKE</V2Caps>
              <div style={{ fontFamily: v2Serif, fontSize: 48, fontWeight: 500, letterSpacing: '-0.025em', color: v2.ink, lineHeight: 1 }}>1,287</div>
            </div>
            <div>
              <V2Caps>THINGS YOU MADE</V2Caps>
              <div style={{ fontFamily: v2Serif, fontSize: 48, fontWeight: 500, letterSpacing: '-0.025em', color: v2.ink, lineHeight: 1 }}>86 + 12</div>
              <V2Caps>SCRIBBLES + MINUTES</V2Caps>
            </div>
          </div>

          <div className="mt-9 pt-6" style={{ borderTop: `1px solid ${v2.rule}` }}>
            <V2Caps>ONE QUESTION · IF YOU’D LIKE</V2Caps>
            <p className="mt-2 text-[14px]" style={{ color: v2.ink }}>What could we have done better?</p>
            <textarea placeholder="Optional · we read every reply." className="mt-3 w-full bg-transparent outline-none p-3 text-[13px] rounded-md" style={{ border: `1px solid ${v2.rule}`, color: v2.ink, fontFamily: v2Sans, minHeight: 80, resize: 'none' }}></textarea>
          </div>
        </article>
      </div>
    </div>
  );
}

// ═══ MOBILE · CAPTURE FLOW + PRICING + MINUTES ════════════════════════════

// 16. Mobile pricing
function V2MobilePricing() {
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      <div className="px-5 pt-7 flex items-center justify-between">
        <V2Caps>← BACK</V2Caps>
        <V2Caps>PRICING</V2Caps>
        <div style={{ width: 40 }} />
      </div>
      <div className="px-5 pt-10 text-center">
        <V2Caps>TWO TIERS, NO TRICKS</V2Caps>
        <h1 className="mt-4" style={{ fontFamily: v2Serif, fontSize: 44, lineHeight: 0.96, letterSpacing: '-0.025em', fontWeight: 500 }}>
          Free to try.<br /><em style={{ fontStyle: 'italic', color: v2.accent }}>Pro</em> when you&rsquo;re hooked.
        </h1>
      </div>

      <div className="px-5 mt-10 space-y-4 pb-12">
        {[
          { name: 'Pro', tag: 'For people who type too much', price: '₹699', cadence: '/mo · annually', cta: 'Start 14-day trial', featured: true,
            features: ['Unlimited dictation', 'Unlimited Scribbles + Minutes', 'Web · desktop · mobile', 'Context-aware dictation', 'Priority support'] },
          { name: 'Free', tag: 'For trying it on', price: '₹0', cadence: 'forever', cta: 'Start free', featured: false,
            features: ['30 minutes / month', '5 Scribbles stored', '1 device', 'Auto-cleanup'] },
          { name: 'Teams', tag: 'For working with people', price: '₹599', cadence: '/seat · annually', cta: 'Talk to us', featured: false,
            features: ['Everything in Pro', 'Shared workspace', 'Shared vocabulary', 'SSO, admin controls'] },
        ].map(t => (
          <div key={t.name} className="rounded-lg p-7" style={{ background: t.featured ? v2.ink : v2.cream2, color: t.featured ? v2.cream : v2.ink, border: t.featured ? 'none' : `1px solid ${v2.rule}` }}>
            <V2Caps color={t.featured ? v2.accent : v2.inkFaint}>{t.tag.toUpperCase()}</V2Caps>
            <div className="mt-2 flex items-baseline justify-between">
              <h3 style={{ fontFamily: v2Serif, fontSize: 32, lineHeight: 1, fontWeight: 500, letterSpacing: '-0.02em' }}>{t.name}</h3>
              <div className="flex items-baseline gap-1.5">
                <span style={{ fontFamily: v2Serif, fontSize: 32, fontWeight: 500, letterSpacing: '-0.025em' }}>{t.price}</span>
                <V2Mono style={{ fontSize: 10, color: t.featured ? '#a8a39a' : v2.inkFaint }}>{t.cadence}</V2Mono>
              </div>
            </div>
            <ul className="mt-5 space-y-2 text-[13px] leading-relaxed">
              {t.features.map(f => (
                <li key={f} className="flex items-start gap-2.5">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ marginTop: 5 }}><path d="M5 12l5 5L20 7" stroke={v2.accent} strokeWidth="2.5" strokeLinecap="round" /></svg>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <button className="mt-6 w-full rounded-full py-3 text-[13px] font-medium" style={{ background: t.featured ? v2.accent : v2.ink, color: t.featured ? v2.ink : v2.cream }}>{t.cta}</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// 17. Mobile recording
function V2MobileRecording() {
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="px-5 pt-7 flex items-center justify-between">
        <V2Caps>ESC · DISCARD</V2Caps>
        <V2Caps color={v2.accent}>● 0:14 · LIVE</V2Caps>
        <div style={{ width: 60 }} />
      </div>
      <main className="flex-1 flex flex-col items-center justify-center px-7 text-center">
        <V2Caps color={v2.accent}>LISTENING</V2Caps>
        <h1 className="mt-4" style={{ fontFamily: v2Serif, fontSize: 64, lineHeight: 0.94, letterSpacing: '-0.03em', fontWeight: 500 }}>
          <em style={{ fontStyle: 'italic', color: v2.accent }}>Speak</em><br />freely.
        </h1>

        <div className="mt-14 flex items-center justify-center gap-1" style={{ height: 100 }}>
          {Array.from({ length: 22 }).map((_, i) => {
            const h = 12 + Math.abs(Math.sin(i * 0.55)) * 78;
            return <span key={i} className="rounded-full" style={{ width: 4, height: h, background: v2.accent, opacity: 0.55 + Math.abs(Math.sin(i * 0.3)) * 0.4 }} />;
          })}
        </div>

        <p className="mt-12" style={{ color: v2.inkSoft, fontFamily: v2Serif, fontSize: 17, lineHeight: 1.55, maxWidth: 280 }}>
          &ldquo;So pricing experiments. Two of them moved a metric we care about…&rdquo;
        </p>
      </main>
      <div className="pb-10 px-7">
        <button className="w-full rounded-full py-3.5 text-[14px] font-medium inline-flex items-center justify-center gap-2.5" style={{ background: v2.ink, color: v2.cream }}>
          <span style={{ display: 'inline-block', height: 9, width: 9, background: v2.accent, borderRadius: 2 }} />
          Stop · let Oscar shape it
        </button>
      </div>
    </div>
  );
}

// 18. Mobile processing
function V2MobileProcessing() {
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="px-5 pt-7"><V2Caps>PROCESSING</V2Caps></div>
      <main className="flex-1 flex flex-col items-center justify-center px-7 text-center">
        <V2Caps>ABOUT 4 SECONDS</V2Caps>
        <h1 className="mt-4" style={{ fontFamily: v2Serif, fontSize: 56, lineHeight: 0.96, letterSpacing: '-0.025em', fontWeight: 500 }}>
          <em style={{ fontStyle: 'italic', color: v2.accent }}>Shaping</em><br />what you said.
        </h1>
        <div className="mt-12 space-y-4 text-left" style={{ width: '100%', maxWidth: 280 }}>
          {[
            ['Transcribing audio', 'done'],
            ['Removing filler words', 'done'],
            ['Detecting context · Slack', 'done'],
            ['Formatting for app', 'active'],
            ['Suggesting a title', 'pending'],
          ].map(([label, state], i) => (
            <div key={i} className="flex items-center gap-3">
              <span style={{ display: 'inline-flex', width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
                {state === 'done'    && <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke={v2.accent} strokeWidth="3" strokeLinecap="round" /></svg>}
                {state === 'active'  && <span style={{ height: 9, width: 9, borderRadius: 999, background: v2.accent }} />}
                {state === 'pending' && <span style={{ height: 6, width: 6, borderRadius: 999, background: v2.ruleHard }} />}
              </span>
              <V2Mono style={{ fontSize: 12, color: state === 'pending' ? v2.inkFaint : v2.ink }}>{label}</V2Mono>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

// 19. Mobile results
function V2MobileResults() {
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      <div className="px-5 pt-7 flex items-center justify-between">
        <V2Caps>DISCARD</V2Caps>
        <V2Caps>EDIT</V2Caps>
      </div>
      <article className="px-5 pt-8 pb-32">
        <V2Caps color={v2.accent}>READY · 4 SECONDS · CLEAN COPY</V2Caps>
        <h1 className="mt-2" style={{ fontFamily: v2Serif, fontSize: 32, lineHeight: 1.0, letterSpacing: '-0.025em', fontWeight: 500 }}>
          Pricing experiments —<br /><em style={{ fontStyle: 'italic', color: v2.accent }}>what we learned</em>.
        </h1>

        <div className="mt-7 rounded-md p-5" style={{ background: v2.cream2 }}>
          <V2Caps color={v2.accent}>OSCAR’S MARGIN</V2Caps>
          <p className="mt-2" style={{ fontFamily: v2Serif, fontSize: 18, lineHeight: 1.4, color: v2.ink, letterSpacing: '-0.005em' }}>
            4 experiments. <em style={{ fontStyle: 'italic', color: v2.accent }}>Two won.</em> Push them harder next month.
          </p>
        </div>

        <div className="mt-7">
          <V2Caps>YOUR VOICE · UNEDITED</V2Caps>
          <div className="mt-3 space-y-4" style={{ fontFamily: v2Serif, fontSize: 17, lineHeight: 1.6, color: v2.ink }}>
            <p>OK so the big thing from last month is that we ran four pricing experiments and only two of them actually moved a metric we care about.</p>
            <p>The first one was the team plan landing page where we said &ldquo;for teams&rdquo; instead of listing seats. That worked.</p>
          </div>
        </div>

        <div className="mt-7 pt-5" style={{ borderTop: `1px solid ${v2.rule}` }}>
          <V2Caps>SUGGESTED · FOLDER</V2Caps>
          <p className="mt-1" style={{ fontFamily: v2Serif, fontSize: 17, color: v2.ink }}>→ Pricing</p>
        </div>
      </article>

      <div style={{ position: 'fixed', bottom: 24, left: 16, right: 16 }}>
        <button className="w-full rounded-full py-3.5 text-[14px] font-medium" style={{ background: v2.ink, color: v2.cream }}>Save Scribble</button>
      </div>
    </div>
  );
}

// 20. Mobile single Minutes
function V2MobileMinutes() {
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      <div className="px-5 pt-7 flex items-center justify-between">
        <V2Caps>← BACK</V2Caps>
        <V2Caps>SHARE</V2Caps>
      </div>
      <article className="px-5 pt-7 pb-12">
        <V2Caps>STANDUP · MAY 20 · 27 MIN · 5 ATTENDEES</V2Caps>
        <h1 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 30, lineHeight: 1.02, letterSpacing: '-0.025em', fontWeight: 500 }}>
          North stars for the quarter — and <em style={{ fontStyle: 'italic', color: v2.accent }}>who’s carrying</em> what.
        </h1>

        <div className="mt-6 flex items-center gap-3 flex-wrap">
          {['S', 'M', 'R', 'K', 'P'].map((l, i) => (
            <span key={i} style={{ display: 'inline-block', height: 26, width: 26, borderRadius: 999, background: v2.cream2, color: v2.ink, fontFamily: v2Serif, fontWeight: 500, fontSize: 12, textAlign: 'center', lineHeight: '26px' }}>{l}</span>
          ))}
        </div>

        <section className="mt-10 pt-6" style={{ borderTop: `1px solid ${v2.rule}` }}>
          <V2Caps color={v2.accent}>DECISIONS · 3</V2Caps>
          <ol className="mt-3 space-y-4">
            {[
              'Souvik picks up the desktop pill polish for two weeks.',
              'Mira drives the Scribble editor redesign.',
              'Standup format shifts to async on Mondays.',
            ].map((d, i) => (
              <li key={i} className="flex gap-3">
                <V2Mono style={{ fontSize: 11, color: v2.accent, marginTop: 4 }}>0{i + 1}</V2Mono>
                <span style={{ fontFamily: v2Serif, fontSize: 17, lineHeight: 1.45, color: v2.ink }}>{d}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-10 pt-6" style={{ borderTop: `1px solid ${v2.rule}` }}>
          <V2Caps>ACTIONS · 7</V2Caps>
          <ul className="mt-3 space-y-3">
            {[
              ['Mira',   'Settings popover spec by Wednesday'],
              ['Roshni', 'Pull pricing analytics for the last 30 days'],
              ['Komal',  'Spec the team plan'],
              ['Sanjna', 'Move standups to async on Notion'],
            ].map(([who, t], i) => (
              <li key={i} className="flex items-start gap-3 pb-3" style={{ borderBottom: `1px solid ${v2.rule}` }}>
                <span style={{ display: 'inline-block', height: 22, width: 22, borderRadius: 999, background: v2.accentSoft, color: v2.ink, fontFamily: v2Serif, fontSize: 11, textAlign: 'center', lineHeight: '22px', fontWeight: 500, marginTop: 2 }}>{who[0]}</span>
                <div>
                  <V2Caps>{who.toUpperCase()}</V2Caps>
                  <div style={{ fontSize: 13, color: v2.ink, marginTop: 2, lineHeight: 1.4 }}>{t}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </article>
    </div>
  );
}

// ═══ DESKTOP · CONTEXT LABELS + STATES + UPDATE ═══════════════════════════

// 21. Desktop context labels (the "Optimized for X" thing)
function V2DesktopContextLabels() {
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <V2WinChrome title="OSCAR · CONTEXT-AWARE DICTATION · PHASE 6" />
      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        <V2DeskSidebar active="settings" />
        <main className="col-span-9 overflow-auto px-10 py-9">
          <V2Caps color={v2.accent}>CONTEXT-AWARE DICTATION · PHASE 6</V2Caps>
          <h1 className="mt-2" style={{ fontFamily: v2Serif, fontSize: 32, lineHeight: 1.02, letterSpacing: '-0.02em', fontWeight: 500 }}>
            Three places <em style={{ fontStyle: 'italic', color: v2.accent }}>&ldquo;Optimized for X&rdquo;</em> shows.
          </h1>
          <p className="mt-3 max-w-xl text-[13px] leading-relaxed" style={{ color: v2.inkSoft }}>
            A passive line. Never an interruption. Reads &ldquo;Optimized for Gmail&rdquo; when Oscar is sure; falls back to neutral when not.
          </p>

          <div className="mt-9 grid grid-cols-3 gap-5">
            {/* On the pill */}
            <div className="rounded-lg p-7" style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}>
              <V2Caps>01 · INSIDE THE PILL</V2Caps>
              <h3 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 20, fontWeight: 500, letterSpacing: '-0.01em' }}>Tucked into the pill itself.</h3>
              <div className="mt-7 flex items-center justify-center">
                <div className="inline-flex items-center gap-3 rounded-full px-4 py-2.5" style={{ background: v2.ink, color: v2.cream }}>
                  <span style={{ display: 'inline-block', height: 6, width: 6, borderRadius: 999, background: v2.accent }} />
                  <V2Mono style={{ fontSize: 10, color: v2.cream2, letterSpacing: '0.14em' }}>GMAIL</V2Mono>
                  <span style={{ fontSize: 11, color: v2.cream }}>· hold to dictate</span>
                </div>
              </div>
            </div>

            {/* Above the input */}
            <div className="rounded-lg p-7" style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}>
              <V2Caps>02 · ABOVE THE SCRIBBLE</V2Caps>
              <h3 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 20, fontWeight: 500, letterSpacing: '-0.01em' }}>Pinned at the top of the result.</h3>
              <div className="mt-7 rounded-md p-3.5" style={{ background: v2.cream, border: `1px solid ${v2.rule}` }}>
                <V2Caps color={v2.accent}>OPTIMIZED FOR GMAIL · HIGH CONFIDENCE</V2Caps>
                <p className="mt-2 text-[12px]" style={{ color: v2.ink, fontFamily: v2Serif, lineHeight: 1.5 }}>&ldquo;Thanks for the time today — sending over the deck and the Loom by EOD.&rdquo;</p>
              </div>
            </div>

            {/* In the recent list */}
            <div className="rounded-lg p-7" style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}>
              <V2Caps>03 · IN THE LIBRARY</V2Caps>
              <h3 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 20, fontWeight: 500, letterSpacing: '-0.01em' }}>Alongside the timestamp.</h3>
              <div className="mt-7 space-y-2">
                {[['GMAIL', 'high'], ['NOTION', 'high'], ['UNKNOWN', 'low']].map(([app, conf], i) => (
                  <div key={i} className="flex items-center justify-between text-[11px] py-1.5" style={{ borderBottom: `1px solid ${v2.rule}` }}>
                    <V2Mono style={{ color: v2.ink }}>14:0{i + 2}</V2Mono>
                    <V2Mono style={{ color: conf === 'high' ? v2.accent : v2.inkFaint }}>{app}</V2Mono>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="mt-9 max-w-2xl text-[13px] leading-relaxed" style={{ color: v2.inkSoft }}>
            Low confidence → falls back to <strong style={{ color: v2.ink }}>neutral cleanup</strong>. Never guesses. Never blocks the dictation.
          </p>
        </main>
      </div>
    </div>
  );
}

// 22. Desktop update notification
function V2DesktopUpdate() {
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <V2WinChrome title="OSCAR · UPDATE AVAILABLE" />
      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        <V2DeskSidebar active="home" />
        <main className="col-span-9 overflow-auto px-10 py-10">
          <V2Caps color={v2.accent}>UPDATE READY · v0.42.0</V2Caps>
          <h1 className="mt-2" style={{ fontFamily: v2Serif, fontSize: 40, lineHeight: 1, letterSpacing: '-0.025em', fontWeight: 500 }}>
            Quieter, <em style={{ fontStyle: 'italic', color: v2.accent }}>faster</em>, fewer bugs.
          </h1>
          <p className="mt-4 max-w-xl text-[14px] leading-relaxed" style={{ color: v2.inkSoft }}>A small one. Worth restarting for.</p>

          <div className="mt-10 grid grid-cols-12 gap-10">
            <div className="col-span-8">
              <V2Caps>RELEASE NOTES · v0.42.0</V2Caps>
              <ul className="mt-4 space-y-3 text-[14px] leading-relaxed" style={{ color: v2.ink }}>
                <li className="flex gap-3"><V2Mono style={{ fontSize: 10, color: v2.accent, marginTop: 6 }}>NEW</V2Mono> <span>Pill settings popover. Right-click the pill to change hotkey, position, and audio cues without opening Settings.</span></li>
                <li className="flex gap-3"><V2Mono style={{ fontSize: 10, color: v2.accent, marginTop: 6 }}>NEW</V2Mono> <span>Hinglish formatter now keeps romanized brand names verbatim.</span></li>
                <li className="flex gap-3"><V2Mono style={{ fontSize: 10, color: v2.inkFaint, marginTop: 6 }}>FAST</V2Mono> <span>18% faster Whisper inference on Apple Silicon.</span></li>
                <li className="flex gap-3"><V2Mono style={{ fontSize: 10, color: v2.inkFaint, marginTop: 6 }}>FIX</V2Mono> <span>Pill hover no longer steals focus from Slack on macOS.</span></li>
                <li className="flex gap-3"><V2Mono style={{ fontSize: 10, color: v2.inkFaint, marginTop: 6 }}>FIX</V2Mono> <span>Recording state survives a sleep-wake cycle.</span></li>
              </ul>
            </div>
            <aside className="col-span-4 rounded-lg p-6 self-start" style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}>
              <V2Caps>READY TO INSTALL</V2Caps>
              <div className="mt-3" style={{ fontFamily: v2Serif, fontSize: 22, fontWeight: 500 }}>32 MB · 1 min restart</div>
              <button className="mt-5 w-full rounded-full py-3 text-[13px] font-medium" style={{ background: v2.ink, color: v2.cream }}>Restart and update</button>
              <button className="mt-2 w-full text-[12px]" style={{ color: v2.inkSoft }}>Later — install on quit</button>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}

// 23. Desktop states gallery (hotkey conflict / mic denied / no calendar)
function V2DesktopStatesGallery() {
  function Card({ tag, h, body, glyph, cta }) {
    return (
      <div className="rounded-lg p-7 flex flex-col" style={{ background: v2.cream2, border: `1px solid ${v2.rule}`, minHeight: 280 }}>
        <V2Caps color={v2.accent}>{tag}</V2Caps>
        {glyph}
        <h3 className="mt-5" style={{ fontFamily: v2Serif, fontSize: 24, lineHeight: 1.05, fontWeight: 500, letterSpacing: '-0.015em' }}>{h}</h3>
        <p className="mt-3 text-[13px] leading-relaxed" style={{ color: v2.inkSoft }}>{body}</p>
        <div className="mt-auto pt-5">
          <button className="text-[12px] rounded-full px-4 py-2 font-medium" style={{ background: v2.ink, color: v2.cream }}>{cta}</button>
        </div>
      </div>
    );
  }
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <V2WinChrome title="OSCAR · STATES" />
      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        <V2DeskSidebar active="home" />
        <main className="col-span-9 overflow-auto px-10 py-9">
          <V2Caps>DESKTOP STATES · COMMON FRICTION</V2Caps>
          <h1 className="mt-2" style={{ fontFamily: v2Serif, fontSize: 32, lineHeight: 1, letterSpacing: '-0.02em', fontWeight: 500 }}>
            When something <em style={{ fontStyle: 'italic', color: v2.accent }}>blocks</em> you.
          </h1>
          <div className="mt-8 grid grid-cols-3 gap-4">
            <Card
              tag="HOTKEY CONFLICT"
              h="Another app owns Ctrl + Space."
              body="macOS Spotlight is using your hotkey. Pick a different combo or disable it system-wide."
              glyph={<div className="mt-4 inline-flex items-center gap-1.5">
                <kbd className="rounded-md px-2 py-1 font-mono text-[11px] font-semibold" style={{ border: `1px solid ${v2.rule}`, background: v2.cream }}>Ctrl</kbd>
                <span style={{ color: v2.inkFaint }}>+</span>
                <kbd className="rounded-md px-2 py-1 font-mono text-[11px] font-semibold line-through" style={{ border: `1px solid ${v2.rule}`, background: v2.cream, color: '#8c2f25' }}>Space</kbd>
              </div>}
              cta="Pick a new hotkey"
            />
            <Card
              tag="MIC DENIED"
              h="Oscar can’t hear you."
              body="The OS revoked microphone access. Three steps to get it back — Oscar will resume right where you left off."
              glyph={<svg className="mt-4" width="32" height="32" viewBox="0 0 24 24" fill="none"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3z" stroke="#8c2f25" strokeWidth="1.5" /><path d="M19 11a7 7 0 0 1-14 0M12 18v3" stroke="#8c2f25" strokeWidth="1.5" strokeLinecap="round" /><path d="M3 3l18 18" stroke="#8c2f25" strokeWidth="2" strokeLinecap="round" /></svg>}
              cta="Open Privacy settings"
            />
            <Card
              tag="NO CALENDAR"
              h="No upcoming meetings to record."
              body="Connect Google Calendar so Oscar can offer to record meetings as they start. Optional, of course."
              glyph={<svg className="mt-4" width="32" height="32" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="2" stroke={v2.inkSoft} strokeWidth="1.5" /><path d="M8 3v4M16 3v4M3 10h18" stroke={v2.inkSoft} strokeWidth="1.5" strokeLinecap="round" /></svg>}
              cta="Connect Google Calendar"
            />
          </div>
        </main>
      </div>
    </div>
  );
}

// ═══ LEGAL ════════════════════════════════════════════════════════════════
function V2WebLegal() {
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      <header className="flex items-center justify-between px-14 py-7" style={{ borderBottom: `1px solid ${v2.rule}` }}>
        <V2Wordmark />
        <nav className="flex items-center gap-8">
          <span style={{ fontFamily: v2Mono, fontSize: 11, letterSpacing: '0.18em', color: v2.ink, borderBottom: `1px solid ${v2.ink}`, paddingBottom: 2 }}>PRIVACY</span>
          <V2Caps>TERMS</V2Caps>
          <V2Caps>REFUNDS</V2Caps>
        </nav>
      </header>

      <article className="mx-auto px-14 py-16 grid grid-cols-12 gap-14" style={{ maxWidth: 1180 }}>
        <aside className="col-span-3">
          <div style={{ position: 'sticky', top: 60 }}>
            <V2Caps>ON THIS PAGE</V2Caps>
            <nav className="mt-4 space-y-2.5 text-[13px]" style={{ color: v2.inkSoft }}>
              {['What we collect', 'What we don’t', 'Audio handling', 'How long we keep it', 'Third parties', 'Your rights', 'Changes', 'Contact'].map((t, i) => (
                <div key={i} style={{ color: i === 0 ? v2.ink : v2.inkSoft, fontWeight: i === 0 ? 500 : 400 }}>{i === 0 && '→ '}{t}</div>
              ))}
            </nav>
          </div>
        </aside>

        <main className="col-span-9" style={{ maxWidth: 760 }}>
          <V2Caps>LEGAL · PRIVACY POLICY · LAST UPDATED MAY 1, 2026</V2Caps>
          <h1 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 72, lineHeight: 0.96, letterSpacing: '-0.025em', fontWeight: 500 }}>
            What we <em style={{ fontStyle: 'italic', color: v2.accent }}>do</em> with your voice.
          </h1>
          <p className="mt-7 text-[20px] leading-relaxed" style={{ color: v2.ink, fontFamily: v2Serif }}>
            Oscar is a voice tool. We take that responsibility seriously. This page is the long version. The short version: <strong>we keep what makes the product work, and nothing else</strong>.
          </p>

          <h2 className="mt-14" style={{ fontFamily: v2Serif, fontSize: 32, fontWeight: 500, letterSpacing: '-0.015em' }}>What we collect</h2>
          <p className="mt-3 text-[16px] leading-relaxed" style={{ color: v2.ink }}>
            Your account email, the text of your transcripts (so the library is searchable), your vocabulary entries, and basic usage telemetry (which features you use, crash reports). That&rsquo;s the whole list.
          </p>

          <h2 className="mt-12" style={{ fontFamily: v2Serif, fontSize: 32, fontWeight: 500, letterSpacing: '-0.015em' }}>What we don&rsquo;t</h2>
          <p className="mt-3 text-[16px] leading-relaxed" style={{ color: v2.ink }}>
            Audio recordings. By default, audio is transcribed and discarded. You can opt to keep audio for re-transcription — it stays on your machine, never on our servers. We don&rsquo;t train models on your content. We don&rsquo;t sell anything.
          </p>

          <h2 className="mt-12" style={{ fontFamily: v2Serif, fontSize: 32, fontWeight: 500, letterSpacing: '-0.015em' }}>Audio handling</h2>
          <p className="mt-3 text-[16px] leading-relaxed" style={{ color: v2.ink }}>
            On desktop, audio is processed locally via Whisper when possible. When we use a cloud transcription provider (currently Deepgram, on the &ldquo;cloud&rdquo; tier), the audio is sent over TLS, transcribed in volatile memory, and discarded within seconds. No copies. No archives.
          </p>

          <h2 className="mt-12" style={{ fontFamily: v2Serif, fontSize: 32, fontWeight: 500, letterSpacing: '-0.015em' }}>How long we keep it</h2>
          <p className="mt-3 text-[16px] leading-relaxed" style={{ color: v2.ink }}>
            Transcripts and vocabulary stay until you delete them. Account deletion triggers a 30-day soft-delete (so you can change your mind), then everything is purged from databases and backups.
          </p>
        </main>
      </article>
    </div>
  );
}

// ═══ OVERLAYS · CANCEL SUB + TRASH SHEET ══════════════════════════════════

// 24. Cancel subscription
function V2OverlayCancelSub() {
  return (
    <div style={{ background: 'rgba(15,13,10,0.55)', minHeight: '100%', fontFamily: v2Sans, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div className="rounded-2xl overflow-hidden" style={{ background: v2.cream, color: v2.ink, width: 560, boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
        <div className="px-9 pt-9 pb-9">
          <V2Caps color="#8c2f25">CANCEL SUBSCRIPTION</V2Caps>
          <h1 className="mt-2" style={{ fontFamily: v2Serif, fontSize: 38, lineHeight: 1.0, letterSpacing: '-0.025em', fontWeight: 500 }}>
            Before you <em style={{ fontStyle: 'italic', color: v2.accent }}>go</em>…
          </h1>
          <p className="mt-4 text-[14px] leading-relaxed" style={{ color: v2.inkSoft }}>
            Your Pro plan stays active until <strong>July 14, 2026</strong>. After that you&rsquo;ll drop to Free — 30 minutes a month, 5 Scribbles stored. Existing Scribbles stay yours, but you won&rsquo;t make new ones beyond the cap.
          </p>

          <div className="mt-7">
            <V2Caps>QUICK QUESTION · WHY</V2Caps>
            <div className="mt-3 space-y-2">
              {[
                'Too expensive',
                'Not using it enough',
                'Found something better',
                'Privacy concerns',
                'Just trying it out',
                'Other',
              ].map((r, i) => (
                <button key={r} className="w-full text-left rounded-md py-2.5 px-4 text-[13px]" style={{ background: i === 1 ? v2.cream2 : 'transparent', border: i === 1 ? `1px solid ${v2.accent}` : `1px solid ${v2.rule}`, color: v2.ink }}>{r}</button>
              ))}
            </div>
          </div>

          <div className="mt-7 rounded-md p-4" style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}>
            <V2Caps color={v2.accent}>BEFORE YOU GO</V2Caps>
            <p className="mt-2 text-[12px] leading-relaxed" style={{ color: v2.inkSoft }}>Would a pause for 3 months help? Keep your data, keep your vocabulary, no charges. Resume anytime.</p>
            <button className="mt-3 text-[12px] rounded-full px-4 py-2" style={{ background: v2.ink, color: v2.cream }}>Pause instead</button>
          </div>

          <div className="mt-7 flex items-center gap-3">
            <button className="text-[13px] rounded-full px-5 py-2.5" style={{ color: '#8c2f25', border: '1px solid #d6b3a8' }}>Cancel anyway</button>
            <button className="text-[13px]" style={{ color: v2.inkSoft }}>Keep Pro</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 25. Trash sheet (right slide-in)
function V2OverlayTrashSheet() {
  return (
    <div style={{ position: 'relative', background: 'rgba(15,13,10,0.3)', minHeight: '100%', fontFamily: v2Sans, padding: 40 }}>
      {/* Faint background */}
      <div className="opacity-30" style={{ pointerEvents: 'none' }}>
        <V2WebHeader active="LIBRARY" />
        <div className="px-14 pt-14">
          <V2Caps>YOUR LIBRARY · 86 SCRIBBLES</V2Caps>
          <h1 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 64, lineHeight: 0.98, letterSpacing: '-0.025em', fontWeight: 500 }}>Everything you kept.</h1>
        </div>
      </div>

      <aside style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 440, background: v2.cream, borderLeft: `1px solid ${v2.rule}`, boxShadow: '-24px 0 64px rgba(0,0,0,0.25)', padding: 32, overflow: 'auto' }}>
        <div className="flex items-center justify-between">
          <V2Caps>TRASH · 4 ITEMS</V2Caps>
          <button className="text-[12px]" style={{ color: v2.inkSoft }}>Close ×</button>
        </div>
        <h2 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 36, lineHeight: 1.0, letterSpacing: '-0.025em', fontWeight: 500 }}>
          Things you almost <em style={{ fontStyle: 'italic', color: v2.accent }}>lost</em>.
        </h2>
        <p className="mt-3 text-[13px] leading-relaxed" style={{ color: v2.inkSoft }}>Anything deleted is held for 30 days. Restore what should still be a Scribble.</p>

        <div className="mt-7">
          {[
            ['MON · 09:14', 'Half-finished email to Anita', '29 days'],
            ['SUN · 16:02', 'Mistyped Cursor note',          '28 days'],
            ['SUN · 11:30', 'Standup notes (old format)',    '28 days'],
            ['FRI · 14:00', 'Voice doodle',                  '25 days'],
          ].map(([d, t, e], i) => (
            <div key={i} className="py-4" style={{ borderBottom: `1px solid ${v2.rule}` }}>
              <V2Mono style={{ fontSize: 11, color: v2.ink }}>{d}</V2Mono>
              <h3 className="mt-1" style={{ fontFamily: v2Serif, fontSize: 16, fontWeight: 500, color: v2.ink, letterSpacing: '-0.005em' }}>{t}</h3>
              <div className="mt-1.5 flex items-center justify-between">
                <V2Caps>EXPIRES IN {e.toUpperCase()}</V2Caps>
                <button className="text-[11px]" style={{ color: v2.accent }}>Restore</button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-5" style={{ borderTop: `1px solid ${v2.rule}` }}>
          <button className="text-[12px] rounded-full px-4 py-2" style={{ color: '#8c2f25', border: '1px solid #d6b3a8' }}>Empty trash</button>
        </div>
      </aside>
    </div>
  );
}

Object.assign(window, {
  V2WebSearchResults, V2WebFolderDetail, V2WebLibraryEmpty, V2WebMinutesShare,
  V2WebTeamFeed, V2WebTeamDocs, V2WebTeamDocSingle,
  V2WebOrgDetails, V2WebOrgMembers, V2WebOrgInvites,
  V2WebInviteAccept, V2WebCreateWorkspace,
  V2WebDesktopCallback, V2WebExportData, V2WebDeleteAccount,
  V2MobilePricing, V2MobileRecording, V2MobileProcessing, V2MobileResults, V2MobileMinutes,
  V2DesktopContextLabels, V2DesktopUpdate, V2DesktopStatesGallery,
  V2WebLegal, V2OverlayCancelSub, V2OverlayTrashSheet,
});
