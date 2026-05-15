import React from 'react';
import AccountPageShell from './AccountPageShell';
import useBlockBackButton from '../../Components/useBlockBackButton';

const termsSections = [
  {
    title: 'Acceptance of Terms',
    body: 'By using this software, you acknowledge that you have read, understood, and agree to comply with these terms and applicable laws.',
  },
  {
    title: 'Purpose of Use',
    body: 'The FBR Invoicing System is designed to facilitate creation, validation, and submission of digital invoices to FBR Pakistan.',
  },
  {
    title: 'User Responsibilities',
    points: [
      'You are responsible for the accuracy and completeness of invoice data.',
      'You must keep FBR-issued API tokens confidential.',
      'You may only use this system for lawful and FBR-compliant invoicing.',
    ],
  },
  {
    title: 'Data Accuracy',
    body: 'All entered data must be true, complete, and up to date. The software is not liable for errors caused by incorrect user input.',
  },
  {
    title: 'System Access',
    body: 'Access may be modified or suspended for maintenance, updates, or legal compliance, with or without prior notice.',
  },
  {
    title: 'Intellectual Property',
    body: 'Platform contents, interface design, and backend systems are protected by copyright and may not be copied without permission.',
  },
  {
    title: 'Termination',
    body: 'Access may be terminated or restricted if these terms are violated.',
  },
  {
    title: 'Changes to Terms',
    body: 'These terms may be updated at any time. Continued use after changes signifies acceptance of the updated terms.',
  },
  {
    title: 'Contact Us',
    body: 'For questions about these terms, contact support@techionik.com.',
  },
];

function Terms() {
  useBlockBackButton();

  return (
    <AccountPageShell
      title="Terms & Conditions"
      subtitle="Review the usage terms for the digital invoicing workspace."
      eyebrow="Account Manager"
    >
      <article className="account-card account-doc-card">
        <h2>Terms & Conditions</h2>
        <p><strong>Last Updated: July 11, 2025</strong></p>
        <p>
          Welcome to the FBR Invoicing System. Please read these terms carefully before using the platform.
          By accessing or using the system, you agree to be bound by these terms.
        </p>

        <ol className="account-doc-list">
          {termsSections.map((section) => (
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

export default Terms;
