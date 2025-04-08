const pool = require('../config/db');
const bcrypt = require('bcryptjs');

module.exports = {
    register: async (userData) => {
        try {
            
            const hashedPassword = await bcrypt.hash(userData.password, 10);
            const [result] = await pool.query(
                'INSERT INTO users (username, password, full_name, email, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
                [userData.username, hashedPassword, userData.full_name, userData.email, userData.role]
            );
            return result;
        } catch (error) {
            console.error(error);
            return null;
        }
    },

    checkLogin: async (username, password) => {
        try {
            const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
            if (rows.length === 0) return null;

            const user = rows[0];

            // Cek apakah password tersimpan dalam plaintext atau bcrypt hash
            if (user.password.length === 60) { // Panjang bcrypt hash adalah 60 karakter
                const isMatch = await bcrypt.compare(password, user.password);
                return isMatch ? user : null;
            } else {
                return user.password === password ? user : null;
            }
        } catch (error) {
            console.error(error);
            return null;
        }
    },

    getUserByUsername: async (username) => {
        try {
            const [rows] = await pool.query('SELECT username, full_name, email, role, created_at FROM users WHERE username = ?', [username]);
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            console.error(error);
            return null;
        }
    },

    getAllUsers: async () => {
        try {
            const [rows] = await pool.query('SELECT username, full_name, email, role, created_at FROM users');
            return rows;
        } catch (error) {
            console.error(error);
            return [];
        }
    }
};
