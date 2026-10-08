'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { CONTACT_TOPICS } from '@/lib/contactValidation';

export default function ContactForm() {
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState('availability');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reference, setReference] = useState('');
  const attempt = useRef<{ identity: string; id: string } | null>(null);
  const submitting = useRef(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      const identity = JSON.stringify([
        email.trim().toLowerCase(),
        topic,
        message.trim(),
      ]);
      if (!attempt.current || attempt.current.identity !== identity)
        attempt.current = { identity, id: crypto.randomUUID() };
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          topic,
          message,
          website,
          attemptId: attempt.current.id,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success || typeof data.reference !== 'string')
        throw new Error(
          data.error ||
            'Le message n’a pas pu être transmis. Réessayez dans quelques instants.',
        );
      setReference(data.reference);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'L’envoi a échoué. Vous pouvez écrire à hello@streammalin.fr.',
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  if (reference)
    return (
      <div className="contact-result" role="status">
        <h2>
          <Check size={19} aria-hidden="true" /> Votre message a été envoyé
        </h2>
        <p>
          Conservez cette référence pour le suivi de votre demande. L’adresse
          indiquée servira à vous répondre.
        </p>
        <p>Référence : {reference}</p>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => {
            setReference('');
            setMessage('');
            attempt.current = null;
          }}
        >
          Nouveau message
        </button>
      </div>
    );
  return (
    <form className="contact-form" onSubmit={submit}>
      <label htmlFor="contact-email">
        Votre adresse e-mail
        <input
          id="contact-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={busy}
          placeholder="vous@exemple.com"
        />
      </label>
      <label htmlFor="contact-topic">
        Votre question concerne
        <select
          id="contact-topic"
          name="topic"
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          disabled={busy}
        >
          {Object.entries(CONTACT_TOPICS).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label htmlFor="contact-message">
        Votre message
        <textarea
          id="contact-message"
          name="message"
          required
          minLength={10}
          maxLength={3000}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          disabled={busy}
          placeholder="Précisez l’offre ou votre référence de commande, si vous en avez une."
        />
      </label>
      <div className="contact-honeypot" aria-hidden="true">
        <label htmlFor="contact-website">
          Site web
          <input
            id="contact-website"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />
        </label>
      </div>
      <p className="contact-privacy">
        Ne transmettez aucun mot de passe ni numéro de carte. Votre e-mail et
        votre message servent à traiter votre demande, sans inscription à une
        liste publicitaire.{' '}
        <Link href="/politique-confidentialite">Confidentialité</Link>
      </p>
      {error && (
        <div className="contact-error" role="alert">
          {error}
        </div>
      )}
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? 'Envoi en cours…' : 'Envoyer mon message'}
        <ArrowRight size={17} aria-hidden="true" />
      </button>
    </form>
  );
}
