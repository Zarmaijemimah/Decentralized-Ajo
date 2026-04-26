import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, extractToken } from '@/lib/auth';
import { validateBody, applyRateLimit } from '@/lib/api-helpers';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { z } from 'zod';

const ReorderMembersSchema = z.object({
  memberIds: z.array(z.string()).min(1, 'Member IDs are required'),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = extractToken(request.headers.get('authorization'));
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });

  const rateLimited = applyRateLimit(request, RATE_LIMITS.api, 'circles:admin:reorder', payload.userId);
  if (rateLimited) return rateLimited;

  const validated = await validateBody(request, ReorderMembersSchema);
  if (validated.error) return validated.error;
  const { memberIds } = validated.data as z.infer<typeof ReorderMembersSchema>;

  try {
    const { id: circleId } = await params;

    // Verify circle exists and user is organizer
    const circle = await prisma.circle.findUnique({
      where: { id: circleId },
    });

    if (!circle) {
      return NextResponse.json({ error: 'Circle not found' }, { status: 404 });
    }

    if (circle.organizerId !== payload.userId) {
      return NextResponse.json({ error: 'Only the organizer can reorder members' }, { status: 403 });
    }

    // Use a transaction to update rotation orders
    // We update them to temporary negative values first to avoid unique constraint violations
    // then to their final values.
    await prisma.$transaction(async (tx) => {
      // First, set all members to temporary negative rotation orders
      for (let i = 0; i < memberIds.length; i++) {
        await tx.circleMember.update({
          where: { 
            id: memberIds[i],
            circleId: circleId // Security check
          },
          data: { rotationOrder: -(i + 1) },
        });
      }

      // Then, set them to their final positive rotation orders
      for (let i = 0; i < memberIds.length; i++) {
        await tx.circleMember.update({
          where: { id: memberIds[i] },
          data: { rotationOrder: i + 1 },
        });
      }
    });

    return NextResponse.json(
      { success: true, message: 'Members reordered successfully' },
      { status: 200 }
    );
  } catch (err) {
    console.error('Reorder members error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
