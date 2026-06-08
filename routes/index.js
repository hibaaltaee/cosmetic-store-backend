// imports
const express = require('express');
const router  = express.Router();

// import middlewares
const { authenticate, adminOnly } = require('../middlewares/auth');
const upload  = require('../middlewares/upload');

// import controllers
const authController     = require('../controllers/authController');
const categoryController = require('../controllers/categoryController');
const productController  = require('../controllers/productController');
const orderController    = require('../controllers/orderController');

router.post('/auth/login', authController.login);
router.get ('/auth/me', authenticate, authController.getMe);
router.post('/auth/change-password', authenticate, authController.changePassword);

router.get('/categories',  categoryController.getAll);
router.get('/categories/:slug', categoryController.getBySlug);

router.get('/products', productController.getAll);
router.get('/products/:slug', productController.getBySlug);

router.post('/orders', orderController.createOrder);
router.get ('/orders/track/:orderNumber', orderController.trackOrder);

router.get('/admin/stats', authenticate, adminOnly, orderController.getStats);
router.get  ('/admin/users',            authenticate, adminOnly, authController.getAllUsers);
router.post ('/admin/users',            authenticate, adminOnly, authController.createUser);
router.patch('/admin/users/:id/toggle', authenticate, adminOnly, authController.toggleUser);

router.get   ('/admin/categories',     authenticate, adminOnly, categoryController.getAllAdmin);
router.post  ('/admin/categories',     authenticate, adminOnly, upload.single('image'), categoryController.create);
router.put   ('/admin/categories/:id', authenticate, adminOnly, upload.single('image'), categoryController.update);
router.delete('/admin/categories/:id', authenticate, adminOnly, categoryController.remove);

router.get   ('/admin/products',     authenticate, adminOnly, productController.getAllAdmin);
router.post  ('/admin/products',     authenticate, adminOnly, upload.array('images', 5), productController.create);
router.put   ('/admin/products/:id', authenticate, adminOnly, upload.array('images', 5), productController.update);
router.delete('/admin/products/:id', authenticate, adminOnly, productController.remove);

router.get  ('/admin/orders',            authenticate, adminOnly, orderController.getAllAdmin);
router.get  ('/admin/orders/:id',        authenticate, adminOnly, orderController.getByIdAdmin);
router.patch('/admin/orders/:id/status', authenticate, adminOnly, orderController.updateStatus);




module.exports = router;
