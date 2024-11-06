const express = require('express');
const prisma = require('../../lib/prisma');
const { authenticateToken } = require('../../middleware/auth');
const { z } = require('zod');

const router = express.Router();

// Schema validation for creating a comment
const createCommentSchema = z.object({
  reviewId: z.number(),
  content: z.string().min(1),
});

// Schema validation for updating a comment
const updateCommentSchema = z.object({
  content: z.string().min(1),
});

// Create a new comment on a review
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { reviewId, content } = createCommentSchema.parse(req.body);
    const userId = req.user.id;

    // Check if the review exists
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      return res.status(404).json({ error: 'Review not found.' });
    }

    const comment = await prisma.comment.create({
      data: {
        content,
        user: { connect: { id: userId } },
        review: { connect: { id: reviewId } },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
        review: {
          select: {
            id: true,
            content: true,
          },
        },
      },
    });

    res.status(201).json(comment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
    } else {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Get all comments for a specific review with pagination
const getCommentsSchema = z.object({
  reviewId: z.string().regex(/^\d+$/),
  page: z.string().regex(/^\d+$/).transform(Number).default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).default('10'),
});

router.get('/', async (req, res) => {
  try {
    const { reviewId, page, limit } = getCommentsSchema.parse(req.query);
    const parsedReviewId = parseInt(reviewId, 10);

    // Check if the review exists
    const review = await prisma.review.findUnique({
      where: { id: parsedReviewId },
    });

    if (!review) {
      return res.status(404).json({ error: 'Review not found.' });
    }

    const comments = await prisma.comment.findMany({
      where: { reviewId: parsedReviewId },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    res.json({
      page,
      limit,
      comments,
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

// Update a comment
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const commentId = parseInt(req.params.id, 10);
    if (isNaN(commentId)) {
      return res.status(400).json({ error: 'Invalid comment ID.' });
    }

    const { content } = updateCommentSchema.parse(req.body);
    const userId = req.user.id;

    // Check if the comment exists and belongs to the user
    const existingComment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!existingComment) {
      return res.status(404).json({ error: 'Comment not found.' });
    }

    if (existingComment.userId !== userId) {
      return res
        .status(403)
        .json({ error: 'You are not authorized to update this comment.' });
    }

    const updatedComment = await prisma.comment.update({
      where: { id: commentId },
      data: { content },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    res.json(updatedComment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
    } else {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Delete a comment
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const commentId = parseInt(req.params.id, 10);
    if (isNaN(commentId)) {
      return res.status(400).json({ error: 'Invalid comment ID.' });
    }

    const userId = req.user.id;

    // Check if the comment exists and belongs to the user
    const existingComment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!existingComment) {
      return res.status(404).json({ error: 'Comment not found.' });
    }

    if (existingComment.userId !== userId) {
      return res
        .status(403)
        .json({ error: 'You are not authorized to delete this comment.' });
    }

    await prisma.comment.delete({
      where: { id: commentId },
    });

    res.json({ message: 'Comment deleted successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all comments written by the authenticated user
router.get('/user/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const comments = await prisma.comment.findMany({
      where: { userId },
      include: {
        review: {
          select: {
            id: true,
            content: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({ comments });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
