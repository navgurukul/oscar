// oscar-v2-screens2.jsx — Wave 2: pricing, capture flow, AI extras, remaining
// settings, overlays, states, desktop extras, mobile extras.

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

// ─── Shared settings shell ─────────────────────────────────────────────
function V2SettingsShell({ active, eyebrow, title, children, lead }) {
  const sections = [
    { id: 'account',  label: 'Account',         sub: 'You' },
    { id: 'billing',  label: 'Plans & billing', sub: 'Pro · annual' },
    { id: 'vocab',    label: 'Vocabulary',      sub: '48 words' },
    { id: 'folders',  label: 'Folders',         sub: '4 folders' },
    { id: 'privacy',  label: 'Data & privacy',  sub: 'Export · delete' },
  ];
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      <V2WebHeader active="SETTINGS" />
      <div className="grid grid-cols-12" style={{ borderTop: `1px solid ${v2.rule}` }}>
        <aside className="col-span-3 px-12 py-14" style={{ borderRight: `1px solid ${v2.rule}` }}>
          <V2Caps>SETTINGS</V2Caps>
          <nav className="mt-7 space-y-6">
            {sections.map(s => (
              <div key={s.id} style={{ borderLeft: s.id === active ? `2px solid ${v2.accent}` : '2px solid transparent', paddingLeft: 14 }}>
                <div style={{ fontFamily: v2Serif, fontSize: 19, fontWeight: 500, color: s.id === active ? v2.ink : v2.inkSoft, letterSpacing: '-0.01em' }}>{s.label}</div>
                <div className="mt-0.5"><V2Caps>{s.sub.toUpperCase()}</V2Caps></div>
              </div>
            ))}
          </nav>
        </aside>
        <main className="col-span-9 px-14 py-14">
          <V2Caps>{eyebrow.toUpperCase()}</V2Caps>
          <h1 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 60, lineHeight: 0.98, letterSpacing: '-0.025em', fontWeight: 500 }}>{title}</h1>
          {lead && <p className="mt-5 max-w-xl text-[15px] leading-relaxed" style={{ color: v2.inkSoft }}>{lead}</p>}
          <div className={lead ? 'mt-12' : 'mt-10'}>{children}</div>
        </main>
      </div>
    </div>
  );
}

