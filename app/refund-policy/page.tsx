export default function RefundPolicyPage() {
  return (
    <main className="min-h-screen py-16 px-4 mt-16">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
          Refund Policy
        </h1>
        <p className="text-gray-400 mb-8">Last updated: February 22, 2025</p>

        <div className="space-y-8 text-gray-300">
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. Overview</h2>
            <p>
              At OSCAR, we strive to provide excellent service. This Refund
              Policy outlines the circumstances under which refunds may be
              issued for Pro subscription payments.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              2. 7-Day Money-Back Guarantee
            </h2>
            <h3 className="text-xl font-semibold text-white mb-3">
              2.1 Eligibility
            </h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong className="text-white">New subscribers only:</strong>{" "}
                Available for first-time Pro subscriptions
              </li>
              <li>
                <strong className="text-white">7-day window:</strong> Request
                must be made within 7 days of initial purchase
              </li>
              <li>
                <strong className="text-white">Full refund:</strong> 100% refund
                of the subscription amount
              </li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-4">
              2.2 How to Request
            </h3>
            <p>To request a refund under the 7-day guarantee:</p>
            <ol className="list-decimal pl-6 space-y-2 mt-3">
              <li>Go to Settings → Billing section</li>
              <li>Click &quot;Request Refund&quot; or contact support</li>
              <li>Provide your subscription details and reason (optional)</li>
              <li>Refund will be processed within 5-7 business days</li>
            </ol>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              3. Technical Issue Refunds
            </h2>
            <h3 className="text-xl font-semibold text-white mb-3">
              3.1 Qualifying Issues
            </h3>
            <p className="mb-3">
              You may be eligible for a prorated refund if you experience:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Extended service outages (more than 48 consecutive hours)</li>
              <li>Critical feature failures that prevent core functionality</li>
              <li>Billing errors or double charges</li>
              <li>AI processing failures due to our system errors</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-4">
              3.2 Process
            </h3>
            <ol className="list-decimal pl-6 space-y-2">
              <li>Report the technical issue to support immediately</li>
              <li>Allow us 72 hours to resolve the issue</li>
              <li>If unresolved, request a prorated refund</li>
              <li>Refund amount based on unused service time</li>
            </ol>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              4. Subscription Cancellations
            </h2>
            <h3 className="text-xl font-semibold text-white mb-3">
              4.1 Standard Cancellation
            </h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong className="text-white">No refund:</strong> Cancellations
                outside the 7-day window are not eligible for refunds
              </li>
              <li>
                <strong className="text-white">Access maintained:</strong> You
                retain access until the end of your current billing period
              </li>
              <li>
                <strong className="text-white">Auto-renewal stops:</strong> No
                future charges after cancellation
              </li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-4">
              4.2 Mid-Cycle Cancellations
            </h3>
            <p>
              If you cancel in the middle of a billing cycle (after the 7-day
              window), you will NOT receive a prorated refund. You will continue
              to have access to Pro features until the end of your paid period.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              5. Non-Refundable Situations
            </h2>
            <p className="mb-4">Refunds will NOT be issued for:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Change of mind after the 7-day guarantee period</li>
              <li>Partial use of a billing period</li>
              <li>Failure to cancel before renewal date</li>
              <li>Account termination due to Terms of Service violations</li>
              <li>Issues caused by third-party services or user error</li>
              <li>
                Dissatisfaction with AI formatting results (subjective quality)
              </li>
              <li>Unused features or services within your plan</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              6. Billing Errors
            </h2>
            <h3 className="text-xl font-semibold text-white mb-3">
              6.1 Double Charges
            </h3>
            <p>
              If you are accidentally charged twice for the same subscription
              period, we will immediately refund the duplicate charge upon
              verification.
            </p>

            <h3 className="text-xl font-semibold text-white mb-3 mt-4">
              6.2 Incorrect Amount
            </h3>
            <p>
              If you are charged an incorrect amount (different from the
              displayed price at checkout), we will refund the difference or the
              full amount at your request.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              7. Refund Processing
            </h2>
            <h3 className="text-xl font-semibold text-white mb-3">
              7.1 Timeframe
            </h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong className="text-white">Approval:</strong> Refund
                requests reviewed within 2 business days
              </li>
              <li>
                <strong className="text-white">Processing:</strong> Approved
                refunds processed within 5-7 business days
              </li>
              <li>
                <strong className="text-white">Bank timing:</strong> May take
                additional 3-5 business days to appear in your account
              </li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-4">
              7.2 Refund Method
            </h3>
            <p>
              Refunds are issued to the original payment method used for the
              purchase through Razorpay. We cannot issue refunds to different
              payment methods or accounts.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              8. Free Plan and Downgrades
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>The Free plan has no charges and no refunds apply</li>
              <li>
                Downgrading from Pro to Free at renewal does not trigger a
                refund for the current period
              </li>
              <li>
                You must cancel before the renewal date to avoid being charged
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              9. Chargebacks
            </h2>
            <p className="mb-4">
              <strong className="text-white">Important:</strong> Before
              initiating a chargeback with your bank:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Contact us first - we resolve most issues quickly</li>
              <li>Chargebacks may result in immediate account suspension</li>
              <li>
                Disputed charges can be reviewed through our refund process
              </li>
              <li>
                Chargebacks after receiving a refund may be reported as fraud
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              10. How to Request a Refund
            </h2>
            <h3 className="text-xl font-semibold text-white mb-3">
              Method 1: In-App
            </h3>
            <ol className="list-decimal pl-6 space-y-2">
              <li>Log in to your account</li>
              <li>Navigate to Settings → Billing</li>
              <li>Find your active subscription</li>
              <li>Click &quot;Request Refund&quot; (if within 7-day window)</li>
              <li>Submit request with optional reason</li>
            </ol>

            <h3 className="text-xl font-semibold text-white mb-3 mt-4">
              Method 2: Contact Support
            </h3>
            <p>If the in-app option is unavailable or for technical issues:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Email us through the contact information in Settings</li>
              <li>Include: Account email, subscription ID, and reason</li>
              <li>We&apos;ll respond within 1-2 business days</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              11. Currency and Exchange Rates
            </h2>
            <p>
              Refunds are issued in the same currency as the original charge
              (INR). Exchange rate fluctuations between purchase and refund
              dates are not our responsibility.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              12. Policy Changes
            </h2>
            <p>
              We may update this Refund Policy from time to time. Changes will
              be posted on this page with an updated &quot;Last updated&quot;
              date. Material changes will be communicated via email.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              13. Questions
            </h2>
            <p>
              If you have questions about our Refund Policy or need assistance
              with a refund request, please contact us through the Settings page
              or at the contact information provided in our application.
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
