const { describe, it, expect, beforeAll, afterAll } = require('@jest/globals');
const request = require('supertest');
const app = require('../../server');
const prisma = require('../../lib/prisma');
const bcrypt = require('bcrypt');

describe('Reviews API', () => {
  let token;
  let userId;
  let itemId;
  let reviewId;

  beforeAll(async () => {
    // Create a test user
    const hashedPassword = await bcrypt.hash('password123', 10);
    const user = await prisma.user.create({
      data: {
        username: 'reviewer',
        email: 'reviewer@example.com',
        password: hashedPassword,
      },
    });
    userId = user.id;

    // Create a test item
    const item = await prisma.item.create({
      data: {
        name: 'Review Test Item',
        description: 'A test item for review purposes.',
        category: 'Test Category',
      },
    });
    itemId = item.id;

    // Authenticate the test user
    const loginResponse = await request(app)
      .post('/api/users/login')
      .send({ email: 'reviewer@example.com', password: 'password123' });

    token = loginResponse.body.token;
  });

  it('should create a new review', async () => {
    const response = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send({
        itemId,
        rating: 5,
        content: 'This is an excellent product!',
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.rating).toBe(5);
    expect(response.body.content).toBe('This is an excellent product!');
    expect(response.body.user).toHaveProperty('id', userId);
    reviewId = response.body.id;
  });

  it('should not allow creating multiple reviews for the same item by the same user', async () => {
    const response = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send({
        itemId,
        rating: 4,
        content: 'Trying to add a second review.',
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty(
      'error',
      'You have already reviewed this item.'
    );
  });

  it('should fetch all reviews', async () => {
    const response = await request(app).get('/api/reviews');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('reviews');
    expect(Array.isArray(response.body.reviews)).toBe(true);
    expect(response.body.reviews.length).toBeGreaterThanOrEqual(1);
  });

  it('should fetch a single review by ID', async () => {
    const response = await request(app).get(`/api/reviews/${reviewId}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('id', reviewId);
    expect(response.body).toHaveProperty('rating', 5);
    expect(response.body).toHaveProperty(
      'content',
      'This is an excellent product!'
    );
    expect(response.body.user).toHaveProperty('id', userId);
    expect(response.body.item).toHaveProperty('id', itemId);
  });

  it('should update the review', async () => {
    const response = await request(app)
      .put(`/api/reviews/${reviewId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        rating: 4,
        content: 'Updated review content.',
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('id', reviewId);
    expect(response.body.rating).toBe(4);
    expect(response.body.content).toBe('Updated review content.');
  });

  it('should not allow updating the review by another user', async () => {
    // Create another user
    const hashedPassword = await bcrypt.hash('password456', 10);
    const anotherUser = await prisma.user.create({
      data: {
        username: 'anotherUser',
        email: 'another@example.com',
        password: hashedPassword,
      },
    });

    // Authenticate the second user
    const loginResponse = await request(app)
      .post('/api/users/login')
      .send({ email: 'another@example.com', password: 'password456' });

    const anotherToken = loginResponse.body.token;

    // Attempt to update the review
    const response = await request(app)
      .put(`/api/reviews/${reviewId}`)
      .set('Authorization', `Bearer ${anotherToken}`)
      .send({
        rating: 3,
        content: 'Unauthorized update attempt.',
      });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty(
      'error',
      'You are not authorized to update this review.'
    );
  });

  it('should delete the review', async () => {
    const response = await request(app)
      .delete(`/api/reviews/${reviewId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty(
      'message',
      'Review deleted successfully.'
    );
  });

  it('should not find the deleted review', async () => {
    const response = await request(app).get(`/api/reviews/${reviewId}`);

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error', 'Review not found');
  });

  it('should fetch all reviews by the authenticated user', async () => {
    // Create multiple reviews
    const item2 = await prisma.item.create({
      data: {
        name: 'Second Test Item',
        description: 'Another test item.',
        category: 'Test Category',
      },
    });

    await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send({
        itemId: item2.id,
        rating: 5,
        content: 'Another great review!',
      });

    const response = await request(app)
      .get('/api/reviews/user/me')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('reviews');
    expect(Array.isArray(response.body.reviews)).toBe(true);
    expect(response.body.reviews.length).toBe(1); // Only one review exists after deletion
    expect(response.body.reviews[0]).toHaveProperty(
      'content',
      'Another great review!'
    );
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.comment.deleteMany();
    await prisma.review.deleteMany({
      where: {
        userId: userId,
      },
    });
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [userId],
        },
      },
    });
    await prisma.item.deleteMany({
      where: {
        id: {
          in: [itemId],
        },
      },
    });
    await prisma.$disconnect();
  });
});