// ═══ WEB · PRICING ════════════════════════════════════════════════════════
function V2WebPricing() {
  const tiers = [
    {
      name: 'Free', tag: 'For trying it on', price: '₹0', cadence: 'forever',
      blurb: 'Enough to feel the difference. Not enough to live on it.',
      features: ['30 minutes of dictation / month', '5 Scribbles stored', '1 device', 'Auto-cleanup'],
      cta: 'Start free', featured: false,
    },
    {
      name: 'Pro', tag: 'For people who type too much', price: '₹699', cadence: 'per month · save 20% annually',
      blurb: 'Everything. Unlimited minutes, all surfaces, the whole archive.',
      features: ['Unlimited dictation', 'Unlimited Scribbles + Minutes', 'Web + desktop + mobile', 'Context-aware dictation', 'Vocabulary & folders', 'Custom transforms & translations', 'Priority support'],
      cta: 'Start 14-day trial', featured: true,
    },
    {
      name: 'Teams', tag: 'For working with people', price: '₹599', cadence: 'per seat · billed annually',
      blurb: 'Shared workspace, shared vocabulary, shared Minutes.',
      features: ['Everything in Pro', 'Shared workspace + folders', 'Team vocabulary', 'Posted Minutes to Slack / Notion', 'SSO', 'Admin controls'],
      cta: 'Talk to us', featured: false,
    },
  ];
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      <header className="flex items-center justify-between px-14 py-7">
        <V2Wordmark />
        <nav className="flex items-center gap-9">
          <V2Caps>PRODUCT</V2Caps>
          <span style={{ fontFamily: v2Mono, fontSize: 11, letterSpacing: '0.18em', color: v2.ink, borderBottom: `1px solid ${v2.ink}`, paddingBottom: 2 }}>PRICING</span>
          <V2Caps>BLOG</V2Caps>
          <V2Caps>SIGN IN</V2Caps>
        </nav>
        <button className="rounded-full px-5 py-2.5 text-[13px] font-medium" style={{ background: v2.ink, color: v2.cream }}>Get Oscar</button>
      </header>

      <section className="px-14 pt-24 pb-16 text-center">
        <V2Caps>PRICING · TWO TIERS, NO TRICKS</V2Caps>
        <h1 className="mt-5 mx-auto" style={{ fontFamily: v2Serif, fontSize: 96, lineHeight: 0.96, letterSpacing: '-0.03em', fontWeight: 500, maxWidth: 900 }}>
          Free to try.<br /><em style={{ fontStyle: 'italic', color: v2.accent }}>Pro</em> when you&rsquo;re hooked.
        </h1>
        <p className="mt-7 mx-auto max-w-lg text-[16px] leading-relaxed" style={{ color: v2.inkSoft }}>
          Most people upgrade within a week. We&rsquo;re fine with that.
        </p>
      </section>

      <section className="px-14 pb-24">
        <div className="grid grid-cols-3 gap-8">
          {tiers.map((t) => (
            <div key={t.name} className="rounded-lg p-9" style={{ background: t.featured ? v2.ink : v2.cream2, color: t.featured ? v2.cream : v2.ink, border: t.featured ? 'none' : `1px solid ${v2.rule}` }}>
              <V2Caps color={t.featured ? v2.accent : v2.inkFaint}>{t.tag.toUpperCase()}</V2Caps>
              <h3 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 40, lineHeight: 1.0, fontWeight: 500, letterSpacing: '-0.02em' }}>{t.name}</h3>
              <div className="mt-7 flex items-baseline gap-3">
                <span style={{ fontFamily: v2Serif, fontSize: 56, fontWeight: 500, lineHeight: 1.0, letterSpacing: '-0.025em' }}>{t.price}</span>
                <V2Mono style={{ fontSize: 11, color: t.featured ? '#a8a39a' : v2.inkFaint, letterSpacing: '0.04em' }}>{t.cadence}</V2Mono>
              </div>
              <p className="mt-5 text-[14px] leading-relaxed" style={{ color: t.featured ? '#cfc9bd' : v2.inkSoft }}>{t.blurb}</p>
              <button className="mt-7 w-full rounded-full py-3 text-[14px] font-medium" style={{ background: t.featured ? v2.accent : v2.ink, color: t.featured ? v2.ink : v2.cream }}>{t.cta}</button>
              <ul className="mt-9 space-y-3 text-[13px] leading-relaxed">
                {t.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ marginTop: 5 }}><path d="M5 12l5 5L20 7" stroke={v2.accent} strokeWidth="2.5" strokeLinecap="round" /></svg>
                    <span style={{ color: t.featured ? v2.cream : v2.ink }}>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="px-14 py-16" style={{ borderTop: `1px solid ${v2.rule}` }}>
        <div className="grid grid-cols-12 gap-10">
          <div className="col-span-3"><V2Caps>QUESTIONS · ANSWERED</V2Caps></div>
          <div className="col-span-9">
            {[
              ['Can I cancel anytime?', 'Yes. Cancel from settings, no questions asked. Your data stays available for 30 days.'],
              ['Is my audio private?', 'Audio is processed and discarded. We keep the transcript, not the recording.'],
              ['Does it work offline?', 'The desktop app falls back to local Whisper when offline — slower, but it works.'],
              ['Is there a team plan?', 'Yes — Teams. Shared workspace, vocabulary, Minutes. Talk to us.'],
            ].map(([q, a], i) => (
              <div key={i} className="grid grid-cols-12 gap-8 py-6" style={{ borderBottom: `1px solid ${v2.rule}` }}>
                <div className="col-span-4" style={{ fontFamily: v2Serif, fontSize: 19, fontWeight: 500, color: v2.ink, letterSpacing: '-0.005em' }}>{q}</div>
                <div className="col-span-8 text-[14px] leading-relaxed" style={{ color: v2.inkSoft }}>{a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

// ═══ WEB · CAPTURE · RECORDING ════════════════════════════════════════════
function V2WebRecording() {
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <V2WebHeader active="TODAY" />
      <main className="flex-1 flex items-center justify-center px-14 py-20">
        <div className="text-center" style={{ maxWidth: 720 }}>
          <V2Caps color={v2.accent}>● RECORDING · 0:14</V2Caps>
          <h1 className="mt-5" style={{ fontFamily: v2Serif, fontSize: 88, lineHeight: 0.96, letterSpacing: '-0.025em', fontWeight: 500 }}>
            <em style={{ fontStyle: 'italic', color: v2.accent }}>Listening</em>.
          </h1>
          <p className="mt-7 mx-auto max-w-md text-[15px] leading-relaxed" style={{ color: v2.inkSoft }}>
            Speak naturally. Oscar will tighten and format when you&rsquo;re done.
          </p>

          <div className="mt-16 flex items-center justify-center gap-1.5" style={{ height: 140 }}>
            {Array.from({ length: 32 }).map((_, i) => {
              const seed = Math.sin(i * 0.42 + 1.4);
              const h = 14 + Math.abs(seed) * 92;
              return <span key={i} className="rounded-full" style={{ width: 4, height: h, background: v2.accent, opacity: 0.5 + Math.abs(Math.sin(i * 0.3)) * 0.4 }} />;
            })}
          </div>

          <p className="mt-16 mx-auto" style={{ color: v2.inkSoft, fontFamily: v2Serif, fontSize: 20, lineHeight: 1.55, maxWidth: 620 }}>
            &ldquo;OK so the big thing from today is the pricing experiments we ran this month, and only two of them moved&hellip;&rdquo;
          </p>

          <div className="mt-14 flex items-center justify-center gap-4">
            <button className="rounded-full px-5 py-3 inline-flex items-center gap-2.5" style={{ background: v2.ink, color: v2.cream }}>
              <span style={{ display: 'inline-block', height: 9, width: 9, background: v2.accent, borderRadius: 2 }} />
              <span style={{ fontSize: 13 }}>Stop · then Oscar shapes it</span>
            </button>
            <button className="text-[13px]" style={{ color: v2.inkSoft }}>· Esc to discard</button>
          </div>
        </div>
      </main>
    </div>
  );
}

// ═══ WEB · CAPTURE · PROCESSING ═══════════════════════════════════════════
function V2WebProcessing() {
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <V2WebHeader active="TODAY" />
      <main className="flex-1 flex items-center justify-center px-14 py-20">
        <div className="text-center" style={{ maxWidth: 720 }}>
          <V2Caps>PROCESSING · ABOUT 4 SECONDS</V2Caps>
          <h1 className="mt-5" style={{ fontFamily: v2Serif, fontSize: 84, lineHeight: 0.96, letterSpacing: '-0.025em', fontWeight: 500 }}>
            <em style={{ fontStyle: 'italic', color: v2.accent }}>Shaping</em><br />what you said.
          </h1>

          <div className="mt-14 mx-auto text-left" style={{ maxWidth: 460 }}>
            <div className="space-y-4">
              {[
                { label: 'Transcribing audio',           state: 'done' },
                { label: 'Removing filler words',         state: 'done' },
                { label: 'Detecting context · Slack',     state: 'done' },
                { label: 'Formatting for the active app', state: 'active' },
                { label: 'Suggesting a title',            state: 'pending' },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-4">
                  <span style={{ display: 'inline-flex', width: 18, height: 18, alignItems: 'center', justifyContent: 'center' }}>
                    {step.state === 'done'    && <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke={v2.accent} strokeWidth="3" strokeLinecap="round" /></svg>}
                    {step.state === 'active'  && <span style={{ height: 10, width: 10, borderRadius: 999, background: v2.accent }} />}
                    {step.state === 'pending' && <span style={{ height: 7, width: 7, borderRadius: 999, background: v2.ruleHard }} />}
                  </span>
                  <V2Mono style={{ fontSize: 13, color: step.state === 'pending' ? v2.inkFaint : v2.ink }}>{step.label}</V2Mono>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-14 mx-auto text-[13px]" style={{ color: v2.inkSoft, maxWidth: 360 }}>
            Oscar takes a moment to clean and format. You&rsquo;ll see the result next.
          </p>
        </div>
      </main>
    </div>
  );
}

// ═══ WEB · CAPTURE · RESULTS ══════════════════════════════════════════════
function V2WebResults() {
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      <V2WebHeader active="TODAY" />
      <article className="px-14 pt-14 pb-20 mx-auto" style={{ maxWidth: 1180 }}>
        <V2Caps color={v2.accent}>READY · 4 SECONDS · CLEAN COPY</V2Caps>
        <h1 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 60, lineHeight: 1.0, letterSpacing: '-0.025em', fontWeight: 500 }}>
          Pricing experiments — what we<br />actually <em style={{ fontStyle: 'italic', color: v2.accent }}>learned</em>.
        </h1>

        <div className="mt-12 grid grid-cols-12 gap-14">
          <div className="col-span-8" style={{ borderRight: `1px solid ${v2.rule}`, paddingRight: 40 }}>
            <V2Caps>YOUR VOICE · UNEDITED</V2Caps>
            <div className="mt-3 space-y-5" style={{ fontFamily: v2Serif, fontSize: 18, lineHeight: 1.65, color: v2.ink }}>
              <p>OK so the big thing from the last month is that we ran four pricing experiments and only two of them actually moved a metric we care about.</p>
              <p>The first one was the team plan landing page where we just said &ldquo;for teams&rdquo; instead of listing seats. That worked. Conversion went from 1.4 to 2.1 percent.</p>
              <p>The second thing that worked was the annual save percentage. We bumped it from 17 to 20 and saw the annual ratio go up by about 4 points.</p>
            </div>
          </div>
          <aside className="col-span-4 space-y-8">
            <div>
              <V2Caps color={v2.accent}>OSCAR&rsquo;S MARGIN</V2Caps>
              <p className="mt-2" style={{ fontFamily: v2Serif, fontSize: 21, lineHeight: 1.4, color: v2.ink, letterSpacing: '-0.005em' }}>
                4 experiments. <em style={{ fontStyle: 'italic', color: v2.accent }}>Two won.</em> Push them harder next month.
              </p>
            </div>
            <div>
              <V2Caps>WHAT WORKED</V2Caps>
              <ul className="mt-2 space-y-1.5 text-[13px]" style={{ color: v2.inkSoft }}>
                <li>· &ldquo;For teams&rdquo; headline · 1.4% → 2.1%</li>
                <li>· Annual save 17% → 20% · +4pt</li>
              </ul>
            </div>
            <div>
              <V2Caps>SUGGESTED TITLE</V2Caps>
              <p className="mt-2 text-[16px]" style={{ color: v2.ink, fontFamily: v2Serif }}>Pricing experiments — what we learned this month</p>
            </div>
            <div>
              <V2Caps>SUGGESTED FOLDER</V2Caps>
              <p className="mt-2 text-[14px]" style={{ color: v2.ink }}>→ Pricing</p>
            </div>
          </aside>
        </div>

        <div className="mt-14 pt-7 flex items-center justify-between" style={{ borderTop: `1px solid ${v2.rule}` }}>
          <V2Caps>SAVE TO LIBRARY · OR DISCARD</V2Caps>
          <div className="flex items-center gap-3">
            <button className="text-[13px] rounded-full px-4 py-2" style={{ border: `1px solid ${v2.rule}`, color: v2.inkSoft }}>Discard</button>
            <button className="text-[13px] rounded-full px-4 py-2" style={{ border: `1px solid ${v2.rule}`, color: v2.inkSoft }}>Edit first</button>
            <button className="text-[13px] rounded-full px-5 py-2.5 font-medium" style={{ background: v2.ink, color: v2.cream }}>Save Scribble</button>
          </div>
        </div>
      </article>
    </div>
  );
}

// ═══ WEB · SETTINGS · BILLING ═════════════════════════════════════════════
function V2WebSettingsBilling() {
  return (
    <V2SettingsShell
      active="billing"
      eyebrow="settings · plans & billing"
      title={<>Pro, on <em style={{ fontStyle: 'italic', color: v2.accent }}>annual</em>.</>}
      lead="You're saving 20% by paying yearly. Next charge ₹8,388 on July 14, 2026."
    >
      <section className="grid grid-cols-12 gap-10" style={{ borderTop: `1px solid ${v2.rule}`, paddingTop: 32 }}>
        <div className="col-span-3"><V2Caps>CURRENT PLAN</V2Caps></div>
        <div className="col-span-9 rounded-lg p-7" style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}>
          <div className="flex items-start justify-between">
            <div>
              <V2Caps color={v2.accent}>PRO · ANNUAL</V2Caps>
              <div className="mt-2 flex items-baseline gap-3">
                <span style={{ fontFamily: v2Serif, fontSize: 48, fontWeight: 500, letterSpacing: '-0.025em' }}>₹699</span>
                <span style={{ fontSize: 13, color: v2.inkSoft }}>per month · billed annually</span>
              </div>
              <p className="mt-3 text-[13px]" style={{ color: v2.inkSoft }}>Renews July 14, 2026 · saving 20% vs monthly.</p>
            </div>
            <button className="text-[12px] rounded-full px-4 py-2" style={{ border: `1px solid ${v2.rule}`, color: v2.inkSoft }}>Manage plan</button>
          </div>
        </div>
      </section>

      <section className="mt-12 grid grid-cols-12 gap-10" style={{ borderTop: `1px solid ${v2.rule}`, paddingTop: 32 }}>
        <div className="col-span-3"><V2Caps>PAYMENT</V2Caps></div>
        <div className="col-span-9">
          <div className="flex items-center justify-between py-4" style={{ borderBottom: `1px solid ${v2.rule}` }}>
            <div>
              <div style={{ fontSize: 14, color: v2.ink }}>HDFC Bank · •••• 4421</div>
              <V2Caps>EXPIRES 09 / 28</V2Caps>
            </div>
            <button className="text-[12px]" style={{ color: v2.accent }}>Update card →</button>
          </div>
        </div>
      </section>

      <section className="mt-12 grid grid-cols-12 gap-10" style={{ borderTop: `1px solid ${v2.rule}`, paddingTop: 32 }}>
        <div className="col-span-3"><V2Caps>INVOICES</V2Caps></div>
        <div className="col-span-9">
          {[
            ['Jul 14, 2025', '₹8,388.00', 'Pro · annual'],
            ['Jul 14, 2024', '₹6,990.00', 'Pro · annual'],
            ['Mar 12, 2024', '₹699.00',   'Pro · monthly'],
            ['Feb 12, 2024', '₹699.00',   'Pro · monthly'],
          ].map(([d, amt, plan], i) => (
            <div key={i} className="grid grid-cols-12 gap-4 py-3 items-center" style={{ borderBottom: `1px solid ${v2.rule}` }}>
              <V2Mono style={{ fontSize: 12, color: v2.ink, gridColumn: 'span 3 / span 3' }}>{d.toUpperCase()}</V2Mono>
              <span className="col-span-3" style={{ fontSize: 14, color: v2.ink }}>{amt}</span>
              <span className="col-span-4 text-[12px]" style={{ color: v2.inkSoft }}>{plan}</span>
              <button className="col-span-2 text-[12px] text-right" style={{ color: v2.inkFaint }}>Download PDF →</button>
            </div>
          ))}
        </div>
      </section>
    </V2SettingsShell>
  );
}

// ═══ WEB · SETTINGS · VOCABULARY ══════════════════════════════════════════
function V2WebSettingsVocabulary() {
  const words = [
    ['Hinglish',     'Slang · English+Hindi'],
    ['NavGurukul',   'Org name'],
    ['Murmur',       'Internal codename'],
    ['Scribble',     'Feature name'],
    ['Minutes',      'Feature name'],
    ['standup',      'Common term'],
    ['Souvik',       'Person'],
    ['Mira Patel',   'Person'],
    ['Roshni Jha',   'Person'],
    ['Komal Ahire',  'Person'],
    ['Sanjna Panwar','Person'],
    ['processItems', 'Code · function'],
    ['utils/data.ts','Code · file path'],
    ['Razorpay',     'Vendor'],
    ['Whisper',      'Tech · model'],
    ['Gemini',       'Tech · model'],
  ];
  return (
    <V2SettingsShell
      active="vocab"
      eyebrow="settings · vocabulary"
      title={<>Words Oscar should <em style={{ fontStyle: 'italic', color: v2.accent }}>know</em>.</>}
      lead="Names, jargon, file paths — the words Whisper would otherwise miss. Oscar treats this as the canonical spelling."
    >
      <div className="max-w-2xl flex items-center gap-3 rounded-full pl-5 pr-2 py-2" style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}>
        <V2Mono style={{ fontSize: 11, color: v2.inkFaint }}>ADD A WORD</V2Mono>
        <input placeholder="e.g. Linear, Tauri, hi-fi" className="flex-1 bg-transparent outline-none py-2 text-[14px]" style={{ color: v2.ink, fontFamily: v2Sans }} />
        <button className="text-[12px] rounded-full px-4 py-2 font-medium" style={{ background: v2.ink, color: v2.cream }}>Add</button>
      </div>

      <div className="mt-10 pt-7" style={{ borderTop: `1px solid ${v2.rule}` }}>
        <V2Caps>YOUR VOCABULARY · 48 WORDS · 16 SHOWN</V2Caps>
        <div className="mt-5 grid grid-cols-2 gap-x-12">
          {words.map(([w, note], i) => (
            <div key={i} className="flex items-center justify-between py-3" style={{ borderBottom: `1px solid ${v2.rule}` }}>
              <div className="flex items-baseline gap-3">
                <span style={{ fontFamily: v2Serif, fontSize: 17, fontWeight: 500, color: v2.ink, letterSpacing: '-0.005em' }}>{w}</span>
                <V2Caps>{note.toUpperCase()}</V2Caps>
              </div>
              <button className="text-[11px]" style={{ color: v2.inkFaint }}>Remove</button>
            </div>
          ))}
        </div>
      </div>
    </V2SettingsShell>
  );
}

