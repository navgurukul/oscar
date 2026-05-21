import { V2LegalLayout } from "@/components/v2/V2LegalLayout";

const TOC = [
  "7-day guarantee",
  "Technical issues",
  "Billing errors",
  "Cancellations",
  "When refunds aren't issued",
  "Chargebacks",
  "How refunds process",
  "Questions",
];

export default function RefundPolicyPage() {
  return (
    <V2LegalLayout
      active="REFUNDS"
      eyebrow="LEGAL · REFUND POLICY · LAST UPDATED FEB 22, 2026"
      title={
        <>
          When refunds <em style={{ fontStyle: "italic", color: "#b8623d" }}>happen</em>, and when
          they don&rsquo;t.
        </>
      }
      lead={
        <>
          We want you to feel confident subscribing to Oscar. This page is honest about when we
          issue refunds — no surprises.
        </>
      }
      toc={TOC}
    >
      <section id="7-day-guarantee">
        <h2>7-day money-back guarantee</h2>
        <p>
          If you subscribe to Oscar Pro for the first time and change your mind, request a full
          refund within 7 days — no questions asked. New subscribers only. Settings → Billing →
          &ldquo;Request refund&rdquo;, or contact support.
        </p>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            ["01 · REVIEW", "≤ 2 business days", "We confirm eligibility and acknowledge."],
            ["02 · PROCESS", "5–7 business days", "Approved refunds are sent through Razorpay."],
            ["03 · YOUR BANK", "+3–5 business days", "Timing depends on your bank — usually within a week."],
          ].map(([k, t, body]) => (
            <div
              key={k}
              className="rounded-md p-4"
              style={{ background: "#efeae0", border: "1px solid #e5e0d6" }}
            >
              <span
                style={{
                  fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "#b8623d",
                  fontSize: 10,
                }}
              >
                {k}
              </span>
              <span
                style={{
                  display: "block",
                  fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                  fontSize: 12,
                  color: "#1a1816",
                  marginTop: 4,
                  letterSpacing: "0.06em",
                }}
              >
                {t.toUpperCase()}
              </span>
              <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "#5a5852" }}>
                {body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="technical-issues">
        <h2>Technical issues</h2>
        <p>
          For significant problems on our end — service outage lasting 48+ consecutive hours, a
          critical feature failure that prevents use, or an AI processing failure caused by our system
          — you may be eligible for a prorated refund for the affected period.
        </p>
        <p>
          Report immediately. We respond within 72 hours. If unresolved in that time, we&rsquo;ll
          work with you on a refund based on unused service time.
        </p>
      </section>

      <section id="billing-errors">
        <h2>Billing errors</h2>
        <p>
          Charged twice for the same period, or charged a different amount than shown at checkout?
          We&rsquo;ll refund the error immediately upon verification.
        </p>
      </section>

      <section id="cancellations">
        <h2>Cancellations</h2>
        <p>
          Cancel outside the 7-day window and no refund is issued for the remaining period — but you
          keep Pro features until the end of your current cycle. No prorated refunds for mid-cycle
          cancellations. Free plan has no charges and no refunds. Downgrading at renewal doesn&rsquo;t
          trigger a refund for the current period.
        </p>
      </section>

      <section id="when-refunds-arent-issued">
        <h2>When refunds aren&rsquo;t issued</h2>
        <ul>
          <li>Change of mind after the 7-day window</li>
          <li>Partial use of a billing period</li>
          <li>Failure to cancel before a renewal date</li>
          <li>Account termination due to Terms violations</li>
          <li>Issues caused by third-party services or user error</li>
          <li>Dissatisfaction with AI formatting quality</li>
          <li>Unused features within your plan</li>
        </ul>
      </section>

      <section id="chargebacks">
        <h2>Chargebacks</h2>
        <p>
          Contact us before initiating a chargeback — most billing issues resolve quickly without a
          dispute. Chargebacks may result in immediate account suspension, and chargebacks filed
          after a refund has already been issued may be reported as fraud.
        </p>
      </section>

      <section id="how-refunds-process">
        <h2>How refunds process</h2>
        <p>
          All refunds go to the original payment method, processed via Razorpay. We can&rsquo;t refund
          to a different method or account. Refunds are issued in the original currency. We&rsquo;re
          not responsible for exchange-rate fluctuations between purchase and refund.
        </p>
      </section>

      <section id="questions">
        <h2>Questions</h2>
        <p>
          Contact us through the settings page or at the contact information provided in our
          application.
        </p>
      </section>

      {/* Quick summary — dark editorial card */}
      <aside
        className="rounded-lg p-7"
        style={{ background: "#1a1816", color: "#f7f4ee" }}
      >
        <span
          style={{
            fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#e8c9b8",
            fontSize: 10,
          }}
        >
          QUICK SUMMARY · IF YOU READ NOTHING ELSE
        </span>
        <ul
          className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-[14px]"
          style={{ fontFamily: '"EB Garamond", Georgia, serif', listStyle: "none", padding: 0 }}
        >
          {[
            "New subscribers: 7-day money-back, no questions",
            "Full refund for billing errors",
            "Prorated refunds for extended technical issues",
            "No refunds for mid-cycle cancellations (after 7 days)",
            "No refunds for Terms violations",
            "Processed in 5–7 business days",
          ].map((line) => (
            <li key={line} className="flex items-start gap-2" style={{ color: "#f7f4ee", padding: 0 }}>
              <span
                style={{
                  color: "#b8623d",
                  fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                  fontSize: 12,
                  marginTop: 4,
                }}
              >
                ·
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </aside>
    </V2LegalLayout>
  );
}
