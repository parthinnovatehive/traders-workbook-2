import type { ReactNode } from 'react';
import { ROUTES } from '@/constants/routes';
import { Seo, breadcrumbSchema, webPageSchema, MARKETING_TRAIL } from '@/components/seo';
import { seoForPath } from '@/config/seo';
import { SITE } from '@/config/site';

/**
 * Legal pages.
 *
 * These are a working starting point written for an Indian trading-journal
 * business, NOT legal advice. Have a lawyer review them before launch — the
 * refund policy in particular is what a payment gateway will ask to see during
 * onboarding.
 */

// From `SITE` rather than typed here: a support address published on four legal
// pages and a `mailto:` in the app is four chances to publish a dead one.
const COMPANY = SITE.name;
const SUPPORT_EMAIL = SITE.supportEmail;
const LAST_UPDATED = '28 September 2026';

/**
 * ISO form of `LAST_UPDATED`, for `dateModified` in the page schema.
 *
 * A real date, because it is stated in the document itself — not a build
 * timestamp dressed up as an editorial date. Hand-parsed rather than run through
 * `new Date()` on the display string, so a locale cannot shift it by a day.
 */
const LAST_UPDATED_ISO = '2026-09-28';

function LegalPage({ path, title, children }: { path: string; title: string; children: ReactNode }) {
  // The description comes from the SEO registry rather than being repeated here,
  // so the snippet and the registry can never disagree.
  const description = seoForPath(path)?.description ?? '';

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <Seo
        path={path}
        schema={[
          {
            ...webPageSchema({ name: title, description, path }),
            dateModified: LAST_UPDATED_ISO,
          },
          breadcrumbSchema([...MARKETING_TRAIL, { name: title, path }]),
        ]}
      />
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
    <LegalPage path={ROUTES.terms} title="Terms & Conditions">
      <p>
        Welcome to Trader’s Workbook (“Trader’s Workbook”, “we”, “us”, or “our”).
        These Terms & Conditions (“Terms”) govern your access to and use of the Trader’s Workbook website, platform, software, digital trading journal, performance analytics tools, and related services available through <a href="https://tradersworkbook.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">https://tradersworkbook.com/</a> (collectively, the “Platform”).
        By creating an account, accessing the Platform, using our services, or purchasing a paid subscription, you agree to be bound by these Terms. If you do not agree with these Terms, please do not use the Platform.
      </p>

      <Section heading="1. About Trader’s Workbook">
        <p>
          Trader’s Workbook is a digital trading journal and performance analytics platform designed to help traders record, analyze, and improve their trading performance, discipline, and psychology.
          The Platform may provide features including:
        </p>
        <ul className="ml-4 list-disc space-y-1 mt-2 mb-2">
          <li><span className="text-text">Digital trading journal functionality</span></li>
          <li><span className="text-text">Trade statistics and performance analytics</span></li>
          <li><span className="text-text">Capital and Profit & Loss (P&L) tracking</span></li>
          <li><span className="text-text">Risk-reward analysis</span></li>
          <li><span className="text-text">Trader psychology and performance tracking</span></li>
          <li><span className="text-text">Other analytical and journaling features made available through the Platform</span></li>
        </ul>
        <p>The features available to you may depend on the plan associated with your account.</p>
      </Section>

      <Section heading="2. Eligibility">
        <p>You must be at least 18 years of age to use the Platform.</p>
        <p>By creating an account or using the Platform, you confirm that:</p>
        <ul className="ml-4 list-disc space-y-1 mt-2 mb-2">
          <li><span className="text-text">You are at least 18 years old.</span></li>
          <li><span className="text-text">The information you provide is accurate and complete.</span></li>
          <li><span className="text-text">You have the legal capacity to enter into these Terms.</span></li>
        </ul>
        <p>We may restrict, suspend, or terminate access if we reasonably believe that an account has been created or used in violation of these requirements.</p>
      </Section>

      <Section heading="3. Account Registration">
        <p>An account is required to use Trader’s Workbook, and guest checkout is not available.</p>
        <p>During registration, we may collect information including your:</p>
        <ul className="ml-4 list-disc space-y-1 mt-2 mb-2">
          <li><span className="text-text">Name</span></li>
          <li><span className="text-text">Email address</span></li>
          <li><span className="text-text">Phone number</span></li>
          <li><span className="text-text">Account/login information</span></li>
        </ul>
        <p>You are responsible for maintaining the confidentiality of your account credentials and for activities conducted through your account. You must notify us if you believe that your account has been accessed or used without authorization.</p>
      </Section>

      <Section heading="4. Free Plan">
        <p>Trader’s Workbook may provide a free plan that allows eligible users to access the Platform without purchasing a paid subscription.</p>
        <p>The free plan is intended to provide lifetime access, subject to the features and limitations applicable to the free plan. The features, usage limits, and functionality available under the free plan may differ from paid plans.</p>
        <p>Trader’s Workbook may introduce, modify, remove, or update features of the free plan where reasonably necessary for the operation and development of the Platform.</p>
      </Section>

      <Section heading="5. Paid Subscriptions">
        <p>Trader’s Workbook may offer paid subscription plans providing additional features or functionality.</p>
        <p>The applicable plan name, features, price, billing period, taxes (where applicable), and other applicable conditions will be displayed on the Platform at the time of purchase.</p>
        <p>Because the available plans and pricing may change, the terms and pricing displayed at the time you purchase a plan will generally apply to that transaction.</p>
        <h3 className="mt-4 font-medium text-text">5.1 No Automatic Renewal</h3>
        <p>Paid subscriptions do not automatically renew unless expressly stated otherwise on the Platform and agreed to by you at the time of purchase. When a paid subscription reaches the end of its applicable paid period, access to paid features may expire unless you purchase or activate another applicable plan.</p>
        <h3 className="mt-4 font-medium text-text">5.2 Cancellation of Paid Subscription</h3>
        <p>You may request cancellation of a paid subscription in accordance with the applicable cancellation and refund terms. If you cancel an active paid subscription, your access to the paid features will generally continue until the end of the period for which you have already paid, unless otherwise stated for the particular plan or service.</p>
        <p>Cancellation does not automatically entitle you to a refund for the unused portion of an active subscription unless you are eligible for a refund under our applicable Refund & Cancellation Policy.</p>
      </Section>

      <Section heading="6. Payment">
        <p>Payments for paid plans may be processed through Razorpay and supported payment methods may include UPI, credit cards, debit cards, and net banking.</p>
        <p>Payment processing may be subject to the terms and policies of the relevant payment provider. Trader’s Workbook does not store customers&apos; card numbers, CVVs, UPI PINs, or net banking credentials. Payment information is processed by Razorpay or the applicable payment provider.</p>
      </Section>

      <Section heading="7. Digital Service Delivery">
        <p>Trader’s Workbook is a digital service. After successful payment and account activation, access to the applicable paid service is intended to be provided immediately through the Trader’s Workbook website/customer dashboard, subject to successful payment confirmation and technical availability.</p>
        <p>If access is delayed due to an issue attributable to the Platform, you may contact customer support so that we can investigate the issue and provide access or an appropriate resolution where applicable. Certain account features may require you to provide necessary information or complete required account setup.</p>
      </Section>

      <Section heading="8. Platform Features and Availability">
        <p>We aim to keep the Platform available and functional, but we do not guarantee that the Platform will always be:</p>
        <ul className="ml-4 list-disc space-y-1 mt-2 mb-2">
          <li><span className="text-text">Available without interruption</span></li>
          <li><span className="text-text">Free from technical errors</span></li>
          <li><span className="text-text">Free from bugs or defects</span></li>
          <li><span className="text-text">Compatible with every device, browser, or operating system</span></li>
          <li><span className="text-text">Available without temporary maintenance or downtime</span></li>
        </ul>
        <p>We may perform maintenance, updates, modifications, or improvements to the Platform from time to time. Features may also be added, modified, suspended, or discontinued as the Platform develops.</p>
      </Section>

      <Section heading="9. Trading and Investment Disclaimer">
        <p>Trader’s Workbook is a trading journaling and performance analytics platform. It is not an investment advisory, brokerage, portfolio management, or trade execution service.</p>
        <p>Trader’s Workbook does not provide:</p>
        <ul className="ml-4 list-disc space-y-1 mt-2 mb-2">
          <li><span className="text-text">Investment advice</span></li>
          <li><span className="text-text">Personalized financial advice</span></li>
          <li><span className="text-text">Guaranteed trading returns</span></li>
          <li><span className="text-text">Brokerage services</span></li>
          <li><span className="text-text">Portfolio management</span></li>
          <li><span className="text-text">Trade execution on behalf of customers</span></li>
        </ul>
        <p>The analytics, statistics, calculations, visualizations, and other information provided through the Platform are intended for record-keeping, analysis, education, and informational purposes.</p>
        <p>You are solely responsible for your own trading and investment decisions. You should independently evaluate any trading or investment decision and seek advice from an appropriately qualified professional where necessary.</p>
      </Section>

      <Section heading="10. No Guarantee of Trading Performance">
        <p>Trader’s Workbook does not guarantee that using the Platform will improve your trading performance, increase your profits, reduce your losses, improve your trading discipline, improve your trading psychology, or produce any particular financial result.</p>
        <p>Past trading performance or analytics displayed through the Platform should not be interpreted as a guarantee or indication of future results. Trading and investing involve financial risk, including the possible loss of capital.</p>
      </Section>

      <Section heading="11. Accuracy of User-Entered Information">
        <p>Many features of Trader’s Workbook depend on information entered or uploaded by the user.</p>
        <p>You are responsible for ensuring that the trading records, transactions, capital figures, P&L information, notes, and other information you enter into the Platform are accurate.</p>
        <p>Trader’s Workbook is not responsible for errors, inaccurate analytics, or misleading results caused by incorrect, incomplete, outdated, or improperly entered user information.</p>
      </Section>

      <Section heading="12. Permitted Use">
        <p>You agree to use the Platform only for lawful purposes and in accordance with these Terms.</p>
        <p>You must not:</p>
        <ul className="ml-4 list-disc space-y-1 mt-2 mb-2">
          <li><span className="text-text">Use the Platform for unlawful or fraudulent activities.</span></li>
          <li><span className="text-text">Attempt to gain unauthorized access to the Platform or another user&apos;s account.</span></li>
          <li><span className="text-text">Interfere with the security or operation of the Platform.</span></li>
          <li><span className="text-text">Introduce malicious code, malware, or other harmful material.</span></li>
          <li><span className="text-text">Attempt to reverse engineer, decompile, or unlawfully reproduce the Platform.</span></li>
          <li><span className="text-text">Scrape, copy, reproduce, or systematically extract Platform content or data without permission.</span></li>
          <li><span className="text-text">Circumvent technical restrictions or access controls.</span></li>
          <li><span className="text-text">Use another person&apos;s account without authorization.</span></li>
          <li><span className="text-text">Use the Platform in a manner that could damage, overload, or disrupt our systems.</span></li>
        </ul>
      </Section>

      <Section heading="13. Intellectual Property">
        <p>Unless otherwise stated, Trader’s Workbook and its licensors retain all rights, title, and interest in the Platform and its contents, including applicable software, website design, branding, logos, interface elements, graphics, text, features, analytics systems, and platform-generated displays and functionality.</p>
        <p>You are granted a limited, non-exclusive, non-transferable right to access and use the Platform for its intended purpose during the applicable period of access. You may not copy, reproduce, modify, distribute, sell, sublicense, or commercially exploit the Platform or its proprietary components without prior written permission.</p>
      </Section>

      <Section heading="14. User Data and Privacy">
        <p>Your use of the Platform involves the collection and processing of certain personal and account information. The information may include your name, email address, phone number, account/login information, payment transaction information, and order history.</p>
        <p>Our handling of personal information is described in our Privacy Policy, which forms part of these Terms. You should review the Privacy Policy to understand how your information is collected, used, stored, and processed.</p>
      </Section>

      <Section heading="15. Third-Party Services">
        <p>Trader’s Workbook may use third-party services to operate or support the Platform, including payment processing, hosting, database, authentication, communication, or other infrastructure services.</p>
        <p>The questionnaire identifies services such as Razorpay and infrastructure/database providers as relevant third-party services, with the final implementation subject to the actual website configuration. Your use of third-party services may also be subject to the respective provider&apos;s terms and policies.</p>
      </Section>

      <Section heading="16. Communications">
        <p>Trader’s Workbook may communicate with users through channels including email, WhatsApp, phone, and push notifications.</p>
        <p>These communications may relate to account activity, service updates, support, transactions, or other Platform-related matters. Any promotional or marketing communications, where applicable, will be handled in accordance with applicable preferences and policies.</p>
      </Section>

      <Section heading="17. Suspension or Termination">
        <p>We may suspend or terminate your account or restrict access to the Platform if:</p>
        <ul className="ml-4 list-disc space-y-1 mt-2 mb-2">
          <li><span className="text-text">You breach these Terms.</span></li>
          <li><span className="text-text">You engage in fraudulent, abusive, or unlawful activity.</span></li>
          <li><span className="text-text">Your use creates a security or operational risk.</span></li>
          <li><span className="text-text">You attempt to misuse the Platform.</span></li>
          <li><span className="text-text">We are required to do so by law or a competent authority.</span></li>
        </ul>
        <p>Where appropriate, we may provide notice before taking such action. Termination or suspension may result in the loss of access to Platform features associated with your account or paid plan.</p>
      </Section>

      <Section heading="18. Account Deletion">
        <p>You may request deletion of your Trader’s Workbook account and personal information in accordance with our Privacy Policy and applicable procedures. Certain information may need to be retained where required for legal, accounting, tax, security, fraud-prevention, dispute-resolution, or other legitimate purposes.</p>
      </Section>

      <Section heading="19. Refunds and Cancellations">
        <p>Refunds and cancellations are governed by the Refund &amp; Cancellation Policy applicable to Trader’s Workbook. Based on the current business information provided, refunds may apply in circumstances including a failed order or where the purchased service was not delivered. Approved refunds may be processed through the original payment method, bank transfer, or UPI, as applicable.</p>
        <p>The stated refund processing commitment is 8–9 business days after approval of the refund. The Refund &amp; Cancellation Policy may contain additional eligibility requirements and procedures.</p>
      </Section>

      <Section heading="20. Disclaimer of Warranties">
        <p>To the extent permitted by applicable law, the Platform and its features are provided on an “as available” basis. We do not guarantee that the Platform will always operate without interruption, errors, delays, or defects.</p>
        <p>Nothing in these Terms is intended to exclude any rights or protections that cannot lawfully be excluded under applicable law.</p>
      </Section>

      <Section heading="21. Limitation of Liability">
        <p>To the extent permitted by applicable law, Trader’s Workbook shall not be responsible for losses arising from:</p>
        <ul className="ml-4 list-disc space-y-1 mt-2 mb-2">
          <li><span className="text-text">Trading or investment decisions made by users</span></li>
          <li><span className="text-text">Financial losses resulting from trading or investing</span></li>
          <li><span className="text-text">Incorrect information entered by users</span></li>
          <li><span className="text-text">Temporary Platform unavailability</span></li>
          <li><span className="text-text">Technical failures outside our reasonable control</span></li>
          <li><span className="text-text">Third-party service failures</span></li>
          <li><span className="text-text">Unauthorized access resulting from the user&apos;s failure to protect account credentials</span></li>
        </ul>
        <p>Nothing in these Terms excludes or limits liability where such exclusion or limitation is prohibited by applicable law.</p>
      </Section>

      <Section heading="22. Changes to These Terms">
        <p>We may update these Terms from time to time to reflect changes to the Platform, services, business practices, legal requirements, or other circumstances. The updated version will be published on the website with a revised Last Updated date. Your continued use of the Platform after the updated Terms become effective may constitute acceptance of the revised Terms, to the extent permitted by applicable law.</p>
      </Section>

      <Section heading="23. Governing Law and Jurisdiction">
        <p>These Terms shall be governed by the applicable laws of India. Any disputes arising in connection with these Terms or your use of the Platform shall be subject to the jurisdiction of the appropriate courts having jurisdiction over Pune, Maharashtra, India, subject to applicable law.</p>
      </Section>

      <Section heading="24. Contact Us">
        <p>For questions, account-related concerns, or support regarding these Terms or the Platform, you may contact Trader’s Workbook through:</p>
        <ul className="ml-4 list-disc space-y-1 mt-2 mb-2">
          <li><span className="text-text">Phone / WhatsApp: +91 9421210350</span></li>
          <li><span className="text-text">Support Hours: Monday–Saturday, 10:00 AM–6:00 PM IST</span></li>
          <li><span className="text-text">Expected Response Time: Within 2–3 business days</span></li>
          <li><span className="text-text">Business Address: Pune, Maharashtra – 411068, India</span></li>
        </ul>
      </Section>

      <Section heading="Acceptance of Terms">
        <p>By creating an account, accessing the Trader’s Workbook Platform, using its services, or purchasing a paid subscription, you acknowledge that you have read, understood, and agreed to these Terms & Conditions.</p>
      </Section>
    </LegalPage>
  );
}

