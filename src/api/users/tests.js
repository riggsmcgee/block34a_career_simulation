const { describe, it, expect, beforeAll, afterAll } = require('@jest/globals');
const request = require('supertest');
const app = require('../../server');
const prisma = require('../../lib/prisma');
const bcrypt = require('bcrypt');

describe('Users API', () => {
  let testUser = {
    username: 'testuser',
    email: 'testuser@example.com',
    password: 'password123',
  };

  beforeAll(async () => {
    // Ensure the test user does not already exist
    await prisma.user.deleteMany({
      where: {
        email: testUser.email,
      },
    });
  });

  it('should register a new user successfully', async () => {
    const response = await request(app)
      .post('/api/users/register')
      .send(testUser);

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('username', testUser.username);
    expect(response.body).toHaveProperty('email', testUser.email);
    expect(response.body).toHaveProperty('createdAt');
    expect(response.body).not.toHaveProperty('password'); // Password should not be returned
  });

  it('should not allow registration with an existing email', async () => {
    const response = await request(app)
      .post('/api/users/register')
      .send(testUser);

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error', 'Email already in use');
  });

  it('should login successfully with correct credentials', async () => {
    const response = await request(app).post('/api/users/login').send({
      email: testUser.email,
      password: testUser.password,
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
    expect(typeof response.body.token).toBe('string');
  });

  it('should not login with incorrect password', async () => {
    const response = await request(app).post('/api/users/login').send({
      email: testUser.email,
      password: 'wrongpassword',
    });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error', 'Invalid credentials');
  });

  it('should not login with non-existent email', async () => {
    const response = await request(app).post('/api/users/login').send({
      email: 'nonexistent@example.com',
      password: 'password123',
    });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error', 'Invalid credentials');
  });

  afterAll(async () => {
    // Clean up the test user after tests run
    await prisma.comment.deleteMany({
      where: {
        userId: {
          in: [
            await prisma.user.findUnique({ where: { email: testUser.email } })
              ?.id,
          ],
        },
      },
    });

    await prisma.review.deleteMany({
      where: {
        userId: {
          in: [
            await prisma.user.findUnique({ where: { email: testUser.email } })
              ?.id,
          ],
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        email: testUser.email,
      },
    });

    await prisma.$disconnect();
  });
});
