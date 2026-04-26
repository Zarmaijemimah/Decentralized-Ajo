'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatXLM } from '@/lib/utils';
import { Crown, CheckCircle2, GripVertical, Loader2 } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { authenticatedFetch } from '@/lib/auth-client';
import { toast } from 'sonner';

interface Member {
  id: string;
  userId: string;
  rotationOrder: number;
  status: string;
  totalContributed: number;
  totalWithdrawn: number;
  hasReceivedPayout: boolean;
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    walletAddress?: string;
  };
}

interface MemberTableProps {
  members: Member[];
  organizerId: string;
  currentRound: number;
  circleId: string;
  isOrganizer: boolean;
  onUpdate?: () => Promise<void>;
}

interface SortableRowProps {
  member: Member;
  isOrganizer: boolean;
  isNextInLine: boolean;
  displayName: string;
  canDrag: boolean;
}

function SortableTableRow({ member, isOrganizer, isNextInLine, displayName, canDrag }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: member.id, disabled: !canDrag });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
    position: 'relative' as const,
    backgroundColor: isDragging ? 'var(--muted)' : undefined,
  };

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell className="w-[50px]">
        {canDrag && (
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <div>
            <p className="font-medium">{displayName}</p>
            {member.user.walletAddress && (
              <p className="text-xs text-muted-foreground font-mono">
                {member.user.walletAddress.slice(0, 8)}...
                {member.user.walletAddress.slice(-6)}
              </p>
            )}
          </div>
          {isOrganizer && (
            <Crown className="h-4 w-4 text-yellow-500" aria-label="Organizer" />
          )}
        </div>
      </TableCell>
      <TableCell className="text-center">
        <div className="flex items-center justify-center gap-1">
          <span className="font-semibold">#{member.rotationOrder}</span>
          {isNextInLine && (
            <Badge variant="default" className="ml-2">
              Next in Line
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right font-mono">
        {formatXLM(member.totalContributed)} XLM
      </TableCell>
      <TableCell className="text-right font-mono">
        {formatXLM(member.totalWithdrawn)} XLM
      </TableCell>
      <TableCell className="text-center">
        <div className="flex items-center justify-center gap-2">
          <Badge
            variant={member.status === 'ACTIVE' ? 'default' : 'secondary'}
          >
            {member.status}
          </Badge>
          {member.hasReceivedPayout && (
            <CheckCircle2 className="h-4 w-4 text-green-500" aria-label="Received Payout" />
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

export function MemberTable({ 
  members, 
  organizerId, 
  currentRound, 
  circleId, 
  isOrganizer,
  onUpdate 
}: MemberTableProps) {
  const [localMembers, setLocalMembers] = useState<Member[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    setLocalMembers([...members].sort((a, b) => a.rotationOrder - b.rotationOrder));
  }, [members]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = localMembers.findIndex((m) => m.id === active.id);
      const newIndex = localMembers.findIndex((m) => m.id === over.id);

      const reorderedMembers = arrayMove(localMembers, oldIndex, newIndex);
      
      // Optimistically update local state with new rotation orders
      const updatedWithOrders = reorderedMembers.map((m, index) => ({
        ...m,
        rotationOrder: index + 1,
      }));
      
      setLocalMembers(updatedWithOrders);
      setIsUpdating(true);

      try {
        const response = await authenticatedFetch(`/api/circles/${circleId}/admin/reorder-members`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberIds: updatedWithOrders.map(m => m.id) }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to reorder members');
        }

        toast.success('Rotation order updated');
        if (onUpdate) await onUpdate();
      } catch (error: any) {
        toast.error(error.message || 'Failed to update order');
        // Rollback on error
        setLocalMembers([...members].sort((a, b) => a.rotationOrder - b.rotationOrder));
      } finally {
        setIsUpdating(false);
      }
    }
  };

  const nextInLine = localMembers.find((m) => !m.hasReceivedPayout);

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Circle Members</CardTitle>
            <CardDescription>
              {members.length} active members • Next payout: {nextInLine ? `#${nextInLine.rotationOrder}` : 'All paid'}
            </CardDescription>
          </div>
          {isUpdating && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </CardHeader>
      <CardContent>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>Member</TableHead>
                <TableHead className="text-center">Rotation</TableHead>
                <TableHead className="text-right">Contributed</TableHead>
                <TableHead className="text-right">Withdrawn</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <SortableContext
                items={localMembers.map((m) => m.id)}
                strategy={verticalListSortingStrategy}
              >
                {localMembers.map((member) => {
                  const isMemberOrganizer = member.userId === organizerId;
                  const isNextInLine = nextInLine?.id === member.id;
                  const displayName =
                    member.user.firstName && member.user.lastName
                      ? `${member.user.firstName} ${member.user.lastName}`
                      : member.user.email;

                  return (
                    <SortableTableRow
                      key={member.id}
                      member={member}
                      isOrganizer={isMemberOrganizer}
                      isNextInLine={isNextInLine}
                      displayName={displayName}
                      canDrag={isOrganizer}
                    />
                  );
                })}
              </SortableContext>
            </TableBody>
          </Table>
        </DndContext>
      </CardContent>
    </Card>
  );
}
