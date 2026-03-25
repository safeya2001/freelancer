import { StarIcon } from '@heroicons/react/24/solid';
import { StarIcon as StarOutline } from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface Props {
  rating: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  showNumber?: boolean;
  count?: number;
}

export default function RatingStars({ rating, max = 5, size = 'sm', showNumber = true, count }: Props) {
  const sizes = { sm: 'w-3.5 h-3.5', md: 'w-5 h-5', lg: 'w-6 h-6' };
  // Coerce to number — postgres returns NUMERIC fields as strings
  const r = Number(rating) || 0;

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: max }).map((_, i) => (
        i < Math.floor(r)
          ? <StarIcon key={i} className={clsx(sizes[size], 'text-yellow-400')} />
          : <StarOutline key={i} className={clsx(sizes[size], 'text-gray-300')} />
      ))}
      {showNumber && (
        <span className="text-xs text-gray-500 ms-1">
          {r.toFixed(1)}{count !== undefined && ` (${count})`}
        </span>
      )}
    </div>
  );
}
