// Oscar v2 — Wave 5
// Gaps closed in this wave:
//   • Auth (full set): sign-up, forgot password, magic-link sent, reset, 2FA, error gallery
//   • Onboarding: web first-run, mobile onboarding, Today first-ever (no items yet)
//   • Editor states: empty, AI streaming, read-only / shared-with-me, version history, save conflict, collab presence
//   • Desktop update — expanded from a single "available" artboard into a six-state gallery
//
// Visual vocabulary inherited from oscar-v2.jsx: warm cream stage, ink type,
// terracotta accent only for live / fresh / live-audio moments. Mono = metadata,
// serif = voice, sans = chrome.

// ═══════════════════════════════════════════════════════════════════════════
// AUTH · FULL SET
// ═══════════════════════════════════════════════════════════════════════════

// Right-side quiet-promise panel — shared by every auth screen so the surface
// stays the same and only the left action changes.
function V2AuthQuietRight({ quote, attrib, role }) {
  return (
    <div className="col-span-6 px-16 py-12 flex flex-col" style={{ background: '#0f0d0a', color: v2.cream }}>
      <V2Caps color="#7a7670">A QUIET PROMISE</V2Caps>
      <div className="flex-1 flex flex-col justify-center" style={{ maxWidth: 520 }}>
        <p style={{ fontFamily: v2Serif, fontSize: 40, lineHeight: 1.14, letterSpacing: '-0.02em', color: v2.cream, fontWeight: 500 }}>
          {quote}
        </p>
        <div className="mt-9 flex items-center gap-3">
          <div style={{ height: 36, width: 36, borderRadius: 999, background: v2.accent }} />
          <div>
            <div style={{ fontFamily: v2Serif, fontSize: 17, color: v2.cream }}>{attrib}</div>
            <V2Caps color="#7a7670">{role}</V2Caps>
          </div>
        </div>
      </div>
      <V2Caps color="#7a7670">OSCAR · STREAM · MINUTES · SCRIBBLE</V2Caps>
    </div>
  );
}

// 1. Sign up — distinct from sign in (which already exists)
function V2WebSignUp() {
  return (
    <div className="grid grid-cols-12" style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      <div className="col-span-6 px-16 py-12 flex flex-col">
        <V2Wordmark />
        <div className="flex-1 flex flex-col justify-center" style={{ maxWidth: 460 }}>
          <V2Caps>SIGN UP · NEW HERE</V2Caps>
          <h1 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 56, lineHeight: 0.98, letterSpacing: '-0.025em', fontWeight: 500 }}>
            Start <em style={{ fontStyle: 'italic', color: v2.accent }}>listening</em><br />for free.
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed" style={{ color: v2.inkSoft }}>
            Free forever for 30&thinsp;min of dictation a day. Upgrade only when you outgrow it.
          </p>

          <button className="mt-9 inline-flex items-center justify-center gap-3 rounded-full px-6 py-4 text-[14px] font-medium" style={{ background: v2.ink, color: v2.cream }}>
            <svg width="16" height="16" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92a8.78 8.78 0 0 0 2.68-6.61z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26a5.4 5.4 0 0 1-3.05.86c-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18z" />
              <path fill="#FBBC05" d="M3.96 10.71A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3-2.33z" />
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 9 0a9 9 0 0 0-8.04 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z" />
            </svg>
            Sign up with Google
          </button>

          <div className="mt-10 pt-6" style={{ borderTop: `1px solid ${v2.rule}` }}>
            <V2Caps>OR · WITH EMAIL</V2Caps>
            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-3">
                <V2Mono style={{ fontSize: 10, color: v2.inkFaint, width: 56 }}>NAME</V2Mono>
                <input placeholder="Souvik Deb" className="flex-1 bg-transparent outline-none py-2 text-[14px]" style={{ borderBottom: `1px solid ${v2.rule}`, color: v2.ink }} />
              </div>
              <div className="flex items-center gap-3">
                <V2Mono style={{ fontSize: 10, color: v2.inkFaint, width: 56 }}>EMAIL</V2Mono>
                <input placeholder="you@work.com" className="flex-1 bg-transparent outline-none py-2 text-[14px]" style={{ borderBottom: `1px solid ${v2.ink}`, color: v2.ink }} />
              </div>
            </div>
            <button className="mt-5 text-[13px] rounded-full px-4 py-2 font-medium" style={{ background: v2.ink, color: v2.cream }}>Send a sign-up link →</button>
          </div>

          <p className="mt-8 text-[12px]" style={{ color: v2.inkFaint }}>
            Already have an account? <span style={{ color: v2.accent }}>Sign in →</span>
          </p>
        </div>
        <V2Caps>BY SIGNING UP YOU AGREE TO THE TERMS &amp; PRIVACY POLICY</V2Caps>
      </div>
      <V2AuthQuietRight
        quote={<>&ldquo;I stopped typing at work in a week. Oscar just <em style={{ fontStyle: 'italic', color: v2.accent }}>listened</em>.&rdquo;</>}
        attrib="Roshni Jha"
        role="PM · OSCAR USER SINCE 2024"
      />
    </div>
  );
}

// 2. Forgot password — request a reset
function V2WebForgotPassword() {
  return (
    <div className="grid grid-cols-12" style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      <div className="col-span-6 px-16 py-12 flex flex-col">
        <V2Wordmark />
        <div className="flex-1 flex flex-col justify-center" style={{ maxWidth: 460 }}>
          <V2Caps>FORGOT PASSWORD</V2Caps>
          <h1 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 56, lineHeight: 0.98, letterSpacing: '-0.025em', fontWeight: 500 }}>
            We&rsquo;ll send you<br />a way <em style={{ fontStyle: 'italic', color: v2.accent }}>back in</em>.
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed" style={{ color: v2.inkSoft }}>
            Type the email you signed up with. If it&rsquo;s on file, you&rsquo;ll get a reset link in under a minute.
          </p>
          <div className="mt-9">
            <V2Caps>EMAIL</V2Caps>
            <input defaultValue="souvik@oscar.so" className="mt-3 w-full bg-transparent outline-none py-3 text-[16px]" style={{ borderBottom: `1px solid ${v2.ink}`, color: v2.ink, fontFamily: v2Sans }} />
          </div>
          <button className="mt-7 inline-flex items-center justify-center rounded-full px-6 py-3.5 text-[14px] font-medium" style={{ background: v2.ink, color: v2.cream }}>
            Send reset link →
          </button>
          <p className="mt-6 text-[13px]" style={{ color: v2.inkSoft }}>
            Remembered it after all? <span style={{ color: v2.accent }}>Sign in</span>
          </p>
        </div>
        <V2Caps>NEED HELP? · support@oscar.so</V2Caps>
      </div>
      <V2AuthQuietRight
        quote={<>&ldquo;Hold the hotkey, talk, walk away. The note shows up <em style={{ fontStyle: 'italic', color: v2.accent }}>where you needed it</em>.&rdquo;</>}
        attrib="Souvik Deb"
        role="ENG · OSCAR SINCE LAUNCH"
      />
    </div>
  );
}

