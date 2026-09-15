import type { ReactNode } from 'react';

/**
 * Legal pages.
 *
 * These are a working starting point written for an Indian trading-journal
 * business, NOT legal advice. Have a lawyer review them before launch — the
 * refund policy in particular is what a payment gateway will ask to see during
 * onboarding.
 */

const COMPANY = "Trader's Workbook";
const SUPPORT_EMAIL = 'support@tradersworkbook.app';
const LAST_UPDATED = '14 September 2026';

function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight text-text">{title}</h1>
      <p className="mt-2 text-sm text-muted">Last updated {LAST_UPDATED}</p>
      <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted">{children}</div>
    </div>
  );
}

function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-text">{heading}</h2>
      {children}
    </section>
  );
}

export function Terms() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        These terms govern your use of {COMPANY}. By creating an account you agree to them. If you
        do not agree, please do not use the service.
      </p>

      <Section heading="1. What this service is">
        <p>
          {COMPANY} is a trading journal and analytics tool. It records trades you enter manually
          and computes performance statistics from them. It does not connect to a broker, place
          orders, hold funds, or execute anything on your behalf.
        </p>
      </Section>

      <Section heading="2. Not investment advice">
        <p>
          Nothing in this service is investment, financial, tax or legal advice, and nothing in it
          is a recommendation to buy or sell any instrument. We are not a registered investment
          adviser or a research analyst. All analytics are arithmetic performed on data you supply.
          Trading carries substantial risk of loss, including loss of your entire capital. You are
          solely responsible for your trading decisions.
        </p>
      </Section>

      <Section heading="3. Accuracy of your data">
        <p>
          Your statistics are only as accurate as what you enter. Contract specifications such as
          lot sizes are configurable defaults that exchanges revise periodically; verify them
          against your broker&apos;s contract note. Currency conversion rates are estimates unless
          you enter your own. We do not warrant that any figure shown is accurate for tax,
          accounting or regulatory purposes.
        </p>
      </Section>

      <Section heading="4. Your account">
        <p>
          You must be at least 18 and provide accurate registration details. You are responsible for
          keeping your password secure and for activity under your account. Tell us promptly at{' '}
          {SUPPORT_EMAIL} if you suspect unauthorised access. One account per person; do not share
          credentials.
        </p>
      </Section>

      <Section heading="5. Acceptable use">
        <p>
          Do not attempt to access other users&apos; data, probe or disrupt the service, scrape it
          in bulk, resell access, or upload unlawful content. We may suspend an account that breaks
          these rules; we will tell you why.
        </p>
      </Section>

      <Section heading="6. Plans and payment">
        <p>
          Paid plans are billed in advance for the period shown at checkout. Prices may change with
          notice, and a change never affects a period you have already paid for. See the Refund and
          Cancellation Policy for how to cancel and when refunds apply.
        </p>
      </Section>

      <Section heading="7. Availability">
        <p>
          We aim for high availability but do not guarantee uninterrupted service. We may change or
          discontinue features. If we discontinue the service entirely, we will give reasonable
          notice and an opportunity to export your data.
        </p>
      </Section>

      <Section heading="8. Your content">
        <p>
          Your trades and notes remain yours. You grant us only the licence needed to store and
          display them back to you and to operate the service. We do not sell your data, and we do
          not use identifiable trade data for any purpose other than providing the service to you.
        </p>
      </Section>

      <Section heading="9. Liability">
        <p>
          To the fullest extent permitted by law, {COMPANY} is not liable for trading losses, lost
          profits, or indirect or consequential damages. Our total liability in any 12-month period
          is limited to the amount you paid us in that period.
        </p>
      </Section>

      <Section heading="10. Termination">
        <p>
          You may stop using the service at any time and request deletion of your account. We may
          terminate accounts that breach these terms. On termination you may export your data for 30
          days, after which it may be permanently deleted.
        </p>
      </Section>

      <Section heading="11. Governing law">
        <p>
          These terms are governed by the laws of India, and the courts of India have exclusive
          jurisdiction over any dispute.
        </p>
      </Section>

      <Section heading="12. Contact">
        <p>Questions about these terms: {SUPPORT_EMAIL}</p>
      </Section>
    </LegalPage>
  );
}