export function Privacy() {
  return (
    <LegalPage path={ROUTES.privacy} title="Privacy Policy">
      <p>
        Trader’s Workbook (“Trader’s Workbook”, “we”, “us”, or “our”) respects your privacy and is committed to protecting the personal information you provide while using our website and digital platform.
      </p>
      <p className="mt-2">
        This Privacy Policy explains how we collect, use, store, process, and protect information when you access or use <a href="https://tradersworkbook.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">https://tradersworkbook.com/</a>, create an account, use our digital trading journal and performance analytics platform, or purchase a paid subscription.
      </p>
      <p className="mt-2">
        By using the Platform, you acknowledge that you have read and understood this Privacy Policy.
      </p>

      <Section heading="1. About Trader’s Workbook">
        <p>Trader’s Workbook is a digital trading journal and performance analytics platform designed to help traders record, analyze, and improve their trading performance, discipline, and psychology.</p>
        <p>Our services include digital trading journal functionality, trading performance analytics, trade statistics, capital and P&L tracking, risk-reward analysis, trader psychology and performance tracking, and subscription-based access to the Platform.</p>
        <p>The Platform is available to users worldwide and is intended for users aged 18 or above.</p>
      </Section>

      <Section heading="2. Information We Collect">
        <p>When you create and use a Trader’s Workbook account, we may collect the following categories of information.</p>

        <h3 className="mt-4 font-medium text-text">2.1 Account and Personal Information</h3>
        <p>We may collect:</p>
        <ul className="ml-4 list-disc space-y-1 mt-2 mb-2">
          <li><span className="text-text">Name</span></li>
          <li><span className="text-text">Email address</span></li>
          <li><span className="text-text">Phone number</span></li>
          <li><span className="text-text">Account and login information</span></li>
        </ul>
        <p>An account is required to use the Platform, and guest checkout is not available.</p>

        <h3 className="mt-4 font-medium text-text">2.2 Transaction and Subscription Information</h3>
        <p>When you purchase a paid service or subscription, we may collect or receive information relating to:</p>
        <ul className="ml-4 list-disc space-y-1 mt-2 mb-2">
          <li><span className="text-text">Payment transaction information</span></li>
          <li><span className="text-text">Order or purchase history</span></li>
          <li><span className="text-text">Subscription or plan information</span></li>
          <li><span className="text-text">Transaction status</span></li>
          <li><span className="text-text">Relevant payment-related identifiers provided by the payment processor</span></li>
        </ul>
        <p>The Platform may use Razorpay and supported payment methods including UPI, credit/debit cards, and net banking.</p>

        <h3 className="mt-4 font-medium text-text">2.3 Trading and Platform Information</h3>
        <p>Information that you enter or maintain while using the Platform may include trading journal records, trade statistics, capital and P&L information, risk-reward information, and information related to your trading performance and psychology.</p>
        <p>Such information is used to provide the Platform&apos;s journaling and analytics functionality.</p>
      </Section>

      <Section heading="3. Payment Information">
        <p>Trader’s Workbook does <strong>not</strong> store customers&apos;:</p>
        <ul className="ml-4 list-disc space-y-1 mt-2 mb-2">
          <li><span className="text-text">Card numbers</span></li>
          <li><span className="text-text">CVVs</span></li>
          <li><span className="text-text">UPI PINs</span></li>
          <li><span className="text-text">Net banking credentials</span></li>
        </ul>
        <p>Payment information is processed and handled by Razorpay or the applicable payment provider.</p>
        <p>When you make a payment, the payment provider may collect and process payment information according to its own privacy policy and terms.</p>
        <p>We may receive transaction-related information necessary to confirm and manage your payment, subscription, and account.</p>
      </Section>

      <Section heading="4. How We Use Your Information">
        <p>We may use the information we collect to:</p>
        <ul className="ml-4 list-disc space-y-1 mt-2 mb-2">
          <li><span className="text-text">Create and manage your account.</span></li>
          <li><span className="text-text">Provide access to the Trader’s Workbook Platform.</span></li>
          <li><span className="text-text">Provide digital trading journal and analytics features.</span></li>
          <li><span className="text-text">Provide performance statistics and related functionality.</span></li>
          <li><span className="text-text">Process and confirm payments.</span></li>
          <li><span className="text-text">Manage subscriptions and account access.</span></li>
          <li><span className="text-text">Maintain transaction and purchase records.</span></li>
          <li><span className="text-text">Respond to customer support requests.</span></li>
          <li><span className="text-text">Communicate with you about your account or services.</span></li>
          <li><span className="text-text">Send service-related notifications.</span></li>
          <li><span className="text-text">Send communications through available channels where applicable.</span></li>
          <li><span className="text-text">Detect, prevent, and investigate fraud, misuse, unauthorized access, or security incidents.</span></li>
          <li><span className="text-text">Maintain and improve the Platform.</span></li>
          <li><span className="text-text">Troubleshoot technical problems.</span></li>
          <li><span className="text-text">Comply with applicable legal, regulatory, tax, accounting, or other lawful requirements.</span></li>
        </ul>
      </Section>

      <Section heading="5. How We Use Trading Information">
        <p>Information entered into your trading journal may be processed to provide the Platform&apos;s intended functionality, including analytics, statistics, P&L tracking, risk-reward analysis, and performance-related insights.</p>
        <p>Trader’s Workbook is a journaling and analytics platform. It does not provide investment advice, guaranteed trading returns, brokerage services, portfolio management, or trade execution on behalf of customers.</p>
        <p>You remain responsible for the accuracy of information you enter into the Platform and for any trading or investment decisions you make.</p>
      </Section>

      <Section heading="6. Cookies and Similar Technologies">
        <p>The Platform may use cookies or similar technologies that are necessary for account authentication, sessions, security, or Platform functionality.</p>
        <p>The questionnaire does not currently specify the complete list of cookies, analytics tools, advertising trackers, or other tracking technologies used by the live website.</p>
        <p>Accordingly, the specific cookie and tracking technologies used on the Platform may be described or updated as the Platform&apos;s implementation is finalized.</p>
        <p>You may be able to control certain cookies through your browser settings, although disabling necessary cookies may affect your ability to use certain Platform features.</p>
      </Section>

      <Section heading="7. Communications">
        <p>Trader’s Workbook may communicate with users through:</p>
        <ul className="ml-4 list-disc space-y-1 mt-2 mb-2">
          <li><span className="text-text">Email</span></li>
          <li><span className="text-text">WhatsApp</span></li>
          <li><span className="text-text">Phone</span></li>
          <li><span className="text-text">Push notifications</span></li>
        </ul>
        <p>These communications may be used for account-related matters, customer support, service updates, transaction-related information, and other communications relating to the Platform.</p>
        <p>The questionnaire does not currently specify whether promotional or marketing messages will be sent.</p>
        <p>Any promotional communications, if introduced, will be handled in accordance with applicable requirements and available communication preferences.</p>
      </Section>

      <Section heading="8. Third-Party Service Providers">
        <p>We may use third-party service providers to operate, maintain, secure, and support the Platform.</p>
        <p>The business information provided identifies or contemplates services including:</p>
        <ul className="ml-4 list-disc space-y-1 mt-2 mb-2">
          <li><span className="text-text">Razorpay</span></li>
          <li><span className="text-text">Database and infrastructure providers such as Supabase/Firebase</span></li>
          <li><span className="text-text">Hosting or cloud providers such as Vercel/AWS/Google Cloud</span></li>
          <li><span className="text-text">WhatsApp Business/API</span></li>
          <li><span className="text-text">Email or other communication services</span></li>
        </ul>
        <p>The exact third-party services used may depend on the final technical implementation of the Platform.</p>
        <p>These providers may process information as necessary to provide their respective services. Third-party providers may have their own privacy policies and terms governing their processing of information.</p>
      </Section>

      <Section heading="9. Data Storage and Security">
        <p>We take reasonable measures to protect personal and account information against unauthorized access, misuse, alteration, disclosure, or destruction.</p>
        <p>The Platform may use third-party hosting, database, authentication, cloud, and infrastructure services. However, no internet-based system or electronic storage system can be guaranteed to be completely secure.</p>
        <p>You are also responsible for maintaining the confidentiality of your account credentials and should notify us if you suspect unauthorized access to your account.</p>
      </Section>

      <Section heading="10. Sharing of Information">
        <p>We do not share personal information indiscriminately.</p>
        <p>Information may be shared with relevant third parties where reasonably necessary to:</p>
        <ul className="ml-4 list-disc space-y-1 mt-2 mb-2">
          <li><span className="text-text">Process payments.</span></li>
          <li><span className="text-text">Provide hosting, database, authentication, or infrastructure services.</span></li>
          <li><span className="text-text">Provide communication or notification services.</span></li>
          <li><span className="text-text">Operate and maintain the Platform.</span></li>
          <li><span className="text-text">Protect the security of the Platform.</span></li>
          <li><span className="text-text">Prevent fraud or misuse.</span></li>
          <li><span className="text-text">Comply with legal or regulatory requirements.</span></li>
          <li><span className="text-text">Respond to lawful requests from competent authorities.</span></li>
          <li><span className="text-text">Protect the rights, property, or safety of Trader’s Workbook, users, or others.</span></li>
        </ul>
        <p>Information may also be disclosed where necessary in connection with a merger, acquisition, restructuring, sale of business assets, or similar business transaction, subject to applicable requirements.</p>
      </Section>

      <Section heading="11. Data Retention">
        <p>We retain personal and account information for as long as reasonably necessary to:</p>
        <ul className="ml-4 list-disc space-y-1 mt-2 mb-2">
          <li><span className="text-text">Provide the Platform and related services.</span></li>
          <li><span className="text-text">Maintain your account.</span></li>
          <li><span className="text-text">Maintain transaction and subscription records.</span></li>
          <li><span className="text-text">Fulfil legitimate business purposes.</span></li>
          <li><span className="text-text">Resolve disputes.</span></li>
          <li><span className="text-text">Prevent fraud and misuse.</span></li>
          <li><span className="text-text">Comply with applicable legal, tax, accounting, or regulatory requirements.</span></li>
        </ul>
        <p>The questionnaire confirms that users may request deletion of their account or personal data, while the exact retention requirements for transaction, invoice, tax, and payment records have not yet been specified.</p>
        <p>Accordingly, certain information may continue to be retained where retention is required or reasonably necessary for lawful purposes.</p>
      </Section>

      <Section heading="12. Account and Data Deletion">
        <p>Users may request deletion of their Trader’s Workbook account and personal data.</p>
        <p>The account deletion process and the specific method for submitting such a request will be made available through the Platform or applicable support channel.</p>
        <p>Deletion may not result in immediate removal of all information where certain records must be retained for legal, accounting, tax, security, fraud-prevention, dispute-resolution, or other legitimate purposes.</p>
        <p>Where information is retained, it will be handled in accordance with applicable requirements.</p>
      </Section>

      <Section heading="13. Children and Age Restriction">
        <p>Trader’s Workbook is intended for users who are <strong>18 years of age or older</strong>.</p>
        <p>We do not knowingly intend to provide the Platform to individuals below the applicable minimum age.</p>
        <p>If we become aware that an account has been created by a person below the required age, we may take appropriate steps, including restricting or terminating the account and deleting information where appropriate.</p>
      </Section>

      <Section heading="14. International Users">
        <p>Trader’s Workbook is intended to be available worldwide.</p>
        <p>If you access the Platform from outside India, your information may be processed or stored in India or other locations where our service providers operate.</p>
        <p>By using the Platform, you acknowledge that information may be processed across different jurisdictions, subject to applicable data protection requirements.</p>
      </Section>

      <Section heading="15. Your Responsibilities">
        <p>You are responsible for:</p>
        <ul className="ml-4 list-disc space-y-1 mt-2 mb-2">
          <li><span className="text-text">Providing accurate information when creating your account.</span></li>
          <li><span className="text-text">Keeping your account credentials secure.</span></li>
          <li><span className="text-text">Updating information when necessary.</span></li>
          <li><span className="text-text">Using the Platform lawfully.</span></li>
          <li><span className="text-text">Ensuring that information you enter into your trading journal is accurate.</span></li>
          <li><span className="text-text">Not sharing your account credentials with unauthorized persons.</span></li>
        </ul>
      </Section>

      <Section heading="16. Links to Third-Party Websites">
        <p>The Platform may contain links or integrations to third-party websites, services, or platforms.</p>
        <p>Trader’s Workbook is not responsible for the privacy practices, security, content, or policies of third-party services that are not controlled by us.</p>
        <p>We recommend reviewing the applicable privacy policies of third-party services before providing them with personal information.</p>
      </Section>

      <Section heading="17. Changes to This Privacy Policy">
        <p>We may update this Privacy Policy from time to time to reflect:</p>
        <ul className="ml-4 list-disc space-y-1 mt-2 mb-2">
          <li><span className="text-text">Changes to the Platform.</span></li>
          <li><span className="text-text">Changes to our services.</span></li>
          <li><span className="text-text">Changes to third-party service providers.</span></li>
          <li><span className="text-text">Changes to our data practices.</span></li>
          <li><span className="text-text">Changes in applicable legal or regulatory requirements.</span></li>
        </ul>
        <p>When we make changes, we may update the <strong>Effective Date</strong> displayed at the beginning of this Privacy Policy.</p>
        <p>You should periodically review this page for the latest version.</p>
      </Section>

      <Section heading="18. Contact Us">
        <p>For privacy-related questions, account concerns, or requests relating to your personal information, you may contact Trader’s Workbook through the available support channels.</p>
        <ul className="ml-4 list-disc space-y-1 mt-2 mb-2">
          <li><span className="text-text"><strong>Phone / WhatsApp:</strong> +91 9421210350</span></li>
          <li><span className="text-text"><strong>Support Hours:</strong> Monday–Saturday, 10:00 AM–6:00 PM IST</span></li>
          <li><span className="text-text"><strong>Expected Response Time:</strong> Within 2–3 business days</span></li>
          <li><span className="text-text"><strong>Business Address:</strong> Pune, Maharashtra – 411068, India</span></li>
        </ul>
      </Section>

      <Section heading="">
        <div className="mt-8 border-t border-border pt-6 text-sm text-muted">
          <p><strong>Trader’s Workbook</strong></p>
          <p>Pune, Maharashtra – 411068, India</p>
          <p>Website: <a href="https://tradersworkbook.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">https://tradersworkbook.com/</a></p>
        </div>
      </Section>
    </LegalPage>
  );
}

