const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const redis = require('ioredis');
const redisClient = new redis();
const userModel = require('../models/userModel');
const { validateGlobalToken } = require('../middleware/authMiddleware');
require('dotenv').config();

// Login
router.post('/login', validateGlobalToken, async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ status: "FAILED", message: "Username dan password harus diisi" });
    }

    const user = await userModel.checkLogin(username, password);
    if (!user) {
        return res.status(400).json({ status: "FAILED", message: "Username atau password salah" });
    }

    const token = jwt.sign({ username: user.username, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    await redisClient.set(`token:${user.username}`, token, 'EX', 86400);

    return res.status(200).json({ status: "SUCCESS", message: "Login berhasil", role: user.role, token });
});

// Register
router.post('/register', validateGlobalToken, async (req, res) => {
    const { username, password, full_name, email, role } = req.body;
    if (!username || !password || !full_name || !email || !role) {
        return res.status(400).json({ status: "FAILED", message: "Semua field harus diisi" });
    }

    const result = await userModel.register({ username, password, full_name, email, role });
    if (result) {
        return res.status(201).json({ status: "SUCCESS", message: "User berhasil didaftarkan" });
    } else {
        return res.status(500).json({ status: "FAILED", message: "Gagal mendaftarkan user" });
    }
});

// Profile berdasarkan token Redis
router.get('/profile', validateGlobalToken, async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: "FAILED", message: "Token diperlukan" });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const storedToken = await redisClient.get(`token:${decoded.username}`);
        if (!storedToken || storedToken !== token) {
            return res.status(401).json({ status: "FAILED", message: "Token tidak valid atau kadaluarsa" });
        }

        const userProfile = await userModel.getUserByUsername(decoded.username);
        if (!userProfile) {
            return res.status(404).json({ status: "FAILED", message: "User tidak ditemukan" });
        }

        return res.status(200).json({ status: "SUCCESS", profile: userProfile });
    } catch (err) {
        return res.status(401).json({ status: "FAILED", message: "Token tidak valid" });
    }
});

// Get profile by username (role superadmin/admin) via token in body
router.post('/getProfile', validateGlobalToken, async (req, res) => {
    const { token, username } = req.body;
    if (!token || !username) {
        return res.status(400).json({ status: "FAILED", message: "Token dan username harus diisi" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'superadmin' && decoded.role !== 'admin') {
            return res.status(403).json({ status: "FAILED", message: "Akses ditolak" });
        }

        const storedToken = await redisClient.get(`token:${decoded.username}`);
        if (!storedToken || storedToken !== token) {
            return res.status(401).json({ status: "FAILED", message: "Token tidak valid atau kadaluarsa" });
        }

        const userProfile = await userModel.getUserByUsername(username);
        if (!userProfile) return res.status(404).json({ status: "FAILED", message: "User tidak ditemukan" });

        return res.status(200).json({ status: "SUCCESS", profile: userProfile });
    } catch (err) {
        console.error(err);
        return res.status(401).json({ status: "FAILED", message: "Token tidak valid" });
    }
});

// Logout
router.post('/logout', validateGlobalToken, async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: "FAILED", message: "Token diperlukan" });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        await redisClient.del(`token:${decoded.username}`);
        return res.status(200).json({ status: "SUCCESS", message: "Logout berhasil" });
    } catch (err) {
        return res.status(401).json({ status: "FAILED", message: "Token tidak valid" });
    }
});

module.exports = router;
