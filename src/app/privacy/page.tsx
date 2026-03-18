import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy | TourLytics',
  description: 'TourLytics Privacy Policy - How we collect, use, and protect your data.',
}

export default function PrivacyPage() {
  return (
    <div className="legal-page">
      <style>{`
        .legal-page {
          min-height: 100vh;
          background: #0a0f1a;
          color: #e2e8f0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .legal-nav {
          padding: 1rem 1.5rem;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          display: flex;
          align-items: center;
          justify-content: space-between;
          max-width: 900px;
          margin: 0 auto;
        }
        .legal-nav a {
          color: #94a3b8;
          text-decoration: none;
          font-size: 0.875rem;
          transition: color 0.2s;
        }
        .legal-nav a:hover { color: #38bdf8; }
        .legal-brand {
          font-weight: 700;
          font-size: 1.1rem;
          color: #f1f5f9 !important;
          letter-spacing: -0.02em;
        }
        .legal-container {
          max-width: 800px;
          margin: 0 auto;
          padding: 3rem 1.5rem 4rem;
        }
        .legal-title {
          font-size: 2rem;
          font-weight: 700;
          color: #f1f5f9;
          margin-bottom: 0.5rem;
          letter-spacing: -0.02em;
        }
        .legal-subtitle {
          font-size: 0.875rem;
          color: #64748b;
          margin-bottom: 2rem;
        }
        .legal-toc {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 8px;
          padding: 1.5rem;
          margin-bottom: 2.5rem;
        }
        .legal-toc-title {
          font-size: 0.75rem;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.75rem;
        }
        .legal-toc a {
          display: block;
          color: #94a3b8;
          text-decoration: none;
          font-size: 0.8125rem;
          padding: 0.25rem 0;
          transition: color 0.2s;
        }
        .legal-toc a:hover { color: #38bdf8; }
        .legal-h2 {
          font-size: 1.25rem;
          font-weight: 700;
          color: #f1f5f9;
          margin-top: 2.5rem;
          margin-bottom: 1rem;
          padding-top: 1.5rem;
          border-top: 1px solid rgba(255,255,255,0.06);
          letter-spacing: -0.01em;
        }
        .legal-h3 {
          font-size: 1rem;
          font-weight: 600;
          color: #cbd5e1;
          margin-top: 1.5rem;
          margin-bottom: 0.5rem;
        }
        .legal-p {
          font-size: 0.875rem;
          line-height: 1.7;
          color: #94a3b8;
          margin-bottom: 0.75rem;
        }
        .legal-caps {
          font-size: 0.8125rem;
          line-height: 1.6;
          color: #94a3b8;
          margin-bottom: 0.75rem;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.01em;
        }
        .legal-indent {
          font-size: 0.875rem;
          line-height: 1.7;
          color: #94a3b8;
          margin-bottom: 0.5rem;
          padding-left: 1.5rem;
        }
        .legal-list {
          list-style: disc;
          padding-left: 1.5rem;
          margin-bottom: 0.75rem;
        }
        .legal-list li {
          font-size: 0.875rem;
          line-height: 1.7;
          color: #94a3b8;
          margin-bottom: 0.25rem;
        }
        .legal-footer {
          padding: 2rem 0;
          border-top: 1px solid rgba(255,255,255,0.06);
          margin-top: 3rem;
        }
        .legal-footer-inner {
          max-width: 800px;
          margin: 0 auto;
          padding: 0 1.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
        }
        .legal-footer a {
          color: #64748b;
          text-decoration: none;
          font-size: 0.75rem;
          transition: color 0.2s;
        }
        .legal-footer a:hover { color: #94a3b8; }
        @media (max-width: 640px) {
          .legal-title { font-size: 1.5rem; }
          .legal-container { padding: 2rem 1rem 3rem; }
        }
      `}</style>

      <nav className="legal-nav">
        <Link href="/" className="legal-brand">TourLytics</Link>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/login">Sign In</Link>
        </div>
      </nav>

      <div className="legal-container">
        <h1 className="legal-title">Privacy Policy</h1>
        <p className="legal-subtitle">Last Updated March 18, 2026 &middot; Chewerlytics LLC (d/b/a &quot;TourLytics&quot;)</p>


        <div className="legal-toc">
          <div className="legal-toc-title">Table of Contents</div>
          <a href="#s1">1. Information We Collect</a>
          <a href="#s2">2. How We Use Information</a>
          <a href="#s3">3. How We Share Information</a>
          <a href="#s4">4. Third-Party Services and Data Processing</a>
          <a href="#s5">5. Data Retention</a>
          <a href="#s6">6. Data Security</a>
          <a href="#s7">7. Your Rights</a>
          <a href="#s8">8. Children&apos;s Privacy</a>
          <a href="#s9">9. International Data Transfers</a>
          <a href="#s10">10. Cookies and Tracking Technologies</a>
          <a href="#s11">11. Do Not Track Signals</a>
          <a href="#s12">12. Changes to This Policy</a>
          <a href="#s13">13. Data Processing Addendum</a>
          <a href="#s14">14. Contact Information</a>
        </div>

        <p className="legal-p">TourLytics is an AI-powered commercial real estate intelligence platform that helps enterprise CRE teams process broker survey documents, visualize properties on interactive maps, generate tour books, perform financial modeling, and conduct commute studies.</p>
            <p className="legal-p">By accessing or using the Platform, you acknowledge that you have read, understood, and agree to be bound by this Privacy Policy. If you do not agree with the practices described in this Policy, please do not use the Platform. If you are accepting this Policy on behalf of an organization, you represent and warrant that you have the authority to bind that organization to this Policy, and references to &quot;you&quot; or &quot;your&quot; shall refer to that organization.</p>
            <p className="legal-p">Capitalized terms not defined in this Privacy Policy shall have the meanings ascribed to them in our Terms of Service, available at tourlytics.ai/terms.</p>
            <h2 className="legal-h2">1. INFORMATION WE COLLECT</h2>
            <p className="legal-p">We collect information in several categories as described below. The types and amounts of information we collect depend on how you interact with the Platform.</p>
            <h3 className="legal-h3">1.1 Account Information</h3>
            <p className="legal-p">When you register for an account on the Platform, we collect the following personal information:</p>
            <ul className="legal-list">
            <li>Full name</li>
            <li>Email address</li>
            <li>Company or organization name</li>
            <li>Job title or role</li>
            <li>Password (stored in hashed form via Supabase Auth)</li>
            <li>Account preferences and settings</li>
            </ul>
            <h3 className="legal-h3">1.2 Customer Content and Customer Data</h3>
            <p className="legal-p">When you use the Platform, you may upload or create content that contains information about third parties and commercial real estate transactions (&quot;Customer Content&quot; and &quot;Customer Data&quot;). This may include:</p>
            <ul className="legal-list">
            <li>Broker survey PDFs containing commercial property data, building addresses, landlord names, and rental rates</li>
            <li>Financial documents such as requests for proposals (RFPs) and letters of intent (LOIs) containing deal terms, pricing, and tenant information</li>
            <li>Annotations, shortlists, tour book configurations, and other materials created within the Platform</li>
            <li>Project-level data and collaboration content shared with team members</li>
            </ul>
            <p className="legal-p">Important: You are responsible for ensuring that you have the right to upload and process any Customer Data and Customer Content through the Platform, and that doing so complies with all applicable laws and any obligations you may have to third parties.</p>
            <h3 className="legal-h3">1.3 AI Interaction Data</h3>
            <p className="legal-p">When you use AI-powered features of the Platform, we collect:</p>
            <ul className="legal-list">
            <li>Prompts, queries, and instructions submitted to the AI chatbot and other AI Features</li>
            <li>AI-generated outputs, including parsed building data, financial models, commute studies, and chatbot responses</li>
            <li>Token consumption records associated with AI actions</li>
            </ul>
            <h3 className="legal-h3">1.4 Usage Data</h3>
            <p className="legal-p">We automatically collect information about how you interact with the Platform, including:</p>
            <ul className="legal-list">
            <li>Features accessed and actions performed</li>
            <li>Token consumption and purchase history</li>
            <li>Pages and screens visited within the Platform</li>
            <li>Frequency and duration of Platform sessions</li>
            <li>Error logs and performance data</li>
            </ul>
            <h3 className="legal-h3">1.5 Device and Technical Data</h3>
            <p className="legal-p">We automatically collect technical information from your device and browser, including:</p>
            <ul className="legal-list">
            <li>IP address</li>
            <li>Browser type and version</li>
            <li>Operating system and device type</li>
            <li>Screen resolution and display settings</li>
            <li>Referring URL and exit pages</li>
            <li>Date and time of access</li>
            <li>Unique device identifiers</li>
            </ul>
            <h3 className="legal-h3">1.6 Payment Data</h3>
            <p className="legal-p">When you purchase tokens or subscribe to the Platform, payment transactions are processed by Stripe, our third-party payment processor. We receive and store:</p>
            <ul className="legal-list">
            <li>Billing name and billing address</li>
            <li>Transaction history and amounts</li>
            <li>Subscription status and plan details</li>
            <li>Last four digits of your payment card (for display purposes only)</li>
            </ul>
            <p className="legal-p">Important: We do not store, process, or have access to your full credit card numbers, CVV codes, or other sensitive payment credentials. All payment card data is processed and stored exclusively by Stripe in accordance with PCI DSS requirements. Please refer to Stripe&#x27;s Privacy Policy for more information.</p>
            <h3 className="legal-h3">1.7 Geolocation Data</h3>
            <p className="legal-p">We process geolocation data derived from building addresses that you upload or enter into the Platform for purposes of geocoding and map visualization using Google Maps Platform. This geolocation data pertains to commercial real estate properties -- not to your personal physical location. We do not collect or track your real-time geographic location.</p>
            <h3 className="legal-h3">1.8 Cookies and Similar Technologies</h3>
            <p className="legal-p">We use cookies and similar tracking technologies to collect information about your interactions with the Platform. For detailed information about the cookies we use, please see Section 10 (Cookies and Tracking Technologies) of this Policy.</p>
            <h2 className="legal-h2">2. HOW WE USE INFORMATION</h2>
            <p className="legal-p">We use the information we collect for the following purposes:</p>
            <h3 className="legal-h3">2.1 Providing and Operating the Service</h3>
            <ul className="legal-list">
            <li>Creating, maintaining, and securing your account</li>
            <li>Processing and parsing uploaded documents using AI Features</li>
            <li>Generating AI outputs, including financial models, commute studies, tour books, and chatbot responses</li>
            <li>Geocoding building addresses and rendering interactive maps</li>
            <li>Facilitating team collaboration within Projects based on role-based access permissions</li>
            <li>Processing payments and managing token balances</li>
            </ul>
            <h3 className="legal-h3">2.2 Communications</h3>
            <ul className="legal-list">
            <li>Sending account-related notifications (e.g., registration confirmations, password resets, security alerts)</li>
            <li>Providing service notifications (e.g., changes to features, scheduled maintenance)</li>
            <li>Responding to your inquiries and support requests</li>
            </ul>
            <h3 className="legal-h3">2.3 Improvement and Development</h3>
            <ul className="legal-list">
            <li>Analyzing usage patterns to improve Platform functionality and user experience</li>
            <li>Identifying and resolving technical issues, bugs, and errors</li>
            <li>Developing new features and services</li>
            <li>Conducting internal research and analytics</li>
            </ul>
            <h3 className="legal-h3">2.4 Security and Fraud Prevention</h3>
            <ul className="legal-list">
            <li>Detecting, preventing, and responding to security incidents, fraud, and abuse</li>
            <li>Monitoring for unauthorized access to accounts and Projects</li>
            <li>Enforcing our Terms of Service and other policies</li>
            </ul>
            <h3 className="legal-h3">2.5 Legal Compliance</h3>
            <ul className="legal-list">
            <li>Complying with applicable laws, regulations, and legal processes</li>
            <li>Responding to lawful requests from government authorities</li>
            <li>Establishing, exercising, or defending legal claims</li>
            </ul>
            <h3 className="legal-h3">2.6 Important Limitations on Use</h3>
            <p className="legal-p">We do NOT use Customer Data or Customer Content to train, improve, or fine-tune artificial intelligence or machine learning models. Your uploaded documents and data are processed solely to provide the Service to you and are not used for any other purpose.</p>
            <p className="legal-p">We do NOT sell your personal information. We have not sold personal information in the preceding twelve (12) months and do not intend to do so. For purposes of the California Consumer Privacy Act (&quot;CCPA&quot;) and the California Privacy Rights Act (&quot;CPRA&quot;), we do not &quot;sell&quot; or &quot;share&quot; personal information as those terms are defined under applicable law.</p>
            <h2 className="legal-h2">3. HOW WE SHARE INFORMATION</h2>
            <p className="legal-p">We do not sell, rent, or trade your personal information to third parties. We may share your information only in the following limited circumstances:</p>
            <h3 className="legal-h3">3.1 Service Providers</h3>
            <p className="legal-p">We engage trusted third-party service providers to perform functions and provide services on our behalf. These providers have access to your information only to the extent necessary to perform their functions and are contractually obligated to protect your information. Our key service providers include:</p>
            <ul className="legal-list">
            <li>Supabase -- Database hosting and user authentication</li>
            <li>Google (Gemini) -- AI-powered document processing and analysis</li>
            <li>Google Maps Platform -- Geocoding and map visualization</li>
            <li>Stripe -- Payment processing and billing</li>
            <li>Vercel -- Platform hosting and content delivery</li>
            </ul>
            <h3 className="legal-h3">3.2 Team Members and Collaborators</h3>
            <p className="legal-p">When you participate in a Project on the Platform, certain information may be visible to other Authorized Users within that Project based on the role-based access control system. Project Owners and Admins may have access to broader information within the Project than Members or Viewers. You should only share information within Projects that you are comfortable making available to other Project participants.</p>
            <h3 className="legal-h3">3.3 Legal Compliance and Protection</h3>
            <p className="legal-p">We may disclose your information if we believe in good faith that such disclosure is necessary to:</p>
            <ul className="legal-list">
            <li>Comply with applicable law, regulation, legal process, or governmental request, including court orders and subpoenas</li>
            <li>Enforce our Terms of Service, this Privacy Policy, or other agreements</li>
            <li>Protect the rights, property, or safety of Company, our users, or the public</li>
            <li>Detect, prevent, or address fraud, security, or technical issues</li>
            </ul>
            <h3 className="legal-h3">3.4 Business Transfers</h3>
            <p className="legal-p">In the event of a merger, acquisition, reorganization, bankruptcy, or sale of all or a portion of our assets, your information may be transferred as part of that transaction. We will provide notice to you via email and/or a prominent notice on the Platform prior to any such transfer and before your information becomes subject to a different privacy policy. You will have the opportunity to delete your account before such transfer takes effect.</p>
            <h3 className="legal-h3">3.5 Aggregated and De-Identified Data</h3>
            <p className="legal-p">We may share aggregated or de-identified information that cannot reasonably be used to identify you for purposes such as industry analysis, market research, and Platform improvement. Such information is not considered personal information under applicable law.</p>
            <h2 className="legal-h2">4. THIRD-PARTY SERVICES AND DATA PROCESSING</h2>
            <p className="legal-p">The Platform integrates with and relies upon third-party services to provide its functionality. Each of these services has its own privacy policy governing the collection and use of data processed through their systems. We encourage you to review the privacy policies of these services:</p>
            <ul className="legal-list">
            <li>Google Gemini (AI Processing): Customer Data submitted through AI Features is processed by Google&#x27;s Gemini AI models. Google&#x27;s processing of this data is subject to Google&#x27;s Privacy Policy and Google&#x27;s Cloud Data Processing Addendum.</li>
            <li>Google Maps Platform (Geocoding): Building addresses are processed through Google Maps Platform for geocoding and map visualization. This processing is subject to Google&#x27;s Privacy Policy.</li>
            <li>Supabase (Database and Authentication): Account data and Customer Data are stored and processed using Supabase. This processing is subject to Supabase&#x27;s Privacy Policy.</li>
            <li>Stripe (Payment Processing): Payment information is processed by Stripe. This processing is subject to Stripe&#x27;s Privacy Policy.</li>
            <li>Vercel (Hosting): The Platform is hosted on Vercel&#x27;s infrastructure. This processing is subject to Vercel&#x27;s Privacy Policy.</li>
            </ul>
            <p className="legal-p">We are not responsible for the privacy practices of these third-party services. We encourage you to review their respective privacy policies to understand how they handle your information.</p>
            <h2 className="legal-h2">5. DATA RETENTION</h2>
            <p className="legal-p">We retain your information for as long as necessary to fulfill the purposes for which it was collected, as described in this Policy, unless a longer retention period is required or permitted by law. Our specific retention periods are as follows:</p>
            <h3 className="legal-h3">5.1 Account Data</h3>
            <p className="legal-p">We retain your account information for the duration of your active account. Upon account deletion, we will delete or anonymize your account data within ninety (90) days, except as required by law or as necessary to comply with our legal obligations, resolve disputes, or enforce our agreements.</p>
            <h3 className="legal-h3">5.2 Customer Content and Customer Data</h3>
            <p className="legal-p">Customer Content and Customer Data are retained for as long as the associated Projects remain active. Upon account termination or deletion of a Project, we will delete Customer Content and Customer Data within thirty (30) days, unless retention is required by law or is necessary for the establishment, exercise, or defense of legal claims.</p>
            <h3 className="legal-h3">5.3 Usage and Analytics Data</h3>
            <p className="legal-p">Usage and analytics data are retained in aggregated form for a period of twenty-four (24) months from the date of collection. After this period, such data is permanently deleted or further anonymized so that it cannot be associated with any individual user.</p>
            <h3 className="legal-h3">5.4 Payment Records</h3>
            <p className="legal-p">Payment and transaction records are retained as required by applicable tax, financial, and accounting regulations, which typically require a retention period of seven (7) years. These records are retained solely for compliance purposes and are not used for marketing or other unrelated purposes.</p>
            <h3 className="legal-h3">5.5 AI Interaction Logs</h3>
            <p className="legal-p">AI interaction logs -- including prompts, queries, and associated outputs -- are retained for a period of ninety (90) days for purposes of quality assurance, debugging, and service improvement. After this period, such logs are permanently deleted. AI interaction logs are not used to train or improve AI models.</p>
            <h2 className="legal-h2">6. DATA SECURITY</h2>
            <p className="legal-p">We implement and maintain commercially reasonable administrative, technical, and physical security measures designed to protect your information from unauthorized access, disclosure, alteration, and destruction. These measures include:</p>
            <h3 className="legal-h3">6.1 Encryption</h3>
            <ul className="legal-list">
            <li>All data transmitted between your device and the Platform is encrypted in transit using Transport Layer Security (TLS) version 1.2 or higher</li>
            <li>Customer Data and Customer Content stored on our servers and in our database infrastructure are encrypted at rest using industry-standard encryption algorithms</li>
            </ul>
            <h3 className="legal-h3">6.2 Access Controls</h3>
            <ul className="legal-list">
            <li>Role-based access controls within the Platform limit access to Customer Data based on assigned user roles (Owner, Admin, Member, Viewer)</li>
            <li>Internal access to production systems and user data is restricted to authorized personnel on a need-to-know basis</li>
            <li>Multi-factor authentication is supported for user accounts</li>
            </ul>
            <h3 className="legal-h3">6.3 Security Assessments</h3>
            <ul className="legal-list">
            <li>We conduct regular security assessments and vulnerability scans of our infrastructure and application code</li>
            <li>We perform periodic reviews of our security policies and procedures</li>
            </ul>
            <h3 className="legal-h3">6.4 Incident Response</h3>
            <p className="legal-p">We maintain incident response procedures to detect, respond to, and recover from security incidents. In the event of a data breach that affects your personal information, we will notify you in accordance with applicable law.</p>
            <h3 className="legal-h3">6.5 SOC 2 Compliance</h3>
            <p className="legal-p">We are actively pursuing SOC 2 Type II compliance certification. We will update this section when certification is achieved.</p>
            <h3 className="legal-h3">6.6 Limitations</h3>
            <p className="legal-p">No method of transmission over the Internet or method of electronic storage is completely secure. While we strive to use commercially reasonable means to protect your information, we cannot guarantee its absolute security. You acknowledge and accept that you transmit information to and through the Platform at your own risk.</p>
            <h2 className="legal-h2">7. YOUR RIGHTS</h2>
            <h3 className="legal-h3">7.1 Rights of California Residents (CCPA/CPRA)</h3>
            <p className="legal-p">If you are a California resident, you have certain rights under the California Consumer Privacy Act (&quot;CCPA&quot;) as amended by the California Privacy Rights Act (&quot;CPRA&quot;). These rights include:</p>
            <p className="legal-p">7.1.1 Right to Know</p>
            <p className="legal-p">You have the right to request that we disclose the categories and specific pieces of personal information we have collected about you, the categories of sources from which that information is collected, the business or commercial purpose for collecting the information, the categories of third parties with whom we share the information, and the specific pieces of personal information we have collected about you.</p>
            <p className="legal-p">7.1.2 Right to Delete</p>
            <p className="legal-p">You have the right to request that we delete personal information that we have collected from you, subject to certain exceptions as provided by law (e.g., if the information is necessary to complete a transaction, detect security incidents, comply with legal obligations, or for other purposes permitted by law).</p>
            <p className="legal-p">7.1.3 Right to Correct</p>
            <p className="legal-p">You have the right to request that we correct inaccurate personal information that we maintain about you, taking into account the nature of the personal information and the purposes for which we process it.</p>
            <p className="legal-p">7.1.4 Right to Opt-Out of Sale or Sharing</p>
            <p className="legal-p">You have the right to opt out of the &quot;sale&quot; or &quot;sharing&quot; of your personal information, as those terms are defined under the CCPA/CPRA. As stated in this Policy, we do not sell or share personal information and have not done so in the preceding twelve (12) months.</p>
            <p className="legal-p">7.1.5 Right to Limit Use of Sensitive Personal Information</p>
            <p className="legal-p">You have the right to limit the use and disclosure of sensitive personal information to uses that are necessary to perform the services reasonably expected by an average consumer. We only use sensitive personal information for purposes permitted under the CCPA/CPRA.</p>
            <p className="legal-p">7.1.6 Right to Non-Discrimination</p>
            <p className="legal-p">We will not discriminate against you for exercising any of your CCPA/CPRA rights. We will not deny you access to the Platform, charge you different prices, provide you a different level or quality of service, or suggest that you will receive a different price or level of service for exercising your rights.</p>
            <p className="legal-p">7.1.7 How to Submit a Request</p>
            <p className="legal-p">To exercise any of the rights described above, please submit a verifiable consumer request to us by:</p>
            <ul className="legal-list">
            <li>Email: privacy@tourlytics.ai</li>
            </ul>
            <p className="legal-p">Only you, or a person you have authorized to act on your behalf (an &quot;authorized agent&quot;), may make a verifiable consumer request related to your personal information. You may also make a verifiable consumer request on behalf of your minor child.</p>
            <p className="legal-p">7.1.8 Verification Process</p>
            <p className="legal-p">Upon receiving a request, we will verify your identity by matching identifying information provided in your request against information we already have on file. We may ask you to provide additional information to verify your identity. If you use an authorized agent to submit a request, we may require that you provide the authorized agent written permission to do so and that you verify your own identity directly with us.</p>
            <p className="legal-p">7.1.9 Response Timeline</p>
            <p className="legal-p">We will respond to verifiable consumer requests within forty-five (45) days of receipt. If we require additional time, we will inform you of the reason and extension period in writing. Any extension will not exceed an additional forty-five (45) days, for a maximum total response time of ninety (90) days. If we are unable to fulfill a request, we will explain the reason in our response.</p>
            <h3 className="legal-h3">7.2 General Rights for All Users</h3>
            <p className="legal-p">Regardless of your location, we provide all users of the Platform with the following rights:</p>
            <p className="legal-p">7.2.1 Access</p>
            <p className="legal-p">You may request access to the personal information we hold about you and receive a copy of such information in a commonly used electronic format.</p>
            <p className="legal-p">7.2.2 Correction</p>
            <p className="legal-p">You may request that we correct any inaccurate or incomplete personal information we hold about you.</p>
            <p className="legal-p">7.2.3 Deletion</p>
            <p className="legal-p">You may request that we delete your personal information, subject to applicable legal requirements and our legitimate retention needs.</p>
            <p className="legal-p">7.2.4 Data Portability</p>
            <p className="legal-p">You may request a copy of your personal information in a structured, commonly used, and machine-readable format, and you may request that we transmit such data to another service provider where technically feasible.</p>
            <p className="legal-p">7.2.5 Withdrawal of Consent</p>
            <p className="legal-p">Where we process your personal information based on your consent, you may withdraw that consent at any time. The withdrawal of consent will not affect the lawfulness of processing based on consent before its withdrawal.</p>
            <p className="legal-p">7.2.6 Objection to Processing</p>
            <p className="legal-p">You may object to the processing of your personal information where we process it based on our legitimate interests. We will cease processing unless we demonstrate compelling legitimate grounds that override your interests, rights, and freedoms.</p>
            <p className="legal-p">To exercise any of these rights, please contact us at privacy@tourlytics.ai. We will respond to your request in accordance with applicable law.</p>
            <h2 className="legal-h2">8. CHILDREN&#x27;S PRIVACY</h2>
            <p className="legal-p">The Platform is not directed to, and we do not knowingly collect personal information from, children under the age of sixteen (16). If we become aware that we have inadvertently collected personal information from a child under 16, we will take steps to delete such information as soon as practicable. If you believe that we may have collected personal information from a child under 16, please contact us at privacy@tourlytics.ai so that we can investigate and take appropriate action.</p>
            <h2 className="legal-h2">9. INTERNATIONAL DATA TRANSFERS</h2>
            <p className="legal-p">The Platform is operated from the United States, and your information is primarily processed and stored in the United States. If you access the Platform from outside the United States, please be aware that your information may be transferred to, stored in, and processed in the United States and other jurisdictions where our service providers operate.</p>
            <p className="legal-p">By accessing or using the Platform, you consent to the transfer of your information to the United States and other jurisdictions that may not provide the same level of data protection as the laws of your country of residence.</p>
            <p className="legal-p">For enterprise customers that require additional safeguards for international data transfers, we offer standard contractual clauses and other appropriate transfer mechanisms upon request. Please contact us at privacy@tourlytics.ai to discuss your specific requirements.</p>
            <h2 className="legal-h2">10. COOKIES AND TRACKING TECHNOLOGIES</h2>
            <p className="legal-p">We use cookies and similar technologies to enhance your experience on the Platform. This section describes the types of cookies we use and how you can manage them.</p>
            <h3 className="legal-h3">10.1 Types of Cookies We Use</h3>
            <p className="legal-p">10.1.1 Essential Cookies</p>
            <p className="legal-p">These cookies are strictly necessary for the operation of the Platform. They enable core functionality such as user authentication, session management, and security features. Essential cookies cannot be disabled without impairing the functionality of the Platform.</p>
            <p className="legal-p">10.1.2 Analytics Cookies</p>
            <p className="legal-p">These cookies help us understand how users interact with the Platform by collecting information about pages visited, features used, and usage patterns. We use this information to analyze and improve the Platform&#x27;s performance and user experience. Analytics data is collected in aggregated or anonymized form where possible.</p>
            <p className="legal-p">10.1.3 No Advertising or Marketing Cookies</p>
            <p className="legal-p">We do not use advertising, marketing, or behavioral tracking cookies on the Platform. We do not serve targeted advertisements, and we do not share cookie data with advertising networks.</p>
            <h3 className="legal-h3">10.2 Managing Cookie Preferences</h3>
            <p className="legal-p">You can manage your cookie preferences through your browser settings. Most browsers allow you to block or delete cookies. Please note that disabling essential cookies may impair the functionality of the Platform. You may also manage analytics cookie preferences through the Platform&#x27;s cookie settings, if available.</p>
            <p className="legal-p">For more information about cookies and how to manage them, you can visit www.allaboutcookies.org.</p>
            <h2 className="legal-h2">11. DO NOT TRACK SIGNALS</h2>
            <p className="legal-p">&quot;Do Not Track&quot; (&quot;DNT&quot;) is a privacy preference that users can set in certain web browsers. We respect your privacy choices. However, because there is no accepted standard for how to respond to DNT signals, the Platform does not currently alter its data collection and use practices in response to DNT signals. We will continue to monitor developments in DNT technology and update our practices accordingly if a uniform standard is adopted.</p>
            <h2 className="legal-h2">12. CHANGES TO THIS POLICY</h2>
            <p className="legal-p">We may update this Privacy Policy from time to time to reflect changes in our practices, technologies, legal requirements, or other factors. When we make material changes to this Policy, we will:</p>
            <ul className="legal-list">
            <li>Provide at least thirty (30) days&#x27; advance notice before the changes take effect</li>
            <li>Notify you by email at the address associated with your account</li>
            <li>Update the &quot;Last Updated&quot; date at the top of this Policy</li>
            <li>Post the updated Policy on the Platform</li>
            </ul>
            <p className="legal-p">Your continued use of the Platform after the effective date of any updated Privacy Policy constitutes your acceptance of the changes. If you do not agree with any changes, you must discontinue your use of the Platform and delete your account before the effective date of the updated Policy.</p>
            <h2 className="legal-h2">13. DATA PROCESSING ADDENDUM</h2>
            <p className="legal-p">For enterprise customers that require a formal Data Processing Addendum (DPA), we offer a comprehensive DPA that covers:</p>
            <ul className="legal-list">
            <li>Company&#x27;s obligations as a data processor, including the scope, nature, and purpose of data processing</li>
            <li>Technical and organizational security measures implemented to protect personal information</li>
            <li>Sub-processor engagement policies, including a list of current sub-processors and a notification process for changes to sub-processors</li>
            <li>Data subject rights assistance and cooperation obligations</li>
            <li>Data breach notification procedures and timelines</li>
            <li>Data return and deletion obligations upon termination of the agreement</li>
            <li>Audit and inspection rights</li>
            </ul>
            <p className="legal-p">To request a Data Processing Addendum, please contact us at privacy@tourlytics.ai. Our DPA is provided at no additional cost and is designed to satisfy the requirements of applicable data protection regulations, including the CCPA/CPRA.</p>
            <h2 className="legal-h2">14. CONTACT INFORMATION</h2>
            <p className="legal-p">If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:</p>
            <p className="legal-p">Chewerlytics LLC (d/b/a TourLytics)</p>
            <p className="legal-p">Email: privacy@tourlytics.ai</p>
            <p className="legal-p">Website: tourlytics.ai</p>
            <p className="legal-p">State of Incorporation: California</p>
            <p className="legal-p">We strive to respond to all inquiries within thirty (30) days of receipt. For requests related to your privacy rights under the CCPA/CPRA, please see Section 7.1.9 for specific response timelines.</p>
            <p className="legal-p">* * *</p>
      </div>

      <div className="legal-footer">
        <div className="legal-footer-inner">
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>&copy; 2026 TourLytics. All rights reserved.</span>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <Link href="/terms">Terms of Service</Link>
            <Link href="/privacy">Privacy Policy</Link>
            <a href="https://www.perplexity.ai/computer" target="_blank" rel="noopener noreferrer">Created with Perplexity Computer</a>
          </div>
        </div>
      </div>
    </div>
  )
}