export function Refunds() {
  return (
    <LegalPage path={ROUTES.refunds} title="Refund & Cancellation Policy">
      <p>
        This Refund & Cancellation Policy explains the circumstances under which cancellations and refunds may be requested for services purchased through Trader’s Workbook (“Trader’s Workbook”, “we”, “us”, or “our”).
      </p>
      <p className="mt-2">
        Trader’s Workbook provides digital trading journal, performance analytics, and related software services through its website and customer dashboard.
      </p>

      <Section heading="1. Cancellation Before Payment">
        <p>Customers may cancel their purchase decision at any time before completing payment.</p>
        <p>No cancellation charge will apply.</p>
        <p>Once payment has been successfully completed, the applicable refund and cancellation conditions described in this policy will apply.</p>
      </Section>

      <Section heading="2. Cancellation of a Paid Subscription">
        <p>Paid subscriptions may be cancelled in accordance with the applicable subscription terms.</p>
        <p>If an active paid subscription is cancelled, access to the paid features will generally continue until the end of the period for which the customer has already paid.</p>
        <p>Cancellation does not automatically result in an immediate termination of access to the paid features.</p>
        <p>Cancellation also does not automatically create an entitlement to a refund for the unused portion of the subscription period.</p>
      </Section>

      <Section heading="3. No Automatic Renewal">
        <p>Trader’s Workbook paid subscriptions do not automatically renew.</p>
        <p>Customers will need to make a new purchase or otherwise activate another applicable paid plan when their existing paid period ends, where such plans are available.</p>
      </Section>

      <Section heading="4. Refund Eligibility">
        <p>A refund may be considered in circumstances including:</p>
        <ul className="ml-4 list-disc space-y-1 mt-2 mb-2">
          <li><span className="text-text">A payment/order failure where payment was nevertheless successfully deducted.</span></li>
          <li><span className="text-text">The purchased digital service was not delivered or access was not provided.</span></li>
          <li><span className="text-text">Other circumstances where Trader’s Workbook determines that a refund is appropriate.</span></li>
        </ul>
        <p>The current business information specifically identifies failed orders and service not delivered as refund-eligible circumstances.</p>
        <p>A refund is not automatically available merely because a customer decides not to use the Platform after purchasing a paid subscription.</p>
      </Section>

      <Section heading="5. Service Access Issues">
        <p>Trader’s Workbook intends to provide digital service access immediately after successful payment and account activation through the website/customer dashboard.</p>
        <p>If a customer has successfully completed payment but cannot access the purchased service because of an issue attributable to the Platform, the customer should contact support.</p>
        <p>Trader’s Workbook will investigate the issue and, where appropriate, provide access or another suitable resolution.</p>
      </Section>

      <Section heading="6. Free Plan">
        <p>Trader’s Workbook may provide a free plan with limited features.</p>
        <p>The free plan provides lifetime access, subject to the features and limitations applicable to the free plan.</p>
        <p>Because the free plan does not require payment, there is no monetary refund applicable to free-plan access.</p>
      </Section>

      <Section heading="7. Refund Method">
        <p>Approved refunds may be processed through:</p>
        <ul className="ml-4 list-disc space-y-1 mt-2 mb-2">
          <li><span className="text-text">The original payment method;</span></li>
          <li><span className="text-text">Bank transfer; or</span></li>
          <li><span className="text-text">UPI,</span></li>
        </ul>
        <p>depending on the circumstances and information available for processing the refund.</p>
      </Section>

      <Section heading="8. Refund Processing Time">
        <p>Once a refund has been approved, Trader’s Workbook aims to process the refund within 8–9 business days.</p>
        <p>The time taken for the amount to actually appear in the customer&apos;s account may also depend on the payment provider or financial institution.</p>
      </Section>

      <Section heading="9. Duplicate or Incorrect Payments">
        <p>If you believe that you have been charged incorrectly or have made a duplicate payment, you should contact Trader’s Workbook support with the relevant transaction details.</p>
        <p>We will review the transaction and determine the appropriate resolution.</p>
      </Section>

      <Section heading="10. How to Request a Refund or Cancellation">
        <p>Customers should contact Trader’s Workbook through the available support channels and provide sufficient information to identify the account and transaction.</p>
        <p>Useful information may include:</p>
        <ul className="ml-4 list-disc space-y-1 mt-2 mb-2">
          <li><span className="text-text">Name associated with the account</span></li>
          <li><span className="text-text">Registered phone number</span></li>
          <li><span className="text-text">Registered email address, where applicable</span></li>
          <li><span className="text-text">Transaction or payment reference</span></li>
          <li><span className="text-text">Date of payment</span></li>
          <li><span className="text-text">Reason for the refund request</span></li>
        </ul>
        <p>Providing accurate transaction information helps us investigate and process requests efficiently.</p>
      </Section>

      <Section heading="11. Refund Review">
        <p>All refund requests may be reviewed before approval.</p>
        <p>Where additional information is reasonably required to verify a transaction or determine eligibility, the customer may be asked to provide relevant details.</p>
        <p>Submission of a refund request does not itself guarantee approval.</p>
      </Section>

      <Section heading="12. Changes to This Policy">
        <p>Trader’s Workbook may update this Refund & Cancellation Policy from time to time.</p>
        <p>Any updated version will be published on the website with a revised effective date.</p>
      </Section>

      <Section heading="13. Contact">
        <div className="mt-4 border-t border-border pt-4 text-sm text-muted">
          <p><strong>Trader’s Workbook</strong></p>
          <p>Pune, Maharashtra – 411068, India</p>
          <p>Phone / WhatsApp: +91 9421210350</p>
          <p>Support Hours: Monday–Saturday, 10:00 AM–6:00 PM IST</p>
          <p>Expected Response Time: Within 2–3 business days</p>
          <p>Website: <a href="https://tradersworkbook.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">https://tradersworkbook.com/</a></p>
        </div>
      </Section>
    </LegalPage>
  );
}

