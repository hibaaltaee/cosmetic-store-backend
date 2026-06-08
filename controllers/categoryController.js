const { query } = require('../db');

const slugify = (str) =>
  str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const getAll = async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT
         c.id,
         c.name,
         c.slug,
         c.description,
         c.image_url,
         c.sort_order,
         COUNT(p.id)::int AS product_count
       FROM categories c
       LEFT JOIN products p
         ON p.category_id = c.id
         AND p.is_active = true
       WHERE c.is_active = true
       GROUP BY c.id
       ORDER BY c.sort_order, c.name`
    );

    res.json({
      success: true,
      data: rows,
    });

  } catch (err) {
    next(err);
  }
};


const getBySlug = async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT * FROM categories 
       WHERE slug = $1 AND is_active = true`,
      [req.params.slug]  // ← get slug from URL
    );

    // 404 if not found
    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    // return single object not array
    res.json({
      success: true,
      data: rows[0],
    });

  } catch (err) {
    next(err);
  }
};

const getAllAdmin = async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT
         c.id, c.name, c.slug, c.description, c.image_url,
         c.is_active, c.sort_order, c.created_at,
         COUNT(p.id)::int AS product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id
       GROUP BY c.id
       ORDER BY c.sort_order, c.name`
    );

    res.json({
      success: true,
      data: rows,
    });

  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    // Step 1 — get data from body
    const { name, description, sort_order = 0 } = req.body;

    // Step 2 — validate
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Name is required',
      });
    }

    // Step 3 — generate slug and get image url
    const slug      = slugify(name);
    const image_url = req.file?.path || null;

    // Step 4 — insert into DB
    const { rows } = await query(
      `INSERT INTO categories (name, slug, description, image_url, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name.trim(), slug, description || null, image_url, parseInt(sort_order)]
    );

    // Step 5 — return created category
    res.status(201).json({
      success: true,
      message: 'Category created',
      data: rows[0],
    });

  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    // Step 1 — get id and body data
    const { id }                                       = req.params;
    const { name, description, sort_order, is_active } = req.body;

    // Step 2 — check category exists
    const { rows: existing } = await query(
      `SELECT * FROM categories WHERE id = $1`,
      [id]
    );
    if (!existing.length) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    // Step 3 — calculate slug and image
    const slug      = name ? slugify(name) : existing[0].slug;
    const image_url = req.file?.path || existing[0].image_url;

    // Step 4 — update DB
    const { rows } = await query(
      `UPDATE categories SET
         name        = COALESCE($1, name),
         slug        = $2,
         description = COALESCE($3, description),
         image_url   = $4,
         sort_order  = COALESCE($5, sort_order),
         is_active   = COALESCE($6, is_active)
       WHERE id = $7
       RETURNING *`,
      [
        name        || null,
        slug,
        description || null,
        image_url,
        sort_order !== undefined ? parseInt(sort_order)                        : null,
        is_active  !== undefined ? (is_active === 'true' || is_active === true) : null,
        id,
      ]
    );

    // Step 5 — return updated category
    res.json({
      success: true,
      message: 'Category updated',
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
      `DELETE FROM categories WHERE id = $1 RETURNING id`,
      [id]
     
    );

    // 404 if not found
    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    // return single object not array
    res.json({
      success: true,
      message: 'Category deleted'
    });

  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getBySlug, getAllAdmin, create, update, remove };
