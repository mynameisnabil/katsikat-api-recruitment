const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const adminModel = require('../models/adminModel'); // Pastikan model ini ada
require('dotenv').config();

// Middleware untuk memeriksa apakah user adalah superadmin
const isSuperAdmin = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ status: "FAILED", message: "Token diperlukan" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'superadmin') {
            return res.status(403).json({ status: "FAILED", message: "Akses ditolak: Hanya super admin yang diperbolehkan" });
        }
        next();
    } catch (error) {
        return res.status(401).json({ status: "FAILED", message: "Token tidak valid" });
    }
};

// Tambah admin baru
router.post('/add', isSuperAdmin, async (req, res) => {
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

// Ambil daftar admin
router.post('/users/list', isSuperAdmin, async (req, res) => {
    try {
        const admins = await adminModel.getAllAdmins();
        return res.status(200).json({ status: "SUCCESS", admins });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: "FAILED", message: "Terjadi kesalahan saat mengambil daftar admin" });
    }
});

// Ambil detail admin berdasarkan ID
router.post('/users/detail', isSuperAdmin, async (req, res) => {
    const { id } = req.body; // Mengambil ID dari body

    if (!id) {
        return res.status(400).json({ status: "FAILED", message: "ID admin harus diisi" });
    }

    try {
        const admin = await adminModel.getAdminById(id);
        if (!admin) {
            return res.status(404).json({ status: "FAILED", message: "Admin tidak ditemukan" });
        }
        return res.status(200).json({ status: "SUCCESS", admin });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: "FAILED", message: "Terjadi kesalahan saat mengambil detail admin" });
    }
});

// Update data admin
router.post('/users/update', isSuperAdmin, async (req, res) => {
    const { id, username, full_name, email, role } = req.body;

    if (!id || !username || !full_name || !email || !role) {
        return res.status(400).json({ status: "FAILED", message: "Semua field harus diisi" });
    }

    try {
        const updatedAdmin = await adminModel.updateAdmin(id, { username, full_name, email, role });
        if (!updatedAdmin) {
            return res.status(404).json({ status: "FAILED", message: "Admin tidak ditemukan" });
        }
        return res.status(200).json({ status: "SUCCESS", message: "Data admin berhasil diperbarui", admin: updatedAdmin });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: "FAILED", message: "Terjadi kesalahan saat memperbarui data admin" });
    }
});

// Hapus admin
router.post('/users/delete', isSuperAdmin, async (req, res) => {
    const { id } = req.body;

    if (!id) {
        return res.status(400).json({ status: "FAILED", message: "ID admin harus diisi" });
    }

    try {
        const deletedAdmin = await adminModel.deleteAdmin(id);
        if (!deletedAdmin) {
            return res.status(404).json({ status: "FAILED", message: "Admin tidak ditemukan" });
        }
        return res.status(200).json({ status: "SUCCESS", message: "Admin berhasil dihapus" });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: "FAILED", message: "Terjadi kesalahan saat menghapus admin" });
    }
});

module.exports = router;
