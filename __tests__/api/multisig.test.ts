import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createMocks } from 'node-mocks-http';
import { POST as withdrawPost, GET as withdrawGet } from '@/app/api/circles/[id]/withdraw/route';
import { POST as approvePost } from '@/app/api/circles/[id]/withdraw/[withdrawalId]/approve/route';
import { GET as multisigGet, PUT as multisigPut } from '@/app/api/circles/[id]/multisig/route';
import { prisma } from '@/lib/prisma';
import { signToken } from '@/lib/auth';
import { cleanupTestData, createTestUser, createTestCircle } from './db-helper';

describe('Multisig Withdrawal System', () => {
  let organizer: any;
  let member1: any;
  let member2: any;
  let approver1: any;
  let approver2: any;
  let circle: any;
  let organizerToken: string;
  let member1Token: string;
  let approver1Token: string;
  let approver2Token: string;

  beforeEach(async () => {
    await cleanupTestData();

    // Create test users
    organizer = await createTestUser('organizer@test.com');
    member1 = await createTestUser('member1@test.com');
    member2 = await createTestUser('member2@test.com');
    approver1 = await createTestUser('approver1@test.com');
    approver2 = await createTestUser('approver2@test.com');

    // Create tokens
    organizerToken = signToken({
      userId: organizer.id,
      email: organizer.email,
      type: 'access',
      scopes: ['user:base'],
    });
    member1Token = signToken({
      userId: member1.id,
      email: member1.email,
      type: 'access',
      scopes: ['user:base'],
    });
    approver1Token = signToken({
      userId: approver1.id,
      email: approver1.email,
      type: 'access',
      scopes: ['user:base'],
    });
    approver2Token = signToken({
      userId: approver2.id,
      email: approver2.email,
      type: 'access',
      scopes: ['user:base'],
    });

    // Create test circle
    circle = await createTestCircle(organizer.id);

    // Add members
    await prisma.circleMember.createMany({
      data: [
        {
          circleId: circle.id,
          userId: member1.id,
          rotationOrder: 1,
          totalContributed: 10000000, // 10M stroops
        },
        {
          circleId: circle.id,
          userId: member2.id,
          rotationOrder: 2,
          totalContributed: 5000000,
        },
        {
          circleId: circle.id,
          userId: approver1.id,
          rotationOrder: 3,
          totalContributed: 8000000,
        },
        {
          circleId: circle.id,
          userId: approver2.id,
          rotationOrder: 4,
          totalContributed: 8000000,
        },
      ],
    });
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  describe('Multisig Configuration', () => {
    it('should allow organizer to configure multisig', async () => {
      const { req, res } = createMocks({
        method: 'PUT',
        headers: {
          authorization: `Bearer ${organizerToken}`,
        },
        body: {
          multisigEnabled: true,
          multisigThreshold: 1000000, // 1M stroops
          requiredApprovals: 2,
          approvers: [approver1.id, approver2.id],
        },
      });

      await multisigPut(req as any, { params: { id: circle.id } });

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.multisigEnabled).toBe(true);
      expect(data.multisigThreshold).toBe(1000000);
      expect(data.requiredApprovals).toBe(2);
      expect(data.approvers).toHaveLength(2);
    });

    it('should prevent non-organizer from configuring multisig', async () => {
      const { req, res } = createMocks({
        method: 'PUT',
        headers: {
          authorization: `Bearer ${member1Token}`,
        },
        body: {
          multisigEnabled: true,
          multisigThreshold: 1000000,
          requiredApprovals: 2,
          approvers: [approver1.id, approver2.id],
        },
      });

      await multisigPut(req as any, { params: { id: circle.id } });

      expect(res._getStatusCode()).toBe(403);
    });

    it('should validate approvers are circle members', async () => {
      const nonMember = await createTestUser('nonmember@test.com');

      const { req, res } = createMocks({
        method: 'PUT',
        headers: {
          authorization: `Bearer ${organizerToken}`,
        },
        body: {
          multisigEnabled: true,
          multisigThreshold: 1000000,
          requiredApprovals: 2,
          approvers: [approver1.id, nonMember.id],
        },
      });

      await multisigPut(req as any, { params: { id: circle.id } });

      expect(res._getStatusCode()).toBe(400);
      const data = JSON.parse(res._getData());
      expect(data.error).toContain('not members');
    });

    it('should validate required approvals does not exceed approver count', async () => {
      const { req, res } = createMocks({
        method: 'PUT',
        headers: {
          authorization: `Bearer ${organizerToken}`,
        },
        body: {
          multisigEnabled: true,
          multisigThreshold: 1000000,
          requiredApprovals: 3,
          approvers: [approver1.id, approver2.id], // Only 2 approvers
        },
      });

      await multisigPut(req as any, { params: { id: circle.id } });

      expect(res._getStatusCode()).toBe(400);
      const data = JSON.parse(res._getData());
      expect(data.error).toContain('cannot exceed');
    });
  });

  describe('Withdrawal Requests', () => {
    beforeEach(async () => {
      // Configure multisig
      await prisma.circle.update({
        where: { id: circle.id },
        data: {
          multisigEnabled: true,
          multisigThreshold: 2000000, // 2M stroops
          requiredApprovals: 2,
          approvers: JSON.stringify([approver1.id, approver2.id]),
        },
      });
    });

    it('should create withdrawal without multisig for low amounts', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          authorization: `Bearer ${member1Token}`,
        },
        body: {
          amount: 1000000, // Below threshold
          reason: 'Small withdrawal',
        },
      });

      await withdrawPost(req as any, { params: { id: circle.id } });

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.requiresMultisig).toBe(false);
      expect(data.withdrawal.status).toBe('APPROVED');
    });

    it('should create withdrawal with multisig for high amounts', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          authorization: `Bearer ${member1Token}`,
        },
        body: {
          amount: 5000000, // Above threshold
          reason: 'Large withdrawal',
        },
      });

      await withdrawPost(req as any, { params: { id: circle.id } });

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.requiresMultisig).toBe(true);
      expect(data.requiredApprovals).toBe(2);
      expect(data.withdrawal.status).toBe('PENDING');
    });

    it('should prevent withdrawal exceeding balance', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          authorization: `Bearer ${member1Token}`,
        },
        body: {
          amount: 20000000, // Exceeds balance
          reason: 'Too much',
        },
      });

      await withdrawPost(req as any, { params: { id: circle.id } });

      expect(res._getStatusCode()).toBe(400);
      const data = JSON.parse(res._getData());
      expect(data.error).toContain('Insufficient balance');
    });

    it('should prevent multiple pending withdrawals', async () => {
      // Create first withdrawal
      await prisma.withdrawal.create({
        data: {
          circleId: circle.id,
          userId: member1.id,
          amount: 4500000,
          requestedAmount: 5000000,
          status: 'PENDING',
        },
      });

      // Try to create second withdrawal
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          authorization: `Bearer ${member1Token}`,
        },
        body: {
          amount: 1000000,
          reason: 'Another withdrawal',
        },
      });

      await withdrawPost(req as any, { params: { id: circle.id } });

      expect(res._getStatusCode()).toBe(400);
      const data = JSON.parse(res._getData());
      expect(data.error).toContain('pending withdrawal');
    });
  });

  describe('Withdrawal Approvals', () => {
    let withdrawal: any;

    beforeEach(async () => {
      // Configure multisig
      await prisma.circle.update({
        where: { id: circle.id },
        data: {
          multisigEnabled: true,
          multisigThreshold: 2000000,
          requiredApprovals: 2,
          approvers: JSON.stringify([approver1.id, approver2.id]),
        },
      });

      // Create pending withdrawal
      withdrawal = await prisma.withdrawal.create({
        data: {
          circleId: circle.id,
          userId: member1.id,
          amount: 4500000,
          requestedAmount: 5000000,
          status: 'PENDING',
        },
      });
    });

    it('should allow approver to approve withdrawal', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          authorization: `Bearer ${approver1Token}`,
        },
        body: {
          approved: true,
          comment: 'Looks good',
        },
      });

      await approvePost(req as any, {
        params: { id: circle.id, withdrawalId: withdrawal.id },
      });

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.approval.approved).toBe(true);
      expect(data.status.approvedCount).toBe(1);
      expect(data.status.isApproved).toBe(false); // Needs 2 approvals
    });

    it('should auto-approve withdrawal when threshold met', async () => {
      // First approval
      await prisma.withdrawalApproval.create({
        data: {
          withdrawalId: withdrawal.id,
          approverId: approver1.id,
          approved: true,
        },
      });

      // Second approval
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          authorization: `Bearer ${approver2Token}`,
        },
        body: {
          approved: true,
          comment: 'Approved',
        },
      });

      await approvePost(req as any, {
        params: { id: circle.id, withdrawalId: withdrawal.id },
      });

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.status.approvedCount).toBe(2);
      expect(data.status.isApproved).toBe(true);
      expect(data.withdrawal.status).toBe('APPROVED');
    });

    it('should prevent non-approver from approving', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          authorization: `Bearer ${member2Token}`,
        },
        body: {
          approved: true,
        },
      });

      await approvePost(req as any, {
        params: { id: circle.id, withdrawalId: withdrawal.id },
      });

      expect(res._getStatusCode()).toBe(403);
    });

    it('should prevent duplicate approvals', async () => {
      // First approval
      await prisma.withdrawalApproval.create({
        data: {
          withdrawalId: withdrawal.id,
          approverId: approver1.id,
          approved: true,
        },
      });

      // Try to approve again
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          authorization: `Bearer ${approver1Token}`,
        },
        body: {
          approved: true,
        },
      });

      await approvePost(req as any, {
        params: { id: circle.id, withdrawalId: withdrawal.id },
      });

      expect(res._getStatusCode()).toBe(400);
      const data = JSON.parse(res._getData());
      expect(data.error).toContain('already voted');
    });

    it('should allow organizer to approve as implicit approver', async () => {
      const organizerMember = await prisma.circleMember.create({
        data: {
          circleId: circle.id,
          userId: organizer.id,
          rotationOrder: 5,
        },
      });

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          authorization: `Bearer ${organizerToken}`,
        },
        body: {
          approved: true,
          comment: 'Organizer approval',
        },
      });

      await approvePost(req as any, {
        params: { id: circle.id, withdrawalId: withdrawal.id },
      });

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.approval.approved).toBe(true);
    });
  });

  describe('Withdrawal Listing', () => {
    beforeEach(async () => {
      await prisma.circle.update({
        where: { id: circle.id },
        data: {
          approvers: JSON.stringify([approver1.id, approver2.id]),
        },
      });
    });

    it('should show only own withdrawals to regular members', async () => {
      // Create withdrawals for different members
      await prisma.withdrawal.createMany({
        data: [
          {
            circleId: circle.id,
            userId: member1.id,
            amount: 1000000,
            requestedAmount: 1000000,
            status: 'PENDING',
          },
          {
            circleId: circle.id,
            userId: member2.id,
            amount: 2000000,
            requestedAmount: 2000000,
            status: 'PENDING',
          },
        ],
      });

      const { req, res } = createMocks({
        method: 'GET',
        headers: {
          authorization: `Bearer ${member1Token}`,
        },
      });

      await withdrawGet(req as any, { params: { id: circle.id } });

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.withdrawals).toHaveLength(1);
      expect(data.withdrawals[0].userId).toBe(member1.id);
    });

    it('should show all withdrawals to approvers', async () => {
      // Create withdrawals for different members
      await prisma.withdrawal.createMany({
        data: [
          {
            circleId: circle.id,
            userId: member1.id,
            amount: 1000000,
            requestedAmount: 1000000,
            status: 'PENDING',
          },
          {
            circleId: circle.id,
            userId: member2.id,
            amount: 2000000,
            requestedAmount: 2000000,
            status: 'PENDING',
          },
        ],
      });

      const { req, res } = createMocks({
        method: 'GET',
        headers: {
          authorization: `Bearer ${approver1Token}`,
        },
      });

      await withdrawGet(req as any, { params: { id: circle.id } });

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.withdrawals).toHaveLength(2);
    });
  });
});
