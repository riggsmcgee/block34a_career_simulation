const errorHandler = (err, req, res, next) => {
  console.error('Unhandled error:', err);

  // Set default status code and message
  let statusCode = 500;
  let message = 'Internal Server Error';

  // Customize response based on error type or properties
  if (err.name === 'ZodError') {
    statusCode = 400;
    message = err.errors;
  } else if (err.statusCode) {
    statusCode = err.statusCode;
    message = err.message;
  }

  res.status(statusCode).json({ error: message });
};

module.exports = { errorHandler };
