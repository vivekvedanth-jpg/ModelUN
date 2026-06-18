"use client";

import { useState, type FormEvent } from "react";
import { saveMessage, buildMailto, type NewMessage } from "@/lib/contact";
import { MailIcon, CheckIcon } from "./icons";

export default function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    const payload: NewMessage = { name, email, message };
    if (!name.trim() || !email.trim() || message.trim().length < 5) {
      setError("Please fill in your name, email, and a short message.");
      return;
    }

    try {
      await saveMessage(payload);
      // Also open the visitor's mail app as a secondary delivery path.
      window.location.href = buildMailto(payload);
      setSent(true);
      setName("");
      setEmail("");
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (sent) {
    return (
      <div className="card flex flex-col items-center gap-3 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 text-green-600">
          <CheckIcon width={26} height={26} />
        </span>
        <h2 className="text-xl font-bold text-navy-900">Thanks — your message is on its way!</h2>
        <p className="max-w-md text-sm text-navy-600">
          Your email app should have opened with your message ready to send. If
          it didn&apos;t, please make sure a mail app is set up on your device.
        </p>
        <button onClick={() => setSent(false)} className="btn-ghost mt-2">
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-50 text-navy-800">
          <MailIcon width={22} height={22} />
        </span>
        <div>
          <h2 className="text-xl font-bold text-navy-900">Send a query</h2>
          <p className="text-sm text-navy-500">
            No account needed — we&apos;ll get back to you by email.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="c-name" className="label">Your name</label>
          <input
            id="c-name"
            className="input-field"
            placeholder="Jane Delegate"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="c-email" className="label">Your email</label>
          <input
            id="c-email"
            type="email"
            className="input-field"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
      </div>

      <div>
        <label htmlFor="c-message" className="label">Message</label>
        <textarea
          id="c-message"
          className="input-field min-h-[120px] resize-y"
          placeholder="How can we help? e.g. how do I get an account?"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
        />
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </p>
      )}

      <button type="submit" className="btn-primary w-full sm:w-auto">
        <MailIcon width={16} height={16} /> Send message
      </button>
    </form>
  );
}