export function Billing() {
  return (
    <LegalPage path={ROUTES.billing} title="Subscription & Billing Policy">
      <p>
        This Subscription & Billing Policy explains how paid subscriptions and free access plans work on the Trader’s Workbook platform.
      </p>
      <p className="mt-2">
        Trader’s Workbook is a digital trading journal and performance analytics platform providing journaling, trading performance analytics, trade statistics, capital/P&L tracking, risk-reward analysis, and trader psychology/performance tracking features according to the applicable plan.
      </p>

      <Section heading="1. Available Plans">
        <p>Trader’s Workbook may provide both:</p>
        <ul className="ml-4 list-disc space-y-1 mt-2 mb-2">
          <li><span className="text-text">A Free Plan</span></li>
          <li><span className="text-text">One or more Paid Plans</span></li>
        </ul>
        <p>The features available under each plan may differ.</p>
        <p>The specific plan features, pricing, billing period, and other applicable details will be displayed on the Trader’s Workbook website when a customer selects a plan.</p>
      </Section>

      <Section heading="2. Free Plan">
        <p>Trader’s Workbook offers a free plan with feature limitations.</p>
        <p>The free plan provides lifetime access, subject to the features and limitations applicable to the free plan.</p>
        <p>No payment is required to continue using the free plan, unless the customer chooses to purchase a paid plan.</p>
        <p>Trader’s Workbook may update or modify the features available under the free plan as the Platform develops.</p>
      </Section>

      <Section heading="3. Paid Subscriptions">
        <p>Paid plans provide access to additional features or functionality according to the plan selected by the customer.</p>
        <p>The applicable price and features will be displayed before payment.</p>
        <p>Before completing a purchase, customers should review:</p>
        <ul className="ml-4 list-disc space-y-1 mt-2 mb-2">
          <li><span className="text-text">The selected plan</span></li>
          <li><span className="text-text">Available features</span></li>
          <li><span className="text-text">Price</span></li>
          <li><span className="text-text">Applicable billing period</span></li>
          <li><span className="text-text">Any applicable taxes or charges</span></li>
        </ul>
        <p>The final amount displayed at checkout will be the amount applicable to the transaction, subject to the information displayed at the time of purchase.</p>
      </Section>

      <Section heading="4. No Automatic Renewal">
        <p>Trader’s Workbook paid subscriptions do not automatically renew.</p>
        <p>At the end of the applicable paid subscription period, the paid subscription will expire unless the customer purchases or activates another applicable paid plan.</p>
        <p>Customers will not be automatically charged for another subscription period.</p>
      </Section>

      <Section heading="5. Payment Methods">
        <p>Trader’s Workbook may accept payments through Razorpay using supported payment methods including:</p>
        <ul className="ml-4 list-disc space-y-1 mt-2 mb-2">
          <li><span className="text-text">UPI</span></li>
          <li><span className="text-text">Credit cards</span></li>
          <li><span className="text-text">Debit cards</span></li>
          <li><span className="text-text">Net banking</span></li>
        </ul>
        <p>Payment processing is handled through Razorpay or the applicable payment provider.</p>
        <p>Trader’s Workbook does not store customers&apos; card numbers, CVVs, UPI PINs, or net banking credentials.</p>
      </Section>

      <Section heading="6. When Subscription Access Begins">
        <p>Paid digital service access is intended to become available immediately after successful payment and account activation.</p>
        <p>Access is provided through the Trader’s Workbook website and customer dashboard.</p>
        <p>In some circumstances, access may be subject to successful payment confirmation or completion of required account information.</p>
      </Section>

      <Section heading="7. Subscription Cancellation">
        <p>Customers may cancel an active paid subscription in accordance with the applicable cancellation terms.</p>
        <p>When a paid subscription is cancelled:</p>
        <ul className="ml-4 list-disc space-y-1 mt-2 mb-2">
          <li><span className="text-text">The subscription will not automatically renew.</span></li>
          <li><span className="text-text">Access to paid features will generally continue until the end of the period already paid for.</span></li>
        </ul>
        <p>Cancellation does not automatically result in a refund for the remaining unused period.</p>
        <p>Refunds are handled separately under the Refund & Cancellation Policy.</p>
      </Section>

      <Section heading="8. Changes Between Plans">
        <p>If Trader’s Workbook provides multiple paid plans, the availability and process for changing from one plan to another will depend on the options displayed on the Platform at the relevant time.</p>
        <p>Any applicable price difference, access change, or other condition will be communicated before the customer completes the relevant transaction.</p>
      </Section>

      <Section heading="9. Failed Payments">
        <p>If a payment attempt fails, access to a paid subscription may not be activated until successful payment is confirmed.</p>
        <p>If the customer&apos;s account or bank/payment provider shows that money was deducted despite a failed transaction, the customer may contact support so that the transaction can be investigated.</p>
        <p>Where a refund is approved, it will be processed according to the Refund & Cancellation Policy.</p>
      </Section>

      <Section heading="10. Incorrect or Duplicate Charges">
        <p>If you believe that you have been charged incorrectly or charged more than once for the same transaction, please contact Trader’s Workbook support with the relevant transaction details.</p>
        <p>We will review the transaction and, where appropriate, process the applicable resolution.</p>
      </Section>

      <Section heading="11. Taxes and Charges">
        <p>Any applicable taxes or charges will be presented during the purchase process where required.</p>
        <p>The amount payable by the customer will be the amount displayed at checkout before payment confirmation.</p>
      </Section>

      <Section heading="12. Subscription Access After Expiry">
        <p>When a paid subscription period ends, access to paid features may expire.</p>
        <p>Where available, the customer may continue using the free plan subject to its applicable features and limitations.</p>
        <p>The free plan provides lifetime access, subject to the terms applicable to that plan.</p>
      </Section>

      <Section heading="13. Account and Subscription Responsibility">
        <p>Customers are responsible for maintaining accurate account information and protecting their login credentials.</p>
        <p>If an account is used by an unauthorized person due to the customer&apos;s failure to protect their credentials, the customer should notify Trader’s Workbook as soon as possible.</p>
      </Section>

      <Section heading="14. Changes to Plans and Pricing">
        <p>Trader’s Workbook may introduce, modify, discontinue, or change the pricing or features of its plans.</p>
        <p>Any changes will generally apply to future purchases or renewals rather than altering the terms of a subscription period that has already been purchased, unless otherwise required or permitted by applicable law.</p>
        <p>Because plan details have not yet been finalized, the current website checkout will contain the applicable pricing and feature information for each available plan.</p>
      </Section>

      <Section heading="15. Relationship With Other Policies">
        <p>This Subscription & Billing Policy should be read together with:</p>
        <ul className="ml-4 list-disc space-y-1 mt-2 mb-2">
          <li><span className="text-text">Trader’s Workbook Terms & Conditions</span></li>
          <li><span className="text-text">Trader’s Workbook Refund & Cancellation Policy</span></li>
          <li><span className="text-text">Trader’s Workbook Privacy Policy</span></li>
        </ul>
        <p>If there is a conflict concerning refunds or cancellations, the applicable Refund & Cancellation Policy will govern those matters.</p>
      </Section>

      <Section heading="16. Changes to This Policy">
        <p>Trader’s Workbook may update this Subscription & Billing Policy when its subscription structure, pricing, billing practices, Platform features, or applicable requirements change.</p>
        <p>The latest version will be published on the website with an updated effective date.</p>
      </Section>

      <Section heading="17. Contact">
        <div className="mt-4 border-t border-border pt-4 text-sm text-muted">
          <p><strong>Trader’s Workbook</strong></p>
          <p>Pune, Maharashtra – 411068, India</p>
          <p>Phone / WhatsApp: +91 9421210350</p>
          <p>Support Hours: Monday–Saturday, 10:00 AM–6:00 PM IST</p>
          <p>Expected Response Time: Within 2–3 business days</p>
          <p>Website: <a href="https://tradersworkbook.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">https://tradersworkbook.com/</a></p>
        </div>
      </Section>
    </LegalPage>
  );
}

