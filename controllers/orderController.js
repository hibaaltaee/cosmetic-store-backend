const { query, getClient } = require('../db');
const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

const generateOrderNumber = () => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${date}-${rand}`;
};

const createOrder = async (req, res, next) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const {
      customer_name, customer_phone, customer_email,
      address, city, notes, items,
    } = req.body;

    // 1. Validate required fields
    if (!customer_name || !customer_phone || !address || !city || !items?.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Name, phone, address, city and items are required',
      });
    }

    // 2. Fetch all products in one query
    const productIds = items.map(i => i.product_id);
    const { rows: products } = await client.query(
      `SELECT id, name, price, stock, images
       FROM products WHERE id = ANY($1) AND is_active = true`,
      [productIds]
    );

    // 3. Check all products exist
    if (products.length !== productIds.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'One or more products not found',
      });
    }

    // 4. Map products by id for easy lookup
    const productMap = {};
    products.forEach(p => { productMap[p.id] = p; });

    // 5. Validate stock and calculate total
    let totalPrice = 0;
    const orderLines = [];

    for (const item of items) {
      const product = productMap[item.product_id];

      if (product.stock < item.quantity) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${product.name}" (available: ${product.stock})`,
        });
      }

      const lineTotal = product.price * item.quantity;
      totalPrice += lineTotal;

      orderLines.push({
        product_id:    product.id,
        product_name:  product.name,
        product_image: product.images?.[0] || null,
        quantity:      item.quantity,
        unit_price:    product.price,
        total_price:   lineTotal,
      });
    }

    // 6. Insert order
    const orderNumber = generateOrderNumber();
    const { rows: orderRows } = await client.query(
      `INSERT INTO orders
         (order_number, customer_name, customer_phone, customer_email,
          address, city, notes, total_price)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        orderNumber,
        customer_name.trim(),
        customer_phone.trim(),
        customer_email || null,
        address.trim(),
        city.trim(),
        notes || null,
        totalPrice,
      ]
    );

    const order = orderRows[0];

    // 7. Insert order items and decrement stock
    for (const line of orderLines) {
      await client.query(
        `INSERT INTO order_items
           (order_id, product_id, product_name, product_image,
            quantity, unit_price, total_price)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          order.id, line.product_id, line.product_name,
          line.product_image, line.quantity,
          line.unit_price, line.total_price,
        ]
      );

      // Decrement stock
      await client.query(
        `UPDATE products SET stock = stock - $1 WHERE id = $2`,
        [line.quantity, line.product_id]
      );
    }

    // 8. All good — commit!
    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Order placed successfully! We will contact you to confirm.',
      data: {
        order_number: order.order_number,
        total_price:  order.total_price,
        status:       order.status,
      },
    });

  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

const trackOrder = async (req, res, next) => {
  try {
    // Step 1 — find order by order number
    const { rows } = await query(
      `SELECT id, order_number, customer_name, status,
       total_price, city, created_at
       FROM orders WHERE order_number = $1`,
      [req.params.orderNumber]
    );

    // Step 2 — 404 if not found
    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Step 3 — get order items
    const { rows: items } = await query(
      `SELECT product_name, product_image, quantity, unit_price, total_price
       FROM order_items WHERE order_id = $1`,
      [rows[0].id]
    );

    // Step 4 — return order with items
    res.json({
      success: true,
      data: { ...rows[0], items },
    });

  } catch (err) {
    next(err);
  }
};

const getAllAdmin = async (req, res, next) => {
  try {
    // Step 1 — get filters
    const { status, search, page = 1, limit = 20, date_from, date_to } = req.query;

    // Step 2 — build WHERE clause
    const conditions = [];
    const params     = [];
    let   idx        = 1;

    if (status) {
      conditions.push(`status = $${idx++}`);
      params.push(status);
    }
    if (search) {
      conditions.push(`(order_number ILIKE $${idx} OR customer_name ILIKE $${idx} OR customer_phone ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }
    if (date_from) {
      conditions.push(`created_at >= $${idx++}`);
      params.push(date_from);
    }
    if (date_to) {
      conditions.push(`created_at <= $${idx++}`);
      params.push(date_to);
    }

    const where  = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Step 3 — count total
    const countResult = await query(
      `SELECT COUNT(id)::int AS total FROM orders ${where}`,
      params
    );

    // Step 4 — get orders
    const { rows } = await query(
      `SELECT
         id, order_number, customer_name, customer_phone,
         city, total_price, status, payment_method, created_at
       FROM orders
       ${where}
       ORDER BY created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, parseInt(limit), offset]
    );

    // Step 5 — send response
    const total = countResult.rows[0].total;

    res.json({
      success: true,
      data: rows,
      pagination: {
        total,
        page:  parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });

  } catch (err) {
    next(err);
  }
};

const getByIdAdmin = async (req, res, next) => {
  try {
    // Step 1 — get id from URL
    const { id } = req.params;

    // Step 2 — get order
    const { rows } = await query(
      `SELECT * FROM orders WHERE id = $1`,
      [id]
    );

    // Step 3 — 404 if not found
    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }                        

    // Step 4 — get order items
    const { rows: items } = await query(
      `SELECT * FROM order_items WHERE order_id = $1`,
      [id]
    );

    // Step 5 — return order with items
    res.json({
      success: true,
      data: { ...rows[0], items },
    });

  } catch (err) {          
    next(err);
  }
};  

const updateStatus = async (req, res, next) => {
  try {
    const { id }     = req.params;
    const { status } = req.body;

    // validate status
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status',
      });
    }

    // update order
    const { rows } = await query(
      `UPDATE orders SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );

    // 404 if not found
    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    res.json({
      success: true,
      message: 'Order status updated',
      data: rows[0],
    });

  } catch (err) {
    next(err);
  }
};

const getStats = async (req, res, next) => {
  try {
    const [totalOrders, totalRevenue, statusBreakdown, recentOrders, topProducts] = await Promise.all([
      
      // 1. total orders (excluding cancelled)
      query(`SELECT COUNT(*)::int AS count FROM orders WHERE status != 'cancelled'`),
      
      // 2. total revenue (delivered orders only)
      query(`SELECT COALESCE(SUM(total_price), 0)::numeric AS revenue FROM orders WHERE status = 'delivered'`),
      
      // 3. count per status
      query(`SELECT status, COUNT(*)::int AS count FROM orders GROUP BY status ORDER BY count DESC`),
      
      // 4. last 5 orders
      query(`SELECT order_number, customer_name, total_price, status, created_at
             FROM orders ORDER BY created_at DESC LIMIT 5`),
      
      // 5. top 5 products by quantity sold
      query(`SELECT
               oi.product_name,
               SUM(oi.quantity)::int AS total_sold,
               SUM(oi.total_price)   AS revenue
             FROM order_items oi
             JOIN orders o ON o.id = oi.order_id AND o.status != 'cancelled'
             GROUP BY oi.product_name
             ORDER BY total_sold DESC
             LIMIT 5`),
    ]);

    res.json({
      success: true,
      data: {
        total_orders:     totalOrders.rows[0].count,
        total_revenue:    totalRevenue.rows[0].revenue,
        status_breakdown: statusBreakdown.rows,
        recent_orders:    recentOrders.rows,
        top_products:     topProducts.rows,
      },
    });

  } catch (err) {
    next(err);
  }
};



module.exports = {createOrder,trackOrder, getAllAdmin,getByIdAdmin, updateStatus,getStats  };
