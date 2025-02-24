const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const redis = require('ioredis');
const redisClient = new redis(); // Pastikan klien Redis diinisialisasi dengan benar
const userModel = require('../models/userModel');
require('dotenv').config();

router.post('/login', async function (req, res) {
    res.setHeader('Content-Type', 'application/json');
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ status: "FAILED", message: "Username dan password harus diisi" });
    }

    const user = await userModel.checkLogin(username, password);
    if (!user) {
        return res.status(400).json({ status: "FAILED", message: "Username atau password salah" });
    }

    const token = jwt.sign({ username: user.username, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    await redisClient.set(`token:${user.username}`, token, 'EX', 86400); // Menggunakan set dengan opsi TTL

    return res.status(200).json({ status: "SUCCESS", message: "Login berhasil", role: user.role, token });
});

router.post('/register', async function (req, res) {
    res.setHeader('Content-Type', 'application/json');
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

router.get('/profile', async function (req, res) {
    res.setHeader('Content-Type', 'application/json');
    const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;


    if (!token) {
        return res.status(401).json({ status: "FAILED", message: "Token diperlukan" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const storedToken = await redisClient.get(`token:${decoded.username}`);

        if (!storedToken || storedToken !== token) {
            return res.status(401).json({ status: "FAILED", message: "Token tidak valid atau telah kadaluarsa" });
        }

        const userProfile = await userModel.getUserByUsername(decoded.username);
        if (!userProfile) {
            return res.status(404).json({ status: "FAILED", message: "User tidak ditemukan" });
        }

        return res.status(200).json({ status: "SUCCESS", profile: userProfile });
    } catch (error) {
        return res.status(401).json({ status: "FAILED", message: "Token tidak valid" });
    }
});

router.post('/getProfile', async function (req, res) {
    res.setHeader('Content-Type', 'application/json');
    const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;
    const { username } = req.body; // Mengambil username dari body

    if (!token) {
        return res.status(401).json({ status: "FAILED", message: "Token diperlukan" });
    }

    if (!username) {
        return res.status(400).json({ status: "FAILED", message: "Username harus diisi" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Memeriksa apakah user memiliki role yang valid
        if (decoded.role !== 'superadmin' && decoded.role !== 'admin') {
            return res.status(403).json({ status: "FAILED", message: "Akses ditolak: Anda tidak memiliki hak akses" });
        }

        const storedToken = await redisClient.get(`token:${decoded.username}`);

        if (!storedToken || storedToken !== token) {
            return res.status(401).json({ status: "FAILED", message: "Token tidak valid atau telah kadaluarsa" });
        }

        const userProfile = await userModel.getUserByUsername(username); // Mencari berdasarkan username dari body
        if (!userProfile) {
            return res.status(404).json({ status: "FAILED", message: "User tidak ditemukan" });
        }

        return res.status(200).json({ status: "SUCCESS", profile: userProfile });
    } catch (error) {
        console.error(error); // Tambahkan ini untuk melihat detail error di console
        return res.status(401).json({ status: "FAILED", message: "Token tidak valid" });
    }
});


router.post('/logout', async function (req, res) {
    res.setHeader('Content-Type', 'application/json');
    const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;

    if (!token) {
        return res.status(401).json({ status: "FAILED", message: "Token diperlukan" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        await redisClient.del(`token:${decoded.username}`);

        return res.status(200).json({ status: "SUCCESS", message: "Logout berhasil" });
    } catch (error) {
        return res.status(401).json({ status: "FAILED", message: "Token tidak valid" });
    }
});

module.exports = router;