export function Disclaimer() {
  return (
    <LegalPage path={ROUTES.disclaimer} title="Trading & Investment Risk Disclaimer">
      <p>
        Trader’s Workbook is a digital trading journal and performance analytics platform designed to help users record, analyze, and review their trading performance, discipline, and psychology.
      </p>
      <p className="mt-2">
        The Platform provides tools and analytics for informational and record-keeping purposes. Trader’s Workbook does not provide investment advice, guaranteed trading returns, brokerage services, portfolio management, or trade execution on behalf of customers.
      </p>

      <Section heading="1. No Investment or Financial Advice">
        <p>Information, analytics, statistics, calculations, charts, records, or other outputs provided through Trader’s Workbook are not intended to constitute:</p>
        <ul className="ml-4 list-disc space-y-1 mt-2 mb-2">
          <li><span className="text-text">Investment advice</span></li>
          <li><span className="text-text">Financial advice</span></li>
          <li><span className="text-text">Trading advice</span></li>
          <li><span className="text-text">A recommendation to buy or sell any financial instrument</span></li>
          <li><span className="text-text">Portfolio management</span></li>
          <li><span className="text-text">Brokerage services</span></li>
          <li><span className="text-text">Trade execution services</span></li>
        </ul>
        <p>The Platform is designed to help users maintain records and analyze their own trading activity.</p>
      </Section>

      <Section heading="2. Trading and Investment Risks">
        <p>Trading and investing in financial markets involves risk.</p>
        <p>The value of investments and trading positions may increase or decrease, and users may lose some or all of the capital they commit to trading or investing.</p>
        <p>Past performance does not guarantee future results.</p>
        <p>Users should make their own independent decisions regarding any trading or investment activity.</p>
      </Section>

      <Section heading="3. No Guarantee of Results">
        <p>Trader’s Workbook does not guarantee that use of the Platform will:</p>
        <ul className="ml-4 list-disc space-y-1 mt-2 mb-2">
          <li><span className="text-text">Generate profits</span></li>
          <li><span className="text-text">Reduce trading losses</span></li>
          <li><span className="text-text">Improve trading performance</span></li>
          <li><span className="text-text">Improve trading discipline</span></li>
          <li><span className="text-text">Improve trading psychology</span></li>
          <li><span className="text-text">Produce any particular financial outcome</span></li>
        </ul>
        <p>Any performance statistics or analytics displayed by the Platform are based on the information and records available to the Platform and should not be interpreted as a guarantee of future performance.</p>
      </Section>

      <Section heading="4. Accuracy of User-Entered Information">
        <p>Certain Platform features depend on information entered or maintained by the user.</p>
        <p>Users are responsible for ensuring that their trading records, transaction information, capital figures, P&L information, and other data entered into the Platform are accurate.</p>
        <p>Incorrect, incomplete, or outdated information may result in inaccurate analytics or calculations.</p>
        <p>Trader’s Workbook does not assume responsibility for trading decisions made based on inaccurate information entered by the user.</p>
      </Section>

      <Section heading="5. Analytics Are Informational Tools">
        <p>The Platform may provide analytics such as:</p>
        <ul className="ml-4 list-disc space-y-1 mt-2 mb-2">
          <li><span className="text-text">Trade statistics</span></li>
          <li><span className="text-text">Capital and P&L tracking</span></li>
          <li><span className="text-text">Risk-reward analysis</span></li>
          <li><span className="text-text">Performance tracking</span></li>
          <li><span className="text-text">Trader psychology and performance tracking</span></li>
        </ul>
        <p>These tools are intended to assist users in reviewing and understanding their own trading activity.</p>
        <p>They should not be treated as a substitute for professional financial or investment advice.</p>
      </Section>

      <Section heading="6. No Brokerage or Trade Execution">
        <p>Trader’s Workbook does not act as a broker and does not execute trades on behalf of users.</p>
        <p>Users remain responsible for placing, modifying, and closing their own trades through their chosen broker or trading platform.</p>
      </Section>

      <Section heading="7. Independent Decision-Making">
        <p>Any decision to buy, sell, hold, trade, invest, or otherwise participate in a financial market remains solely the user&apos;s responsibility.</p>
        <p>Users should consider their own financial circumstances, objectives, risk tolerance, and other relevant factors before making financial decisions.</p>
        <p>Where appropriate, users should consult a qualified financial or investment professional.</p>
      </Section>

      <Section heading="8. Third-Party Information">
        <p>Where information from external or third-party sources is displayed or used by the Platform, Trader’s Workbook does not guarantee that such information will always be complete, accurate, current, or uninterrupted.</p>
        <p>Users should independently verify information before relying on it for financial decisions.</p>
      </Section>

      <Section heading="9. No Professional Relationship">
        <p>Use of Trader’s Workbook does not create an investment advisory, fiduciary, brokerage, portfolio management, or other professional financial relationship between Trader’s Workbook and the user.</p>
      </Section>

      <Section heading="10. User Responsibility">
        <p>By using Trader’s Workbook, you acknowledge that:</p>
        <ul className="ml-4 list-disc space-y-1 mt-2 mb-2">
          <li><span className="text-text">You understand that trading and investing involve financial risk.</span></li>
          <li><span className="text-text">You are responsible for your own trading and investment decisions.</span></li>
          <li><span className="text-text">You will not rely on Trader’s Workbook as a source of personalized investment advice.</span></li>
          <li><span className="text-text">You understand that past performance does not guarantee future results.</span></li>
        </ul>
      </Section>

      <Section heading="11. Related Terms">
        <p>This Disclaimer should be read together with the Trader’s Workbook Terms & Conditions, Privacy Policy, Refund & Cancellation Policy, and Subscription & Billing Policy.</p>
      </Section>

      <Section heading="12. Contact">
        <div className="mt-4 border-t border-border pt-4 text-sm text-muted">
          <p><strong>Trader’s Workbook</strong></p>
          <p>Pune, Maharashtra – 411068, India</p>
          <p>Phone / WhatsApp: +91 9421210350</p>
          <p>Support Hours: Monday–Saturday, 10:00 AM–6:00 PM IST</p>
          <p>Expected Response Time: Within 2–3 business days</p>
          <p>Website: <a href="https://tradersworkbook.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">https://tradersworkbook.com/</a></p>
        </div>
      </Section>
    </LegalPage>
  );
}

