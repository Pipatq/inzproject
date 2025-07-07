// src/api/controllers/file.controller.js
const { pool } = require('../../config/database');
const fs = require('fs');
const path = require('path');

// --- Helper Function ---
const deleteFromDiskRecursive = async (objectId) => {
    const [object] = await pool.query('SELECT * FROM file_objects WHERE id = ?', [objectId]);
    if (object.length === 0) return;

    if (object[0].is_folder) {
        const [children] = await pool.query('SELECT id FROM file_objects WHERE parent_id = ?', [objectId]);
        for (const child of children) {
            await deleteFromDiskRecursive(child.id);
        }
    } else {
        if (object[0].storage_path && fs.existsSync(object[0].storage_path)) {
            fs.unlinkSync(object[0].storage_path);
        }
    }
};

// --- Controller Functions ---

const renameObject = async (req, res) => {
    const { id } = req.params;
    const { newName } = req.body;
    if (!newName) return res.status(400).json({ message: 'New name is required.' });

    try {
        await pool.query('UPDATE file_objects SET name = ? WHERE id = ?', [newName, id]);
        res.status(200).json({ message: 'Renamed successfully.' });
    } catch (error) {
        console.error('Error renaming object:', error);
        res.status(500).json({ message: 'Error renaming object.' });
    }
};

const createFolder = async (req, res) => {
    const { name, parentId } = req.body;
    if (!name) return res.status(400).send('Folder name is required.');
    
    try {
        await pool.query('INSERT INTO file_objects (name, parent_id, is_folder) VALUES (?, ?, TRUE)', [name, parentId || null]);
        res.redirect('back');
    } catch (error) {
        console.error('Error creating folder:', error);
        res.status(500).send('Error creating folder.');
    }
};

// const uploadFile = async (req, res) => {
//     if (!req.file) return res.status(400).send('No file uploaded.');

//     console.log('--- Multer File Info ---');
//     console.log('Multer has processed this file object:', req.file);
//     console.log('>>>>>> Original Name from Multer:', req.file.originalname);
//     console.log('--- End Multer File Info ---');


//     try {
//         const { parentId } = req.body;
//         const { originalname, filename, mimetype, size, path: storage_path } = req.file;
//         const sql = `
//             INSERT INTO file_objects 
//             (parent_id, is_folder, name, system_filename, storage_path, mimetype, size_bytes) 
//             VALUES (?, FALSE, ?, ?, ?, ?, ?)`;
//         await pool.query(sql, [parentId || null, originalname, filename, storage_path, mimetype, size]);
//         res.redirect('back');
//     } catch (error) {
//         console.error('Error uploading file:', error);
//         res.status(500).send('Error saving file metadata.');
//     }
// };

const uploadFile = async (req, res) => {
    // ตรวจสอบว่ามีไฟล์ถูกอัปโหลดมาหรือไม่
    if (!req.files || req.files.length === 0) {
        return res.status(400).send('No files uploaded.');
    }

    try {
        const { parentId } = req.body;
        const files = req.files; // ตอนนี้ req.files เป็น Array

        // วนลูปเพื่อบันทึกข้อมูลไฟล์แต่ละไฟล์ลงฐานข้อมูล
        for (const file of files) {
            const { originalname, filename, mimetype, size, path: storage_path } = file;
            const sql = `
                INSERT INTO file_objects 
                (parent_id, is_folder, name, system_filename, storage_path, mimetype, size_bytes) 
                VALUES (?, FALSE, ?, ?, ?, ?, ?)`;
            await pool.query(sql, [parentId || null, originalname, filename, storage_path, mimetype, size]);
        }

        res.redirect('back'); // กลับไปหน้าเดิมหลังอัปโหลดเสร็จ

    } catch (error) {
        console.error('Error uploading files:', error);
        res.status(500).send('Error saving file metadata.');
    }
};

const softDeleteObject = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('UPDATE file_objects SET is_deleted = TRUE, deleted_at = NOW() WHERE id = ?', [id]);
        res.redirect('back');
    } catch (error) {
        console.error('Error moving object to trash:', error);
        res.status(500).send('Error moving object to trash.');
    }
};

const restoreObject = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('UPDATE file_objects SET is_deleted = FALSE, deleted_at = NULL WHERE id = ?', [id]);
        res.redirect('back');
    } catch (error) {
        console.error('Error restoring object:', error);
        res.status(500).send('Error restoring object.');
    }
};

const permanentlyDeleteObject = async (req, res) => {
    const { id } = req.params;
    try {
        await deleteFromDiskRecursive(id);
        await pool.query('DELETE FROM file_objects WHERE id = ?', [id]);
        res.redirect('back');
    } catch (error) {
        console.error('Error permanently deleting object:', error);
        res.status(500).send('Error permanently deleting object.');
    }
};

const emptyTrash = async (req, res) => {
    try {
        const [trashItems] = await pool.query('SELECT id FROM file_objects WHERE is_deleted = TRUE');
        for (const item of trashItems) {
            await deleteFromDiskRecursive(item.id);
        }
        await pool.query('DELETE FROM file_objects WHERE is_deleted = TRUE');
        res.redirect('/trash');
    } catch (error) {
        console.error('Error emptying trash:', error);
        res.status(500).send('Error emptying trash.');
    }
};

const downloadFile = async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.query('SELECT * FROM file_objects WHERE id = ? AND is_folder = FALSE', [id]);
        if (rows.length === 0) return res.status(404).send('File not found.');
        
        const file = rows[0];
        const filePath = path.resolve(file.storage_path);
        if (!fs.existsSync(filePath)) return res.status(404).send('File not found on disk.');
        
        res.download(filePath, file.name);
    } catch (error) {
        console.error('Error downloading file:', error);
        res.status(500).send('Error downloading file.');
    }
};


const searchObjects = async (req, res) => {
    const { q } = req.query; // ดึงคำค้นหาจาก URL parameter ?q=...

    if (!q) {
        // ถ้าไม่มีคำค้นหา ส่งค่าว่างกลับไป
        return res.json([]);
    }

    try {
        // ใช้ LIKE '%...%' เพื่อค้นหาไฟล์/โฟลเดอร์ที่มีคำค้นหาอยู่ในชื่อ
        // และค้นหาเฉพาะไฟล์ที่ยังไม่ถูกลบ (is_deleted = FALSE)
        const sql = 'SELECT * FROM file_objects WHERE name LIKE ? AND is_deleted = FALSE';
        const queryParam = `%${q}%`; // สร้าง parameter สำหรับ LIKE

        const [results] = await pool.query(sql, [queryParam]);

        // ส่งผลลัพธ์กลับไปเป็น JSON
        res.json(results);

    } catch (error) {
        console.error('Error searching objects:', error);
        res.status(500).json({ message: 'Error during search.' });
    }
};

module.exports = {
    renameObject,
    createFolder,
    uploadFile,
    softDeleteObject,
    restoreObject,
    permanentlyDeleteObject,
    emptyTrash,
    downloadFile,
    searchObjects
};