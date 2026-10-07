import LegalPage from '../LegalPage';
import { TERMS_DOCUMENT } from '@/lib/legal/terms-2026-10-07.1';

export default function TermsDocument() {
  return <LegalPage title="Conditions Générales de Vente" updatedAt={TERMS_DOCUMENT.updatedAt}
    intro={`Version ${TERMS_DOCUMENT.version}. Ces conditions s’appliquent aux commandes qui acceptent cette version.`}
    toc={TERMS_DOCUMENT.sections.map(section => ({ id: section.id, label: section.title }))}>
    {TERMS_DOCUMENT.sections.map(section => <section key={section.id}><h2 id={section.id}>{section.title}</h2>{section.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</section>)}
    <p><a href="/retractation">Déposer une demande de rétractation</a> · <a href="/politique-confidentialite">Politique de confidentialité</a></p>
  </LegalPage>;
}
