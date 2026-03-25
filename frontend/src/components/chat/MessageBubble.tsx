import { Message } from '@/types';
import { timeAgo } from '@/utils/date';
import { useRouter } from 'next/router';
import clsx from 'clsx';

interface Props {
  message: Message;
  isOwn: boolean;
}

export default function MessageBubble({ message, isOwn }: Props) {
  const { locale } = useRouter();

  return (
    <div className={clsx('flex gap-2 mb-1', isOwn ? 'flex-row-reverse' : 'flex-row')}>
      {!isOwn && (
        <div className="w-7 h-7 rounded-full bg-primary-200 shrink-0 mt-auto" />
      )}
      <div className={clsx('max-w-xs lg:max-w-md')}>
        {message.body && (
          <div className={clsx('px-4 py-2.5 text-sm leading-relaxed', isOwn ? 'bubble-self' : 'bubble-other')}>
            {message.body}
          </div>
        )}
        {message.file_urls && message.file_urls.length > 0 && message.file_urls.map((url, i) => {
          const name = message.file_names?.[i] || 'file';
          const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(name);
          return isImage
            ? <img key={i} src={url} alt={name} className="max-w-xs rounded-xl mt-1 cursor-pointer hover:opacity-90"
                onClick={() => window.open(url, '_blank')} />
            : <a key={i} href={url} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-xl text-sm text-primary-700 hover:bg-gray-200 mt-1">
                📎 {name}
              </a>;
        })}
        <p className={clsx('text-xs text-gray-400 mt-0.5 px-1', isOwn ? 'text-end' : 'text-start')}>
          {timeAgo(message.created_at, locale as string)}
        </p>
      </div>
    </div>
  );
}
