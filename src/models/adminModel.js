const mysql = require('mysql2/promise'); // Menggunakan mysql2 dengan promise
const pool = require('../config/db');


// Fungsi untuk menambah admin baru
const addAdmin = async ({ username, password, full_name, email, role }) => {
    const [rows] = await pool.query('INSERT INTO users (username, password, full_name, email, role) VALUES (?, ?, ?, ?, ?)', 
        [username, password, full_name, email, role]);
    return { id: rows.insertId, username, full_name, email, role }; // Mengembalikan admin yang baru ditambahkan
};

// Fungsi untuk mengambil semua admin
const getAllAdmins = async () => {
    const [rows] = await pool.query('SELECT id, username, full_name, email, role FROM users WHERE role = "admin"');
    return rows; // Mengembalikan daftar admin
};

// Fungsi untuk mengambil admin berdasarkan ID
const getAdminById = async (id) => {
    const [rows] = await pool.query('SELECT id, username, full_name, email, role FROM users WHERE id = ?', [id]);
    return rows[0]; // Mengembalikan admin dengan ID tertentu
};

// Fungsi untuk memperbarui data admin
const updateAdmin = async (id, { username, full_name, email, role }) => {
    const [result] = await pool.query('UPDATE users SET username = ?, full_name = ?, email = ?, role = ? WHERE id = ?', 
        [username, full_name, email, role, id]);
    return result.affectedRows > 0; // Mengembalikan true jika ada baris yang terpengaruh
};

// Fungsi untuk menghapus admin
const deleteAdmin = async (id) => {
    const [result] = await pool.query('DELETE FROM users WHERE id = ?', [id]);
    return result.affectedRows > 0; // Mengembalikan true jika ada baris yang terpengaruh
};

module.exports = {
    addAdmin,
    getAllAdmins,
    getAdminById,
    updateAdmin,
    deleteAdmin,
};