// ═══ WEB · SETTINGS · FOLDERS ═════════════════════════════════════════════
function V2WebSettingsFolders() {
  const folders = [
    { name: 'Pricing',     count: 12, latest: 'Pricing experiments — what we learned' },
    { name: 'Engineering', count: 24, latest: 'Refactor note for processItems' },
    { name: 'Standup',     count: 8,  latest: 'North stars for the quarter' },
    { name: 'Inbox',       count: 7,  latest: 'Reply to Roshni on the deck' },
  ];
  return (
    <V2SettingsShell
      active="folders"
      eyebrow="settings · folders"
      title={<>How you <em style={{ fontStyle: 'italic', color: v2.accent }}>group</em> things.</>}
      lead="Oscar can route Scribbles to folders automatically based on what you said. You can also drag them around."
    >
      <button className="inline-flex items-center gap-2.5 rounded-full px-5 py-2.5 text-[13px] font-medium" style={{ background: v2.ink, color: v2.cream }}>
        + New folder
      </button>

      <div className="mt-10 pt-7" style={{ borderTop: `1px solid ${v2.rule}` }}>
        <V2Caps>YOUR FOLDERS · 4 · 51 SCRIBBLES FILED</V2Caps>
        <div className="mt-5 grid grid-cols-2 gap-5">
          {folders.map((f, i) => (
            <div key={i} className="rounded-lg p-6" style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}>
              <div className="flex items-baseline justify-between">
                <h3 style={{ fontFamily: v2Serif, fontSize: 26, fontWeight: 500, color: v2.ink, letterSpacing: '-0.015em' }}>{f.name}</h3>
                <V2Mono style={{ fontSize: 13, color: v2.accent }}>{f.count}</V2Mono>
              </div>
              <div className="mt-5 text-[12px] leading-relaxed" style={{ color: v2.inkSoft }}>
                <V2Caps>LATEST</V2Caps>
                <p className="mt-1.5" style={{ fontSize: 13, color: v2.ink }}>{f.latest}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </V2SettingsShell>
  );
}

// ═══ WEB · SETTINGS · PRIVACY ═════════════════════════════════════════════
function V2WebSettingsPrivacy() {
  function Toggle({ label, desc, on }) {
    return (
      <div className="flex items-start justify-between py-5" style={{ borderBottom: `1px solid ${v2.rule}` }}>
        <div className="max-w-md">
          <div style={{ fontSize: 14, color: v2.ink, fontWeight: 500 }}>{label}</div>
          <p className="mt-1 text-[12px] leading-relaxed" style={{ color: v2.inkSoft }}>{desc}</p>
        </div>
        <div className="rounded-full" style={{ height: 24, width: 44, background: on ? v2.accent : v2.ruleHard, position: 'relative', flexShrink: 0 }}>
          <div className="rounded-full" style={{ position: 'absolute', top: 2, left: on ? 22 : 2, height: 20, width: 20, background: v2.cream, transition: 'left 0.2s' }} />
        </div>
      </div>
    );
  }
  return (
    <V2SettingsShell
      active="privacy"
      eyebrow="settings · data & privacy"
      title={<>What we <em style={{ fontStyle: 'italic', color: v2.accent }}>do</em> with your voice.</>}
      lead="Oscar transcribes locally on desktop when possible. Audio never leaves your machine unless you opt in. Transcripts sync if you're signed in."
    >
      <section className="grid grid-cols-12 gap-10" style={{ borderTop: `1px solid ${v2.rule}`, paddingTop: 32 }}>
        <div className="col-span-3"><V2Caps>WHAT&rsquo;S STORED</V2Caps></div>
        <div className="col-span-9">
          <Toggle label="Audio recordings" desc="Audio is discarded by default. Turn on to keep a local copy for re-transcription." on={false} />
          <Toggle label="Transcripts"      desc="Cleaned text is stored. Required to make your library searchable."                  on={true} />
          <Toggle label="Telemetry"        desc="Anonymous usage stats — feature use, crash reports. No content."                    on={true} />
        </div>
      </section>

      <section className="mt-12 grid grid-cols-12 gap-10" style={{ borderTop: `1px solid ${v2.rule}`, paddingTop: 32 }}>
        <div className="col-span-3"><V2Caps>YOUR DATA</V2Caps></div>
        <div className="col-span-9 space-y-4">
          <div className="rounded-lg p-5 flex items-start justify-between gap-6" style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}>
            <div>
              <div style={{ fontFamily: v2Serif, fontSize: 20, fontWeight: 500 }}>Export everything</div>
              <p className="mt-1 text-[13px] leading-relaxed" style={{ color: v2.inkSoft }}>Download a ZIP of every Scribble, every Minutes, every vocabulary entry. Markdown + JSON.</p>
            </div>
            <button className="text-[12px] rounded-full px-4 py-2 font-medium shrink-0" style={{ background: v2.ink, color: v2.cream }}>Start export</button>
          </div>
          <div className="rounded-lg p-5 flex items-start justify-between gap-6" style={{ border: '1px solid #d6b3a8' }}>
            <div>
              <div style={{ fontFamily: v2Serif, fontSize: 20, fontWeight: 500, color: '#8c2f25' }}>Delete account</div>
              <p className="mt-1 text-[13px] leading-relaxed" style={{ color: v2.inkSoft }}>Permanently delete every Scribble, every Minutes, your subscription. Cannot be undone.</p>
            </div>
            <button className="text-[12px] rounded-full px-4 py-2 shrink-0" style={{ color: '#8c2f25', border: '1px solid #d6b3a8' }}>Delete account</button>
          </div>
        </div>
      </section>
    </V2SettingsShell>
  );
}

// ═══ WEB · TRANSFORM ══════════════════════════════════════════════════════
function V2WebTransform() {
  function Opt({ t, active }) {
    return (
      <div className="flex items-center gap-2.5 py-1.5 px-2 rounded" style={{ background: active ? v2.accentSoft : 'transparent' }}>
        <span style={{ display: 'inline-block', height: 11, width: 11, borderRadius: 999, background: active ? v2.accent : 'transparent', border: active ? 'none' : `1.5px solid ${v2.ruleHard}` }} />
        <span style={{ fontSize: 13, color: v2.ink, fontWeight: active ? 500 : 400 }}>{t}</span>
      </div>
    );
  }
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      <V2WebHeader active="LIBRARY" />
      <article className="px-14 py-14">
        <V2Caps>SCRIBBLE · MAY 18 · TRANSFORM</V2Caps>
        <h1 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 60, lineHeight: 1.0, letterSpacing: '-0.025em', fontWeight: 500, maxWidth: 940 }}>
          Same words, <em style={{ fontStyle: 'italic', color: v2.accent }}>different shape</em>.
        </h1>

        <div className="mt-12 grid grid-cols-12 gap-12">
          <div className="col-span-3">
            <V2Caps color={v2.accent}>TRANSFORM</V2Caps>

            <div className="mt-5">
              <V2Caps>TONE</V2Caps>
              <div className="mt-2 space-y-1">
                <Opt t="As you said it" active={false} />
                <Opt t="More formal"    active={true} />
                <Opt t="More casual"    active={false} />
                <Opt t="For a boss"     active={false} />
                <Opt t="For a teammate" active={false} />
              </div>
            </div>

            <div className="mt-7">
              <V2Caps>LENGTH</V2Caps>
              <div className="mt-2 space-y-1">
                <Opt t="Original"         active={false} />
                <Opt t="Shorter"          active={true} />
                <Opt t="Bullet list"      active={false} />
                <Opt t="Just the headline" active={false} />
              </div>
            </div>

            <div className="mt-7">
              <V2Caps>AUDIENCE</V2Caps>
              <div className="mt-2 space-y-1">
                <Opt t="Inside the team" active={false} />
                <Opt t="For customers"   active={false} />
                <Opt t="For investors"   active={false} />
                <Opt t="For a stranger"  active={false} />
              </div>
            </div>
          </div>

          <div className="col-span-9 grid grid-cols-2 gap-10">
            <div style={{ borderRight: `1px solid ${v2.rule}`, paddingRight: 30 }}>
              <V2Caps>ORIGINAL</V2Caps>
              <div className="mt-3 space-y-4" style={{ fontFamily: v2Serif, fontSize: 17, lineHeight: 1.6, color: v2.ink }}>
                <p>OK so the big thing from last month is that we ran four pricing experiments and only two of them actually moved a metric we care about. The first one was the team plan landing page where we said &ldquo;for teams&rdquo; instead of listing seats.</p>
                <p>That worked. Conversion went from 1.4 to 2.1 percent which is meaningful.</p>
              </div>
            </div>
            <div>
              <V2Caps color={v2.accent}>TRANSFORMED · MORE FORMAL, SHORTER</V2Caps>
              <div className="mt-3 space-y-4" style={{ fontFamily: v2Serif, fontSize: 17, lineHeight: 1.6, color: v2.ink }}>
                <p>Of the four pricing experiments we ran last month, two showed meaningful movement on the metrics we track.</p>
                <p>The landing page change to &ldquo;for teams&rdquo; instead of seat-based copy lifted conversion from 1.4% to 2.1% — a 50% relative improvement.</p>
              </div>
              <div className="mt-6 flex items-center gap-2">
                <button className="text-[12px] rounded-full px-4 py-2 font-medium" style={{ background: v2.ink, color: v2.cream }}>Save as new Scribble</button>
                <button className="text-[12px] rounded-full px-4 py-2" style={{ border: `1px solid ${v2.rule}`, color: v2.inkSoft }}>Copy</button>
              </div>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}

