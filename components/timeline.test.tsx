import { render, screen, within } from '@testing-library/react';
import { Timeline, type TimelineEvent } from './timeline';

const baseEvents: TimelineEvent[] = [
  {
    id: '1',
    type: 'contribution',
    title: 'Contribution received',
    description: 'Round 2 contribution to Family Circle',
    timestamp: new Date('2026-04-20T10:00:00Z'),
    amount: 50,
    asset: 'XLM',
    status: 'completed',
  },
  {
    id: '2',
    type: 'member_joined',
    title: 'Alice joined Family Circle',
    timestamp: new Date('2026-04-22T09:30:00Z'),
  },
  {
    id: '3',
    type: 'payout',
    title: 'Payout disbursed',
    timestamp: new Date('2026-04-25T14:15:00Z'),
    amount: 250,
    asset: 'XLM',
    status: 'pending',
  },
];

describe('Timeline', () => {
  it('renders an empty state when no events are provided', () => {
    render(<Timeline events={[]} emptyMessage="Nothing here yet" />);
    expect(screen.getByRole('status')).toHaveTextContent('Nothing here yet');
  });

  it('renders one list item per event', () => {
    render(<Timeline events={baseEvents} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('orders events most-recent-first by default', () => {
    render(<Timeline events={baseEvents} />);
    const items = screen.getAllByRole('listitem');
    expect(within(items[0]).getByText('Payout disbursed')).toBeInTheDocument();
    expect(within(items[1]).getByText(/Alice joined/)).toBeInTheDocument();
    expect(within(items[2]).getByText('Contribution received')).toBeInTheDocument();
  });

  it('orders events oldest-first when order="asc"', () => {
    render(<Timeline events={baseEvents} order="asc" />);
    const items = screen.getAllByRole('listitem');
    expect(within(items[0]).getByText('Contribution received')).toBeInTheDocument();
    expect(within(items[2]).getByText('Payout disbursed')).toBeInTheDocument();
  });

  it('renders status badges and amounts when provided', () => {
    render(<Timeline events={baseEvents} />);
    expect(screen.getByText('completed')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
    expect(screen.getByText(/50\.00 XLM/)).toBeInTheDocument();
    expect(screen.getByText(/250\.00 XLM/)).toBeInTheDocument();
  });

  it('emits machine-readable timestamps via <time dateTime>', () => {
    render(<Timeline events={[baseEvents[0]]} />);
    const time = screen.getByRole('listitem').querySelector('time');
    expect(time).not.toBeNull();
    expect(time?.getAttribute('datetime')).toBe('2026-04-20T10:00:00.000Z');
  });
});
