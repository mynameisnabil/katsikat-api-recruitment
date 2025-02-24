const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // Koneksi database
require('dotenv').config();

// Endpoint untuk mengecek status aplikasi dan database
router.get('/', async (req, res) => {
    const status = {
        project: "running",
        uptime: process.uptime(), // Waktu server berjalan dalam detik
        version: process.env.APP_VERSION || "1.0.0",
        database: "down" // Default status database (akan diperbarui jika sukses)
    };

    try {
        // Coba query sederhana untuk cek koneksi ke database
        await pool.query('SELECT 1');
        status.database = "connected";
    } catch (error) {
        console.error("Database connection error:", error.message);
        status.database = "error";
    }

    return res.status(200).json(status);
});

module.exports = router;
