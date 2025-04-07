const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const adminModel = require('../models/adminModel');
const { validateGlobalToken } = require('../middleware/authMiddleware');
require('dotenv').config();

// Cek apakah JWT (dari body) memiliki role superadmin
const isSuperAdmin = (req, res, next) => {
    const token = req.body.token;
    if (!token) return res.status(401).json({ status: "FAILED", message: "Token JWT diperlukan" });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'superadmin') {
            return res.status(403).json({ status: "FAILED", message: "Hanya superadmin yang diperbolehkan" });
        }
        next();
    } catch (err) {
        return res.status(401).json({ status: "FAILED", message: "Token JWT tidak valid" });
    }
};

// Tambah admin
router.post('/add', validateGlobalToken, isSuperAdmin, async (req, res) => {
    const { username, password, full_name, email, role } = req.body;

    if (!username || !password || !full_name || !email || !role) {
        return res.status(400).json({ status: "FAILED", message: "Semua field harus diisi" });
    }

    try {
        const newUser = await adminModel.addAdmin({ username, password, full_name, email, role });
        return res.status(201).json({ status: "SUCCESS", message: "Admin berhasil ditambahkan", admin: newUser });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: "FAILED", message: "Terjadi kesalahan saat menambahkan admin" });
    }
});

// Daftar admin
router.post('/users/list', validateGlobalToken, isSuperAdmin, async (req, res) => {
    try {
        const admins = await adminModel.getAllAdmins();
        return res.status(200).json({ status: "SUCCESS", admins });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: "FAILED", message: "Terjadi kesalahan saat mengambil daftar admin" });
    }
});

// Detail admin
router.post('/users/detail', validateGlobalToken, isSuperAdmin, async (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).json({ status: "FAILED", message: "ID admin harus diisi" });

    try {
        const admin = await adminModel.getAdminById(id);
        if (!admin) return res.status(404).json({ status: "FAILED", message: "Admin tidak ditemukan" });
        return res.status(200).json({ status: "SUCCESS", admin });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: "FAILED", message: "Terjadi kesalahan" });
    }
});

// Update admin
router.post('/users/update', validateGlobalToken, isSuperAdmin, async (req, res) => {
    const { id, username, full_name, email, role } = req.body;
    if (!id || !username || !full_name || !email || !role) {
        return res.status(400).json({ status: "FAILED", message: "Semua field harus diisi" });
    }

    try {
        const updatedAdmin = await adminModel.updateAdmin(id, { username, full_name, email, role });
        if (!updatedAdmin) return res.status(404).json({ status: "FAILED", message: "Admin tidak ditemukan" });
        return res.status(200).json({ status: "SUCCESS", message: "Admin diperbarui", admin: updatedAdmin });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: "FAILED", message: "Terjadi kesalahan" });
    }
});

// Hapus admin
router.post('/users/delete', validateGlobalToken, isSuperAdmin, async (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).json({ status: "FAILED", message: "ID admin harus diisi" });

    try {
        const deleted = await adminModel.deleteAdmin(id);
        if (!deleted) return res.status(404).json({ status: "FAILED", message: "Admin tidak ditemukan" });
        return res.status(200).json({ status: "SUCCESS", message: "Admin dihapus" });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: "FAILED", message: "Terjadi kesalahan" });
    }
});

module.exports = router;
