const { describe, it, expect, beforeAll, afterAll } = require('@jest/globals');
const request = require('supertest');
const app = require('../../server');
const prisma = require('../../lib/prisma');
const bcrypt = require('bcrypt');

describe('Comments API', () => {
  let token;
  let userId;
  let reviewId;
  let commentId;

  beforeAll(async () => {
    // Create a test user
    const hashedPassword = await bcrypt.hash('password123', 10);
    const user = await prisma.user.create({
      data: {
        username: 'commenter',
        email: 'commenter@example.com',
        password: hashedPassword,
      },
    });
    userId = user.id;

    // Create another test user
    const hashedPassword2 = await bcrypt.hash('password456', 10);
    const user2 = await prisma.user.create({
      data: {
        username: 'anotherUser',
        email: 'another@example.com',
        password: hashedPassword2,
      },
    });

    // Create a test item
    const item = await prisma.item.create({
      data: {
        name: 'Comment Test Item',
        description: 'A test item for comment purposes.',
        category: 'Test Category',
      },
    });

    // Create a test review
    const review = await prisma.review.create({
      data: {
        rating: 5,
        content: 'This is a test review.',
        userId: user2.id,
        itemId: item.id,
      },
    });
    reviewId = review.id;

    // Authenticate the test user
    const loginResponse = await request(app)
      .post('/api/users/login')
      .send({ email: 'commenter@example.com', password: 'password123' });

    token = loginResponse.body.token;
  });

  it('should create a new comment on a review', async () => {
    const response = await request(app)
      .post('/api/comments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        reviewId,
        content: 'This is a test comment.',
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.content).toBe('This is a test comment.');
    expect(response.body.user).toHaveProperty('id', userId);
    expect(response.body.review).toHaveProperty('id', reviewId);
    commentId = response.body.id;
  });

  it('should fetch all comments for a specific review', async () => {
    const response = await request(app)
      .get('/api/comments')
      .query({ reviewId: reviewId.toString(), page: '1', limit: '10' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('comments');
    expect(Array.isArray(response.body.comments)).toBe(true);
    expect(response.body.comments.length).toBeGreaterThanOrEqual(1);
    const fetchedComment = response.body.comments.find(
      (c) => c.id === commentId
    );
    expect(fetchedComment).toHaveProperty('content', 'This is a test comment.');
    expect(fetchedComment.user).toHaveProperty('id', userId);
  });

  it('should update the comment', async () => {
    const response = await request(app)
      .put(`/api/comments/${commentId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        content: 'Updated comment content.',
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('id', commentId);
    expect(response.body.content).toBe('Updated comment content.');
  });

  it('should not allow updating the comment by another user', async () => {
    // Authenticate as another user
    const loginResponse = await request(app)
      .post('/api/users/login')
      .send({ email: 'another@example.com', password: 'password456' });

    const anotherToken = loginResponse.body.token;

    // Attempt to update the comment
    const response = await request(app)
      .put(`/api/comments/${commentId}`)
      .set('Authorization', `Bearer ${anotherToken}`)
      .send({
        content: 'Unauthorized update attempt.',
      });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty(
      'error',
      'You are not authorized to update this comment.'
    );
  });

  it('should delete the comment', async () => {
    const response = await request(app)
      .delete(`/api/comments/${commentId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty(
      'message',
      'Comment deleted successfully.'
    );
  });

  it('should not find the deleted comment', async () => {
    const response = await request(app).get(`/api/comments/${commentId}`);

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error', 'Comment not found.');
  });

  it('should fetch all comments written by the authenticated user', async () => {
    // Create multiple comments
    const newReview = await prisma.review.create({
      data: {
        rating: 4,
        content: 'Another test review.',
        userId: userId,
        itemId: (await prisma.item.findFirst()).id,
      },
    });

    await request(app)
      .post('/api/comments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        reviewId: newReview.id,
        content: 'First comment by user.',
      });

    await request(app)
      .post('/api/comments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        reviewId: newReview.id,
        content: 'Second comment by user.',
      });

    const response = await request(app)
      .get('/api/comments/user/me')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('comments');
    expect(Array.isArray(response.body.comments)).toBe(true);
    expect(response.body.comments.length).toBeGreaterThanOrEqual(2);
    expect(response.body.comments[0]).toHaveProperty(
      'content',
      'Second comment by user.'
    );
    expect(response.body.comments[1]).toHaveProperty(
      'content',
      'First comment by user.'
    );
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.comment.deleteMany({
      where: {
        userId: userId,
      },
    });
    await prisma.review.deleteMany({
      where: {
        id: reviewId,
      },
    });
    await prisma.review.deleteMany({
      where: {
        userId: userId,
      },
    });
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ['commenter@example.com', 'another@example.com'],
        },
      },
    });
    await prisma.item.deleteMany({
      where: {
        name: {
          contains: 'Comment Test Item',
        },
      },
    });
    await prisma.$disconnect();
  });
});
