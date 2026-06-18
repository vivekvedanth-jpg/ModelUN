"use client";

import { useEffect, useState } from "react";
import { getMessages, deleteMessage, type ContactMessage } from "@/lib/contact";
import { MailIcon, TrashIcon } from "./icons";

function when(ts: number): string {
  return new Date(ts).toLocaleString();
}

export default function ContactInbox() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);

  useEffect(() => {
    setMessages(getMessages());
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold text-navy-900">Inbox</h2>
      <p className="mt-1 text-navy-600">
        Queries sent from the contact page on this device. (Visitors&apos;
        messages are also emailed to you directly.)
      </p>

      <div className="mt-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-navy-200 px-6 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy-50 text-navy-400">
              <MailIcon width={24} height={24} />
            </span>
            <p className="font-semibold text-navy-800">No messages yet</p>
            <p className="max-w-sm text-sm text-navy-500">
              Queries from the contact page will show up here.
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <article key={m.id} className="card">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-bold text-navy-900">{m.name}</h3>
                  <a
                    href={`mailto:${m.email}`}
                    className="text-sm font-medium text-navy-600 hover:text-gold-600"
                  >
                    {m.email}
                  </a>
                  <span className="ml-2 text-xs text-navy-400">· {when(m.createdAt)}</span>
                </div>
                <button
                  onClick={() => setMessages(deleteMessage(m.id))}
                  className="inline-flex flex-shrink-0 items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700"
                >
                  <TrashIcon width={14} height={14} /> Delete
                </button>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-navy-700">
                {m.message}
              </p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