// 3. Magic link sent — confirmation screen after the reset / sign-up email is fired
function V2WebMagicLinkSent() {
  return (
    <div className="grid grid-cols-12" style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      <div className="col-span-6 px-16 py-12 flex flex-col">
        <V2Wordmark />
        <div className="flex-1 flex flex-col justify-center" style={{ maxWidth: 460 }}>
          <V2Caps color={v2.accent}>LINK SENT · CHECK YOUR INBOX</V2Caps>
          <h1 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 56, lineHeight: 0.98, letterSpacing: '-0.025em', fontWeight: 500 }}>
            We just emailed<br /><em style={{ fontStyle: 'italic', color: v2.accent }}>the door</em>.
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed" style={{ color: v2.inkSoft }}>
            Open the message from <span style={{ color: v2.ink }}>hello@oscar.so</span> in your <span style={{ color: v2.ink }}>souvik@oscar.so</span> inbox. The link is good for the next 15 minutes.
          </p>

          {/* Envelope animation as static SVG — kept restrained, accent only on the seal */}
          <div className="mt-10 inline-flex items-center gap-4 rounded-md px-5 py-4" style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}>
            <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
              <rect x="6" y="12" width="36" height="26" rx="2" stroke={v2.ink} strokeWidth="1.4" />
              <path d="M6 14l18 12 18-12" stroke={v2.ink} strokeWidth="1.4" />
              <circle cx="36" cy="14" r="5" fill={v2.accent} />
            </svg>
            <div>
              <V2Caps>WAITING FOR YOU</V2Caps>
              <div className="mt-1" style={{ fontFamily: v2Serif, fontSize: 17, color: v2.ink }}>souvik@oscar.so</div>
            </div>
          </div>

          <div className="mt-10 space-y-3 text-[13px]" style={{ color: v2.inkSoft }}>
            <div className="flex gap-3"><V2Mono style={{ color: v2.inkFaint, fontSize: 10 }}>01</V2Mono> Didn&rsquo;t arrive? Check spam, or wait 60 seconds — sometimes the queue is slow.</div>
            <div className="flex gap-3"><V2Mono style={{ color: v2.inkFaint, fontSize: 10 }}>02</V2Mono> Wrong email? <span style={{ color: v2.accent }}>Use a different address →</span></div>
            <div className="flex gap-3"><V2Mono style={{ color: v2.inkFaint, fontSize: 10 }}>03</V2Mono> Still nothing after a few minutes? <span style={{ color: v2.accent }}>Resend</span> · <span style={{ color: v2.accent }}>Contact support</span></div>
          </div>
        </div>
        <V2Caps>LINK EXPIRES IN 15 MINUTES · SINGLE-USE</V2Caps>
      </div>
      <V2AuthQuietRight
        quote={<>&ldquo;The only login screen I miss seeing — because everything else just <em style={{ fontStyle: 'italic', color: v2.accent }}>worked</em>.&rdquo;</>}
        attrib="Mira Patel"
        role="DESIGNER · OSCAR SINCE 2025"
      />
    </div>
  );
}

// 4. Reset password — the page the email link lands on
function V2WebResetPassword() {
  return (
    <div className="grid grid-cols-12" style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      <div className="col-span-6 px-16 py-12 flex flex-col">
        <V2Wordmark />
        <div className="flex-1 flex flex-col justify-center" style={{ maxWidth: 460 }}>
          <V2Caps>RESET PASSWORD · souvik@oscar.so</V2Caps>
          <h1 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 56, lineHeight: 0.98, letterSpacing: '-0.025em', fontWeight: 500 }}>
            Pick a new<br /><em style={{ fontStyle: 'italic', color: v2.accent }}>secret</em>.
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed" style={{ color: v2.inkSoft }}>
            Twelve characters or more. Anything works — we don&rsquo;t enforce special-character theatre.
          </p>

          <div className="mt-9 space-y-7">
            <div>
              <V2Caps>NEW PASSWORD</V2Caps>
              <div className="mt-3 flex items-center gap-3" style={{ borderBottom: `1px solid ${v2.ink}` }}>
                <input type="password" defaultValue="••••••••••••••••" className="flex-1 bg-transparent outline-none py-3 text-[16px]" style={{ color: v2.ink }} />
                <V2Mono style={{ fontSize: 11, color: v2.inkSoft }}>SHOW</V2Mono>
              </div>
              {/* Strength meter */}
              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 flex gap-1" style={{ height: 3 }}>
                  <div style={{ flex: 1, background: v2.accent, borderRadius: 2 }} />
                  <div style={{ flex: 1, background: v2.accent, borderRadius: 2 }} />
                  <div style={{ flex: 1, background: v2.accent, borderRadius: 2 }} />
                  <div style={{ flex: 1, background: v2.ruleHard, borderRadius: 2 }} />
                </div>
                <V2Mono style={{ fontSize: 10, color: v2.accent }}>STRONG</V2Mono>
              </div>
            </div>
            <div>
              <V2Caps>CONFIRM</V2Caps>
              <input type="password" defaultValue="••••••••••••••••" className="mt-3 w-full bg-transparent outline-none py-3 text-[16px]" style={{ borderBottom: `1px solid ${v2.rule}`, color: v2.ink }} />
            </div>
          </div>

          <button className="mt-9 inline-flex items-center justify-center rounded-full px-6 py-3.5 text-[14px] font-medium" style={{ background: v2.ink, color: v2.cream }}>
            Set new password &amp; sign in →
          </button>

          <p className="mt-6 text-[12px]" style={{ color: v2.inkFaint }}>
            You&rsquo;ll stay signed in on this device. Other sessions will be logged out.
          </p>
        </div>
      </div>
      <V2AuthQuietRight
        quote={<>&ldquo;Twelve characters, no theatre. A login should never feel like an <em style={{ fontStyle: 'italic', color: v2.accent }}>obstacle course</em>.&rdquo;</>}
        attrib="Mira Patel"
        role="DESIGNER"
      />
    </div>
  );
}

