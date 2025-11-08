import { useEffect, useRef, useState } from 'react';
import { Account, Message, Transaction } from '../types';
import { useChat } from '../hooks/useChat';
import SuggestedPrompts from './SuggestedPrompts';

interface ChatSidebarProps {
  accounts: Account[];
  transactions: Transaction[];
}

export default function ChatSidebar({ accounts, transactions }: ChatSidebarProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const { mutateAsync, isPending } = useChat();
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const sendMessage = async (text: string) => {
    const newUserMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date()
    };
    setMessages((prev) => [...prev, newUserMessage]);
    const response = await mutateAsync({ message: text, transactions, accounts });
    const assistantMessage: Message = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: response || 'Sorry, I could not generate a response.',
      timestamp: new Date()
    };
    setMessages((prev) => [...prev, assistantMessage]);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const text = input.trim();
    setInput('');
    await sendMessage(text);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isPending]);

  return (
    <div className="w-full lg:w-[400px] flex flex-col h-full">
      <div className="card flex-1 flex flex-col h-[70vh] lg:h-[calc(100vh-4rem)]">
        <h3 className="text-lg font-semibold mb-2">AI Financial Advisor</h3>
        {messages.length === 0 && (
          <div className="mb-3">
            <SuggestedPrompts onSelect={(p) => sendMessage(p)} />
          </div>
        )}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {messages.map((m) => (
            <div key={m.id} className={`max-w-[85%] ${m.role === 'user' ? 'ml-auto' : ''}`}>
              <div className={`${m.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100'} rounded-lg px-3 py-2`}>
                <div className="whitespace-pre-wrap text-sm">{m.content}</div>
              </div>
              <div className="text-xs text-slate-400 mt-1">{m.timestamp.toLocaleTimeString()}</div>
            </div>
          ))}
          {isPending && (
            <div className="max-w-[85%]">
              <div className="bg-gray-100 rounded-lg px-3 py-2 text-sm text-slate-500">Typing…</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <form onSubmit={onSubmit} className="mt-3 flex items-center gap-2">
          <input
            className="input flex-1"
            placeholder="Ask about your spending..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button className="btn-primary" type="submit" disabled={isPending}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}


