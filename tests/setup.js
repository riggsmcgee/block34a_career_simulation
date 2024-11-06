const prisma = require('../src/lib/prisma');
const bcrypt = require('bcrypt');

module.exports = async () => {
  await prisma.comment.deleteMany();
  await prisma.review.deleteMany();
  await prisma.user.deleteMany();
  await prisma.item.deleteMany();

  // Seed the database with initial data for testing
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Create test users
  const user1 = await prisma.user.create({
    data: {
      username: 'testuser1',
      email: 'testuser1@example.com',
      password: hashedPassword,
    },
  });

  const user2 = await prisma.user.create({
    data: {
      username: 'testuser2',
      email: 'testuser2@example.com',
      password: hashedPassword,
    },
  });

  // Create test items
  const item1 = await prisma.item.create({
    data: {
      name: 'Test Item 1',
      description: 'Description for Test Item 1',
      category: 'Category A',
    },
  });

  const item2 = await prisma.item.create({
    data: {
      name: 'Test Item 2',
      description: 'Description for Test Item 2',
      category: 'Category B',
    },
  });

  // Create test reviews
  const review1 = await prisma.review.create({
    data: {
      rating: 5,
      content: 'Excellent product!',
      userId: user1.id,
      itemId: item1.id,
    },
  });

  const review2 = await prisma.review.create({
    data: {
      rating: 4,
      content: 'Very good, but could be improved.',
      userId: user2.id,
      itemId: item1.id,
    },
  });

  // Create test comments
  await prisma.comment.createMany({
    data: [
      {
        content: 'I agree with this review.',
        userId: user2.id,
        reviewId: review1.id,
      },
      {
        content: 'Thanks for the feedback!',
        userId: user1.id,
        reviewId: review2.id,
      },
    ],
  });

  console.log('Test database has been seeded.');
};
