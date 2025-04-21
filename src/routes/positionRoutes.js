const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const redis = require('ioredis');
const redisClient = new redis();
const positionModel = require('../models/positionModel');
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

// POST /api/position/list → Ambil daftar posisi
router.post('/list', validateGlobalToken, isAdminOrSuperAdmin, async (req, res) => {
    try {
        const positions = await positionModel.getAllPositions();
        
        return res.status(200).json({
            status: "SUCCESS",
            message: "Berhasil mengambil daftar posisi",
            positions
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "FAILED",
            message: "Terjadi kesalahan saat mengambil daftar posisi"
        });
    }
});

// POST /api/position/detail → Ambil detail posisi
router.post('/detail', validateGlobalToken, isAdminOrSuperAdmin, async (req, res) => {
    const { position_id } = req.body;
    
    if (!position_id) {
        return res.status(400).json({
            status: "FAILED",
            message: "ID posisi diperlukan"
        });
    }
    
    try {
        const position = await positionModel.getPositionById(position_id);
        
        if (!position) {
            return res.status(404).json({
                status: "FAILED",
                message: "Posisi tidak ditemukan"
            });
        }
        
        return res.status(200).json({
            status: "SUCCESS",
            message: "Berhasil mengambil detail posisi",
            position
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "FAILED",
            message: "Terjadi kesalahan saat mengambil detail posisi"
        });
    }
});

// POST /api/position/add → Tambah posisi baru
router.post('/add', validateGlobalToken, isAdminOrSuperAdmin, async (req, res) => {
    const { position_name, type, work } = req.body;
    
    if (!position_name || !type || !work) {
        return res.status(400).json({
            status: "FAILED",
            message: "Field wajib (position_name, type, work) harus diisi"
        });
    }
    
    try {
        const newPosition = await positionModel.createPosition({
            position_name, type, work
        });
        
        return res.status(201).json({
            status: "SUCCESS",
            message: "Posisi berhasil ditambahkan",
            position: newPosition
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "FAILED",
            message: "Terjadi kesalahan saat menambahkan posisi"
        });
    }
});

// POST /api/position/update → Update posisi
router.post('/update', validateGlobalToken, isAdminOrSuperAdmin, async (req, res) => {
    const { position_id, position_name, type, work } = req.body;
    
    if (!position_id || !position_name || !type || !work) {
        return res.status(400).json({
            status: "FAILED",
            message: "Field wajib (position_id, position_name, type, work) harus diisi"
        });
    }
    
    try {
        const updated = await positionModel.updatePosition(position_id, {
            position_name, type, work
        });
        
        if (!updated) {
            return res.status(404).json({
                status: "FAILED",
                message: "Posisi tidak ditemukan"
            });
        }
        
        return res.status(200).json({
            status: "SUCCESS",
            message: "Posisi berhasil diperbarui"
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "FAILED",
            message: "Terjadi kesalahan saat memperbarui posisi"
        });
    }
});

// POST /api/position/delete → Hapus posisi
router.post('/delete', validateGlobalToken, isAdminOrSuperAdmin, async (req, res) => {
    const { position_id } = req.body;
    
    if (!position_id) {
        return res.status(400).json({
            status: "FAILED",
            message: "ID posisi diperlukan"
        });
    }
    
    try {
        const deleted = await positionModel.deletePosition(position_id);
        
        if (!deleted) {
            return res.status(404).json({
                status: "FAILED",
                message: "Posisi tidak ditemukan"
            });
        }
        
        return res.status(200).json({
            status: "SUCCESS",
            message: "Posisi berhasil dihapus"
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "FAILED",
            message: "Terjadi kesalahan saat menghapus posisi"
        });
    }
});

module.exports = router;