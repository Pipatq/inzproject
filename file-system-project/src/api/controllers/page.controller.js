// src/api/controllers/page.controller.js

const { pool } = require('../../config/database');
const path = require('path');
const fs = require('fs');

/**
 * Helper Function: ดึงข้อมูล Breadcrumbs (เส้นทางของโฟลเดอร์)
 * @param {number | null} folderId - ID ของโฟลเดอร์ปัจจุบัน
 * @returns {Promise<Array>} - Array ของ Object ที่เป็น Breadcrumb
 */
const getBreadcrumbs = async (folderId) => {
    let breadcrumbs = [];
    let currentId = folderId;
    while (currentId) {
        const [rows] = await pool.query('SELECT id, name, parent_id FROM file_objects WHERE id = ?', [currentId]);
        if (rows.length === 0) break;
        const folder = rows[0];
        breadcrumbs.unshift({ id: folder.id, name: folder.name });
        currentId = folder.parent_id;
    }
    return breadcrumbs;
};

/**
 * Factory Function: สร้าง Controller สำหรับแสดงหน้า File System
 * @param {string} viewName - ชื่อไฟล์ EJS ที่จะ render ('index' หรือ 'admin')
 * @param {string} title - Title ของหน้าเว็บ
 */
const showFileSystemPage = (viewName, title) => async (req, res) => {
    try {
        let parentId = req.params.parentId || null;

        // จัดการกรณีที่ parentId อาจเป็นสตริง 'undefined'
        if (parentId === 'undefined') {
            parentId = null;
        }

        const view = req.query.view || 'grid';

        const [objects] = await pool.query(
            'SELECT * FROM file_objects WHERE parent_id <=> ? AND is_deleted = FALSE ORDER BY is_folder DESC, name ASC',
            [parentId]
        );

        const breadcrumbs = await getBreadcrumbs(parentId);

        res.render(viewName, {
            title: title,
            objects,
            breadcrumbs,
            currentFolderId: parentId,
            view
        });
    } catch (error) {
        console.error(`Error fetching page ${viewName}:`, error);
        res.status(500).send('Error loading file system.');
    }
};

// --- Page Rendering Functions ---

// ใช้ Factory Function เพื่อสร้าง Controller สำหรับหน้า index และ admin
const showHomePage = showFileSystemPage('index', 'File System');
const showAdminPage = showFileSystemPage('admin', 'File System - Admin');

// Controller: แสดงหน้าถังขยะ
const showTrashPage = async (req, res) => {
    try {
        const [trashItems] = await pool.query(
            'SELECT * FROM file_objects WHERE is_deleted = TRUE ORDER BY deleted_at DESC'
        );
        res.render('trash', {
            title: 'Trash',
            trashItems
        });
    } catch (error) {
        console.error('Error fetching trash:', error);
        res.status(500).send('Error loading trash.');
    }
};

// Controller: แสดงภาพ Preview
const showPreview = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(
            'SELECT storage_path, mimetype FROM file_objects WHERE id = ? AND is_deleted = FALSE AND is_folder = FALSE',
            [id]
        );
        if (rows.length === 0) {
            return res.status(404).send('File not found.');
        }

        const file = rows[0];
        if (!file.mimetype.startsWith('image/')) {
            return res.status(403).send('Preview is only available for images.');
        }

        const filePath = path.resolve(file.storage_path);
        if (!fs.existsSync(filePath)) {
            return res.status(404).send('File not found on disk.');
        }
        
        res.sendFile(filePath);

    } catch (error) {
        console.error('Error serving preview:', error);
        res.status(500).send('Error generating preview.');
    }
};


module.exports = {
    showHomePage,
    showAdminPage,
    showTrashPage,
    showPreview
};
