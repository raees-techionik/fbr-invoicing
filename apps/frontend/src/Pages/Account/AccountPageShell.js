import React from 'react';

function AccountPageShell({ title, subtitle, eyebrow = 'Account', actions, children }) {
  return (
    <section className="account-page-section" aria-labelledby="account-page-title">
      <header className="account-page-header">
        <div>
          <span>{eyebrow}</span>
          <h1 id="account-page-title">{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {actions && <div className="account-page-actions">{actions}</div>}
      </header>

      {children}
    </section>
  );
}

export default AccountPageShell;
