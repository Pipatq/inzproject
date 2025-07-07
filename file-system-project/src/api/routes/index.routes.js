// const express = require('express');
// const router = express.Router();
// const pageController = require('../controllers/page.controller');
// const fileController = require('../controllers/file.controller');
// const authController = require('../controllers/auth.controller');
// const upload = require('../../config/multer.config');

// // --- API Endpoints ---
// router.post('/folder', fileController.createFolder);
// router.post('/upload', upload.single('file'), fileController.uploadFile);
// router.get('/download/:id', fileController.downloadFile);
// router.post('/rename/:id', fileController.renameObject);
// router.post('/delete/:id', fileController.softDeleteObject);
// router.post('/restore/:id', fileController.restoreObject);
// router.post('/perm-delete/:id', fileController.permanentlyDeleteObject);
// router.post('/empty-trash', fileController.emptyTrash);

// // --- START: เพิ่ม Auth Routes ---
// router.post('/auth/login', authController.login);
// router.get('/auth/logout', authController.logout);
// // --- END: เพิ่ม Auth Routes ---


// module.exports = router;
// src/routes/index.routes.js

// const express = require('express');
// const router = express.Router();

// // --- Controllers ---
// const pageController = require('../controllers/page.controller');
// const fileController = require('../controllers/file.controller');
// const authController = require('../controllers/auth.controller');
// const upload = require('../../config/multer.config');

// // Middleware สำหรับตรวจสอบสิทธิ์ Superadmin
// const { verifySuperadmin } = authController;

// // --- Public Routes (ทุกคนเข้าได้) ---
// router.get('/', pageController.showHomePage);
// router.get('/files/:id?', pageController.showHomePage); // หน้าสำหรับ User ทั่วไป
// router.get('/health', (req, res) => res.status(200).send('OK'));
// router.get('/api_file/download/:id', fileController.downloadFile); // เปิดให้ download ได้

// // --- Auth Routes ---
// router.post('/auth/login', authController.login);
// router.get('/auth/logout', authController.logout);


// // --- Superadmin Protected Page Routes (เฉพาะ Superadmin ที่ Login แล้ว) ---
// router.get('/admin/:id?', verifySuperadmin, pageController.showAdminPage);
// router.get('/admin', verifySuperadmin, pageController.showAdminPage);
// router.get('/trash', verifySuperadmin, pageController.showTrashPage);
// router.get('/preview/:id', verifySuperadmin, pageController.showPreview); // Preview ก็ควรป้องกัน


// // --- Superadmin Protected API Routes (เฉพาะ Superadmin ที่ Login แล้ว) ---
// router.post('/api_file/folder', verifySuperadmin, fileController.createFolder);
// router.post('/api_file/upload', verifySuperadmin, upload.single('file'), fileController.uploadFile);
// router.post('/api_file/rename/:id', verifySuperadmin, fileController.renameObject);
// router.post('/api_file/delete/:id', verifySuperadmin, fileController.softDeleteObject);
// router.post('/api_file/restore/:id', verifySuperadmin, fileController.restoreObject);
// router.post('/api_file/perm-delete/:id', verifySuperadmin, fileController.permanentlyDeleteObject);
// router.post('/api_file/empty-trash', verifySuperadmin, fileController.emptyTrash);


// module.exports = router;
// api/routes/index.routes.js

const express = require('express');
const router = express.Router();
const axios = require('axios');
const jwt = require('jsonwebtoken');

// --- START: นำ Controller และ Middleware มาไว้ที่นี่ ---
// const fileController = require('../../controllers/file.controller');
const fileController = require('../controllers/file.controller'); // <-- แก้ไข Path
const authController = require('../controllers/auth.controller'); 
const upload = require('../../config/multer.config');

// const { verifySuperadmin } = authController;
const { login, logout, verifySuperadmin } = authController;

// --- Auth Routes ---
router.post('/auth/login', login);
router.get('/auth/logout', logout);

// --- Protected File API Routes ---
router.post('/folder', verifySuperadmin, fileController.createFolder);
// router.post('/upload', verifySuperadmin, upload.single('file'), fileController.uploadFile);
router.post('/upload', verifySuperadmin, upload.array('file', 10), fileController.uploadFile);
router.post('/rename/:id', verifySuperadmin, fileController.renameObject);
router.post('/delete/:id', verifySuperadmin, fileController.softDeleteObject);
router.post('/restore/:id', verifySuperadmin, fileController.restoreObject);
router.post('/perm-delete/:id', verifySuperadmin, fileController.permanentlyDeleteObject);
router.post('/empty-trash', verifySuperadmin, fileController.emptyTrash);

// --- Public File API Route ---
router.get('/search', fileController.searchObjects);
router.get('/download/:id', fileController.downloadFile);


module.exports = router;