// ═══ WEB · TRANSLATE ══════════════════════════════════════════════════════
function V2WebTranslate() {
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      <V2WebHeader active="LIBRARY" />
      <article className="px-14 py-14">
        <V2Caps>SCRIBBLE · MAY 18 · TRANSLATE</V2Caps>
        <h1 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 60, lineHeight: 1.0, letterSpacing: '-0.025em', fontWeight: 500, maxWidth: 940 }}>
          Your words, in <em style={{ fontStyle: 'italic', color: v2.accent }}>another tongue</em>.
        </h1>

        <div className="mt-9 max-w-2xl flex items-center gap-4 rounded-full px-5 py-2.5" style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}>
          <V2Caps>FROM</V2Caps>
          <span style={{ fontSize: 14, color: v2.ink, fontFamily: v2Serif, fontWeight: 500 }}>English</span>
          <V2Mono style={{ color: v2.inkFaint }}>→</V2Mono>
          <V2Caps color={v2.accent}>TO</V2Caps>
          <span style={{ fontSize: 14, color: v2.ink, fontFamily: v2Serif, fontWeight: 500 }}>हिन्दी · Hindi</span>
          <button className="ml-auto text-[12px] rounded-full px-3 py-1.5" style={{ border: `1px solid ${v2.rule}`, color: v2.inkSoft }}>Change</button>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-12">
          <div style={{ borderRight: `1px solid ${v2.rule}`, paddingRight: 40 }}>
            <V2Caps>ENGLISH</V2Caps>
            <div className="mt-3 space-y-5" style={{ fontFamily: v2Serif, fontSize: 18, lineHeight: 1.6, color: v2.ink }}>
              <p>OK so the big thing from last month is that we ran four pricing experiments and only two of them actually moved a metric we care about.</p>
              <p>The first one was the team plan landing page where we said &ldquo;for teams&rdquo; instead of listing seats. That worked.</p>
            </div>
          </div>
          <div>
            <V2Caps color={v2.accent}>हिन्दी · HINDI</V2Caps>
            <div className="mt-3 space-y-5" style={{ fontFamily: v2Serif, fontSize: 18, lineHeight: 1.7, color: v2.ink }}>
              <p>तो पिछले महीने की सबसे बड़ी बात यह है कि हमने चार <strong style={{ color: v2.accent, fontWeight: 500 }}>pricing experiments</strong> चलाए और उनमें से केवल दो ने उस metric को हिलाया जिसकी हमें परवाह है।</p>
              <p>पहला था team plan landing page जहाँ हमने &ldquo;for teams&rdquo; कहा बजाय seats list करने के। वह काम कर गया।</p>
            </div>
            <div className="mt-6 pt-4" style={{ borderTop: `1px solid ${v2.rule}` }}>
              <V2Caps>GLOSSARY PRESERVED</V2Caps>
              <p className="mt-2 text-[12px] leading-relaxed" style={{ color: v2.inkSoft }}>pricing experiments, team plan, landing page, for teams, seats, metric — kept in English. Oscar treats your vocabulary as proper nouns.</p>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}

