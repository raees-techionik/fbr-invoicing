import React from 'react';
import AccountPageShell from './AccountPageShell';
import useBlockBackButton from '../../Components/useBlockBackButton';

const privacySections = [
  {
    title: 'Information We Collect',
    points: [
      'Business details including company name, NTN, CNIC, and address.',
      'Customer and invoice data needed for compliant invoicing.',
      'Authentication data used for FBR authorization.',
      'Error logs used to troubleshoot platform issues.',
    ],
  },
  {
    title: 'How We Use Your Information',
    points: [
      'To generate, validate, and submit invoices with FBR.',
      'To troubleshoot platform needs and improve system performance.',
      'To generate FBR summaries and compliance records.',
    ],
  },
  {
    title: 'Data Security',
    points: [
      'Data is encrypted during transmission.',
      'API tokens are stored securely and are not visible after saving.',
      'Data is only shared with FBR when required for compliance.',
    ],
  },
  {
    title: 'Cookies & Tracking',
    points: [
      'Session cookies may be used to manage login and preferences.',
      'Personally identifiable information is not tracked unless operationally required.',
    ],
  },
  {
    title: 'Third Party Access',
    points: [
      'Users may request export or deletion of account data from settings.',
      'Data is not sold or shared with unauthorized third parties.',
    ],
  },
  {
    title: 'User Inactivity',
    points: [
      'Inactive accounts may be flagged for compliance review.',
      'Accounts with no activity may be deleted after 365 days of inactivity.',
    ],
  },
  {
    title: 'Regulatory Compliance',
    points: [
      'Applicable legal and operational regulations will be followed during processing.',
    ],
  },
  {
    title: 'Privacy Revisions',
    points: [
      'Significant policy changes will be displayed inside the platform.',
    ],
  },
  {
    title: 'Contact Us',
    body: 'For privacy questions, contact privacy@techionik.com or +92-300-2344567.',
  },
];

function Privacy() {
  useBlockBackButton();

  return (
    <AccountPageShell
      title="Privacy Policy"
      subtitle="Understand how workspace and invoice-related account data is handled."
      eyebrow="Account Manager"
    >
      <article className="account-card account-doc-card">
        <h2>Privacy Policy</h2>
        <p><strong>Last Updated: July 11, 2025</strong></p>
        <p>
          We respect your privacy and are committed to protecting the personal information shared through the
          FBR Invoicing System.
        </p>

        <ol className="account-doc-list">
          {privacySections.map((section) => (
            <li key={section.title}>
              <div>
                <h3>{section.title}</h3>
                {section.body && <p>{section.body}</p>}
                {section.points && (
                  <ul>
                    {section.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ol>
      </article>
    </AccountPageShell>
  );
}

export default Privacy;
