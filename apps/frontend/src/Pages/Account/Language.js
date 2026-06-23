import React, { useEffect, useState } from 'react';
import { FiGlobe, FiSave } from 'react-icons/fi';
import AccountPageShell from './AccountPageShell';
import useBlockBackButton from '../../Components/useBlockBackButton';

const languages = [
  { value: 'en', label: 'English' },
  { value: 'ur', label: 'Urdu' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'ar', label: 'Arabic' },
];

function Language() {
  useBlockBackButton();
  const [isEditable, setIsEditable] = useState(false);
  const [language, setLanguage] = useState(localStorage.getItem('preferredLanguage') || 'en');

  useEffect(() => {
    const scriptId = 'google-translate-script';

    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      script.async = true;
      document.body.appendChild(script);
    }

    window.googleTranslateElementInit = () => {
      if (window.google && window.google.translate) {
        new window.google.translate.TranslateElement(
          {
            pageLanguage: 'en',
            includedLanguages: 'en,ur,es,fr,ar',
            layout: window.google.translate.TranslateElement.InlineLayout.HORIZONTAL,
            autoDisplay: false,
          },
          'google_translate_element'
        );
      }
    };

    return () => {
      delete window.googleTranslateElementInit;
    };
  }, []);

  const changeLanguage = (lang) => {
    localStorage.setItem('preferredLanguage', lang);

    const googleSelect = document.querySelector('.goog-te-combo');
    if (googleSelect) {
      googleSelect.value = lang;
      googleSelect.dispatchEvent(new Event('change'));
      return;
    }

    document.cookie = `googtrans=/en/${lang}; path=/`;
  };

  const handleLanguageChange = (event) => {
    const selectedLang = event.target.value;
    setLanguage(selectedLang);
    changeLanguage(selectedLang);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setIsEditable(false);
  };

  return (
    <AccountPageShell
      title="Language"
      subtitle="Choose the language preference used by the workspace interface."
      eyebrow="Privacy & Settings"
      actions={
        <button className="account-button-secondary" type="button" onClick={() => setIsEditable((value) => !value)}>
          {isEditable ? 'Cancel' : 'Edit'}
        </button>
      }
    >
      <form className="account-card" onSubmit={handleSubmit}>
        <div className="account-card-header">
          <div>
            <h2>Language Preference</h2>
            <p>You can change this anytime. Translation support depends on Google Translate availability.</p>
          </div>
          <FiGlobe size={24} color="#f05c44" aria-hidden="true" />
        </div>

        <div className="account-card-body">
          <div className="account-form-grid">
            <div className="account-field-full">
              <label htmlFor="account-language">Preferred Language</label>
              <select id="account-language" value={language} disabled={!isEditable} onChange={handleLanguageChange}>
                {languages.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>
          </div>

          {isEditable && (
            <div className="account-button-row">
              <button className="account-button-primary" type="submit">
                <FiSave size={16} />
                Save Language
              </button>
            </div>
          )}
        </div>
      </form>
      <div id="google_translate_element" hidden />
    </AccountPageShell>
  );
}

export default Language;