// ═══ WEB · PUBLISH DIALOG ═════════════════════════════════════════════════
function V2WebPublishDialog() {
  return (
    <div style={{ background: 'rgba(15,13,10,0.45)', minHeight: '100%', fontFamily: v2Sans, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '60px 40px' }}>
      <div className="rounded-2xl overflow-hidden" style={{ background: v2.cream, color: v2.ink, width: 720, boxShadow: '0 24px 64px rgba(0,0,0,0.4)', border: `1px solid ${v2.rule}` }}>
        <div className="px-9 pt-8 pb-5" style={{ borderBottom: `1px solid ${v2.rule}` }}>
          <V2Caps>PUBLISH TO WORKSPACE</V2Caps>
          <h1 className="mt-2" style={{ fontFamily: v2Serif, fontSize: 34, lineHeight: 1.0, letterSpacing: '-0.025em', fontWeight: 500 }}>
            Share <em style={{ fontStyle: 'italic', color: v2.accent }}>Pricing experiments</em> with the team?
          </h1>
          <p className="mt-3 text-[13px] leading-relaxed" style={{ color: v2.inkSoft }}>
            This will copy the Scribble into <strong>NavGurukul · Product</strong> and notify members. Yours stays private.
          </p>
        </div>

        <div className="px-9 py-7 space-y-6">
          <div>
            <V2Caps>WORKSPACE</V2Caps>
            <div className="mt-2 flex items-center gap-3 rounded-md p-3.5" style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}>
              <div style={{ height: 28, width: 28, borderRadius: 6, background: v2.accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: v2.cream, fontFamily: v2Serif, fontWeight: 500, fontSize: 14 }}>N</div>
              <div>
                <div style={{ fontSize: 14, color: v2.ink }}>NavGurukul · Product</div>
                <V2Caps>12 MEMBERS · WORKSPACE</V2Caps>
              </div>
              <V2Mono style={{ marginLeft: 'auto', fontSize: 11, color: v2.inkFaint }}>change ↓</V2Mono>
            </div>
          </div>

          <div>
            <V2Caps>FOLDER</V2Caps>
            <div className="mt-2 flex items-center gap-3 rounded-md p-3.5" style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}>
              <span style={{ fontSize: 14, color: v2.ink, fontFamily: v2Serif, fontWeight: 500 }}>Pricing</span>
              <V2Caps>12 SCRIBBLES</V2Caps>
              <V2Mono style={{ marginLeft: 'auto', fontSize: 11, color: v2.inkFaint }}>change ↓</V2Mono>
            </div>
          </div>

          <div>
            <V2Caps>WHO CAN SEE IT</V2Caps>
            <div className="mt-2 space-y-2">
              {[
                ['Everyone in NavGurukul · Product', true],
                ['Only people I @ mention',          false],
                ['Anyone with the link',             false],
              ].map(([label, on], i) => (
                <div key={i} className="flex items-center gap-3 py-1">
                  <span style={{ display: 'inline-flex', height: 16, width: 16, borderRadius: 999, background: on ? v2.accent : 'transparent', border: on ? 'none' : `1.5px solid ${v2.ruleHard}`, alignItems: 'center', justifyContent: 'center' }}>
                    {on && <span style={{ display: 'block', height: 6, width: 6, background: v2.cream, borderRadius: 999 }} />}
                  </span>
                  <span style={{ fontSize: 13, color: v2.ink, fontWeight: on ? 500 : 400 }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-9 py-5 flex items-center justify-between" style={{ borderTop: `1px solid ${v2.rule}`, background: v2.cream2 }}>
          <V2Caps>OPTIMIZED FOR NOTION</V2Caps>
          <div className="flex items-center gap-3">
            <button className="text-[13px]" style={{ color: v2.inkSoft }}>Cancel</button>
            <button className="text-[13px] rounded-full px-5 py-2.5 font-medium" style={{ background: v2.ink, color: v2.cream }}>Publish</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══ WEB · STATES (GALLERY) ═══════════════════════════════════════════════
function V2WebStatesGallery() {
  const states = [
    { tag: 'FIRST RUN · EMPTY',  h: 'A clean library.',                  body: 'Hold Ctrl + Space anywhere on your computer to make your first Scribble.', accent: true },
    { tag: 'LOADING · SKELETON', h: 'Pulling your day…',            body: 'Sketchy lines, low contrast, no spinner. The page composes itself.',         mono: true },
    { tag: 'NO MATCH',           h: 'Nothing matches "razorpay".',       body: 'Try a different word, or check your folders. Your library has 86 Scribbles.' },
    { tag: 'LIMIT REACHED',      h: 'You’ve hit the Free cap.',     body: 'You made 30 minutes of Scribbles this month. Upgrade or wait until June 1.', cta: 'Upgrade →' },
    { tag: 'MIC DENIED',         h: 'Oscar can’t hear you.',        body: 'The browser blocked microphone access. Re-enable in site settings, then come back.', cta: 'Open site settings →' },
    { tag: 'NOT FOUND',          h: 'This Scribble is gone.',            body: 'Either it was deleted, or the link is wrong. Check Trash, where we keep things for 30 days.', cta: 'Open Trash →' },
  ];
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      <div className="px-14 pt-12 pb-6">
        <V2Caps>v2 · WEB STATES</V2Caps>
        <h1 className="mt-2" style={{ fontFamily: v2Serif, fontSize: 48, lineHeight: 1.0, letterSpacing: '-0.025em', fontWeight: 500 }}>
          When something&rsquo;s <em style={{ fontStyle: 'italic', color: v2.accent }}>different</em>.
        </h1>
        <p className="mt-3 max-w-xl text-[14px] leading-relaxed" style={{ color: v2.inkSoft }}>Empty, loading, denied, limit-reached, not-found. All of them dressed in the same restraint.</p>
      </div>

      <div className="grid grid-cols-2 gap-6 px-14 pb-14">
        {states.map((s, i) => (
          <div key={i} className="rounded-lg p-9 flex flex-col" style={{ background: v2.cream2, border: `1px solid ${v2.rule}`, minHeight: 240 }}>
            <V2Caps color={s.accent ? v2.accent : v2.inkFaint}>{s.tag}</V2Caps>
            <h3 className="mt-2" style={{ fontFamily: v2Serif, fontSize: 30, lineHeight: 1.05, fontWeight: 500, letterSpacing: '-0.015em', color: v2.ink }}>{s.h}</h3>
            <p className="mt-3 text-[14px] leading-relaxed" style={{ color: v2.inkSoft, maxWidth: 440 }}>{s.body}</p>
            {s.cta && <div className="mt-auto pt-5"><button className="text-[13px]" style={{ color: v2.accent }}>{s.cta}</button></div>}
            {s.mono && (
              <div className="mt-auto pt-7 space-y-2">
                <div style={{ height: 8, width: '60%', background: v2.ruleHard, borderRadius: 4 }} />
                <div style={{ height: 8, width: '40%', background: v2.ruleHard, borderRadius: 4 }} />
                <div style={{ height: 8, width: '52%', background: v2.ruleHard, borderRadius: 4 }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══ DESKTOP · VIBE CODING ════════════════════════════════════════════════
function V2DesktopVibeCoding() {
  const modes = [
    { id: 'conv', name: 'Conversational', tag: 'DEFAULT',  desc: 'Cleaned prose. Punctuation, capitalization, removed filler. The standard.', active: true },
    { id: 'code', name: 'Coding',         tag: 'IDES',     desc: 'No prose cleanup. Variables, snake_case, dot.notation, file paths verbatim.' },
    { id: 'mins', name: 'Minutes',        tag: 'MEETINGS', desc: 'Speaker turns. Decisions and actions surfaced. Filler kept for nuance.' },
    { id: 'note', name: 'Note',           tag: 'JOURNALS', desc: 'Bullet-leaning. Stream of consciousness preserved. Light cleanup only.' },
  ];
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <V2WinChrome title="OSCAR · VIBE CODING" />
      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        <V2DeskSidebar active="settings" />
        <main className="col-span-9 overflow-auto px-10 py-9">
          <V2Caps>VIBE CODING · MODE PICKER</V2Caps>
          <h1 className="mt-2" style={{ fontFamily: v2Serif, fontSize: 36, lineHeight: 1, letterSpacing: '-0.02em', fontWeight: 500 }}>
            How Oscar should <em style={{ fontStyle: 'italic', color: v2.accent }}>format</em>.
          </h1>
          <p className="mt-3 max-w-xl text-[13px] leading-relaxed" style={{ color: v2.inkSoft }}>
            Pick a baseline. Context-aware dictation overrides this per app — VS Code uses Coding, Notion uses Note, Slack uses Conversational.
          </p>
          <div className="mt-9 space-y-3">
            {modes.map(m => (
              <div key={m.id} className="rounded-lg p-5 flex items-start gap-5" style={{ background: m.active ? v2.cream2 : 'transparent', border: m.active ? `1px solid ${v2.accent}` : `1px solid ${v2.rule}` }}>
                <span style={{ display: 'inline-flex', height: 16, width: 16, borderRadius: 999, background: m.active ? v2.accent : 'transparent', border: m.active ? 'none' : `1.5px solid ${v2.ruleHard}`, marginTop: 4, alignItems: 'center', justifyContent: 'center' }}>
                  {m.active && <span style={{ display: 'block', height: 6, width: 6, background: v2.cream, borderRadius: 999 }} />}
                </span>
                <div className="flex-1">
                  <div className="flex items-baseline gap-3">
                    <h3 style={{ fontFamily: v2Serif, fontSize: 22, fontWeight: 500, color: v2.ink, letterSpacing: '-0.01em' }}>{m.name}</h3>
                    <V2Caps>{m.tag}</V2Caps>
                  </div>
                  <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: v2.inkSoft }}>{m.desc}</p>
                </div>
                {m.active && <V2Mono style={{ fontSize: 11, color: v2.accent, letterSpacing: '0.16em' }}>ACTIVE</V2Mono>}
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

// ═══ DESKTOP · ONBOARDING (3 STEPS) ═══════════════════════════════════════
function V2DesktopOnboarding() {
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <V2WinChrome title="OSCAR · WELCOME" />
      <div className="flex-1 grid grid-cols-3 overflow-hidden">
        {/* Step 1 — active */}
        <div className="px-8 py-12 flex flex-col" style={{ borderRight: `1px solid ${v2.rule}` }}>
          <V2Mono style={{ fontSize: 11, color: v2.accent, letterSpacing: '0.18em' }}>01 · ACTIVE</V2Mono>
          <V2Caps>SIGN IN</V2Caps>
          <h2 className="mt-4" style={{ fontFamily: v2Serif, fontSize: 30, fontWeight: 500, lineHeight: 1.05, letterSpacing: '-0.02em' }}>
            Welcome to <em style={{ fontStyle: 'italic', color: v2.accent }}>Oscar</em>.
          </h2>
          <p className="mt-3 text-[13px] leading-relaxed flex-1" style={{ color: v2.inkSoft }}>
            Continue with Google to sync your Scribbles, vocabulary, and Minutes across web and desktop.
          </p>
          <button className="mt-5 inline-flex items-center justify-center gap-2 rounded-full py-3 text-[13px] font-medium" style={{ background: v2.ink, color: v2.cream }}>
            <svg width="14" height="14" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92a8.78 8.78 0 0 0 2.68-6.61z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26a5.4 5.4 0 0 1-3.05.86c-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18z" />
              <path fill="#FBBC05" d="M3.96 10.71A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3-2.33z" />
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 9 0a9 9 0 0 0-8.04 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z" />
            </svg>
            Continue with Google
          </button>
        </div>

        {/* Step 2 — next */}
        <div className="px-8 py-12 flex flex-col" style={{ borderRight: `1px solid ${v2.rule}`, background: v2.cream2, opacity: 0.72 }}>
          <V2Mono style={{ fontSize: 11, color: v2.inkFaint, letterSpacing: '0.18em' }}>02 · NEXT</V2Mono>
          <V2Caps>PERMISSIONS</V2Caps>
          <h2 className="mt-4" style={{ fontFamily: v2Serif, fontSize: 30, fontWeight: 500, lineHeight: 1.05, letterSpacing: '-0.02em' }}>
            Three things Oscar needs.
          </h2>
          <div className="mt-5 space-y-2 flex-1">
            {[['Microphone', 'To hear you'], ['Accessibility', 'To paste what you said'], ['Login items', 'To start automatically']].map(([n, w], i) => (
              <div key={i} className="flex items-start gap-3 py-3" style={{ borderBottom: `1px solid ${v2.rule}` }}>
                <V2Mono style={{ fontSize: 10, color: v2.inkFaint, marginTop: 2 }}>0{i + 1}</V2Mono>
                <div>
                  <div style={{ fontSize: 13, color: v2.ink, fontWeight: 500 }}>{n}</div>
                  <p className="text-[11px] mt-0.5" style={{ color: v2.inkSoft }}>{w}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Step 3 — ready */}
        <div className="px-8 py-12 flex flex-col" style={{ background: v2.cream2, opacity: 0.5 }}>
          <V2Mono style={{ fontSize: 11, color: v2.inkFaint, letterSpacing: '0.18em' }}>03 · READY</V2Mono>
          <V2Caps>FIRST SCRIBBLE</V2Caps>
          <h2 className="mt-4" style={{ fontFamily: v2Serif, fontSize: 30, fontWeight: 500, lineHeight: 1.05, letterSpacing: '-0.02em' }}>
            Try a <em style={{ fontStyle: 'italic', color: v2.accent }}>practice run</em>.
          </h2>
          <div className="mt-5 flex-1">
            <V2Caps>HOTKEY</V2Caps>
            <div className="mt-2 inline-flex items-center gap-2">
              <kbd className="rounded-md px-2 py-1 font-mono text-xs font-semibold" style={{ border: `1px solid ${v2.rule}`, background: v2.cream }}>Ctrl</kbd>
              <span style={{ color: v2.inkFaint }}>+</span>
              <kbd className="rounded-md px-2 py-1 font-mono text-xs font-semibold" style={{ border: `1px solid ${v2.rule}`, background: v2.cream }}>Space</kbd>
            </div>
            <p className="mt-5 text-[12px] leading-relaxed" style={{ color: v2.inkSoft }}>Hold to listen. Speak naturally. Release when done.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══ DESKTOP · TRASH ══════════════════════════════════════════════════════
function V2DesktopTrash() {
  const items = [
    { d: 'TUE · 09:14', t: 'Half-finished email to Anita',  expires: '29 days' },
    { d: 'MON · 16:02', t: 'Mistyped Cursor note',           expires: '28 days' },
    { d: 'MON · 11:30', t: 'Standup notes (old format)',     expires: '28 days' },
    { d: 'FRI · 14:00', t: 'Voice doodle',                   expires: '25 days' },
  ];
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <V2WinChrome title="OSCAR · TRASH" />
      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        <V2DeskSidebar active="scribble" />
        <main className="col-span-9 overflow-auto px-10 py-9">
          <V2Caps>TRASH · 4 ITEMS · 30 DAY RETENTION</V2Caps>
          <h1 className="mt-2" style={{ fontFamily: v2Serif, fontSize: 36, lineHeight: 1, letterSpacing: '-0.02em', fontWeight: 500 }}>
            Things you almost <em style={{ fontStyle: 'italic', color: v2.accent }}>lost</em>.
          </h1>
          <p className="mt-3 max-w-md text-[13px] leading-relaxed" style={{ color: v2.inkSoft }}>
            Anything you deleted is held here for 30 days before it&rsquo;s gone for good. Restore what should still be a Scribble.
          </p>
          <div className="mt-9">
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-12 gap-4 py-4 items-baseline" style={{ borderBottom: `1px solid ${v2.rule}` }}>
                <div className="col-span-2"><V2Mono style={{ fontSize: 12, color: v2.ink }}>{it.d}</V2Mono></div>
                <div className="col-span-6" style={{ fontFamily: v2Serif, fontSize: 17, fontWeight: 500, color: v2.ink, letterSpacing: '-0.005em' }}>{it.t}</div>
                <div className="col-span-3"><V2Caps>EXPIRES IN {it.expires.toUpperCase()}</V2Caps></div>
                <div className="col-span-1 text-right"><button className="text-[11px]" style={{ color: v2.accent }}>Restore</button></div>
              </div>
            ))}
          </div>
          <div className="mt-9">
            <button className="text-[12px] rounded-full px-4 py-2" style={{ border: `1px solid ${v2.rule}`, color: v2.inkSoft }}>Empty trash</button>
          </div>
        </main>
      </div>
    </div>
  );
}

// ═══ DESKTOP · AI PANEL ═══════════════════════════════════════════════════
function V2DesktopAIPanel() {
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <V2WinChrome title="OSCAR · SCRIBBLE · AI" />
      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        <V2DeskSidebar active="scribble" />
        <main className="col-span-6 overflow-auto px-7 py-7" style={{ borderRight: `1px solid ${v2.rule}` }}>
          <V2Caps>SLACK · MAY 20 · 14:08</V2Caps>
          <h1 className="mt-2.5" style={{ fontFamily: v2Serif, fontSize: 28, fontWeight: 500, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            Status update — pill polish<br />and the verifier.
          </h1>
          <p className="mt-6" style={{ fontFamily: v2Serif, fontSize: 17, lineHeight: 1.65, color: v2.ink }}>
            &ldquo;Wrapping the desktop pill polish today. Settings popover is in. Verifier is happy — let&rsquo;s ship this week.&rdquo;
          </p>
        </main>

        <aside className="col-span-3 overflow-auto px-6 py-7" style={{ background: v2.cream2 }}>
          <V2Caps color={v2.accent}>ASK OSCAR · AI</V2Caps>
          <h2 className="mt-2.5" style={{ fontFamily: v2Serif, fontSize: 22, fontWeight: 500, lineHeight: 1.1, letterSpacing: '-0.015em' }}>
            Reshape this <em style={{ fontStyle: 'italic', color: v2.accent }}>any way</em>.
          </h2>

          <div className="mt-6">
            <V2Caps>SUGGESTED</V2Caps>
            <div className="mt-2 space-y-2">
              {['Make it shorter', 'Pull out just the action items', 'Reframe as a board update', 'Make it more formal'].map(t => (
                <div key={t} className="flex items-center gap-2 text-[13px] py-1.5" style={{ color: v2.ink }}>
                  <span style={{ color: v2.accent }}>→</span> {t}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-7 pt-5" style={{ borderTop: `1px solid ${v2.rule}` }}>
            <V2Caps>OR · TYPE A PROMPT</V2Caps>
            <textarea placeholder="Translate to Hindi · or summarize in 3 bullets" className="mt-2 w-full bg-transparent outline-none p-3 text-[13px] rounded-md" style={{ border: `1px solid ${v2.rule}`, color: v2.ink, fontFamily: v2Sans, minHeight: 80, resize: 'none' }}></textarea>
            <button className="mt-3 w-full text-[12px] rounded-full py-2.5 font-medium" style={{ background: v2.ink, color: v2.cream }}>Run</button>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ═══ OVERLAY · UPGRADE ════════════════════════════════════════════════════
function V2OverlayUpgrade() {
  return (
    <div style={{ background: 'rgba(15,13,10,0.55)', minHeight: '100%', fontFamily: v2Sans, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div className="rounded-2xl overflow-hidden" style={{ background: v2.cream, color: v2.ink, width: 540, boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
        <div className="px-9 pt-9 pb-9">
          <V2Caps color={v2.accent}>YOU&rsquo;VE HIT THE FREE CAP</V2Caps>
          <h1 className="mt-2" style={{ fontFamily: v2Serif, fontSize: 40, lineHeight: 1.0, letterSpacing: '-0.025em', fontWeight: 500 }}>
            30 minutes spent.<br /><em style={{ fontStyle: 'italic', color: v2.accent }}>Worth it</em> yet?
          </h1>
          <p className="mt-5 text-[14px] leading-relaxed" style={{ color: v2.inkSoft }}>
            Most people are hooked at 18 minutes. You made it to 30. Upgrade to Pro and don&rsquo;t lose the momentum.
          </p>
          <div className="mt-7 rounded-lg p-5" style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}>
            <div className="flex items-baseline justify-between">
              <V2Caps>PRO · ANNUAL</V2Caps>
              <V2Mono style={{ fontSize: 12, color: v2.accent }}>SAVE 20%</V2Mono>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span style={{ fontFamily: v2Serif, fontSize: 36, fontWeight: 500, letterSpacing: '-0.025em' }}>₹699</span>
              <span style={{ fontSize: 12, color: v2.inkSoft }}>/ month · billed annually</span>
            </div>
            <ul className="mt-4 space-y-1.5 text-[12px]" style={{ color: v2.inkSoft }}>
              <li>· Unlimited dictation</li>
              <li>· Unlimited Scribbles + Minutes</li>
              <li>· Context-aware dictation, vocabulary, transforms</li>
            </ul>
          </div>

          <button className="mt-7 w-full rounded-full py-3.5 text-[14px] font-medium" style={{ background: v2.ink, color: v2.cream }}>Upgrade to Pro</button>
          <button className="mt-3 w-full text-[12px]" style={{ color: v2.inkSoft }}>Maybe later — show me on June 1</button>
        </div>
      </div>
    </div>
  );
}

// ═══ OVERLAY · CHECKOUT ═══════════════════════════════════════════════════
function V2OverlayCheckout() {
  return (
    <div style={{ background: 'rgba(15,13,10,0.55)', minHeight: '100%', fontFamily: v2Sans, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div className="rounded-2xl overflow-hidden grid grid-cols-12" style={{ background: v2.cream, color: v2.ink, width: 820, boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
        <div className="col-span-5 p-8 flex flex-col" style={{ background: v2.cream2, borderRight: `1px solid ${v2.rule}` }}>
          <V2Caps>YOUR ORDER</V2Caps>
          <h2 className="mt-2" style={{ fontFamily: v2Serif, fontSize: 28, fontWeight: 500, lineHeight: 1.0, letterSpacing: '-0.02em' }}>Oscar Pro · annual</h2>
          <div className="mt-6 pb-4" style={{ borderBottom: `1px solid ${v2.rule}` }}>
            <div className="flex items-baseline justify-between">
              <span style={{ fontSize: 13, color: v2.inkSoft }}>Pro · 12 months</span>
              <V2Mono style={{ fontSize: 13, color: v2.ink }}>₹8,388.00</V2Mono>
            </div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span style={{ fontSize: 13, color: v2.inkSoft }}>Annual saving</span>
              <V2Mono style={{ fontSize: 13, color: v2.accent }}>− ₹2,100.00</V2Mono>
            </div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span style={{ fontSize: 13, color: v2.inkSoft }}>GST 18%</span>
              <V2Mono style={{ fontSize: 13, color: v2.ink }}>₹1,512.00</V2Mono>
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <V2Caps>TOTAL · INR</V2Caps>
            <span style={{ fontFamily: v2Serif, fontSize: 32, fontWeight: 500, letterSpacing: '-0.025em' }}>₹7,800</span>
          </div>
          <div className="mt-auto pt-6">
            <V2Caps>SECURE PAYMENT · RAZORPAY</V2Caps>
          </div>
        </div>
        <div className="col-span-7 p-8">
          <V2Caps>PAY WITH</V2Caps>
          <h2 className="mt-2" style={{ fontFamily: v2Serif, fontSize: 28, fontWeight: 500, lineHeight: 1.0, letterSpacing: '-0.02em' }}>
            How would you <em style={{ fontStyle: 'italic', color: v2.accent }}>like to pay</em>?
          </h2>

          <div className="mt-6 grid grid-cols-2 gap-2">
            {[
              ['UPI · default',  true],
              ['Card',          false],
              ['Net banking',   false],
              ['Google Pay',    false],
            ].map(([label, on], i) => (
              <button key={i} className="rounded-md py-3 px-4 text-left text-[13px]" style={{ background: on ? v2.cream2 : 'transparent', border: on ? `1px solid ${v2.accent}` : `1px solid ${v2.rule}`, color: v2.ink, fontWeight: on ? 500 : 400 }}>{label}</button>
            ))}
          </div>

          <div className="mt-6">
            <V2Caps>UPI ID</V2Caps>
            <input placeholder="you@hdfcbank" className="mt-2 w-full bg-transparent outline-none py-3 text-[14px]" style={{ borderBottom: `1px solid ${v2.ink}`, color: v2.ink, fontFamily: v2Sans }} />
          </div>

          <button className="mt-8 w-full rounded-full py-3.5 text-[14px] font-medium" style={{ background: v2.ink, color: v2.cream }}>Pay ₹7,800</button>
          <p className="mt-3 text-center text-[11px]" style={{ color: v2.inkFaint }}>Cancel anytime · 14-day money back if it&rsquo;s not for you.</p>
        </div>
      </div>
    </div>
  );
}

// ═══ OVERLAY · PERMISSION ═════════════════════════════════════════════════
function V2OverlayPermission() {
  return (
    <div style={{ background: 'rgba(15,13,10,0.45)', minHeight: '100%', fontFamily: v2Sans, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div className="rounded-2xl overflow-hidden" style={{ background: v2.cream, color: v2.ink, width: 520, boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
        <div className="px-9 pt-9 pb-9">
          <V2Caps color={v2.accent}>OSCAR CAN&rsquo;T HEAR YOU</V2Caps>
          <h1 className="mt-2" style={{ fontFamily: v2Serif, fontSize: 36, lineHeight: 1.02, letterSpacing: '-0.025em', fontWeight: 500 }}>
            We need <em style={{ fontStyle: 'italic', color: v2.accent }}>three permissions</em> back.
          </h1>
          <p className="mt-4 text-[14px] leading-relaxed" style={{ color: v2.inkSoft }}>
            The OS revoked microphone access. Here&rsquo;s how to get Oscar listening again.
          </p>

          <ol className="mt-6 space-y-1">
            {[
              'Open System Settings → Privacy & Security',
              'Scroll to Microphone, find Oscar, toggle it on',
              'Come back — we’ll resume from where you left off',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-4 py-4" style={{ borderBottom: `1px solid ${v2.rule}` }}>
                <V2Mono style={{ fontSize: 11, color: v2.accent, marginTop: 2 }}>0{i + 1}</V2Mono>
                <span style={{ fontSize: 14, color: v2.ink, lineHeight: 1.5 }}>{step}</span>
              </li>
            ))}
          </ol>

          <div className="mt-7 flex items-center gap-3">
            <button className="flex-1 rounded-full py-3 text-[14px] font-medium" style={{ background: v2.ink, color: v2.cream }}>Open Privacy settings</button>
            <button className="text-[13px]" style={{ color: v2.inkSoft }}>Not now</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══ OVERLAY · TOASTS ═════════════════════════════════════════════════════
function V2OverlayToasts() {
  const toasts = [
    { tone: 'success', icon: '✓', text: 'Pasted to Slack · ready to send', meta: '4S' },
    { tone: 'info',    icon: '↪', text: 'Saved to Scribbles → Pricing',     meta: 'UNDO' },
    { tone: 'warn',    icon: '!', text: 'Low confidence transcript — review before publishing', meta: '' },
    { tone: 'error',   icon: '×', text: 'Couldn’t reach Oscar. Check your connection.', meta: 'RETRY' },
    { tone: 'audio',   icon: '●', text: 'Recording started · hold Ctrl + Space', meta: '0:00' },
    { tone: 'context', icon: '○', text: 'Optimizing for Notion · context-v1', meta: '' },
  ];
  return (
    <div style={{ background: v2.cream, minHeight: '100%', fontFamily: v2Sans, padding: 48 }}>
      <V2Caps>TOAST CATALOG · v2</V2Caps>
      <h1 className="mt-2" style={{ fontFamily: v2Serif, fontSize: 44, lineHeight: 1, letterSpacing: '-0.025em', fontWeight: 500, color: v2.ink }}>
        Small things, <em style={{ fontStyle: 'italic', color: v2.accent }}>said quietly</em>.
      </h1>
      <p className="mt-3 max-w-xl text-[14px] leading-relaxed" style={{ color: v2.inkSoft }}>One pill shape, six tones. Accent only for live or just-finished moments.</p>

      <div className="mt-10 space-y-3 max-w-md">
        {toasts.map((t, i) => {
          const isHot = t.tone === 'success' || t.tone === 'audio';
          const bg     = isHot ? 'rgba(184,98,61,0.10)' : v2.cream2;
          const border = isHot ? `1px solid ${v2.accent}` : `1px solid ${v2.rule}`;
          const ic     = isHot ? v2.accent : v2.inkSoft;
          return (
            <div key={i} className="rounded-full flex items-center gap-3 px-5 py-3" style={{ background: bg, border, boxShadow: '0 6px 18px rgba(0,0,0,0.05)' }}>
              <span style={{ color: ic, fontSize: 13, width: 14, textAlign: 'center', fontWeight: 600 }}>{t.icon}</span>
              <span className="flex-1" style={{ fontSize: 13, color: v2.ink }}>{t.text}</span>
              {t.meta && <V2Mono style={{ fontSize: 10, color: v2.inkFaint, letterSpacing: '0.16em' }}>{t.meta}</V2Mono>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══ MOBILE · LANDING ═════════════════════════════════════════════════════
function V2MobileLanding() {
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      <div className="px-5 pt-7 flex items-center justify-between">
        <V2Wordmark />
        <V2Caps>SIGN IN</V2Caps>
      </div>
      <div className="px-5 pt-14 text-center">
        <V2Caps>VOICE-FIRST WRITING</V2Caps>
        <h1 className="mt-5" style={{ fontFamily: v2Serif, fontSize: 56, lineHeight: 0.94, letterSpacing: '-0.03em', fontWeight: 500 }}>
          You talk.<br />
          Oscar<br />
          <em style={{ fontStyle: 'italic', color: v2.accent }}>listens</em>.
        </h1>
        <p className="mt-7 text-[15px] leading-relaxed" style={{ color: v2.inkSoft, maxWidth: 320, marginInline: 'auto' }}>
          A dictation tool that knows what app you&rsquo;re in and writes the way that app deserves.
        </p>
      </div>
      <div className="px-5 mt-10 flex flex-col items-center gap-3">
        <button className="w-full inline-flex items-center justify-center gap-3 rounded-full py-3.5 text-[14px] font-medium" style={{ background: v2.ink, color: v2.cream }}>
          <span style={{ display: 'inline-block', height: 7, width: 7, borderRadius: 999, background: v2.accent }} />
          Try Oscar free
        </button>
        <button className="text-[13px]" style={{ color: v2.inkSoft }}>Watch the 90-sec tour</button>
      </div>

      <div className="px-5 mt-14 pb-12 space-y-6">
        {[
          ['01', 'Stream',   'Dictate into anything — Slack, Notion, Cursor, Gmail.'],
          ['02', 'Minutes',  'Meetings → decisions + actions, automatically.'],
          ['03', 'Scribble', 'Voice notes, organized into TL;DR and structure.'],
        ].map(([n, t, d], i) => (
          <article key={i} className="pb-6" style={{ borderBottom: `1px solid ${v2.rule}` }}>
            <div className="flex items-baseline gap-3">
              <V2Mono style={{ fontSize: 11, color: v2.accent, letterSpacing: '0.18em' }}>{n}</V2Mono>
              <V2Caps>{t.toUpperCase()}</V2Caps>
            </div>
            <p className="mt-2.5" style={{ fontFamily: v2Serif, fontSize: 22, lineHeight: 1.25, color: v2.ink, letterSpacing: '-0.01em', fontWeight: 500 }}>{d}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

// ═══ MOBILE · AUTH ════════════════════════════════════════════════════════
function V2MobileAuth() {
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="px-5 pt-7"><V2Wordmark /></div>
      <div className="flex-1 flex flex-col justify-center px-7">
        <V2Caps>WELCOME BACK</V2Caps>
        <h1 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 44, lineHeight: 0.98, letterSpacing: '-0.025em', fontWeight: 500 }}>
          Pick up<br />where you<br /><em style={{ fontStyle: 'italic', color: v2.accent }}>left off</em>.
        </h1>
        <p className="mt-5 text-[14px] leading-relaxed" style={{ color: v2.inkSoft }}>
          Continue with Google to sync across web, desktop, and mobile.
        </p>
        <button className="mt-9 inline-flex items-center justify-center gap-3 rounded-full px-6 py-4 text-[14px] font-medium" style={{ background: v2.ink, color: v2.cream }}>
          <svg width="16" height="16" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92a8.78 8.78 0 0 0 2.68-6.61z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26a5.4 5.4 0 0 1-3.05.86c-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18z" />
            <path fill="#FBBC05" d="M3.96 10.71A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3-2.33z" />
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 9 0a9 9 0 0 0-8.04 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z" />
          </svg>
          Continue with Google
        </button>
        <p className="mt-3 text-center text-[12px]" style={{ color: v2.inkFaint }}>New here? Same button — we&rsquo;ll create one for you.</p>
      </div>
      <div className="px-7 pb-10">
        <V2Caps>BY SIGNING IN YOU AGREE TO THE TERMS</V2Caps>
      </div>
    </div>
  );
}

// ═══ MOBILE · SETTINGS ════════════════════════════════════════════════════
function V2MobileSettings() {
  const rows = [
    { tag: 'ACCOUNT',         h: 'Identity & voice',           sub: 'Display name · email · time zone' },
    { tag: 'PLANS & BILLING', h: 'Pro · annual',                sub: 'Renews Jul 14 · ₹699/mo', highlight: true },
    { tag: 'VOCABULARY',      h: '48 custom words',             sub: 'Hinglish · names · code paths' },
    { tag: 'FOLDERS',         h: '4 folders · 51 Scribbles',    sub: 'Pricing · Engineering · Standup · Inbox' },
    { tag: 'DATA & PRIVACY',  h: 'Export · delete',             sub: 'What we do with your voice' },
    { tag: 'SOUND',           h: 'Off',                         sub: 'Chime when recording starts and stops' },
  ];
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      <div className="px-5 pt-7 flex items-center justify-between">
        <V2Caps>← BACK</V2Caps>
        <V2Caps>SETTINGS</V2Caps>
        <div style={{ width: 50 }} />
      </div>
      <div className="px-5 pt-8">
        <V2Caps>YOU, ON OSCAR</V2Caps>
        <h1 className="mt-2" style={{ fontFamily: v2Serif, fontSize: 36, lineHeight: 0.98, letterSpacing: '-0.025em', fontWeight: 500 }}>
          Souvik <em style={{ fontStyle: 'italic', color: v2.accent }}>Deb</em>.
        </h1>
        <p className="mt-2 text-[13px]" style={{ color: v2.inkSoft }}>souvik@navgurukul.org · Pro · annual</p>
      </div>

      <div className="px-5 mt-9">
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-12 gap-3 py-4 items-baseline" style={{ borderBottom: `1px solid ${v2.rule}` }}>
            <div className="col-span-11">
              <V2Caps color={row.highlight ? v2.accent : v2.inkFaint}>{row.tag}</V2Caps>
              <div className="mt-1" style={{ fontFamily: v2Serif, fontSize: 17, fontWeight: 500, color: v2.ink, letterSpacing: '-0.005em' }}>{row.h}</div>
              <p className="text-[12px] mt-0.5" style={{ color: v2.inkSoft }}>{row.sub}</p>
            </div>
            <div className="col-span-1 text-right"><V2Mono style={{ fontSize: 13, color: v2.inkFaint }}>→</V2Mono></div>
          </div>
        ))}
      </div>

      <div className="px-5 mt-10 pb-10">
        <button className="w-full rounded-full py-3 text-[13px]" style={{ border: `1px solid ${v2.rule}`, color: v2.inkSoft }}>Sign out</button>
      </div>
    </div>
  );
}

Object.assign(window, {
  V2WebPricing, V2WebRecording, V2WebProcessing, V2WebResults,
  V2WebSettingsBilling, V2WebSettingsVocabulary, V2WebSettingsFolders, V2WebSettingsPrivacy,
  V2WebTransform, V2WebTranslate, V2WebPublishDialog, V2WebStatesGallery,
  V2DesktopVibeCoding, V2DesktopOnboarding, V2DesktopTrash, V2DesktopAIPanel,
  V2OverlayUpgrade, V2OverlayCheckout, V2OverlayPermission, V2OverlayToasts,
  V2MobileLanding, V2MobileAuth, V2MobileSettings,
});