export function Contact() {
  return (
    <LegalPage path={ROUTES.contact} title="Contact Us">
      <p>
        Have a question about Trader’s Workbook, your account, subscription, payment, or access to the Platform? Our support team is available to assist you.
      </p>

      <Section heading="Trader’s Workbook">
        <ul className="ml-4 space-y-2 mt-4">
          <li>
            <strong>Business Address:</strong><br />
            <span className="text-muted">Pune, Maharashtra – 411068, India</span>
          </li>
          <li>
            <strong>Phone:</strong><br />
            <span className="text-muted">+91 9421210350</span>
          </li>
          <li>
            <strong>WhatsApp:</strong><br />
            <span className="text-muted">+91 9421210350</span>
          </li>
          <li>
            <strong>Support Hours:</strong><br />
            <span className="text-muted">Monday–Saturday<br />10:00 AM–6:00 PM IST</span>
          </li>
          <li>
            <strong>Expected Response Time:</strong><br />
            <span className="text-muted">Within 2–3 business days</span>
          </li>
        </ul>
      </Section>

      <Section heading="How We Can Help">
        <p>You can contact us regarding:</p>
        <ul className="ml-4 list-disc space-y-1 mt-2 mb-2">
          <li><span className="text-text">Account and login issues</span></li>
          <li><span className="text-text">Platform access</span></li>
          <li><span className="text-text">Subscription-related questions</span></li>
          <li><span className="text-text">Payment and transaction issues</span></li>
          <li><span className="text-text">Refund and cancellation requests</span></li>
          <li><span className="text-text">Problems accessing paid features</span></li>
          <li><span className="text-text">Technical issues with the Platform</span></li>
          <li><span className="text-text">Questions about the free plan</span></li>
          <li><span className="text-text">Privacy and account-related requests</span></li>
          <li><span className="text-text">General questions about Trader’s Workbook</span></li>
        </ul>
        <p className="mt-4">
          When contacting support about a payment, subscription, or account issue, please provide sufficient information to help us identify your account or transaction.
        </p>
        <p className="mt-2">
          For payment-related issues, useful information may include the transaction reference, date of payment, registered phone number, and other relevant transaction details.
        </p>
        <p className="mt-2 font-medium">
          Please do not share your password, UPI PIN, card number, CVV, OTP, or other confidential payment credentials with customer support.
        </p>
      </Section>

      <Section heading="About Trader’s Workbook">
        <p>
          Trader’s Workbook is a digital trading journal and performance analytics platform that helps traders record, analyze, and improve their trading performance, discipline, and psychology.
        </p>
        <p className="mt-2">
          The Platform provides features such as trading journaling, performance analytics, trade statistics, capital/P&L tracking, risk-reward analysis, and trader psychology/performance tracking according to the applicable plan.
        </p>
        <div className="mt-4 border-t border-border pt-4 text-sm">
          <strong>Website:</strong> <a href="https://tradersworkbook.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">https://tradersworkbook.com/</a>
        </div>
        <p className="mt-4 font-medium">We look forward to assisting you.</p>
      </Section>
    </LegalPage>
  );
}
