import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'next-i18next';
import { PaperAirplaneIcon, PaperClipIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { chatApi, uploadsApi } from '@/services/api';
import { Message } from '@/types';
import { useSocket } from '@/contexts/SocketContext';
import { useAuth } from '@/contexts/AuthContext';
import MessageBubble from './MessageBubble';

interface Props {
  roomId: string;
  otherUserId?: string;
  header?: React.ReactNode; // optional context header (project title, etc.)
}

export default function ChatRoom({ roomId, otherUserId, header }: Props) {
  const { t } = useTranslation('common');
  const { socket } = useSocket();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    chatApi.messages(roomId).then((r) => setMessages(r.data.data));
  }, [roomId]);

  useEffect(() => {
    if (!socket || !roomId) return;
    socket.emit('join_room', { room_id: roomId });
    socket.emit('mark_read', { room_id: roomId });

    socket.on('new_message', (msg: Message) => {
      setMessages((prev) => {
        // Remove optimistic placeholder from same sender with same body
        const filtered = prev.filter(
          (m) => !(m.id.startsWith('temp-') && m.sender_id === msg.sender_id && m.body === msg.body),
        );
        // Avoid duplicate if server echoes an id we already have
        if (filtered.some((m) => m.id === msg.id)) return filtered;
        return [...filtered, msg];
      });
      socket.emit('mark_read', { room_id: roomId });
    });
    socket.on('typing', ({ userId }: { userId: string }) => {
      if (userId !== user?.id) setOtherTyping(true);
    });
    socket.on('stop_typing', ({ userId }: { userId: string }) => {
      if (userId !== user?.id) setOtherTyping(false);
    });

    return () => { socket.off('new_message'); socket.off('typing'); socket.off('stop_typing'); };
  }, [socket, roomId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, otherTyping]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInput(e.target.value);
    if (!typing) {
      setTyping(true);
      socket?.emit('typing', { room_id: roomId });
    }
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      setTyping(false);
      socket?.emit('stop_typing', { room_id: roomId });
    }, 1500);
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;

    if (!socket?.connected) {
      toast.error('Reconnecting to chat, please try again in a moment.');
      return;
    }

    const body = input.trim();
    const tempId = `temp-${Date.now()}`;
    setInput('');
    setSending(true);
    socket.emit('stop_typing', { room_id: roomId });
    setTyping(false);

    // Optimistic update — show message immediately
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        room_id: roomId,
        sender_id: user!.id,
        body,
        created_at: new Date().toISOString(),
        read_by: [],
      } as Message,
    ]);

    socket.emit('send_message', { room_id: roomId, body });
    setSending(false);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await uploadsApi.single(file);
    const { url, original_name } = res.data.data;
    socket?.emit('send_message', { room_id: roomId, file_urls: [url], file_names: [original_name] });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Optional context header */}
      {header && (
        <div className="border-b border-gray-100 px-4 py-2.5 bg-gray-50 shrink-0">
          {header}
        </div>
      )}
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {messages.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">{t('chat.no_messages')}</p>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} isOwn={msg.sender_id === user?.id} />
        ))}
        {otherTyping && (
          <div className="flex items-center gap-2 ps-2">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span key={i} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
            <span className="text-xs text-gray-400">{t('chat.typing')}</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 p-3">
        <form onSubmit={sendMessage} className="flex items-center gap-2">
          <label className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer text-gray-500">
            <PaperClipIcon className="w-5 h-5" />
            <input type="file" className="sr-only" onChange={handleFileUpload} />
          </label>
          <input value={input} onChange={handleInputChange}
            placeholder={t('chat.type_message')}
            className="flex-1 px-4 py-2.5 rounded-xl bg-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:bg-white transition" />
          <button type="submit" disabled={!input.trim() || sending}
            className="p-2.5 bg-primary-700 hover:bg-primary-800 text-white rounded-xl transition disabled:opacity-50">
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
