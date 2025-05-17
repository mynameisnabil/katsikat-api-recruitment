const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const redis = require('ioredis');
const redisClient = new redis();
const studyMaterialModel = require('../models/studyMaterialModel');
const { validateGlobalToken } = require('../middleware/authMiddleware');
require('dotenv').config();

// Middleware to verify if user is admin or superadmin via token in body
const isAdminOrSuperAdmin = async (req, res, next) => {
    // Ambil token dari header Authorization
    const token = req.body.token
    if (!token) {
        return res.status(401).json({ status: "FAILED", message: "Token JWT diperlukan" });
    }

    try {
        // Verifikasi token menggunakan JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Periksa apakah role adalah admin atau superadmin
        if (decoded.role !== 'superadmin' && decoded.role !== 'admin') {
            return res.status(403).json({ status: "FAILED", message: "Hanya admin dan superadmin yang diperbolehkan" });
        }

        // Periksa token di Redis
        const storedToken = await redisClient.get(`token:${decoded.username}`);
        if (!storedToken || storedToken !== token) {
            return res.status(401).json({ status: "FAILED", message: "Token tidak valid atau kadaluarsa" });
        }

        // Simpan informasi pengguna ke dalam request
        req.user = decoded;
        next();
    } catch (err) {
        console.error("Error in isAdminOrSuperAdmin middleware:", err);

        // Tangani error JWT
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ status: "FAILED", message: "Token telah kedaluwarsa" });
        } else if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({ status: "FAILED", message: "Token tidak valid" });
        }

        // Tangani error lainnya
        return res.status(500).json({ status: "FAILED", message: "Terjadi kesalahan pada server" });
    }
};

// POST /api/add → Tambah materi pembelajaran
router.post('/add', validateGlobalToken, isAdminOrSuperAdmin, async (req, res) => {
    const { created_by, title, description, file_url, thumbnail } = req.body;
    
    if (!created_by || !title || !description || !file_url) {
        return res.status(400).json({
            status: "FAILED",
            message: "Field wajib (created_by, title, description, file_url) harus diisi"
        });
    }
    
    try {
        const newMaterial = await studyMaterialModel.addStudyMaterial({
            created_by, title, description, file_url, thumbnail
        });
        
        return res.status(201).json({
            status: "SUCCESS",
            message: "Materi pembelajaran berhasil ditambahkan",
            material: newMaterial
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "FAILED",
            message: "Terjadi kesalahan saat menambahkan materi pembelajaran"
        });
    }
});

// POST /api/list → Ambil daftar materi
router.post('/list',validateGlobalToken,  isAdminOrSuperAdmin, async (req, res) => {
    try {
        const materials = await studyMaterialModel.getAllStudyMaterials();
        
        return res.status(200).json({
            status: "SUCCESS",
            message: "Berhasil mengambil daftar materi pembelajaran",
            materials
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "FAILED",
            message: "Terjadi kesalahan saat mengambil daftar materi pembelajaran"
        });
    }
});

// POST /api/detail → Ambil detail materi
router.post('/detail',validateGlobalToken,  isAdminOrSuperAdmin, async (req, res) => {
    const { material_id } = req.body;
    
    if (!material_id) {
        return res.status(400).json({
            status: "FAILED",
            message: "ID materi pembelajaran diperlukan"
        });
    }
    
    try {
        const material = await studyMaterialModel.getStudyMaterialById(material_id);
        
        if (!material) {
            return res.status(404).json({
                status: "FAILED",
                message: "Materi pembelajaran tidak ditemukan"
            });
        }
        
        return res.status(200).json({
            status: "SUCCESS",
            message: "Berhasil mengambil detail materi pembelajaran",
            material
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "FAILED",
            message: "Terjadi kesalahan saat mengambil detail materi pembelajaran"
        });
    }
});

// POST /api/update → Update materi pembelajaran
router.post('/update', validateGlobalToken, isAdminOrSuperAdmin, async (req, res) => {
    const { material_id, title, description, file_url, thumbnail } = req.body;
    
    if (!material_id || !title || !description || !file_url) {
        return res.status(400).json({
            status: "FAILED",
            message: "Field wajib (material_id, title, description, file_url) harus diisi"
        });
    }
    
    try {
        const updated = await studyMaterialModel.updateStudyMaterial(material_id, {
            title, description, file_url, thumbnail
        });
        
        if (!updated) {
            return res.status(404).json({
                status: "FAILED",
                message: "Materi pembelajaran tidak ditemukan"
            });
        }
        
        return res.status(200).json({
            status: "SUCCESS",
            message: "Materi pembelajaran berhasil diperbarui"
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "FAILED",
            message: "Terjadi kesalahan saat memperbarui materi pembelajaran"
        });
    }
});

// POST /api/delete → Hapus materi pembelajaran
router.post('/delete', isAdminOrSuperAdmin, async (req, res) => {
    const { material_id } = req.body;
    
    if (!material_id) {
        return res.status(400).json({
            status: "FAILED",
            message: "ID materi pembelajaran diperlukan"
        });
    }
    
    try {
        const deleted = await studyMaterialModel.deleteStudyMaterial(material_id);
        
        if (!deleted) {
            return res.status(404).json({
                status: "FAILED",
                message: "Materi pembelajaran tidak ditemukan"
            });
        }
        
        return res.status(200).json({
            status: "SUCCESS",
            message: "Materi pembelajaran berhasil dihapus"
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "FAILED",
            message: "Terjadi kesalahan saat menghapus materi pembelajaran"
        });
    }
});

// POST /api/add_candidate_to_study → Tambah candidate dengan id_candidate dan study id
// Route: Modified to handle multiple study IDs
router.post('/add_candidate_to_study', validateGlobalToken, isAdminOrSuperAdmin, async (req, res) => {
    const { study_ids, candidate_id } = req.body;
    
    if (!study_ids || !candidate_id) {
        return res.status(400).json({
            status: "FAILED",
            message: "ID materi pembelajaran dan ID kandidat diperlukan"
        });
    }
    
    try {
        const result = await studyMaterialModel.addCandidateToStudyMaterial(study_ids, candidate_id);
        
        // Create appropriate message based on results
        let message = "";
        if (result.created.length > 0 && result.updated.length > 0) {
            message = `Kandidat berhasil ditambahkan ke ${result.created.length} materi pembelajaran baru dan akses diperbarui untuk ${result.updated.length} materi pembelajaran`;
        } else if (result.created.length > 0) {
            message = `Kandidat berhasil ditambahkan ke ${result.created.length} materi pembelajaran`;
        } else if (result.updated.length > 0) {
            message = `Akses kandidat ke ${result.updated.length} materi pembelajaran berhasil diperbarui`;
        }
        
        return res.status(200).json({
            status: "SUCCESS",
            message: message,
            candidate_id: candidate_id,
            result: {
                created_study_ids: result.created,
                updated_study_ids: result.updated
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "FAILED",
            message: "Terjadi kesalahan saat menambahkan kandidat ke materi pembelajaran"
        });
    }
});


module.exports = router;