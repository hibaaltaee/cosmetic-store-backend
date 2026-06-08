const { query } = require("../db");

const slugify = (str) =>
  str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const getAll = async (req, res, next) => {
  try {
    const {
      category,
      search,
      featured,
      sort = "created_at",
      order = "desc",
      page = 1,
      limit = 12,
    } = req.query;

    // Build dynamic WHERE clause
    const conditions = ["p.is_active = true"];
    const params = [];
    let idx = 1;

    if (category) {
      conditions.push(`c.slug = $${idx++}`);
      params.push(category);
    }
    if (search) {
      conditions.push(`(p.name ILIKE $${idx} OR p.description ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }
    if (featured === "true") {
      conditions.push(`p.is_featured = true`);
    }

    // Prevent SQL injection on sort
    const allowedSort = ["name", "price", "created_at", "stock"];
    const allowedOrder = ["asc", "desc"];
    const safeSort = allowedSort.includes(sort) ? `p.${sort}` : "p.created_at";
    const safeOrder = allowedOrder.includes(order) ? order : "desc";

    const where = `WHERE ${conditions.join(" AND ")}`;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get total count for pagination
    const countResult = await query(
      `SELECT COUNT(p.id)::int AS total
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       ${where}`,
      params,
    );

    // Get products
    const { rows } = await query(
      `SELECT
         p.id, p.name, p.slug, p.description, p.price,
         p.compare_price, p.stock, p.sku, p.images,
         p.is_featured, p.created_at,
         c.id   AS category_id,
         c.name AS category_name,
         c.slug AS category_slug
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       ${where}
       ORDER BY ${safeSort} ${safeOrder}
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, parseInt(limit), offset],
    );

    const total = countResult.rows[0].total;

    res.json({
      success: true,
      data: rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
};

const getBySlug = async (req, res, next) => {
  try {
    // Step 1 — get product with category info
    const { rows } = await query(
      `SELECT
         p.*,
         c.id   AS category_id,
         c.name AS category_name,
         c.slug AS category_slug
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.slug = $1 AND p.is_active = true`,
      [req.params.slug],
    );

    // Step 2 — 404 if not found
    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const product = rows[0];

    // Step 3 — get related products
    const { rows: related } = await query(
      `SELECT id, name, slug, price, compare_price, images
       FROM products
       WHERE category_id = $1 AND id != $2 AND is_active = true
       LIMIT 4`,
      [product.category_id, product.id],
    );

    // Step 4 — send response
    res.json({
      success: true,
      data: { ...product, related },
    });
  } catch (err) {
    next(err);
  }
};

const getAllAdmin = async (req, res, next) => {
  try {
    const {
      search,
      category,
      sort = "created_at",
      order = "desc",
      page = 1,
      limit = 12,
    } = req.query;

    const conditions = [];
    const params = [];
    let idx = 1;

    if (category) {
      conditions.push(`c.slug = $${idx++}`);
      params.push(category);
    }
    if (search) {
      conditions.push(`(p.name ILIKE $${idx} OR p.sku ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const allowedSort = ["name", "price", "created_at", "stock"];
    const allowedOrder = ["asc", "desc"];
    const safeSort = allowedSort.includes(sort) ? `p.${sort}` : "p.created_at";
    const safeOrder = allowedOrder.includes(order) ? order : "desc";

    // ✅ handle empty conditions
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const countResult = await query(
      `SELECT COUNT(p.id)::int AS total
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       ${where}`,
      params,
    );

    // ✅ complete query with where, order, limit, offset
    const { rows } = await query(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       ${where}
       ORDER BY ${safeSort} ${safeOrder}
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, parseInt(limit), offset],
    );

    const total = countResult.rows[0].total;

    res.json({
      success: true,
      data: rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    // Step 1 — get data from body
    const {
      name,
      description,
      price,
      compare_price,
      stock,
      sku,
      category_id,
      is_featured,
    } = req.body;

    // Step 2 — validate
    if (!name || !price) {
      return res.status(400).json({
        success: false,
        message: "Name and price are required",
      });
    }

    // Step 3 — generate slug and get image url
    const slug = slugify(name);
    const images = req.files?.map((f) => f.path) || [];

    // Step 4 — insert into DB
    const { rows } = await query(
      `INSERT INTO products
       (name, slug, description, price, compare_price, stock, sku, category_id, images, is_featured)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        name.trim(),
        slug,
        description || null,
        parseFloat(price), // always number
        compare_price ? parseFloat(compare_price) : null, // optional
        parseInt(stock) || 0, // default 0
        sku || null, // optional
        category_id || null, // optional
        images, // array
        is_featured === "true" || is_featured === true, // boolean
      ],
    );

    // Step 5 — return created category
    res.status(201).json({
      success: true,
      message: "prodect created",
      data: rows[0],
    });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    // Step 1 — get id and body data
    const { id } = req.params;
    const {
      name,
      description,
      is_active,
      price,
      compare_price,
      stock,
      sku,
      existing_images ,
      category_id,
      is_featured,
    } = req.body;

    // Step 2 — check category exists
    const { rows: existing } = await query(
      `SELECT * FROM products WHERE id = $1`,
      [id],
    );
    if (!existing.length) {
      return res.status(404).json({
        success: false,
        message: "product not found",
      });
    }

    // Step 3 — calculate slug and image
    const slug = name ? slugify(name) : existing[0].slug;
    let images = existing[0].images;
    if (existing_images !== undefined) {
      images = Array.isArray(existing_images)
        ? existing_images
        : JSON.parse(existing_images || "[]");
    }
    if (req.files?.length) {
      images = [...images, ...req.files.map((f) => f.path)];
    }

    // Step 4 — update DB
    const { rows } = await query(
  `UPDATE products SET
     name          = COALESCE($1, name),
     slug          = $2,
     description   = COALESCE($3, description),
     price         = COALESCE($4, price),
     compare_price = $5,
     stock         = COALESCE($6, stock),
     sku           = COALESCE($7, sku),
     category_id   = $8,
     images        = $9,
     is_featured   = COALESCE($10, is_featured),
     is_active     = COALESCE($11, is_active)
   WHERE id = $12
   RETURNING *`,
  [
    name          || null,
    slug,
    description   || null,
    price         ? parseFloat(price)         : null,
    compare_price ? parseFloat(compare_price) : null,
    stock         !== undefined ? parseInt(stock)                                   : null,
    sku           || null,
    category_id   || null,
    images,
    is_featured   !== undefined ? (is_featured === 'true' || is_featured === true) : null,
    is_active     !== undefined ? (is_active   === 'true' || is_active   === true) : null,
    id,
  ]
);

    // Step 5 — return updated category
    res.json({
      success: true,
      message: "product updated",
      data: rows[0],
    });
  } catch (err) {
    next(err);
  }
};


const remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows } = await query(
      `DELETE FROM products WHERE id = $1 RETURNING id`,
      [id]
     
    );

    // 404 if not found
    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // return single object not array
    res.json({
      success: true,
      message: 'Product deleted'
    });

  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getBySlug, getAllAdmin, create, update, remove };