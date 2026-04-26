import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { prisma } from '@/lib/prisma';
import { generateToken } from '@/lib/auth';
import { CircleCategory } from '@prisma/client';

/**
 * Integration Tests for Circle Category Filtering API
 * 
 * Tests the GET /api/circles?category=<CATEGORY> endpoint
 * 
 * Coverage:
 * - Category filtering with valid categories
 * - No category parameter (returns all circles)
 * - Invalid category parameter (returns 400)
 * - Empty category parameter (returns all circles)
 * - Case-insensitive category matching
 * - Empty results (returns empty array with 200)
 * - Multiple circles in different categories
 * - User authorization and circle membership filtering
 */

describe('Circle Category Filtering API', () => {
  let testUser1: any;
  let testUser2: any;
  let authToken1: string;
  let authToken2: string;
  
  let educationCircle1: any;
  let educationCircle2: any;
  let medicalCircle: any;
  let businessCircle: any;
  let generalCircle: any;

  beforeAll(async () => {
    // Create test users
    testUser1 = await prisma.user.create({
      data: {
        email: 'testuser1@example.com',
        password: 'hashedpassword123',
        firstName: 'Test',
        lastName: 'User1',
        verified: true,
      },
    });

    testUser2 = await prisma.user.create({
      data: {
        email: 'testuser2@example.com',
        password: 'hashedpassword456',
        firstName: 'Test',
        lastName: 'User2',
        verified: true,
      },
    });

    // Generate auth tokens
    authToken1 = generateToken({ userId: testUser1.id, email: testUser1.email });
    authToken2 = generateToken({ userId: testUser2.id, email: testUser2.email });

    // Create test circles with different categories
    educationCircle1 = await prisma.circle.create({
      data: {
        name: 'University Fund Circle',
        description: 'Saving for university tuition',
        category: CircleCategory.EDUCATION,
        organizerId: testUser1.id,
        contributionAmount: 1000,
        contributionFrequencyDays: 30,
        maxRounds: 12,
      },
    });

    educationCircle2 = await prisma.circle.create({
      data: {
        name: 'School Supplies Circle',
        description: 'Buying school supplies',
        category: CircleCategory.EDUCATION,
        organizerId: testUser1.id,
        contributionAmount: 500,
        contributionFrequencyDays: 30,
        maxRounds: 6,
      },
    });

    medicalCircle = await prisma.circle.create({
      data: {
        name: 'Healthcare Emergency Fund',
        description: 'Emergency medical expenses',
        category: CircleCategory.MEDICAL,
        organizerId: testUser1.id,
        contributionAmount: 2000,
        contributionFrequencyDays: 30,
        maxRounds: 12,
      },
    });

    businessCircle = await prisma.circle.create({
      data: {
        name: 'Startup Capital Circle',
        description: 'Raising capital for business',
        category: CircleCategory.BUSINESS,
        organizerId: testUser2.id,
        contributionAmount: 5000,
        contributionFrequencyDays: 30,
        maxRounds: 10,
      },
    });

    generalCircle = await prisma.circle.create({
      data: {
        name: 'General Savings Circle',
        description: 'General purpose savings',
        category: CircleCategory.GENERAL,
        organizerId: testUser1.id,
        contributionAmount: 1000,
        contributionFrequencyDays: 7,
        maxRounds: 52,
      },
    });

    // Add members to circles
    await prisma.circleMember.create({
      data: {
        circleId: educationCircle1.id,
        userId: testUser1.id,
        rotationOrder: 1,
      },
    });

    await prisma.circleMember.create({
      data: {
        circleId: educationCircle2.id,
        userId: testUser1.id,
        rotationOrder: 2,
      },
    });

    await prisma.circleMember.create({
      data: {
        circleId: medicalCircle.id,
        userId: testUser1.id,
        rotationOrder: 3,
      },
    });

    await prisma.circleMember.create({
      data: {
        circleId: businessCircle.id,
        userId: testUser2.id,
        rotationOrder: 4,
      },
    });

    await prisma.circleMember.create({
      data: {
        circleId: generalCircle.id,
        userId: testUser1.id,
        rotationOrder: 5,
      },
    });
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.circleMember.deleteMany({
      where: {
        OR: [
          { userId: testUser1.id },
          { userId: testUser2.id },
        ],
      },
    });

    await prisma.circle.deleteMany({
      where: {
        OR: [
          { organizerId: testUser1.id },
          { organizerId: testUser2.id },
        ],
      },
    });

    await prisma.user.deleteMany({
      where: {
        OR: [
          { id: testUser1.id },
          { id: testUser2.id },
        ],
      },
    });

    await prisma.$disconnect();
  });

  describe('GET /api/circles?category=<CATEGORY>', () => {
    it('should return only EDUCATION circles when category=EDUCATION', async () => {
      const response = await fetch('http://localhost:3000/api/circles?category=EDUCATION', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken1}`,
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.circles).toBeInstanceOf(Array);
      expect(data.circles.length).toBe(2);
      expect(data.filter).toEqual({ category: 'EDUCATION' });
      expect(data.count).toBe(2);

      // Verify all returned circles are EDUCATION category
      data.circles.forEach((circle: any) => {
        expect(circle.category).toBe('EDUCATION');
      });

      // Verify specific circles are returned
      const circleNames = data.circles.map((c: any) => c.name);
      expect(circleNames).toContain('University Fund Circle');
      expect(circleNames).toContain('School Supplies Circle');
    });

    it('should return only MEDICAL circles when category=MEDICAL', async () => {
      const response = await fetch('http://localhost:3000/api/circles?category=MEDICAL', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken1}`,
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.circles).toBeInstanceOf(Array);
      expect(data.circles.length).toBe(1);
      expect(data.filter).toEqual({ category: 'MEDICAL' });
      expect(data.count).toBe(1);

      expect(data.circles[0].category).toBe('MEDICAL');
      expect(data.circles[0].name).toBe('Healthcare Emergency Fund');
    });

    it('should return only BUSINESS circles when category=BUSINESS', async () => {
      const response = await fetch('http://localhost:3000/api/circles?category=BUSINESS', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken2}`,
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.circles).toBeInstanceOf(Array);
      expect(data.circles.length).toBe(1);
      expect(data.filter).toEqual({ category: 'BUSINESS' });

      expect(data.circles[0].category).toBe('BUSINESS');
      expect(data.circles[0].name).toBe('Startup Capital Circle');
    });

    it('should return all user circles when no category parameter is provided', async () => {
      const response = await fetch('http://localhost:3000/api/circles', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken1}`,
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.circles).toBeInstanceOf(Array);
      expect(data.circles.length).toBe(4); // User1 has 4 circles
      expect(data.filter).toBeNull();
      expect(data.count).toBe(4);

      // Verify different categories are present
      const categories = data.circles.map((c: any) => c.category);
      expect(categories).toContain('EDUCATION');
      expect(categories).toContain('MEDICAL');
      expect(categories).toContain('GENERAL');
    });

    it('should handle case-insensitive category matching (lowercase)', async () => {
      const response = await fetch('http://localhost:3000/api/circles?category=education', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken1}`,
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.circles.length).toBe(2);
      expect(data.filter).toEqual({ category: 'EDUCATION' });

      data.circles.forEach((circle: any) => {
        expect(circle.category).toBe('EDUCATION');
      });
    });

    it('should handle case-insensitive category matching (mixed case)', async () => {
      const response = await fetch('http://localhost:3000/api/circles?category=MeDiCaL', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken1}`,
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.circles.length).toBe(1);
      expect(data.filter).toEqual({ category: 'MEDICAL' });
      expect(data.circles[0].category).toBe('MEDICAL');
    });

    it('should return 400 for invalid category', async () => {
      const response = await fetch('http://localhost:3000/api/circles?category=INVALID_CATEGORY', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken1}`,
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.error).toBe('Invalid category');
      expect(data.validCategories).toBeInstanceOf(Array);
      expect(data.validCategories).toContain('EDUCATION');
      expect(data.validCategories).toContain('MEDICAL');
      expect(data.validCategories).toContain('BUSINESS');
    });

    it('should return empty array with 200 when category has no results', async () => {
      const response = await fetch('http://localhost:3000/api/circles?category=TRAVEL', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken1}`,
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.circles).toBeInstanceOf(Array);
      expect(data.circles.length).toBe(0);
      expect(data.filter).toEqual({ category: 'TRAVEL' });
      expect(data.count).toBe(0);
    });

    it('should handle empty string category parameter gracefully', async () => {
      const response = await fetch('http://localhost:3000/api/circles?category=', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken1}`,
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.circles).toBeInstanceOf(Array);
      expect(data.circles.length).toBe(4); // Returns all circles
      expect(data.filter).toBeNull();
    });

    it('should handle whitespace-only category parameter gracefully', async () => {
      const response = await fetch('http://localhost:3000/api/circles?category=%20%20%20', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken1}`,
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.circles).toBeInstanceOf(Array);
      expect(data.circles.length).toBe(4); // Returns all circles
      expect(data.filter).toBeNull();
    });

    it('should return 401 when no authorization token is provided', async () => {
      const response = await fetch('http://localhost:3000/api/circles?category=EDUCATION', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).toBe(401);
      
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 when invalid authorization token is provided', async () => {
      const response = await fetch('http://localhost:3000/api/circles?category=EDUCATION', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer invalid_token_12345',
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).toBe(401);
      
      const data = await response.json();
      expect(data.error).toBe('Invalid or expired token');
    });

    it('should only return circles where user is member or organizer', async () => {
      // User2 should only see their BUSINESS circle, not User1's circles
      const response = await fetch('http://localhost:3000/api/circles', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken2}`,
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.circles.length).toBe(1);
      expect(data.circles[0].category).toBe('BUSINESS');
      expect(data.circles[0].organizerId).toBe(testUser2.id);
    });

    it('should include organizer and members data in response', async () => {
      const response = await fetch('http://localhost:3000/api/circles?category=EDUCATION', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken1}`,
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.circles[0].organizer).toBeDefined();
      expect(data.circles[0].organizer.id).toBe(testUser1.id);
      expect(data.circles[0].organizer.email).toBe(testUser1.email);
      expect(data.circles[0].members).toBeInstanceOf(Array);
      expect(data.circles[0].members.length).toBeGreaterThan(0);
    });

    it('should include contributions data in response', async () => {
      const response = await fetch('http://localhost:3000/api/circles?category=MEDICAL', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken1}`,
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.circles[0].contributions).toBeDefined();
      expect(data.circles[0].contributions).toBeInstanceOf(Array);
    });

    it('should return circles ordered by createdAt desc', async () => {
      const response = await fetch('http://localhost:3000/api/circles', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken1}`,
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.circles.length).toBeGreaterThan(1);

      // Verify ordering (most recent first)
      for (let i = 0; i < data.circles.length - 1; i++) {
        const current = new Date(data.circles[i].createdAt);
        const next = new Date(data.circles[i + 1].createdAt);
        expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
      }
    });

    it('should handle multiple valid categories in sequence', async () => {
      const categories = ['EDUCATION', 'MEDICAL', 'BUSINESS', 'GENERAL'];
      
      for (const category of categories) {
        const response = await fetch(`http://localhost:3000/api/circles?category=${category}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${authToken1}`,
            'Content-Type': 'application/json',
          },
        });

        expect(response.status).toBe(200);
        
        const data = await response.json();
        expect(data.success).toBe(true);
        
        // All returned circles should match the requested category
        data.circles.forEach((circle: any) => {
          expect(circle.category).toBe(category);
        });
      }
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle special characters in category parameter', async () => {
      const response = await fetch('http://localhost:3000/api/circles?category=EDUCATION%20%3C%3E', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken1}`,
          'Content-Type': 'application/json',
        },
      });

      // Should return 400 for invalid category
      expect(response.status).toBe(400);
    });

    it('should handle very long category string', async () => {
      const longCategory = 'A'.repeat(1000);
      const response = await fetch(`http://localhost:3000/api/circles?category=${longCategory}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken1}`,
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.error).toBe('Invalid category');
    });

    it('should handle null category parameter', async () => {
      const response = await fetch('http://localhost:3000/api/circles?category=null', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken1}`,
          'Content-Type': 'application/json',
        },
      });

      // Should return 400 for invalid category
      expect(response.status).toBe(400);
    });
  });
});
