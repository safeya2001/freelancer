import clsx from 'clsx';

const colorMap: Record<string, string> = {
  active: 'badge-green', open: 'badge-green', completed: 'badge-green', approved: 'badge-green', verified: 'badge-green',
  pending: 'badge-yellow', in_progress: 'badge-yellow', submitted: 'badge-yellow', pending_verification: 'badge-yellow',
  cancelled: 'badge-red', rejected: 'badge-red', banned: 'badge-red', disputed: 'badge-red',
  delivered: 'badge-blue', accepted: 'badge-blue',
  paused: 'badge-gray', closed: 'badge-gray', withdrawn: 'badge-gray',
};

export default function Badge({ status, label }: { status: string; label?: string }) {
  return (
    <span className={clsx(colorMap[status] || 'badge-gray')}>
      {label || status.replace(/_/g, ' ')}
    </span>
  );
}
