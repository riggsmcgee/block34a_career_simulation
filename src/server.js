const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { errorHandler } = require('./middleware/error');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Routes
const userRoutes = require('./api/users/routes');
const itemRoutes = require('./api/items/routes'); // Added Items routes
const reviewRoutes = require('./api/reviews/routes');
const commentRoutes = require('./api/comments/routes');

app.use('/api/users', userRoutes);
app.use('/api/items', itemRoutes); // Use Items routes
app.use('/api/reviews', reviewRoutes);
app.use('/api/comments', commentRoutes);

// Error handling middleware
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app; // Export for testing
