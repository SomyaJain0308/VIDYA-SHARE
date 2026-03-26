import { useEffect, useState } from 'react';
import { getUserConversations, listenToMessages, markMessagesAsSeen } from '../utils/chat';

export function useUserConversations(userId) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userId) {
      setConversations([]);
      setLoading(false);
      setError('');
      return undefined;
    }

    let active = true;
    setLoading(true);
    setError('');

    const unsubscribe = getUserConversations(
      userId,
      (nextConversations) => {
        if (!active) return;
        setConversations(nextConversations);
        setError('');
        setLoading(false);
      },
      (nextError) => {
        if (!active) return;
        const nextMessage = nextError?.message || 'Could not load conversations right now.';
        const isPermissionError =
          nextError?.code === 'permission-denied' || /insufficient permissions/i.test(nextMessage);
        if (isPermissionError) {
          setConversations([]);
        }
        setError(nextMessage);
        setLoading(false);
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [userId]);

  return { conversations, loading, error };
}

export function useConversationMessages(conversationId, userId) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(Boolean(conversationId));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      setError('');
      return undefined;
    }

    let active = true;
    setLoading(true);
    setError('');

    const unsubscribe = listenToMessages(
      conversationId,
      (nextMessages) => {
        if (!active) return;
        setMessages(nextMessages);
        setLoading(false);
        if (userId) {
          markMessagesAsSeen(conversationId, userId).catch((markError) => {
            console.error('Failed to mark chat messages as seen', markError);
          });
        }
      },
      (nextError) => {
        if (!active) return;
        setError(nextError?.message || 'Could not load messages right now.');
        setLoading(false);
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [conversationId, userId]);

  return { messages, loading, error };
}
