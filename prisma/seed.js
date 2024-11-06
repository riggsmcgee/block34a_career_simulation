const prisma = require('../src/lib/prisma');
const bcrypt = require('bcrypt');

async function main() {
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Create users
  const user1 = await prisma.user.create({
    data: {
      username: 'admin',
      email: 'admin@example.com',
      password: hashedPassword,
    },
  });

  const user2 = await prisma.user.create({
    data: {
      username: 'testuser',
      email: 'testuser@example.com',
      password: hashedPassword,
    },
  });

  // Create items
  const items = await prisma.item.createMany({
    data: [
      {
        name: 'Item 1',
        description: 'Description for Item 1',
        category: 'Category A',
      },
      {
        name: 'Item 2',
        description: 'Description for Item 2',
        category: 'Category B',
      },
      {
        name: 'Item 3',
        description: 'Description for Item 3',
        category: 'Category A',
      },
      {
        name: 'Item 4',
        description: 'Description for Item 4',
        category: 'Category C',
      },
      {
        name: 'Item 5',
        description: 'Description for Item 5',
        category: 'Category B',
      },
      // Add more items as needed
    ],
  });

  // Fetch all items to create reviews
  const allItems = await prisma.item.findMany();

  // Create reviews for each item
  for (const item of allItems) {
    await prisma.review.createMany({
      data: [
        {
          rating: Math.floor(Math.random() * 5) + 1,
          content: `Review 1 for ${item.name}`,
          userId: user1.id,
          itemId: item.id,
        },
        {
          rating: Math.floor(Math.random() * 5) + 1,
          content: `Review 2 for ${item.name}`,
          userId: user2.id,
          itemId: item.id,
        },
      ],
    });
  }

  console.log('Database has been seeded. 🌱');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
