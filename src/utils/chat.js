import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../firebase';

const CONVERSATION_PAGE_SIZE = 30;
const MESSAGE_PAGE_SIZE = 50;
const UNREAD_COUNT_SCAN_LIMIT = 25;

const normalizeMessageText = (value) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, 800);

const buildConversationId = (listingId, buyerId, sellerId) => `${listingId}_${buyerId}_${sellerId}`;

const buildConversationPreview = (snapshot) => {
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    participants: Array.isArray(data.participants) ? data.participants : [],
    listingId: data.listingId || '',
    listingTitle: data.listingTitle || 'Listing',
    lastMessage: data.lastMessage || '',
    lastMessageAt: data.lastMessageAt || null,
    lastMessageSenderId: data.lastMessageSenderId || '',
  };
};

const buildMessageModel = (snapshot) => {
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    clientMessageId: data.clientMessageId || snapshot.id,
    senderId: data.senderId || '',
    text: data.text || '',
    createdAt: data.createdAt || null,
    seenBy: Array.isArray(data.seenBy) ? data.seenBy : [],
  };
};

const fetchListingTitle = async (transaction, listingId) => {
  const publicRef = doc(db, 'publicListings', listingId);
  const publicSnapshot = await transaction.get(publicRef);
  if (publicSnapshot.exists()) return publicSnapshot.data();

  return null;
};

const getUnreadCount = async (conversationId, userId, lastMessageSenderId) => {
  if (!conversationId || !userId || lastMessageSenderId === userId) return 0;

  const messagesQuery = query(
    collection(db, 'conversations', conversationId, 'messages'),
    orderBy('createdAt', 'desc'),
    orderBy('clientMessageId', 'desc'),
    limit(UNREAD_COUNT_SCAN_LIMIT)
  );
  const snapshot = await getDocs(messagesQuery);

  let unreadCount = 0;
  snapshot.forEach((messageDoc) => {
    const data = messageDoc.data() || {};
    const seenBy = Array.isArray(data.seenBy) ? data.seenBy : [];
    if (data.senderId !== userId && !seenBy.includes(userId)) {
      unreadCount += 1;
    }
  });

  return unreadCount;
};

export const getOrCreateConversation = async (listingId, buyerId, sellerId) => {
  if (!listingId || !buyerId || !sellerId) throw new Error('Missing conversation details.');
  if (buyerId === sellerId) throw new Error('You cannot chat on your own listing.');

  const conversationId = buildConversationId(listingId, buyerId, sellerId);
  const conversationRef = doc(db, 'conversations', conversationId);

  await runTransaction(db, async (transaction) => {
    const conversationSnapshot = await transaction.get(conversationRef);
    if (conversationSnapshot.exists()) return;

    const listingData = await fetchListingTitle(transaction, listingId);
    if (!listingData) {
      throw new Error('This listing is no longer available for chat.');
    }
    if (listingData.sellerId !== sellerId) {
      throw new Error('Seller details do not match this listing.');
    }

    transaction.set(conversationRef, {
      participants: [buyerId, sellerId],
      listingId,
      listingTitle: listingData.title || 'Listing',
      lastMessage: '',
      lastMessageAt: serverTimestamp(),
      lastMessageSenderId: buyerId,
    });
  });

  return conversationId;
};

export const sendMessage = async (conversationId, text) => {
  const currentUserId = auth.currentUser?.uid || '';
  const cleanText = normalizeMessageText(text);
  if (!conversationId) throw new Error('Conversation missing.');
  if (!currentUserId) throw new Error('Please sign in to chat.');
  if (!cleanText) throw new Error('Message cannot be empty.');

  const conversationRef = doc(db, 'conversations', conversationId);
  const conversationSnapshot = await getDoc(conversationRef);
  if (!conversationSnapshot.exists()) throw new Error('Conversation not found.');

  const conversationData = conversationSnapshot.data() || {};
  const participants = Array.isArray(conversationData.participants) ? conversationData.participants : [];
  if (!participants.includes(currentUserId)) throw new Error('You cannot send a message in this conversation.');

  const messageRef = doc(collection(db, 'conversations', conversationId, 'messages'));
  const batch = writeBatch(db);

  batch.set(messageRef, {
    clientMessageId: messageRef.id,
    senderId: currentUserId,
    text: cleanText,
    createdAt: serverTimestamp(),
    seenBy: [currentUserId],
  });
  batch.update(conversationRef, {
    lastMessage: cleanText.slice(0, 240),
    lastMessageAt: serverTimestamp(),
    lastMessageSenderId: currentUserId,
  });

  await batch.commit();
};

export const listenToMessages = (conversationId, onUpdate, onError) => {
  if (!conversationId) return () => {};

  const messagesQuery = query(
    collection(db, 'conversations', conversationId, 'messages'),
    orderBy('createdAt', 'desc'),
    orderBy('clientMessageId', 'desc'),
    limit(MESSAGE_PAGE_SIZE)
  );

  return onSnapshot(
    messagesQuery,
    (snapshot) => {
      const nextMessages = snapshot.docs.map(buildMessageModel).reverse();
      if (typeof onUpdate === 'function') onUpdate(nextMessages);
    },
    (error) => {
      console.error('Chat message listener failed', error);
      if (typeof onError === 'function') onError(error);
    }
  );
};

export const getUserConversations = (userId, onUpdate, onError) => {
  if (!userId) return () => {};

  const conversationsQuery = query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', userId),
    orderBy('lastMessageAt', 'desc'),
    limit(CONVERSATION_PAGE_SIZE)
  );

  return onSnapshot(
    conversationsQuery,
    async (snapshot) => {
      try {
        const baseConversations = snapshot.docs.map(buildConversationPreview);
        const enrichedConversations = await Promise.all(
          baseConversations.map(async (conversation) => {
            try {
              return {
                ...conversation,
                unreadCount: await getUnreadCount(conversation.id, userId, conversation.lastMessageSenderId),
              };
            } catch (error) {
              console.error('Unread count load failed', error);
              return {
                ...conversation,
                unreadCount: 0,
              };
            }
          })
        );

        if (typeof onUpdate === 'function') onUpdate(enrichedConversations);
      } catch (error) {
        console.error('Conversation preview load failed', error);
        if (typeof onError === 'function') onError(error);
      }
    },
    (error) => {
      console.error('Conversation listener failed', error);
      if (typeof onError === 'function') onError(error);
    }
  );
};

export const markMessagesAsSeen = async (conversationId, userId) => {
  if (!conversationId || !userId) return;

  const messagesQuery = query(
    collection(db, 'conversations', conversationId, 'messages'),
    orderBy('createdAt', 'desc'),
    orderBy('clientMessageId', 'desc'),
    limit(MESSAGE_PAGE_SIZE)
  );
  const snapshot = await getDocs(messagesQuery);

  const unseenMessages = snapshot.docs.filter((messageDoc) => {
    const data = messageDoc.data() || {};
    const seenBy = Array.isArray(data.seenBy) ? data.seenBy : [];
    return data.senderId !== userId && !seenBy.includes(userId);
  });

  if (unseenMessages.length === 0) return;

  const batch = writeBatch(db);
  unseenMessages.forEach((messageDoc) => {
    batch.update(messageDoc.ref, {
      seenBy: arrayUnion(userId),
    });
  });
  await batch.commit();
};