export function Privacy() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        This policy explains what {COMPANY} collects, why, and what control you have over it.
      </p>

      <Section heading="What we collect">
        <ul className="ml-4 list-disc space-y-1">
          <li>
            <span className="text-text">Account details</span> — name, email, and optionally a phone
            number, provided at signup.
          </li>
          <li>
            <span className="text-text">Trading journal data</span> — the trades, notes and tags you
            enter, and the account settings you configure.
          </li>
          <li>
            <span className="text-text">Technical data</span> — authentication tokens, and basic log
            data such as timestamps and error reports, used to keep the service running and secure.
          </li>
          <li>
            <span className="text-text">Feedback</span> — anything you send us through the feedback
            form, along with the page you sent it from.
          </li>
        </ul>
        <p>
          We do not collect your broker credentials, and we cannot see or place your trades. We do
          not use advertising trackers.
        </p>
      </Section>

      <Section heading="How we use it">
        <p>
          To operate your account, compute your analytics, provide support, and improve the product.
          We do not sell your personal data or share it with advertisers.
        </p>
      </Section>

      <Section heading="Who can see your trades">
        <p>
          Only you. Access is enforced at the database level by row-level security, so every query
          is scoped to the signed-in account. Our administrators can see account-level information
          such as your name, email, plan and how many trades you have recorded — they cannot read
          the trades themselves, your positions or your P&amp;L. A small number of engineers can
          access production infrastructure for maintenance under confidentiality obligations.
        </p>
      </Section>

      <Section heading="Processors">
        <p>
          We use Supabase for database hosting and authentication, and an email provider for
          transactional messages such as password resets. These providers process data on our
          instructions only.
        </p>
      </Section>

      <Section heading="Retention">
        <p>
          We keep your data while your account is active. If you delete your account we remove your
          profile, accounts and trades; backups are purged on their normal rotation, typically
          within 30 days. Anonymous aggregate counts may be retained.
        </p>
      </Section>

      <Section heading="Your rights">
        <p>
          You can access and correct your details in Settings, export everything as JSON or CSV at
          any time, and request deletion by emailing {SUPPORT_EMAIL} from your registered address.
          We respond within 30 days.
        </p>
      </Section>

      <Section heading="Security">
        <p>
          Data is encrypted in transit. Passwords are hashed by our authentication provider and are
          never visible to us. No system is perfectly secure; if a breach affects you we will notify
          you promptly.
        </p>
      </Section>

      <Section heading="Contact">
        <p>Privacy questions or requests: {SUPPORT_EMAIL}</p>
      </Section>
    </LegalPage>
  );
}

export function Refunds() {
  return (
    <LegalPage title="Refund & Cancellation Policy">
      <Section heading="Cancelling">
        <p>
          You can cancel a paid plan at any time. Cancellation stops the next renewal; your plan
          stays active until the end of the period you have already paid for, after which the
          account reverts to the Free plan. Your data is not deleted when you cancel.
        </p>
      </Section>

      <Section heading="Refunds">
        <p>
          If you are not satisfied, email {SUPPORT_EMAIL} within{' '}
          <span className="text-text">7 days</span> of your first payment for a full refund. Beyond
          that window, payments for the current period are generally non-refundable, because the
          service was available to you throughout it.
        </p>
        <p>
          We will always refund a duplicate charge, a charge after a valid cancellation, or a period
          during which the service was substantially unavailable through our fault.
        </p>
      </Section>

      <Section heading="How to request one">
        <p>
          Email {SUPPORT_EMAIL} from your registered address with the reason. We respond within 3
          business days. Approved refunds are returned to the original payment method, normally
          within 5–10 business days depending on your bank.
        </p>
      </Section>

      <Section heading="Free plan">
        <p>
          The Free plan costs nothing and needs no cancellation. You can try the product on it for
          as long as you like before paying for anything.
        </p>
      </Section>
    </LegalPage>
  );
}

export function Contact() {
  return (
    <LegalPage title="Contact">
      <Section heading="Support">
        <p>
          Email {SUPPORT_EMAIL} and we will get back to you within 2 business days. Including a
          screenshot and what you were doing helps a lot.
        </p>
      </Section>
      <Section heading="In-app feedback">
        <p>
          If you are signed in, the fastest route is the profile menu → &ldquo;Send feedback&rdquo;.
          It attaches the page you were on, and you can track the status of what you sent in
          Settings.
        </p>
      </Section>
      <Section heading="Privacy and data requests">
        <p>Email {SUPPORT_EMAIL} from your registered address.</p>
      </Section>
    </LegalPage>
  );
}
