const { describe, it, expect, beforeAll, afterAll } = require('@jest/globals');
const request = require('supertest');
const app = require('../../server');
const prisma = require('../../lib/prisma');

describe('Items API', () => {
  let item1, item2;

  beforeAll(async () => {
    // Create test items
    item1 = await prisma.item.create({
      data: {
        name: 'Test Item 1',
        description: 'Description for Test Item 1',
        category: 'Category A',
      },
    });

    item2 = await prisma.item.create({
      data: {
        name: 'Test Item 2',
        description: 'Description for Test Item 2',
        category: 'Category B',
      },
    });

    // Create reviews for item1
    await prisma.review.createMany({
      data: [
        {
          rating: 5,
          content: 'Excellent!',
          userId: 1, // Assuming a user with ID 1 exists
          itemId: item1.id,
        },
        {
          rating: 4,
          content: 'Very good',
          userId: 1,
          itemId: item1.id,
        },
      ],
    });
  });

  it('should fetch a list of items without query parameters', async () => {
    const response = await request(app).get('/api/items');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('items');
    expect(Array.isArray(response.body.items)).toBe(true);
    expect(response.body.items.length).toBeGreaterThanOrEqual(2);
    // Check if averageRating is calculated
    const fetchedItem = response.body.items.find(
      (item) => item.id === item1.id
    );
    expect(fetchedItem).toHaveProperty('averageRating', 4.5);
  });

  it('should fetch a list of items with search query', async () => {
    const response = await request(app)
      .get('/api/items')
      .query({ search: 'Item 1' });

    expect(response.status).toBe(200);
    expect(response.body.items.length).toBe(1);
    expect(response.body.items[0].name).toBe('Test Item 1');
  });

  it('should fetch a list of items with category filter', async () => {
    const response = await request(app)
      .get('/api/items')
      .query({ category: 'Category B' });

    expect(response.status).toBe(200);
    expect(response.body.items.length).toBe(1);
    expect(response.body.items[0].category).toBe('Category B');
  });

  it('should fetch item details by ID', async () => {
    const response = await request(app).get(`/api/items/${item1.id}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('id', item1.id);
    expect(response.body).toHaveProperty('averageRating', 4.5);
    expect(response.body).toHaveProperty('reviews');
    expect(Array.isArray(response.body.reviews)).toBe(true);
    expect(response.body.reviews.length).toBe(2);
  });

  it('should return 404 for non-existent item', async () => {
    const response = await request(app).get('/api/items/999999');

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error', 'Item not found');
  });

  it('should return 400 for invalid item ID', async () => {
    const response = await request(app).get('/api/items/invalid-id');

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error', 'Invalid item ID');
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.review.deleteMany({
      where: {
        itemId: { in: [item1.id, item2.id] },
      },
    });
    await prisma.item.deleteMany({
      where: {
        id: { in: [item1.id, item2.id] },
      },
    });
    await prisma.$disconnect();
  });
});
