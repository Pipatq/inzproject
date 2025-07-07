// const express = require('express');
// const path = require('path');
// const apiRoutes = require('./api/routes/index.routes');
// const { pool } = require('./config/database');

// const app = express();

// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
// app.set('views', path.join(__dirname, 'views'));
// app.set('view engine', 'ejs');
// app.use(express.static(path.join(__dirname, '../public')));

// // --- Helper Function for Breadcrumbs ---
// const getBreadcrumbs = async (folderId) => {
//     let breadcrumbs = [];
//     let currentId = folderId;
//     while (currentId) {
//         const [rows] = await pool.query('SELECT id, name, parent_id FROM file_objects WHERE id = ?', [currentId]);
//         if (rows.length > 0) {
//             breadcrumbs.unshift(rows[0]);
//             currentId = rows[0].parent_id;
//         } else {
//             break;
//         }
//     }
//     return breadcrumbs;
// };

// // --- Main Route for File Explorer ---
// app.get('/files/:parentId?', async (req, res) => {
//     const parentId = req.params.parentId || null;
//     const view = req.query.view || 'grid';

//     try {
//         const objectsSql = 'SELECT * FROM file_objects WHERE parent_id <=> ? ORDER BY is_folder DESC, name ASC';
//         const [objects] = await pool.query(objectsSql, [parentId]);
        
//         const breadcrumbs = await getBreadcrumbs(parentId);

//         res.render('index', {
//             title: 'File System',
//             objects: objects,
//             currentFolderId: parentId,
//             breadcrumbs: breadcrumbs,
//             view: view
//         });
//     } catch (error) {
//         console.error(error);
//         res.status(500).send("Error loading file system.");
//     }
// });

// app.get('/', (req, res) => {
//     res.redirect('/files');
// });

// app.use('/api_file', apiRoutes);

// // module.exports = app;
// const express = require('express');
// const cookieParser = require('cookie-parser');
// const path = require('path');
// const fs = require('fs');
// const apiRoutes = require('./api/routes/index.routes');
// const { pool } = require('./config/database');

// const app = express();

// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
// app.use(cookieParser()); 
// app.set('views', path.join(__dirname, 'views'));
// app.set('view engine', 'ejs');
// app.use(express.static(path.join(__dirname, '../public')));

// // --- Helper Functions ---
// const getBreadcrumbs = async (folderId) => {
//     let breadcrumbs = [];
//     let currentId = folderId;
//     while (currentId) {
//         const [rows] = await pool.query('SELECT id, name, parent_id FROM file_objects WHERE id = ? AND is_deleted = FALSE', [currentId]);
//         if (rows.length > 0) {
//             breadcrumbs.unshift(rows[0]);
//             currentId = rows[0].parent_id;
//         } else {
//             break;
//         }
//     }
//     return breadcrumbs;
// };

// // --- Main Application Routes ---

// // File Explorer View
// app.get('/files/:parentId?', async (req, res) => {
//     const parentId = req.params.parentId || null;
//     const view = req.query.view || 'grid';

//     try {
//         const objectsSql = 'SELECT * FROM file_objects WHERE parent_id <=> ? AND is_deleted = FALSE ORDER BY is_folder DESC, name ASC';
//         const [objects] = await pool.query(objectsSql, [parentId]);
//         const breadcrumbs = await getBreadcrumbs(parentId);

//         res.render('index', {
//             title: 'File System',
//             objects,
//             currentFolderId: parentId,
//             breadcrumbs,
//             view
//         });
//     } catch (error) {
//         console.error(error);
//         res.status(500).send("Error loading file system.");
//     }
// });

// // Trash View
// app.get('/trash', async (req, res) => {
//     try {
//         // Purge old files first
//         const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
//         const [itemsToPurge] = await pool.query('SELECT id FROM file_objects WHERE is_deleted = TRUE AND deleted_at < ?', [sevenDaysAgo]);
//         for (const item of itemsToPurge) {
//             // This is a simplified version. In a real app, use the controller function.
//             await pool.query('DELETE FROM file_objects WHERE id = ?', [item.id]);
//         }

//         const [trashItems] = await pool.query('SELECT * FROM file_objects WHERE is_deleted = TRUE ORDER BY deleted_at DESC');
//         res.render('trash', {
//             title: 'Trash',
//             trashItems
//         });
//     } catch (error) {
//         console.error(error);
//         res.status(500).send("Error loading trash.");
//     }
// });

// // Image Thumbnail/Preview Route
// app.get('/preview/:id', async (req, res) => {
//     try {
//         const [rows] = await pool.query('SELECT storage_path, mimetype FROM file_objects WHERE id = ?', [req.params.id]);
//         if (rows.length > 0 && rows[0].storage_path && rows[0].mimetype.startsWith('image/')) {
//             const filePath = rows[0].storage_path;
//             if (fs.existsSync(filePath)) {
//                 res.sendFile(path.resolve(filePath));
//             } else {
//                 res.status(404).send('File not found on disk');
//             }
//         } else {
//             res.status(404).send('Not an image or file not found');
//         }
//     } catch (error) {
//         res.status(500).send('Server error');
//     }
// });

// app.get('/', (req, res) => res.redirect('/files'));
// app.use('/api_file', apiRoutes);

// module.exports = app;
// app.js

// src/app.js
// src/app.js
// src/app.js

const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const dotenv = require('dotenv');

// --- 1. Imports ---
// Import ทุกอย่างที่จำเป็นแค่ครั้งเดียวที่นี่
const apiRoutes = require('./api/routes/index.routes');
const { showHomePage, showAdminPage, showTrashPage, showPreview } = require('./api/controllers/page.controller');
const { verifySuperadmin } = require('./api/controllers/auth.controller');

// --- 2. Initial Setup ---
// โหลดค่าจาก .env และสร้าง instance ของ express
dotenv.config();
const app = express();

// --- 3. Middleware Setup ---
// ตั้งค่า Middleware ที่จะใช้กับทุก Request
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, '../public')));


// --- 4. Page Rendering Routes ---
// กำหนดเส้นทางสำหรับการแสดงผลหน้าเว็บแต่ละหน้า
// แต่ละ Route จะมี Handler แค่ตัวเดียวที่ import เข้ามา

// Route หลัก: / และ /files/ จะแสดงหน้า index.ejs สำหรับทุกคน
app.get(['/', '/files/:parentId?'], showHomePage);

// Route Admin: /admin/ จะแสดงหน้า admin.ejs และต้องผ่านการตรวจสอบสิทธิ์ก่อน
app.get(['/admin', '/admin/:parentId?'], verifySuperadmin, showAdminPage);

// Route ถังขยะ: /trash ต้องผ่านการตรวจสอบสิทธิ์
app.get('/trash', verifySuperadmin, showTrashPage);

// Route Preview: /preview ต้องผ่านการตรวจสอบสิทธิ์
app.get('/preview/:id', showPreview);


// --- 5. API Routes ---
// ทุก Route ที่ขึ้นต้นด้วย /api จะถูกส่งไปจัดการโดย apiRoutes
// app.use('/api', apiRoutes);
app.use('/fs-api', apiRoutes);


// --- 6. Export App ---
// ส่งออก app instance เพื่อให้ server.js นำไปใช้งาน
module.exports = app;
