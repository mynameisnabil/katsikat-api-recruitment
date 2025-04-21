const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const redis = require('ioredis');
const redisClient = new redis();
const statusModel = require('../models/statusModel');
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

// POST /api/status/list → Ambil daftar status
router.post('/list', validateGlobalToken, isAdminOrSuperAdmin, async (req, res) => {
    try {
        const statuses = await statusModel.getAllStatuses();
        
        return res.status(200).json({
            status: "SUCCESS",
            message: "Berhasil mengambil daftar status",
            statuses
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "FAILED",
            message: "Terjadi kesalahan saat mengambil daftar status"
        });
    }
});

// POST /api/status/detail → Ambil detail status
router.post('/detail', validateGlobalToken, isAdminOrSuperAdmin, async (req, res) => {
    const { status_id } = req.body;
    
    if (!status_id) {
        return res.status(400).json({
            status: "FAILED",
            message: "ID status diperlukan"
        });
    }
    
    try {
        const statusData = await statusModel.getStatusById(status_id);
        
        if (!statusData) {
            return res.status(404).json({
                status: "FAILED",
                message: "Status tidak ditemukan"
            });
        }
        
        return res.status(200).json({
            status: "SUCCESS",
            message: "Berhasil mengambil detail status",
            statusData
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "FAILED",
            message: "Terjadi kesalahan saat mengambil detail status"
        });
    }
});

// POST /api/status/add → Tambah status baru
router.post('/add', validateGlobalToken, isAdminOrSuperAdmin, async (req, res) => {
    const { status_name } = req.body;
    
    if (!status_name) {
        return res.status(400).json({
            status: "FAILED",
            message: "Field wajib (status_name) harus diisi"
        });
    }
    
    try {
        const newStatus = await statusModel.createStatus(status_name);
        
        return res.status(201).json({
            status: "SUCCESS",
            message: "Status berhasil ditambahkan",
            statusData: newStatus
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "FAILED",
            message: "Terjadi kesalahan saat menambahkan status"
        });
    }
});

// POST /api/status/update → Update status
router.post('/update', validateGlobalToken, isAdminOrSuperAdmin, async (req, res) => {
    const { status_id, status_name } = req.body;
    
    if (!status_id || !status_name) {
        return res.status(400).json({
            status: "FAILED",
            message: "Field wajib (status_id, status_name) harus diisi"
        });
    }
    
    try {
        const updated = await statusModel.updateStatus(status_id, status_name);
        
        if (!updated) {
            return res.status(404).json({
                status: "FAILED",
                message: "Status tidak ditemukan"
            });
        }
        
        return res.status(200).json({
            status: "SUCCESS",
            message: "Status berhasil diperbarui"
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "FAILED",
            message: "Terjadi kesalahan saat memperbarui status"
        });
    }
});

// POST /api/status/delete → Hapus status
router.post('/delete', validateGlobalToken, isAdminOrSuperAdmin, async (req, res) => {
    const { status_id } = req.body;
    
    if (!status_id) {
        return res.status(400).json({
            status: "FAILED",
            message: "ID status diperlukan"
        });
    }
    
    try {
        const deleted = await statusModel.deleteStatus(status_id);
        
        if (!deleted) {
            return res.status(404).json({
                status: "FAILED",
                message: "Status tidak ditemukan"
            });
        }
        
        return res.status(200).json({
            status: "SUCCESS",
            message: "Status berhasil dihapus"
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "FAILED",
            message: "Terjadi kesalahan saat menghapus status"
        });
    }
});

module.exports = router;