const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  });
};

const errorHandler = (err, req, res, next) => {
  console.error("Error:", err);

  if (err.code === "23505") {
    const field = err.detail?.match(/\((.+?)\)/)?.[1] || "field";
    return res.status(409).json({
      success: false,
      message: `${field} already exists`,
    });
  }

  if (err.code === "23503") {
    return res.status(400).json({
      success: false,
      message: "Referenced record not found",
    });
  }

  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || "Internal server error",
  });
};

module.exports = { errorHandler, notFound };
