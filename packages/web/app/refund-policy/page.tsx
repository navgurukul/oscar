export default function RefundPolicyPage() {
  return (
    <main className="min-h-screen py-16 px-4 mt-16">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Refund Policy
          </h1>
          <p className="text-gray-400">Last updated: February 22, 2026</p>
        </div>

        <div className="space-y-8 text-gray-300">
          <p className="mb-8 text-base leading-relaxed">
            We want you to feel confident subscribing to OSCAR. This page explains when and how refunds are issued, so there are no surprises.
          </p>

          <section>
            <h2 className="text-2xl font-bold text-white mb-6">7-Day Money-Back Guarantee</h2>
            <p className="mb-4 text-base leading-relaxed">
              If you subscribe to OSCAR Pro for the first time and change your mind, you can request a full refund within 7 days of your purchase — no questions asked. This applies to new subscribers only. To request a refund, go to Settings → Billing and click &quot;Request Refund&quot;, or reach out to our support team directly.
            </p>
            <p className="mb-3 text-base leading-relaxed">Once your request is submitted, here is what to expect:</p>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li className="text-base leading-relaxed"><strong className="text-white">Review —</strong>We will review your request within 2 business days.</li>
              <li className="text-base leading-relaxed"><strong className="text-white">Processing —</strong>Approved refunds are processed within 5–7 business days.</li>
              <li className="text-base leading-relaxed"><strong className="text-white">Bank —</strong>It may take an additional 3–5 business days to appear in your account depending on your bank.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-6">Technical Issues</h2>
            <p className="mb-4 text-base leading-relaxed">
              If you experience a significant technical problem on our end — such as an extended service outage lasting more than 48 consecutive hours, a critical feature failure that prevents you from using OSCAR, or an AI processing failure caused by our system — you may be eligible for a prorated refund for the affected period.
            </p>
            <p className="mb-3 text-base leading-relaxed">
              Please report the issue to us immediately. We commit to responding within 72 hours. If we are unable to resolve it in that time, we will work with you on a refund based on the unused service time. The same review, processing, and bank timelines above apply.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-6">Billing Errors</h2>
            <p className="text-base leading-relaxed">
              If you are accidentally charged twice for the same period, or charged an amount different from what was shown at checkout, we will refund the error immediately upon verification. These are our mistakes and we take full responsibility for correcting them.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-6">Cancellations</h2>
            <p className="mb-4 text-base leading-relaxed">
              If you cancel your subscription outside the 7-day window, no refund is issued for the remaining period — but you keep access to Pro features until the end of your current billing cycle. We do not offer prorated refunds for mid-cycle cancellations. The Free plan has no charges and no refunds apply. Downgrading from Pro to Free at renewal does not trigger a refund for the current period.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-6">When Refunds Are Not Issued</h2>
            <p className="mb-3 text-base leading-relaxed">Refunds are not available in the following situations:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li className="text-base leading-relaxed">Change of mind after the 7-day window</li>
              <li className="text-base leading-relaxed">Partial use of a billing period</li>
              <li className="text-base leading-relaxed">Failure to cancel before a renewal date</li>
              <li className="text-base leading-relaxed">Account termination due to Terms of Service violations</li>
              <li className="text-base leading-relaxed">Issues caused by third-party services or user error</li>
              <li className="text-base leading-relaxed">Dissatisfaction with AI formatting quality</li>
              <li className="text-base leading-relaxed">Unused features or services within your plan</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-6">Chargebacks</h2>
            <p className="text-base leading-relaxed">
              Before initiating a chargeback with your bank, please contact us first — we resolve most billing issues quickly and without the hassle of a dispute. Chargebacks may result in immediate account suspension, and chargebacks filed after a refund has already been issued may be reported as fraud.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-6">How Refunds Are Processed</h2>
            <p className="mb-4 text-base leading-relaxed">
              All refunds are issued to the original payment method used at purchase, processed through Razorpay. We cannot issue refunds to a different payment method or account. Refunds are made in the same currency as the original charge — INR for Indian payments, USD for international payments. We are not responsible for exchange rate fluctuations between the time of purchase and the time of refund.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-6">Questions</h2>
            <p className="text-base leading-relaxed">
              If you have questions about this policy or need help with a refund request please contact us through the settings page or at the contact information provided in our application.
            </p>
          </section>

          <div className="mt-12 p-6 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
            <h3 className="text-xl font-bold text-cyan-400 mb-3">
              Quick Summary
            </h3>
            <ul className="space-y-2">
              <li>- 7-day money-back guarantee for new subscribers</li>
              <li>- Full refund for billing errors</li>
              <li>- Prorated refunds for extended technical issues</li>
              <li>- No refunds for mid-cycle cancellations (after 7 days)</li>
              <li>- No refunds for Terms violations</li>
              <li>- Refunds processed in 5-7 business days</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