// 5. Two-factor challenge
function V2WebTwoFactor() {
  const digits = ['8', '4', '2', '1', '', ''];
  return (
    <div className="grid grid-cols-12" style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      <div className="col-span-6 px-16 py-12 flex flex-col">
        <V2Wordmark />
        <div className="flex-1 flex flex-col justify-center" style={{ maxWidth: 460 }}>
          <V2Caps>TWO-STEP · ALMOST THERE</V2Caps>
          <h1 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 56, lineHeight: 0.98, letterSpacing: '-0.025em', fontWeight: 500 }}>
            Confirm it&rsquo;s<br /><em style={{ fontStyle: 'italic', color: v2.accent }}>actually you</em>.
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed" style={{ color: v2.inkSoft }}>
            Open your authenticator app and type the 6-digit code for <span style={{ color: v2.ink }}>Oscar</span>.
          </p>

          <div className="mt-10 flex items-center gap-3">
            {digits.map((d, i) => (
              <div key={i} className="flex items-center justify-center rounded-md"
                style={{
                  width: 52, height: 64,
                  background: d ? v2.cream2 : v2.cream,
                  border: `1px solid ${d ? v2.ink : v2.rule}`,
                  fontFamily: v2Mono, fontSize: 26, color: v2.ink,
                }}>
                {d || <span style={{ color: v2.inkFaint, fontSize: 18 }}>·</span>}
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-center gap-2">
            <span className="inline-block rounded-full" style={{ height: 7, width: 7, background: v2.accent }} />
            <V2Caps color={v2.accent}>NEXT CODE IN 24S</V2Caps>
          </div>

          <button className="mt-9 inline-flex items-center justify-center rounded-full px-6 py-3.5 text-[14px] font-medium" style={{ background: v2.ink, color: v2.cream, opacity: 0.4 }}>
            Verify and sign in →
          </button>

          <div className="mt-10 pt-6 space-y-3 text-[13px]" style={{ borderTop: `1px solid ${v2.rule}`, color: v2.inkSoft }}>
            <div className="flex items-center gap-3"><V2Mono style={{ color: v2.inkFaint, fontSize: 10 }}>↻</V2Mono> Don&rsquo;t have the app handy? <span style={{ color: v2.accent }}>Use a recovery code</span></div>
            <div className="flex items-center gap-3"><V2Mono style={{ color: v2.inkFaint, fontSize: 10 }}>✕</V2Mono> Lost access entirely? <span style={{ color: v2.accent }}>Contact support</span></div>
          </div>
        </div>
        <V2Caps>OSCAR · TWO-STEP VERIFICATION</V2Caps>
      </div>
      <V2AuthQuietRight
        quote={<>&ldquo;Security I never have to think about. <em style={{ fontStyle: 'italic', color: v2.accent }}>Six digits</em>, six seconds, done.&rdquo;</>}
        attrib="Roshni Jha"
        role="PM"
      />
    </div>
  );
}

// 6. Auth error gallery — wrong provider, account locked, suspicious login, expired link, unknown device, blocked region
function V2WebAuthErrors() {
  function Card({ tag, h, body, cta, secondary, glyph }) {
    return (
      <div className="rounded-lg p-7 flex flex-col" style={{ background: v2.cream2, border: `1px solid ${v2.rule}`, minHeight: 280 }}>
        <V2Caps color={v2.accent}>{tag}</V2Caps>
        {glyph}
        <h3 className="mt-4" style={{ fontFamily: v2Serif, fontSize: 22, lineHeight: 1.1, fontWeight: 500, letterSpacing: '-0.015em' }}>{h}</h3>
        <p className="mt-3 text-[13px] leading-relaxed" style={{ color: v2.inkSoft }}>{body}</p>
        <div className="mt-auto pt-5 flex items-center gap-3">
          <button className="text-[12px] rounded-full px-4 py-2 font-medium" style={{ background: v2.ink, color: v2.cream }}>{cta}</button>
          {secondary && <button className="text-[12px]" style={{ color: v2.inkSoft }}>{secondary}</button>}
        </div>
      </div>
    );
  }
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      <V2WebHeader active="" />
      <section className="px-14 pt-8 pb-16">
        <V2Caps>AUTH · ERROR CATALOG</V2Caps>
        <h1 className="mt-2" style={{ fontFamily: v2Serif, fontSize: 44, lineHeight: 1, letterSpacing: '-0.025em', fontWeight: 500 }}>
          When the door <em style={{ fontStyle: 'italic', color: v2.accent }}>won&rsquo;t open</em>.
        </h1>
        <p className="mt-3 max-w-xl text-[14px] leading-relaxed" style={{ color: v2.inkSoft }}>
          Every dead end has a path forward. Nothing red. Nothing dramatic. One clear next step.
        </p>

        <div className="mt-10 grid grid-cols-3 gap-4">
          <Card
            tag="WRONG PROVIDER"
            h="This email signed up with Google."
            body="You signed up with Google last time. Use the Google button to keep your Scribbles connected to one account."
            glyph={<svg className="mt-4" width="32" height="32" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92a8.78 8.78 0 0 0 2.68-6.61z" /><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26a5.4 5.4 0 0 1-3.05.86c-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18z" /><path fill="#FBBC05" d="M3.96 10.71A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3-2.33z" /><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 9 0a9 9 0 0 0-8.04 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z" /></svg>}
            cta="Continue with Google"
            secondary="Use a different email"
          />
          <Card
            tag="LINK EXPIRED"
            h="That link timed out."
            body="Magic links live for 15 minutes. We can send you a fresh one — same email, new key."
            glyph={<svg className="mt-4" width="32" height="32" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="13" r="8" stroke={v2.ink} strokeWidth="1.4" /><path d="M12 9v4l3 2M8 3l-2 2M16 3l2 2" stroke={v2.ink} strokeWidth="1.4" strokeLinecap="round" /></svg>}
            cta="Send a new link"
            secondary="Use password instead"
          />
          <Card
            tag="ACCOUNT LOCKED"
            h="Too many tries."
            body="We locked the door for 15 minutes after 5 wrong attempts. If it wasn&rsquo;t you, change your password when you&rsquo;re back in."
            glyph={<svg className="mt-4" width="32" height="32" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="10" rx="2" stroke={v2.ink} strokeWidth="1.4" /><path d="M8 11V7a4 4 0 0 1 8 0v4" stroke={v2.ink} strokeWidth="1.4" /><circle cx="12" cy="16" r="1.4" fill={v2.accent} /></svg>}
            cta="Reset password"
            secondary="Contact support"
          />
          <Card
            tag="SUSPICIOUS LOGIN"
            h="New device, new place."
            body="A sign-in from Bengaluru on a device we don&rsquo;t recognise. If that was you, confirm with the code we just emailed."
            glyph={<svg className="mt-4" width="32" height="32" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="10" r="3" stroke={v2.ink} strokeWidth="1.4" /><path d="M5 21c0-3.87 3.13-7 7-7s7 3.13 7 7" stroke={v2.ink} strokeWidth="1.4" /><circle cx="19" cy="6" r="3" fill={v2.accent} /></svg>}
            cta="It was me — verify"
            secondary="Wasn't me, lock account"
          />
          <Card
            tag="UNKNOWN ACCOUNT"
            h="No account for that email."
            body="We couldn&rsquo;t find souvik@example.com on file. Sign up takes 10 seconds — or check the spelling."
            glyph={<svg className="mt-4" width="32" height="32" viewBox="0 0 24 24" fill="none"><path d="M4 8l8 5 8-5" stroke={v2.inkSoft} strokeWidth="1.4" /><rect x="4" y="6" width="16" height="12" rx="2" stroke={v2.inkSoft} strokeWidth="1.4" /><path d="M9 14l6-6M15 14l-6-6" stroke={v2.accent} strokeWidth="1.6" strokeLinecap="round" /></svg>}
            cta="Sign up instead"
            secondary="Try another email"
          />
          <Card
            tag="REGION BLOCKED"
            h="Oscar isn&rsquo;t live here yet."
            body="We&rsquo;re still rolling out in your region. Drop us your email and you&rsquo;ll be first in when we land."
            glyph={<svg className="mt-4" width="32" height="32" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke={v2.ink} strokeWidth="1.4" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" stroke={v2.ink} strokeWidth="1.2" /></svg>}
            cta="Join the waitlist"
            secondary="Read the FAQ"
          />
        </div>

        <div className="mt-10 pt-6 text-[12px]" style={{ borderTop: `1px solid ${v2.rule}`, color: v2.inkFaint }}>
          Each card shows a real auth dead end and the single best next step. Tone: calm, not alarming. Accent only in the tag — never in the body.
        </div>
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ONBOARDING
// ═══════════════════════════════════════════════════════════════════════════

// 7. Web first-run — the moment after sign-up, before they've recorded anything
function V2WebFirstRun() {
  const steps = [
    { n: '01', h: 'Get the desktop app', b: 'The pill lives on your desktop. The web is for reading and sharing.', cta: 'Download for macOS · 38 MB', state: 'doing' },
    { n: '02', h: 'Hold Ctrl + Space, anywhere', b: 'It works in Slack, Notion, Cursor, Gmail — any text field you can type into.', cta: null, state: 'next' },
    { n: '03', h: 'Watch Oscar shape it for you', b: 'Filler removed, formatting matched to wherever you&rsquo;re writing. You stay in flow.', cta: null, state: 'next' },
  ];
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      <V2WebHeader active="TODAY" />
      <section className="px-14 pt-16 pb-12">
        <V2Caps color={v2.accent}>WELCOME · ACCOUNT CREATED · YOU&rsquo;RE IN</V2Caps>
        <h1 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 88, lineHeight: 0.96, letterSpacing: '-0.025em', fontWeight: 500, maxWidth: 1000 }}>
          Hi Souvik. Let&rsquo;s teach you to <em style={{ fontStyle: 'italic', color: v2.accent }}>listen</em>.
        </h1>
        <p className="mt-6 max-w-xl text-[16px] leading-relaxed" style={{ color: v2.inkSoft }}>
          Three steps. Two minutes. Then you never type the easy stuff again.
        </p>
      </section>

      <section className="px-14 pb-20" style={{ borderTop: `1px solid ${v2.rule}` }}>
        <div className="mt-12 space-y-12">
          {steps.map((s) => (
            <article key={s.n} className="grid grid-cols-12 gap-10">
              <div className="col-span-2 pt-1.5 flex items-baseline gap-3">
                <V2Mono style={{ fontSize: 22, color: s.state === 'doing' ? v2.ink : v2.inkFaint, letterSpacing: '-0.01em' }}>{s.n}</V2Mono>
                {s.state === 'doing' && <span className="inline-block rounded-full" style={{ height: 7, width: 7, background: v2.accent }} />}
              </div>
              <div className="col-span-10">
                <h2 style={{ fontFamily: v2Serif, fontSize: 36, lineHeight: 1.05, letterSpacing: '-0.02em', fontWeight: 500, color: v2.ink, maxWidth: 760 }}>
                  {s.h}
                </h2>
                <p className="mt-3 text-[16px] leading-relaxed" style={{ color: v2.inkSoft, maxWidth: 640 }}>{s.b}</p>
                {s.cta && (
                  <button className="mt-5 inline-flex items-center gap-3 rounded-full px-5 py-3 text-[13px] font-medium" style={{ background: v2.ink, color: v2.cream }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 4v12m0 0l-5-5m5 5l5-5M5 20h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                    {s.cta}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>

        <div className="mt-16 pt-6 flex items-center justify-between" style={{ borderTop: `1px solid ${v2.rule}` }}>
          <V2Caps>NOT READY? · SKIP &amp; EXPLORE THE WEB APP →</V2Caps>
          <V2Caps>~2 MIN · ALL THREE STEPS</V2Caps>
        </div>
      </section>
    </div>
  );
}

// 8. Today · first-ever (account exists but no captures yet)
function V2WebTodayFirstEver() {
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      <V2WebHeader active="TODAY" />
      <section className="px-14 pt-24 pb-12">
        <V2Caps>TUE · MAY 20 · 14:08</V2Caps>
        <h1 className="mt-4" style={{ fontFamily: v2Serif, fontSize: 92, lineHeight: 0.96, letterSpacing: '-0.025em', fontWeight: 500, maxWidth: 920 }}>
          Today is <em style={{ fontStyle: 'italic', color: v2.accent }}>quiet</em>.
        </h1>
        <p className="mt-7 max-w-xl text-[16px] leading-relaxed" style={{ color: v2.inkSoft }}>
          Nothing here yet — and that&rsquo;s fine. The first time you hold the hotkey, the spine fills in below.
        </p>
        <div className="mt-10 flex items-center gap-6">
          <button className="inline-flex items-center gap-3 rounded-full px-6 py-3" style={{ background: v2.ink, color: v2.cream, fontSize: 14, fontWeight: 500 }}>
            <span className="inline-block rounded-full" style={{ height: 7, width: 7, background: v2.accent }} />
            Hold <V2Mono style={{ fontSize: 12, color: v2.cream2 }}>Ctrl+Space</V2Mono> to listen
          </button>
          <button className="text-[14px]" style={{ color: v2.inkSoft }}>· or drop in an audio file</button>
        </div>
      </section>

      <section className="px-14 pt-12 pb-20" style={{ borderTop: `1px solid ${v2.rule}` }}>
        <div className="grid grid-cols-12 gap-10 mb-12">
          <div className="col-span-2"><V2Caps>THE DAY, IN ORDER</V2Caps></div>
          <div className="col-span-10"><V2Caps>0 MOMENTS · YET</V2Caps></div>
        </div>

        {/* Three placeholder rows — ghosted, with the kinds of moments the user will see */}
        <div className="space-y-10" style={{ opacity: 0.42 }}>
          {[
            { t: '14:08', s: 'SLACK',     b: 'A status update you dictated into Slack.' },
            { t: '13:42', s: 'STANDUP',   b: 'A 27-minute meeting Oscar listened in on.' },
            { t: '11:45', s: 'CURSOR',    b: 'A code comment, formatted for the file you&rsquo;re in.' },
          ].map((e, i) => (
            <article key={i} className="grid grid-cols-12 gap-10">
              <div className="col-span-2 pt-2">
                <V2Mono style={{ fontSize: 14, color: v2.inkFaint }}>{e.t}</V2Mono>
                <div className="mt-1.5"><V2Source name={e.s} kind="" /></div>
              </div>
              <div className="col-span-10">
                <p style={{ fontFamily: v2Serif, fontSize: 22, lineHeight: 1.4, color: v2.inkFaint, letterSpacing: '-0.005em', maxWidth: 760, fontStyle: 'italic' }}>
                  {e.b}
                </p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-14 pt-7 grid grid-cols-3 gap-8" style={{ borderTop: `1px solid ${v2.rule}` }}>
          <div>
            <V2Caps color={v2.accent}>FOUR THINGS TO TRY</V2Caps>
            <p className="mt-3 text-[14px] leading-relaxed" style={{ color: v2.inkSoft }}>
              Hold the hotkey in Slack and dictate a status. Open Cursor and dictate a code comment. Drop a meeting recording in here. Open Settings and add your name to the vocabulary.
            </p>
          </div>
          <div>
            <V2Caps>OR · READ FIRST</V2Caps>
            <ul className="mt-3 space-y-2 text-[13px]" style={{ color: v2.inkSoft }}>
              <li>· <span style={{ color: v2.accent }}>The 3-minute Oscar tour →</span></li>
              <li>· How Oscar handles your audio</li>
              <li>· What the pill colors mean</li>
              <li>· Keyboard shortcuts</li>
            </ul>
          </div>
          <div>
            <V2Caps>OR · LISTEN TO OTHERS</V2Caps>
            <p className="mt-3 text-[14px] leading-relaxed" style={{ color: v2.inkSoft }}>
              Three short Scribbles from the Oscar team — what we use it for, in our own voice.
            </p>
            <p className="mt-2 text-[12px]" style={{ color: v2.accent }}>Play the welcome reel →</p>
          </div>
        </div>
      </section>
    </div>
  );
}

// 9. Mobile onboarding — three steps inside an iOS frame
function V2MobileOnboarding() {
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <div className="px-5 pt-8 flex items-center justify-between">
        <V2Wordmark />
        <V2Caps>STEP 2 OF 3</V2Caps>
      </div>

      <div className="px-5 pt-9">
        <V2Caps color={v2.accent}>PERMISSIONS · MICROPHONE</V2Caps>
        <h1 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 38, lineHeight: 0.98, letterSpacing: '-0.025em', fontWeight: 500 }}>
          Oscar needs to <em style={{ fontStyle: 'italic', color: v2.accent }}>hear you</em>.
        </h1>
        <p className="mt-4 text-[14px] leading-relaxed" style={{ color: v2.inkSoft }}>
          Tap allow on the next prompt. Audio is processed on-device when possible — and never stored without a Scribble to attach it to.
        </p>
      </div>

      {/* Faux system prompt */}
      <div className="mx-5 mt-9 rounded-2xl px-5 py-5" style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}>
        <V2Caps>iOS · IN 3 SECONDS</V2Caps>
        <div className="mt-3 flex items-center gap-3">
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="18" height="18" rx="4" stroke={v2.ink} strokeWidth="1.4" />
            <path d="M12 8a2 2 0 0 0-2 2v3a2 2 0 1 0 4 0v-3a2 2 0 0 0-2-2zM15 13a3 3 0 0 1-6 0M12 16v2" stroke={v2.accent} strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <div className="flex-1">
            <div className="text-[14px]" style={{ color: v2.ink, fontWeight: 500 }}>&ldquo;Oscar&rdquo; Would Like to Access the Microphone</div>
            <p className="mt-1 text-[12px]" style={{ color: v2.inkSoft }}>So you can dictate to any app on this phone.</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button className="rounded-full py-2 text-[12px]" style={{ background: v2.cream, border: `1px solid ${v2.rule}`, color: v2.inkSoft }}>Don&rsquo;t Allow</button>
          <button className="rounded-full py-2 text-[12px] font-medium" style={{ background: v2.ink, color: v2.cream }}>Allow</button>
        </div>
      </div>

      <div className="flex-1" />

      {/* Step indicator */}
      <div className="px-5 pb-7 mt-10">
        <div className="flex items-center gap-1.5">
          <div style={{ flex: 1, height: 3, background: v2.ink, borderRadius: 2 }} />
          <div style={{ flex: 1, height: 3, background: v2.accent, borderRadius: 2 }} />
          <div style={{ flex: 1, height: 3, background: v2.ruleHard, borderRadius: 2 }} />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <V2Caps>← SIGN IN</V2Caps>
          <V2Caps>FIRST SCRIBBLE →</V2Caps>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EDITOR STATES GALLERY
// ═══════════════════════════════════════════════════════════════════════════

// 10. Scribble editor — six states in one canvas
function V2WebEditorStatesGallery() {
  // Mini editor card — each state is a compact slice that mimics the real
  // single-Scribble layout, sized to fit six in a 3×2 grid.
  function Card({ tag, h, body, children }) {
    return (
      <div className="rounded-lg p-6 flex flex-col" style={{ background: v2.cream2, border: `1px solid ${v2.rule}`, minHeight: 430 }}>
        <V2Caps color={v2.accent}>{tag}</V2Caps>
        <h3 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 22, lineHeight: 1.05, letterSpacing: '-0.015em', fontWeight: 500 }}>{h}</h3>
        <p className="mt-2 text-[12px] leading-relaxed" style={{ color: v2.inkSoft }}>{body}</p>
        <div className="mt-5 flex-1 rounded-md overflow-hidden" style={{ background: v2.cream, border: `1px solid ${v2.rule}` }}>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      <V2WebHeader active="" />
      <section className="px-14 pt-8 pb-16">
        <V2Caps>SCRIBBLE EDITOR · SIX STATES</V2Caps>
        <h1 className="mt-2" style={{ fontFamily: v2Serif, fontSize: 44, lineHeight: 1, letterSpacing: '-0.025em', fontWeight: 500 }}>
          What a single Scribble <em style={{ fontStyle: 'italic', color: v2.accent }}>can become</em>.
        </h1>
        <p className="mt-3 max-w-xl text-[14px] leading-relaxed" style={{ color: v2.inkSoft }}>
          Empty, streaming, shared, versioned, conflicted, collaborative. All inside the same paper.
        </p>

        <div className="mt-10 grid grid-cols-3 gap-4">

          {/* A. Empty doc */}
          <Card
            tag="EMPTY · NEW SCRIBBLE"
            h="A blank page that listens."
            body="Before the first word. The page invites — never pressures."
          >
            <div className="p-5 h-full flex flex-col">
              <V2Caps>UNTITLED · MAY 20 · 14:08</V2Caps>
              <div className="mt-3" style={{ fontFamily: v2Serif, fontSize: 22, color: v2.inkFaint, fontStyle: 'italic', lineHeight: 1.2 }}>
                Hold <V2Mono style={{ fontSize: 13, color: v2.accent, background: v2.cream2, padding: '1px 6px', borderRadius: 4 }}>Ctrl+Space</V2Mono><br />and start talking.
              </div>
              <div className="mt-auto flex items-center gap-2 pt-4" style={{ borderTop: `1px dashed ${v2.ruleHard}` }}>
                <span className="inline-block rounded-full" style={{ height: 6, width: 6, background: v2.ruleHard }} />
                <V2Caps>WAITING FOR YOU</V2Caps>
              </div>
            </div>
          </Card>

          {/* B. AI streaming */}
          <Card
            tag="AI STREAMING · MARGIN FILLING IN"
            h="Oscar is writing in the margin."
            body="The transcript on the left is final. The right margin streams in as Oscar listens to the whole."
          >
            <div className="p-5 h-full flex gap-4">
              <div className="flex-1 pr-4" style={{ borderRight: `1px solid ${v2.rule}` }}>
                <V2Caps>YOUR VOICE</V2Caps>
                <p className="mt-2" style={{ fontFamily: v2Serif, fontSize: 13, lineHeight: 1.5, color: v2.ink }}>
                  We ran four pricing experiments. Two worked. Annual save bumped from 17 to 20.
                </p>
              </div>
              <div style={{ width: 110 }}>
                <V2Caps color={v2.accent}>OSCAR ↓</V2Caps>
                <p className="mt-2" style={{ fontFamily: v2Serif, fontSize: 12, lineHeight: 1.4, color: v2.ink }}>
                  4 experiments. <em style={{ color: v2.accent }}>Two won.</em>
                </p>
                <p className="mt-2" style={{ fontFamily: v2Serif, fontSize: 12, lineHeight: 1.4, color: v2.ink }}>
                  Push annual save<span className="inline-block" style={{ width: 6, height: 11, background: v2.accent, marginLeft: 2, verticalAlign: 'middle', animation: 'blink 1s steps(2) infinite' }} />
                </p>
                <div className="mt-3 flex items-center gap-1.5">
                  <span className="inline-block rounded-full" style={{ height: 5, width: 5, background: v2.accent }} />
                  <V2Caps color={v2.accent} size={9}>WRITING…</V2Caps>
                </div>
              </div>
            </div>
          </Card>

          {/* C. Read-only / shared with me */}
          <Card
            tag="READ-ONLY · SHARED WITH YOU"
            h="Someone else&rsquo;s voice."
            body="Mira shared this Scribble with you. You can read, copy, comment — but the source is hers."
          >
            <div className="p-5 h-full flex flex-col">
              <div className="flex items-center justify-between">
                <V2Caps>BY MIRA · MAY 18</V2Caps>
                <div className="rounded-full px-2 py-0.5" style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}>
                  <V2Caps size={9}>READ-ONLY</V2Caps>
                </div>
              </div>
              <p className="mt-3" style={{ fontFamily: v2Serif, fontSize: 16, lineHeight: 1.4, color: v2.ink }}>
                Quarterly planning notes — three big bets for the next 90 days.
              </p>
              <p className="mt-2 text-[12px]" style={{ color: v2.inkSoft, lineHeight: 1.5 }}>
                One: ship the desktop pill polish. Two: redesign the Scribble editor…
              </p>
              <div className="mt-auto pt-3 flex items-center gap-2" style={{ borderTop: `1px solid ${v2.rule}` }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="10" rx="2" stroke={v2.inkSoft} strokeWidth="1.5" /><path d="M8 11V7a4 4 0 0 1 8 0v4" stroke={v2.inkSoft} strokeWidth="1.5" /></svg>
                <span className="text-[11px]" style={{ color: v2.inkSoft }}>Copy or comment · can&rsquo;t edit</span>
              </div>
            </div>
          </Card>

          {/* D. Version history */}
          <Card
            tag="VERSION HISTORY · 7 SAVES"
            h="Every shape it&rsquo;s been."
            body="Oscar saves on every meaningful change. Click a version to preview, restore to roll back."
          >
            <div className="p-5 h-full flex flex-col">
              <V2Caps>HISTORY</V2Caps>
              <div className="mt-3 space-y-2.5 flex-1 overflow-hidden">
                {[
                  { t: '14:08', d: 'Now', a: 'You', live: true },
                  { t: '13:42', d: '26m ago', a: 'You — reshaped as Slack' },
                  { t: '11:18', d: '3h ago', a: 'You — first dictation' },
                  { t: 'MAY 19', d: 'yesterday', a: 'Oscar auto-clean' },
                  { t: 'MAY 18', d: '2 days ago', a: 'You — initial save' },
                ].map((v, i) => (
                  <div key={i} className="flex items-baseline gap-3 pb-2" style={{ borderBottom: i < 4 ? `1px solid ${v2.rule}` : 'none' }}>
                    {v.live && <span className="inline-block rounded-full" style={{ height: 5, width: 5, background: v2.accent }} />}
                    <V2Mono style={{ fontSize: 10, color: v2.ink, width: 50 }}>{v.t}</V2Mono>
                    <div className="flex-1 text-[11px]" style={{ color: v.live ? v2.ink : v2.inkSoft }}>{v.a}</div>
                    {!v.live && <button className="text-[10px]" style={{ color: v2.accent }}>Restore</button>}
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* E. Save conflict */}
          <Card
            tag="CONFLICT · YOU EDITED OFFLINE"
            h="Two versions exist."
            body="You dictated on the phone while desktop was offline. Pick which truth to keep — or merge."
          >
            <div className="p-5 h-full flex flex-col">
              <V2Caps color={v2.accent}>BOTH MOVED SINCE THE LAST SYNC</V2Caps>
              <div className="mt-4 grid grid-cols-2 gap-3 flex-1">
                <div className="rounded p-3 flex flex-col" style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}>
                  <V2Caps size={9}>THIS DEVICE · 12:08</V2Caps>
                  <p className="mt-2 text-[11px]" style={{ fontFamily: v2Serif, color: v2.ink, lineHeight: 1.35 }}>
                    Annual save bumped to <strong>22%</strong> next month.
                  </p>
                  <button className="mt-auto text-[10px] rounded-full px-3 py-1.5 font-medium" style={{ background: v2.ink, color: v2.cream }}>Keep this</button>
                </div>
                <div className="rounded p-3 flex flex-col" style={{ background: v2.cream, border: `1px solid ${v2.accent}` }}>
                  <V2Caps color={v2.accent} size={9}>iPHONE · 14:02</V2Caps>
                  <p className="mt-2 text-[11px]" style={{ fontFamily: v2Serif, color: v2.ink, lineHeight: 1.35 }}>
                    Annual save bumped to <strong>20%</strong> — also test 14-day trial.
                  </p>
                  <button className="mt-auto text-[10px] rounded-full px-3 py-1.5 font-medium" style={{ background: v2.ink, color: v2.cream }}>Keep this</button>
                </div>
              </div>
              <button className="mt-3 text-[11px]" style={{ color: v2.accent }}>· or merge intelligently →</button>
            </div>
          </Card>

          {/* F. Collaboration / presence */}
          <Card
            tag="COLLAB · MIRA IS HERE"
            h="Two voices on one page."
            body="Mira&rsquo;s cursor is in the margin. Oscar keeps your edits separate, then weaves."
          >
            <div className="p-5 h-full flex flex-col">
              <div className="flex items-center gap-2">
                <div style={{ height: 22, width: 22, borderRadius: 999, background: v2.accent, color: v2.cream, fontFamily: v2Serif, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 500 }}>S</div>
                <div style={{ height: 22, width: 22, borderRadius: 999, background: '#3957a0', color: v2.cream, fontFamily: v2Serif, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 500, marginLeft: -6, border: `2px solid ${v2.cream}` }}>M</div>
                <V2Caps>YOU + MIRA · LIVE</V2Caps>
              </div>
              <p className="mt-4" style={{ fontFamily: v2Serif, fontSize: 14, lineHeight: 1.45, color: v2.ink }}>
                We ran four pricing experiments. Two worked.
                <span style={{ background: 'rgba(57, 87, 160, 0.14)', padding: '0 2px' }}>Annual save bumped from 17 to 20</span><span style={{ display: 'inline-block', width: 2, height: 14, background: '#3957a0', marginLeft: 1, verticalAlign: 'middle' }} /> — push to 22%.
              </p>
              <div className="mt-auto pt-3 flex items-center gap-2" style={{ borderTop: `1px solid ${v2.rule}` }}>
                <span className="inline-block rounded-full" style={{ height: 5, width: 5, background: '#3957a0' }} />
                <span className="text-[11px]" style={{ color: v2.inkSoft }}>Mira is highlighting in the body</span>
              </div>
            </div>
          </Card>

        </div>

        <div className="mt-10 pt-6 grid grid-cols-3 gap-8" style={{ borderTop: `1px solid ${v2.rule}` }}>
          <div>
            <V2Caps>WHAT&rsquo;S CONSISTENT</V2Caps>
            <p className="mt-3 text-[13px] leading-relaxed" style={{ color: v2.inkSoft }}>
              The paper is always cream. Serif is your voice. Accent is presence — never decoration.
            </p>
          </div>
          <div>
            <V2Caps>WHAT CHANGES</V2Caps>
            <p className="mt-3 text-[13px] leading-relaxed" style={{ color: v2.inkSoft }}>
              The chrome above the page. Read-only adds a chip. Conflict adds two columns. Collab adds a second cursor color.
            </p>
          </div>
          <div>
            <V2Caps>WHAT&rsquo;S MISSING ON PURPOSE</V2Caps>
            <p className="mt-3 text-[13px] leading-relaxed" style={{ color: v2.inkSoft }}>
              No red warnings. No spinners without a verb. No badges that don&rsquo;t describe an action.
            </p>
          </div>
        </div>
      </section>

      <style>{`@keyframes blink { to { opacity: 0; } }`}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DESKTOP UPDATE — SIX STATES IN ONE CANVAS
// ═══════════════════════════════════════════════════════════════════════════

// 11. Multi-state desktop update gallery
function V2DesktopUpdateGallery() {
  function PillRow({ icon, label, sub, accent }) {
    return (
      <div className="flex items-center gap-3 pt-3 pb-3" style={{ borderBottom: `1px solid ${v2.rule}` }}>
        <div style={{ width: 28, height: 28, borderRadius: 999, background: accent ? v2.accent : v2.cream2, color: accent ? v2.cream : v2.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
        <div className="flex-1">
          <div className="text-[12px]" style={{ color: v2.ink, fontWeight: 500 }}>{label}</div>
          <div className="text-[10px] mt-0.5" style={{ color: v2.inkSoft, fontFamily: v2Mono, letterSpacing: '0.04em' }}>{sub}</div>
        </div>
      </div>
    );
  }

  function StateCard({ tag, h, children, footer, accent }) {
    return (
      <div className="rounded-lg p-6 flex flex-col" style={{ background: v2.cream2, border: `1px solid ${v2.rule}`, minHeight: 280 }}>
        <V2Caps color={accent ? v2.accent : v2.inkFaint}>{tag}</V2Caps>
        <h3 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 22, lineHeight: 1.05, letterSpacing: '-0.015em', fontWeight: 500 }}>{h}</h3>
        <div className="mt-4 flex-1">{children}</div>
        {footer && <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${v2.rule}` }}>{footer}</div>}
      </div>
    );
  }

  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <V2WinChrome title="OSCAR · UPDATE · ALL STATES" />
      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        <V2DeskSidebar active="settings" />
        <main className="col-span-9 overflow-auto px-9 py-8">
          <V2Caps>DESKTOP · UPDATE · SIX STATES</V2Caps>
          <h1 className="mt-2" style={{ fontFamily: v2Serif, fontSize: 32, lineHeight: 1, letterSpacing: '-0.02em', fontWeight: 500 }}>
            How Oscar tells you it&rsquo;s <em style={{ fontStyle: 'italic', color: v2.accent }}>changed</em>.
          </h1>
          <p className="mt-3 max-w-xl text-[13px] leading-relaxed" style={{ color: v2.inkSoft }}>
            Quiet at idle, verbose during work, never alarmist. The accent appears only when a restart is genuinely available.
          </p>

          <div className="mt-7 grid grid-cols-3 gap-3">
            {/* 1. Up to date — quiet rest state */}
            <StateCard
              tag="UP TO DATE · v0.42.0"
              h="You&rsquo;re current."
              footer={<V2Caps>CHECKED 2 MIN AGO · AUTO</V2Caps>}
            >
              <div className="flex items-center gap-3">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke={v2.ink} strokeWidth="1.4" />
                  <path d="M7 12l4 4 6-7" stroke={v2.ink} strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                <p className="text-[12px] leading-relaxed" style={{ color: v2.inkSoft }}>
                  Oscar checks for updates every six hours. Nothing for you to do.
                </p>
              </div>
            </StateCard>

            {/* 2. Checking */}
            <StateCard
              tag="CHECKING · IN PROGRESS"
              h="Looking for something newer."
              footer={
                <div className="flex items-center gap-2">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1.6s linear infinite' }}>
                    <circle cx="12" cy="12" r="9" stroke={v2.inkSoft} strokeWidth="2" strokeDasharray="14 30" />
                  </svg>
                  <V2Mono style={{ fontSize: 10, color: v2.inkSoft }}>pinging release feed · ~2s</V2Mono>
                </div>
              }
            >
              <p className="text-[12px] leading-relaxed" style={{ color: v2.inkSoft }}>
                The mono line tells you exactly what&rsquo;s happening. No bare spinner.
              </p>
            </StateCard>

            {/* 3. Downloading */}
            <StateCard
              tag="DOWNLOADING · v0.43.0"
              h="Pulling 32 MB in the background."
              footer={<V2Mono style={{ fontSize: 10, color: v2.inkSoft }}>18 MB / 32 MB · 1.4 MB/s · ~10s LEFT</V2Mono>}
            >
              <div className="space-y-2">
                <PillRow icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 4v12m0 0l-5-5m5 5l5-5M5 20h14" stroke={v2.ink} strokeWidth="1.6" strokeLinecap="round" /></svg>} label="oscar-0.43.0-mac-arm64.dmg" sub="32 MB · SHA verified" />
                <div style={{ height: 5, background: v2.ruleHard, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: '56%', background: v2.ink, borderRadius: 3 }} />
                </div>
              </div>
            </StateCard>

            {/* 4. Ready to install — the accent moment */}
            <StateCard
              tag="READY · RESTART TO INSTALL"
              h={<>Quieter, <em style={{ fontStyle: 'italic', color: v2.accent }}>faster</em>, fewer bugs.</>}
              accent
              footer={
                <div className="flex items-center gap-2">
                  <button className="text-[11px] rounded-full px-3 py-1.5 font-medium" style={{ background: v2.ink, color: v2.cream }}>Restart now</button>
                  <button className="text-[11px]" style={{ color: v2.inkSoft }}>Install on quit</button>
                </div>
              }
            >
              <ul className="space-y-1.5 text-[11px]" style={{ color: v2.ink }}>
                <li className="flex gap-2"><V2Mono style={{ fontSize: 9, color: v2.accent, paddingTop: 2 }}>NEW</V2Mono>Pill settings popover.</li>
                <li className="flex gap-2"><V2Mono style={{ fontSize: 9, color: v2.accent, paddingTop: 2 }}>NEW</V2Mono>Hinglish keeps brand names verbatim.</li>
                <li className="flex gap-2"><V2Mono style={{ fontSize: 9, color: v2.inkFaint, paddingTop: 2 }}>FAST</V2Mono>18% faster Whisper on Apple Silicon.</li>
                <li className="flex gap-2"><V2Mono style={{ fontSize: 9, color: v2.inkFaint, paddingTop: 2 }}>FIX</V2Mono>Pill no longer steals focus from Slack.</li>
              </ul>
            </StateCard>

            {/* 5. Failed */}
            <StateCard
              tag="DOWNLOAD FAILED"
              h="That didn&rsquo;t come through."
              footer={
                <div className="flex items-center gap-2">
                  <button className="text-[11px] rounded-full px-3 py-1.5 font-medium" style={{ background: v2.ink, color: v2.cream }}>Try again</button>
                  <button className="text-[11px]" style={{ color: v2.inkSoft }}>Skip this version</button>
                </div>
              }
            >
              <div className="flex items-center gap-3">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#8c2f25" strokeWidth="1.4" />
                  <path d="M8 8l8 8M16 8l-8 8" stroke="#8c2f25" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                <p className="text-[12px] leading-relaxed" style={{ color: v2.inkSoft }}>
                  Network dropped at 18 MB of 32 MB. Oscar resumes from where it stopped — your slot is held.
                </p>
              </div>
            </StateCard>

            {/* 6. Mandatory */}
            <StateCard
              tag="REQUIRED · SECURITY"
              h={<>This one&rsquo;s <em style={{ fontStyle: 'italic', color: v2.accent }}>not optional</em>.</>}
              accent
              footer={
                <div>
                  <button className="text-[11px] rounded-full px-3 py-1.5 font-medium" style={{ background: v2.ink, color: v2.cream }}>Install and restart now</button>
                  <div className="mt-2"><V2Caps color={v2.inkSoft}>OSCAR WILL STOP RECORDING IN 10 MIN</V2Caps></div>
                </div>
              }
            >
              <p className="text-[12px] leading-relaxed" style={{ color: v2.ink }}>
                v0.42.1 patches a token-leak path in the desktop callback. We don&rsquo;t make these blocking unless we have to.
              </p>
            </StateCard>
          </div>

          <div className="mt-7 pt-5 grid grid-cols-2 gap-7" style={{ borderTop: `1px solid ${v2.rule}` }}>
            <div>
              <V2Caps>HIERARCHY</V2Caps>
              <p className="mt-2 text-[12px] leading-relaxed" style={{ color: v2.inkSoft }}>
                Up-to-date and Checking are rest states — no accent, ever. Downloading is process — mono captions only. Ready and Required earn the accent because they ask for action.
              </p>
            </div>
            <div>
              <V2Caps>WHERE THESE SHOW UP</V2Caps>
              <p className="mt-2 text-[12px] leading-relaxed" style={{ color: v2.inkSoft }}>
                Settings → About (this surface), the menubar icon (a single accent dot when Ready or Required), and a one-line banner in Today when Required.
              </p>
            </div>
          </div>

          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </main>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

Object.assign(window, {
  V2WebSignUp, V2WebForgotPassword, V2WebMagicLinkSent, V2WebResetPassword,
  V2WebTwoFactor, V2WebAuthErrors,
  V2WebFirstRun, V2WebTodayFirstEver, V2MobileOnboarding,
  V2WebEditorStatesGallery,
  V2DesktopUpdateGallery,
});
