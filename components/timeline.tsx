'use client';

import * as React from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Banknote,
  CircleDashed,
  Clock,
  UserMinus,
  UserPlus,
  Vote,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn, formatAmount, formatDate } from '@/lib/utils';

export type TimelineEventType =
  | 'contribution'
  | 'withdrawal'
  | 'payout'
  | 'member_joined'
  | 'member_left'
  | 'proposal'
  | 'circle_dissolved'
  | 'general';

export type TimelineEventStatus = 'pending' | 'completed' | 'failed' | 'cancelled';

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  title: string;
  description?: string;
  timestamp: Date | string | number;
  amount?: number;
  asset?: string;
  status?: TimelineEventStatus;
}

export interface TimelineProps extends React.ComponentProps<'ol'> {
  events: TimelineEvent[];
  /** Sort order by timestamp. Defaults to "desc" (most recent first). */
  order?: 'asc' | 'desc';
  emptyMessage?: string;
}

const ICONS: Record<TimelineEventType, LucideIcon> = {
  contribution: ArrowDownToLine,
  withdrawal: ArrowUpFromLine,
  payout: Banknote,
  member_joined: UserPlus,
  member_left: UserMinus,
  proposal: Vote,
  circle_dissolved: XCircle,
  general: CircleDashed,
};

const ICON_TONE: Record<TimelineEventType, string> = {
  contribution: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  withdrawal: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  payout: 'bg-primary/10 text-primary',
  member_joined: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  member_left: 'bg-muted text-muted-foreground',
  proposal: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  circle_dissolved: 'bg-destructive/10 text-destructive',
  general: 'bg-muted text-muted-foreground',
};

const STATUS_VARIANT: Record<TimelineEventStatus, React.ComponentProps<typeof Badge>['variant']> = {
  pending: 'secondary',
  completed: 'default',
  failed: 'destructive',
  cancelled: 'outline',
};

function toDate(value: TimelineEvent['timestamp']): Date {
  return value instanceof Date ? value : new Date(value);
}

export const Timeline: React.FC<TimelineProps> = ({
  events,
  order = 'desc',
  emptyMessage = 'No activity yet.',
  className,
  ...rest
}) => {
  const sorted = React.useMemo(() => {
    const copy = [...events];
    copy.sort((a, b) => {
      const diff = toDate(a.timestamp).getTime() - toDate(b.timestamp).getTime();
      return order === 'asc' ? diff : -diff;
    });
    return copy;
  }, [events, order]);

  if (sorted.length === 0) {
    return (
      <div
        role="status"
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-md border border-dashed py-10 text-sm text-muted-foreground',
          className,
        )}
      >
        <Clock size={20} aria-hidden="true" />
        <span>{emptyMessage}</span>
      </div>
    );
  }

  return (
    <ol
      role="list"
      aria-label="Activity timeline"
      className={cn('relative space-y-6', className)}
      {...rest}
    >
      {sorted.map((event, index) => {
        const Icon = ICONS[event.type];
        const date = toDate(event.timestamp);
        const isLast = index === sorted.length - 1;

        return (
          <li key={event.id} className="relative flex gap-4">
            {!isLast && (
              <span
                aria-hidden="true"
                className="absolute left-5 top-10 h-[calc(100%+0.5rem)] w-px bg-border"
              />
            )}
            <div
              className={cn(
                'relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-4 ring-background',
                ICON_TONE[event.type],
              )}
            >
              <Icon size={18} aria-hidden="true" />
            </div>

            <div className="flex-1 pb-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground">{event.title}</p>
                  {event.status && (
                    <Badge variant={STATUS_VARIANT[event.status]} className="capitalize">
                      {event.status}
                    </Badge>
                  )}
                </div>
                <time
                  dateTime={date.toISOString()}
                  title={formatDate(date)}
                  className="text-xs text-muted-foreground"
                >
                  {formatDistanceToNow(date, { addSuffix: true })}
                </time>
              </div>

              {event.description && (
                <p className="mt-1 text-sm text-muted-foreground">{event.description}</p>
              )}

              {typeof event.amount === 'number' && (
                <p className="mt-1 font-mono text-sm font-semibold text-foreground">
                  {formatAmount(event.amount, event.asset ?? 'XLM')} {event.asset ?? 'XLM'}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
};

export default Timeline;
