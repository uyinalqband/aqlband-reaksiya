import { useState } from 'react';
import { searchUserByUsername } from '@/services/userService';
import { sendFriendRequest } from '@/services/friendService';
import { Button } from '@/components/ui/Button';

interface AddFriendBarProps {
  myUserId: string;
  onRequestSent: () => void;
}

export function AddFriendBar({ myUserId, onRequestSent }: AddFriendBarProps) {
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'success'>('idle');
  const [message, setMessage] = useState('');

  const handleSend = async () => {
    const trimmed = username.trim();
    if (!trimmed) return;

    setStatus('loading');
    setMessage('');
    try {
      const target = await searchUserByUsername(trimmed);
      if (!target) {
        setStatus('error');
        setMessage("Bu nik bilan foydalanuvchi topilmadi. U ilovani hali ochmagan bo'lishi mumkin.");
        return;
      }
      await sendFriendRequest(myUserId, target.id);
      setStatus('success');
      setMessage(`${target.first_name}ga so'rov yuborildi.`);
      setUsername('');
      onRequestSent();
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : "Nimadir xato ketdi.");
    }
  };

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void handleSend()}
          placeholder="@foydalanuvchi_nomi"
          className="h-11 flex-1 rounded-xl border border-ink-600 bg-ink-800 px-3.5 text-sm text-mist-100 placeholder:text-mist-700 focus:border-violet-500 focus:outline-none"
        />
        <Button size="md" onClick={() => void handleSend()} disabled={status === 'loading' || !username.trim()}>
          Qo'shish
        </Button>
      </div>
      {message && (
        <p className={`mt-2 text-xs ${status === 'error' ? 'text-signal-early' : 'text-signal-go'}`}>{message}</p>
      )}
    </div>
  );
}
