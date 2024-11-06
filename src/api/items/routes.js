const express = require('express');
const prisma = require('../../lib/prisma');
const { z } = require('zod');

const router = express.Router();

// Schema for query parameters
const querySchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
});

// GET /api/items
// Fetch a list of items with optional search and pagination
router.get('/', async (req, res) => {
  try {
    const { search, category, page, limit } = querySchema.parse(req.query);

    const where = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.category = category;
    }

    const items = await prisma.item.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        reviews: {
          select: {
            rating: true,
          },
        },
      },
    });

    // Calculate average rating for each item
    const itemsWithAvgRating = items.map((item) => {
      const averageRating =
        item.reviews.length > 0
          ? item.reviews.reduce((acc, curr) => acc + curr.rating, 0) /
            item.reviews.length
          : null;
      return {
        ...item,
        averageRating: averageRating
          ? parseFloat(averageRating.toFixed(2))
          : null,
        reviews: undefined, // Remove reviews from the response
      };
    });

    res.json({
      page,
      limit,
      items: itemsWithAvgRating,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
    } else {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// GET /api/items/:id
// Fetch details of a specific item, including average rating and reviews
router.get('/:id', async (req, res) => {
  try {
    const itemId = parseInt(req.params.id, 10);
    if (isNaN(itemId)) {
      return res.status(400).json({ error: 'Invalid item ID' });
    }

    const item = await prisma.item.findUnique({
      where: { id: itemId },
      include: {
        reviews: {
          include: {
            user: {
              select: { id, username },
            },
            comments: {
              include: {
                user: {
                  select: { id, username },
                },
              },
            },
          },
        },
      },
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Calculate average rating
    const averageRating =
      item.reviews.length > 0
        ? item.reviews.reduce((acc, curr) => acc + curr.rating, 0) /
          item.reviews.length
        : null;

    res.json({
      ...item,
      averageRating: averageRating
        ? parseFloat(averageRating.toFixed(2))
        : null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
