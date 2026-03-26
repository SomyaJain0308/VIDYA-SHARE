import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Loader2, MessageCircle, Send } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { useConversationMessages, useUserConversations } from '../hooks/useChat';
import { sendMessage } from '../utils/chat';

const SEND_DEBOUNCE_MS = 800;
const DUPLICATE_MESSAGE_WINDOW_MS = 4000;

const formatConversationTime = (timestamp) => {
  const timestampDate =
    typeof timestamp?.toDate === 'function'
      ? timestamp.toDate()
      : timestamp instanceof Date
        ? timestamp
        : null;

  if (!timestampDate || Number.isNaN(timestampDate.getTime?.())) return '';

  const now = new Date();
  const sameDay = now.toDateString() === timestampDate.toDateString();
  if (sameDay) {
    return timestampDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return timestampDate.toLocaleDateString([], { day: 'numeric', month: 'short' });
};

const getMessageDayLabel = (timestamp) => {
  const timestampDate =
    typeof timestamp?.toDate === 'function'
      ? timestamp.toDate()
      : timestamp instanceof Date
        ? timestamp
        : null;

  if (!timestampDate || Number.isNaN(timestampDate.getTime?.())) return '';
  return timestampDate.toLocaleDateString([], { day: 'numeric', month: 'short' });
};

export default function Chats({ initialConversationId = '', onConversationConsumed, onRequireAuth, onNavigateHome }) {
  const [currentUserId, setCurrentUserId] = useState(() => auth.currentUser?.uid || '');
  const [isAuthReady, setIsAuthReady] = useState(() => Boolean(auth.currentUser));
  const [activeConversationId, setActiveConversationId] = useState('');
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [showMobileThread, setShowMobileThread] = useState(false);
  const messagesEndRef = useRef(null);
  const sendLockRef = useRef(false);
  const lastSentMessageRef = useRef({ text: '', at: 0 });

  const { conversations, loading: conversationsLoading, error: conversationsError } = useUserConversations(currentUserId);
  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) || null,
    [activeConversationId, conversations]
  );
  const { messages, loading: messagesLoading, error: messagesError } = useConversationMessages(activeConversationId, currentUserId);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUserId(user?.uid || '');
      setIsAuthReady(true);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!initialConversationId) return;
    setActiveConversationId(initialConversationId);
    setShowMobileThread(true);
    if (typeof onConversationConsumed === 'function') {
      onConversationConsumed();
    }
  }, [initialConversationId, onConversationConsumed]);

  useEffect(() => {
    if (activeConversationId || conversations.length === 0) return;
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setActiveConversationId(conversations[0].id);
    }
  }, [activeConversationId, conversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const openConversation = (conversationId) => {
    setActiveConversationId(conversationId);
    setShowMobileThread(true);
    setSendError('');
  };

  const handleBackToList = () => {
    setShowMobileThread(false);
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();
    const cleanDraft = String(draft || '').trim();
    if (!cleanDraft || !activeConversationId) return;
    if (sendLockRef.current) return;

    const now = Date.now();
    const lastSent = lastSentMessageRef.current;
    const isDuplicateMessage =
      lastSent.text === cleanDraft && now - lastSent.at < DUPLICATE_MESSAGE_WINDOW_MS;

    if (isDuplicateMessage) {
      setSendError('This message was just sent.');
      return;
    }

    sendLockRef.current = true;
    setIsSending(true);
    setSendError('');
    try {
      await sendMessage(activeConversationId, cleanDraft);
      lastSentMessageRef.current = { text: cleanDraft, at: Date.now() };
      setDraft('');
    } catch (error) {
      console.error('Chat send failed', error);
      setSendError(error?.message || 'Could not send the message right now.');
    } finally {
      window.setTimeout(() => {
        sendLockRef.current = false;
        setIsSending(false);
      }, SEND_DEBOUNCE_MS);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="mx-auto w-full max-w-[1280px] px-3 pb-16 pt-6 sm:px-6">
        <div className="lux-panel flex min-h-[360px] flex-col items-center justify-center rounded-[2rem] p-6 text-center">
          <Loader2 className="h-7 w-7 animate-spin text-cyan-100" />
          <p className="mt-4 text-sm font-semibold text-white">Loading your chat access...</p>
        </div>
      </div>
    );
  }

  if (!currentUserId) {
    return (
      <div className="mx-auto w-full max-w-[1280px] px-3 pb-16 pt-6 sm:px-6">
        <div className="lux-panel flex min-h-[360px] flex-col items-center justify-center rounded-[2rem] p-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-[1.4rem] border border-cyan-300/18 bg-cyan-300/10 text-cyan-100">
            <MessageCircle className="h-6 w-6" />
          </div>
          <h1 className="font-display mt-5 text-3xl font-semibold text-white">Chat about a listing</h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-cyan-50/72">
            Sign in to continue your listing conversations and message sellers directly inside Vidya Share.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => (typeof onRequireAuth === 'function' ? onRequireAuth() : null)}
              className="btn-primary rounded-xl px-5 py-3 text-sm font-bold"
            >
              Sign in to chat
            </button>
            <button
              type="button"
              onClick={() => (typeof onNavigateHome === 'function' ? onNavigateHome() : null)}
              className="rounded-xl border border-cyan-300/18 bg-[#08111a]/88 px-5 py-3 text-sm font-semibold text-cyan-50 transition hover:border-cyan-300/34 hover:bg-white/[0.08]"
            >
              Back to listings
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] px-3 pb-16 pt-6 sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/62">Inbox</p>
          <h1 className="font-display mt-2 text-3xl font-semibold text-white">Chats</h1>
        </div>
        <button
          type="button"
          onClick={() => (typeof onNavigateHome === 'function' ? onNavigateHome() : null)}
          className="hidden rounded-full border border-cyan-300/18 bg-[#08111a]/88 px-4 py-2 text-sm font-semibold text-cyan-50 transition hover:border-cyan-300/34 hover:bg-white/[0.08] md:inline-flex"
        >
          Back to listings
        </button>
      </div>

      <div className="grid min-h-[72vh] gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className={`lux-panel overflow-hidden rounded-[2rem] ${showMobileThread ? 'hidden lg:flex' : 'flex'} flex-col`}>
          <div className="border-b border-cyan-300/12 px-5 py-4">
            <p className="text-sm font-semibold text-white">Your conversations</p>
            <p className="mt-1 text-xs text-cyan-50/62">Each chat stays tied to one book listing.</p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            {conversationsLoading ? (
              <div className="flex min-h-[220px] items-center justify-center text-sm font-semibold text-cyan-50/74">
                <Loader2 className="mr-3 h-4 w-4 animate-spin text-cyan-100" />
                Loading chats...
              </div>
            ) : null}

            {!conversationsLoading && conversations.length === 0 ? (
              <div className="flex min-h-[260px] flex-col items-center justify-center rounded-[1.6rem] border border-dashed border-cyan-300/18 bg-[#08111a]/72 p-5 text-center">
                <MessageCircle className="h-7 w-7 text-cyan-100/80" />
                <p className="mt-4 text-sm font-semibold text-white">No chats yet</p>
                <p className="mt-2 max-w-xs text-xs leading-relaxed text-cyan-50/68">
                  Open any listing and tap Chat with Seller to start a conversation.
                </p>
              </div>
            ) : null}

            {conversations.map((conversation) => {
              const isActive = conversation.id === activeConversationId;
              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => openConversation(conversation.id)}
                  className={`mb-2 w-full rounded-[1.35rem] border px-4 py-3 text-left transition ${
                    isActive
                      ? 'border-cyan-200/42 bg-cyan-300/10 shadow-[0_24px_48px_-30px_rgba(91,232,255,0.35)]'
                      : 'border-cyan-300/12 bg-[#08111a]/82 hover:border-cyan-300/24 hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{conversation.listingTitle || 'Listing chat'}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-cyan-50/64">
                        {conversation.lastMessage || 'No messages yet. Say hello about this listing.'}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[11px] font-semibold text-cyan-100/72">{formatConversationTime(conversation.lastMessageAt)}</p>
                      {conversation.unreadCount > 0 ? (
                        <span className="mt-2 inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-cyan-200 px-2 py-0.5 text-[11px] font-bold text-[#041018]">
                          {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}

            {conversationsError && conversations.length > 0 ? (
              <p className="mt-3 rounded-xl border border-rose-200/38 bg-rose-300/16 px-3 py-2 text-sm font-semibold text-rose-100">
                {conversationsError}
              </p>
            ) : null}
          </div>
        </aside>

        <section className={`lux-panel min-h-[72vh] flex-col overflow-hidden rounded-[2rem] ${showMobileThread ? 'flex' : 'hidden lg:flex'}`}>
          {activeConversation ? (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-cyan-300/12 px-4 py-4 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={handleBackToList}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-cyan-300/18 bg-[#08111a]/88 text-cyan-50 transition hover:border-cyan-300/34 hover:bg-white/[0.08] lg:hidden"
                    aria-label="Back to chat list"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold text-white">{activeConversation.listingTitle || 'Listing chat'}</p>
                    <p className="mt-1 text-xs text-cyan-50/64">Messages stay inside Vidya Share until you choose to move elsewhere.</p>
                  </div>
                </div>
                <span className="hidden rounded-full border border-cyan-300/16 bg-[#08111a]/88 px-3 py-1 text-xs font-semibold text-cyan-50/78 sm:inline-flex">
                  Book chat
                </span>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
                {messagesLoading ? (
                  <div className="flex h-full min-h-[240px] items-center justify-center text-sm font-semibold text-cyan-50/74">
                    <Loader2 className="mr-3 h-4 w-4 animate-spin text-cyan-100" />
                    Loading messages...
                  </div>
                ) : null}

                {!messagesLoading && messages.length === 0 ? (
                  <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
                    <MessageCircle className="h-8 w-8 text-cyan-100/80" />
                    <p className="mt-4 text-sm font-semibold text-white">Start the conversation</p>
                    <p className="mt-2 max-w-sm text-xs leading-relaxed text-cyan-50/68">
                      For your safety, only share personal contact details after confirming the deal.
                    </p>
                  </div>
                ) : null}

                {!messagesLoading ? (
                  <div className="space-y-3">
                    {messages.map((message, index) => {
                      const previousMessage = messages[index - 1];
                      const previousDay = previousMessage ? getMessageDayLabel(previousMessage.createdAt) : '';
                      const currentDay = getMessageDayLabel(message.createdAt);
                      const isOwnMessage = message.senderId === currentUserId;

                      return (
                        <React.Fragment key={message.id}>
                          {currentDay && currentDay !== previousDay ? (
                            <div className="flex justify-center py-2">
                              <span className="rounded-full border border-cyan-300/16 bg-[#08111a]/88 px-3 py-1 text-[11px] font-semibold text-cyan-50/68">
                                {currentDay}
                              </span>
                            </div>
                          ) : null}
                          <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                            <div
                              className={`max-w-[86%] rounded-[1.4rem] px-4 py-3 text-sm leading-relaxed shadow-[0_18px_40px_-28px_rgba(0,0,0,0.82)] sm:max-w-[72%] ${
                                isOwnMessage
                                  ? 'bg-cyan-200 text-[#041018]'
                                  : 'border border-cyan-300/14 bg-[#08111a]/88 text-cyan-50'
                              }`}
                            >
                              <p className="whitespace-pre-wrap break-words">{message.text}</p>
                              <p className={`mt-2 text-[11px] font-semibold ${isOwnMessage ? 'text-[#083246]/72' : 'text-cyan-50/58'}`}>
                                {formatConversationTime(message.createdAt)}
                              </p>
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                ) : null}

                {messagesError ? (
                  <p className="mt-3 rounded-xl border border-rose-200/38 bg-rose-300/16 px-3 py-2 text-sm font-semibold text-rose-100">
                    {messagesError}
                  </p>
                ) : null}
              </div>

              <form onSubmit={handleSendMessage} className="border-t border-cyan-300/12 px-4 py-4 sm:px-5">
                <div className="flex items-end gap-3">
                  <div className="min-w-0 flex-1">
                    <label className="sr-only" htmlFor="chat-draft">Type a message</label>
                    <textarea
                      name="chat_draft"
                      id="chat-draft"
                      rows="1"
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder="Ask about condition, edition, or pickup area"
                      className="lux-textarea min-h-[56px] resize-none text-sm font-medium"
                      maxLength={800}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSending || !draft.trim()}
                    className="btn-primary inline-flex min-h-[56px] min-w-[56px] items-center justify-center rounded-xl px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label="Send message"
                  >
                    {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
                {sendError ? (
                  <p className="mt-3 rounded-xl border border-rose-200/38 bg-rose-300/16 px-3 py-2 text-sm font-semibold text-rose-100">
                    {sendError}
                  </p>
                ) : null}
              </form>
            </>
          ) : (
            <div className="flex h-full min-h-[360px] flex-col items-center justify-center px-6 text-center">
              <MessageCircle className="h-8 w-8 text-cyan-100/80" />
              <p className="mt-4 text-sm font-semibold text-white">Choose a conversation</p>
              <p className="mt-2 max-w-sm text-xs leading-relaxed text-cyan-50/68">
                Pick any listing chat from the left, or start from a listing page using Chat with Seller.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
