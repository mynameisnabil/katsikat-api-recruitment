const pool = require('../config/db');

const getAllStatuses = async () => {
    const [rows] = await pool.query('SELECT * FROM status');
    return rows.map(row => {
        const { id, ...rest } = row;
        return {
            ...rest,
            id_status: id
        };
    });
};

const getStatusById = async (id) => {
    const [rows] = await pool.query('SELECT * FROM status WHERE id = ?', [id]);
    if (rows.length === 0) return null;
    const { id: rowId, ...rest } = rows[0];
    return {
        ...rest,
        id_status: rowId
    };
};

const createStatus = async (status_name) => {
    const [result] = await pool.query(`
        INSERT INTO status (status_name, created_at, updated_at)
        VALUES (?, NOW(), NOW())
    `, [status_name]);
    return {
        id_status: result.insertId,
        status_name
    };
};

const updateStatus = async (id, status_name) => {
    const [result] = await pool.query(`
        UPDATE status
        SET status_name = ?, updated_at = NOW()
        WHERE id = ?
    `, [status_name, id]);
    return result.affectedRows > 0;
};

const deleteStatus = async (id) => {
    const [result] = await pool.query('DELETE FROM status WHERE id = ?', [id]);
    return result.affectedRows > 0;
};

module.exports = {
    getAllStatuses,
    getStatusById,
    createStatus,
    updateStatus,
    deleteStatus
};
