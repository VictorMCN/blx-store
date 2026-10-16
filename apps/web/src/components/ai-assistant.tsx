"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ApiError,
  apiFetch,
} from "@/lib/api";
import { useStore } from "./store-provider";

type ChatRole =
  | "user"
  | "assistant";

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}

interface AssistantResponse {
  message: string;
}

const QUICK_PROMPTS = [
  "Show me some laptops.",
  "Compare the NovaBook 14 and ForgeBook 16.",
  "What are my latest orders?",
];

function SendIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="m4 12 16-8-6 16-2.5-6.5L4 12Z" />
      <path d="m11.5 13.5 3.5-3.5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="m6 6 12 12" />
      <path d="M18 6 6 18" />
    </svg>
  );
}

export function AiAssistant() {
  const {
    user,
    authLoading,
  } = useStore();

  const [open, setOpen] =
    useState(false);

  const [input, setInput] =
    useState("");

  const [messages, setMessages] =
    useState<ChatMessage[]>([]);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const messagesEndRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  useEffect(() => {
    if (!user) {
      setMessages([]);
      setInput("");
      setError(null);
    }
  }, [user]);

  useEffect(() => {
    if (!open) {
      return;
    }

    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [
    open,
    messages,
    submitting,
  ]);

  async function sendMessage(
    rawMessage: string,
  ) {
    const message =
      rawMessage.trim();

    if (
      !message ||
      !user ||
      submitting
    ) {
      return;
    }

    const history =
      messages
        .slice(-8)
        .map(
          ({
            role,
            content,
          }) => ({
            role,
            content,
          }),
        );

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      content: message,
    };

    setMessages(
      (current) => [
        ...current,
        userMessage,
      ],
    );

    setInput("");
    setSubmitting(true);
    setError(null);

    try {
      const response =
        await apiFetch<AssistantResponse>(
          "/api/assistant/chat",
          {
            method: "POST",
            body: JSON.stringify({
              message,
              history,
            }),
          },
        );

      const assistantMessage:
        ChatMessage = {
          id: `${Date.now()}-assistant`,
          role: "assistant",
          content:
            response.message,
        };

      setMessages(
        (current) => [
          ...current,
          assistantMessage,
        ],
      );
    } catch (caught) {
      if (
        caught instanceof ApiError &&
        caught.status === 401
      ) {
        setError(
          "Your session has expired. Please sign in again.",
        );
      } else if (
        caught instanceof ApiError &&
        caught.status === 503
      ) {
        setError(
          "The AI assistant is temporarily unavailable. Please try again shortly.",
        );
      } else {
        setError(
          caught instanceof Error
            ? caught.message
            : "The AI assistant could not complete your request.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    await sendMessage(
      input,
    );
  }

  return (
    <>
      {open && (
        <section
          aria-label="BLX AI Assistant"
          className="fixed bottom-24 right-4 z-50 flex h-[min(620px,calc(100vh-7rem))] w-[calc(100vw-2rem)] max-w-[390px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/15 sm:right-6"
        >
          <div className="relative flex min-h-20 items-center justify-between overflow-hidden border-b border-slate-800 bg-slate-950 px-5 py-4 text-white">
            <div className="flex items-center gap-3">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-white ring-1 ring-white/10">
                <Image
                  src="/blx-ai-mascot.png"
                  alt="BLX AI mascot"
                  fill
                  sizes="56px"
                  className="object-cover object-top"
                  priority
                />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold">
                    BLX AI Assistant
                  </h2>

                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                </div>

                <p className="mt-0.5 text-xs text-slate-400">
                  Products and order support
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setOpen(false)
              }
              className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
              aria-label="Close AI assistant"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto bg-slate-50 px-4 py-5">
            {authLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                Checking your session...
              </div>
            ) : !user ? (
              <div className="flex h-full flex-col items-center justify-center px-5 text-center">
                <div className="relative h-20 w-20 overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-slate-200">
                  <Image
                    src="/blx-ai-avatar.png"
                    alt="BLX AI"
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </div>

                <h3 className="mt-5 text-base font-semibold text-slate-950">
                  Sign in to use BLX AI
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  The assistant can recommend
                  products, compare devices,
                  and securely check your own
                  orders.
                </p>

                <Link
                  href="/login"
                  onClick={() =>
                    setOpen(false)
                  }
                  className="mt-6 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Sign in
                </Link>
              </div>
            ) : (
              <>
                {messages.length ===
                  0 && (
                  <div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white ring-1 ring-slate-200">
                          <Image
                            src="/blx-ai-avatar.png"
                            alt=""
                            fill
                            sizes="40px"
                            className="object-cover"
                          />
                        </div>

                        <div>
                          <div className="text-sm font-semibold text-slate-950">
                            How can I help?
                          </div>

                          <p className="mt-1 text-sm leading-6 text-slate-500">
                            Ask me about BLX
                            products, comparisons,
                            availability, or your
                            recent orders.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      {QUICK_PROMPTS.map(
                        (
                          prompt,
                        ) => (
                          <button
                            key={
                              prompt
                            }
                            type="button"
                            disabled={
                              submitting
                            }
                            onClick={() =>
                              void sendMessage(
                                prompt,
                              )
                            }
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {
                              prompt
                            }
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {messages.map(
                    (
                      message,
                    ) => (
                      <div
                        key={
                          message.id
                        }
                        className={
                          message.role ===
                          "user"
                            ? "flex justify-end"
                            : "flex items-start justify-start gap-2"
                        }
                      >
                        {message.role ===
                          "assistant" && (
                          <div className="relative mt-1 h-8 w-8 shrink-0 overflow-hidden rounded-full bg-white ring-1 ring-slate-200">
                            <Image
                              src="/blx-ai-avatar.png"
                              alt=""
                              fill
                              sizes="32px"
                              className="object-cover"
                            />
                          </div>
                        )}

                        <div
                          className={
                            message.role ===
                            "user"
                              ? "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-blue-600 px-4 py-3 text-sm leading-6 text-white"
                              : "max-w-[82%] whitespace-pre-wrap rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 shadow-sm"
                          }
                        >
                          {
                            message.content
                          }
                        </div>
                      </div>
                    ),
                  )}

                  {submitting && (
                    <div className="flex items-start gap-2">
                      <div className="relative mt-1 h-8 w-8 shrink-0 overflow-hidden rounded-full bg-white ring-1 ring-slate-200">
                        <Image
                          src="/blx-ai-avatar.png"
                          alt=""
                          fill
                          sizes="32px"
                          className="object-cover"
                        />
                      </div>

                      <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-slate-400" />
                        <span className="h-2 w-2 animate-pulse rounded-full bg-slate-400 [animation-delay:150ms]" />
                        <span className="h-2 w-2 animate-pulse rounded-full bg-slate-400 [animation-delay:300ms]" />
                      </div>
                    </div>
                  )}
                </div>

                {error && (
                  <div
                    role="alert"
                    className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700"
                  >
                    {error}
                  </div>
                )}

                <div
                  ref={
                    messagesEndRef
                  }
                />
              </>
            )}
          </div>

          {user && !authLoading && (
            <form
              onSubmit={submit}
              className="border-t border-slate-200 bg-white p-4"
            >
              <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 transition focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-50">
                <textarea
                  value={input}
                  onChange={(
                    event,
                  ) =>
                    setInput(
                      event
                        .target
                        .value,
                    )
                  }
                  onKeyDown={(
                    event,
                  ) => {
                    if (
                      event.key ===
                        "Enter" &&
                      !event.shiftKey
                    ) {
                      event.preventDefault();

                      if (
                        input.trim() &&
                        !submitting
                      ) {
                        void sendMessage(
                          input,
                        );
                      }
                    }
                  }}
                  rows={1}
                  maxLength={1500}
                  disabled={
                    submitting
                  }
                  placeholder="Ask BLX AI..."
                  className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-950 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
                  aria-label="Message BLX AI Assistant"
                />

                <button
                  type="submit"
                  disabled={
                    submitting ||
                    !input.trim()
                  }
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  aria-label="Send message"
                >
                  <SendIcon />
                </button>
              </div>

              <p className="mt-2 text-center text-[11px] leading-4 text-slate-400">
                AI responses may be imperfect.
                Product and order data comes
                from BLX Store systems.
              </p>
            </form>
          )}
        </section>
      )}

      <button
        type="button"
        onClick={() =>
          setOpen(
            (current) =>
              !current,
          )
        }
        aria-expanded={open}
        aria-label={
          open
            ? "Close BLX AI Assistant"
            : "Open BLX AI Assistant"
        }
        className="fixed bottom-6 right-4 z-50 flex h-16 items-center gap-2 rounded-2xl bg-slate-950 py-2 pl-2 pr-4 text-sm font-semibold text-white shadow-xl shadow-slate-950/20 transition hover:-translate-y-0.5 hover:bg-blue-600 sm:right-6"
      >
        <span className="relative h-12 w-12 overflow-hidden rounded-xl bg-white">
          <Image
            src="/blx-ai-avatar.png"
            alt=""
            fill
            sizes="48px"
            className="object-cover"
          />
        </span>

        <span>
          BLX AI
        </span>
      </button>
    </>
  );
}
