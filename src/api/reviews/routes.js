const express = require('express');
const prisma = require('../../lib/prisma');
const { authenticateToken } = require('../../middleware/auth');
const { z } = require('zod');

const router = express.Router();

// Schema validation
const createReviewSchema = z.object({
  itemId: z.number(),
  rating: z.number().min(1).max(5),
  content: z.string().min(1),
});

const updateReviewSchema = z.object({
  rating: z.number().min(1).max(5).optional(),
  content: z.string().min(1).optional(),
});

// Create review
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { itemId, rating, content } = createReviewSchema.parse(req.body);
    const userId = req.user.id;

    // Ensure the user hasn't already reviewed this item
    const existingReview = await prisma.review.findUnique({
      where: {
        userId_itemId: {
          userId,
          itemId,
        },
      },
    });

    if (existingReview) {
      return res
        .status(400)
        .json({ error: 'You have already reviewed this item.' });
    }

    const review = await prisma.review.create({
      data: {
        rating,
        content,
        user: { connect: { id: userId } },
        item: { connect: { id: itemId } },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    res.status(201).json(review);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
    } else {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Get all reviews with optional filters and pagination
const getAllReviewsSchema = z.object({
  itemId: z.string().optional(),
  userId: z.string().optional(),
  page: z.string().regex(/^\d+$/).transform(Number).default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).default('10'),
});

router.get('/', async (req, res) => {
  try {
    const { itemId, userId, page, limit } = getAllReviewsSchema.parse(
      req.query
    );

    const where = {};

    if (itemId) {
      where.itemId = parseInt(itemId, 10);
    }

    if (userId) {
      where.userId = parseInt(userId, 10);
    }

    const reviews = await prisma.review.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
        item: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({
      page,
      limit,
      reviews,
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

// Get a single review by ID
router.get('/:id', async (req, res) => {
  try {
    const reviewId = parseInt(req.params.id, 10);
    if (isNaN(reviewId)) {
      return res.status(400).json({ error: 'Invalid review ID' });
    }

    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        user: {
          select: { id, username },
        },
        item: {
          select: { id, name, description, category },
        },
        comments: {
          include: {
            user: {
              select: { id, username },
            },
          },
        },
      },
    });

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    res.json(review);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a review
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const reviewId = parseInt(req.params.id, 10);
    if (isNaN(reviewId)) {
      return res.status(400).json({ error: 'Invalid review ID' });
    }

    const { rating, content } = updateReviewSchema.parse(req.body);
    const userId = req.user.id;

    // Check if the review exists and belongs to the user
    const existingReview = await prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!existingReview) {
      return res.status(404).json({ error: 'Review not found' });
    }

    if (existingReview.userId !== userId) {
      return res
        .status(403)
        .json({ error: 'You are not authorized to update this review.' });
    }

    const updatedReview = await prisma.review.update({
      where: { id: reviewId },
      data: {
        rating: rating !== undefined ? rating : existingReview.rating,
        content: content !== undefined ? content : existingReview.content,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    res.json(updatedReview);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
    } else {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Delete a review
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const reviewId = parseInt(req.params.id, 10);
    if (isNaN(reviewId)) {
      return res.status(400).json({ error: 'Invalid review ID' });
    }

    const userId = req.user.id;

    // Check if the review exists and belongs to the user
    const existingReview = await prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!existingReview) {
      return res.status(404).json({ error: 'Review not found' });
    }

    if (existingReview.userId !== userId) {
      return res
        .status(403)
        .json({ error: 'You are not authorized to delete this review.' });
    }

    await prisma.review.delete({
      where: { id: reviewId },
    });

    res.json({ message: 'Review deleted successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all reviews by the authenticated user
router.get('/user/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const reviews = await prisma.review.findMany({
      where: { userId },
      include: {
        item: {
          select: {
            id: true,
            name: true,
          },
        },
        comments: {
          include: {
            user: {
              select: { id, username },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({ reviews });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
