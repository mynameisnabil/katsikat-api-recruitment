const pool = require('../config/db');

const getAllPositions = async () => {
    const [rows] = await pool.query('SELECT * FROM positions');
    return rows.map(row => {
        const { id, ...rest } = row;
        return {
            ...rest,
            id_position: id
        };
    });
};

const getPositionById = async (id) => {
    const [rows] = await pool.query('SELECT * FROM positions WHERE id = ?', [id]);
    if (rows.length === 0) return null;
    const { id: rowId, ...rest } = rows[0];
    return {
        ...rest,
        id_position: rowId
    };
};

const createPosition = async (positionData) => {
    const { position_name, type, work } = positionData;
    const [result] = await pool.query(`
        INSERT INTO positions (position_name, type, work, created_at, updated_at)
        VALUES (?, ?, ?, NOW(), NOW())
    `, [position_name, type, work]);
    return {
        id_position: result.insertId,
        position_name,
        type,
        work
    };
};

const updatePosition = async (id, positionData) => {
    const { position_name, type, work } = positionData;
    const [result] = await pool.query(`
        UPDATE positions
        SET position_name = ?, type = ?, work = ?, updated_at = NOW()
        WHERE id = ?
    `, [position_name, type, work, id]);
    return result.affectedRows > 0;
};

const deletePosition = async (id) => {
    const [result] = await pool.query('DELETE FROM positions WHERE id = ?', [id]);
    return result.affectedRows > 0;
};

module.exports = {
    getAllPositions,
    getPositionById,
    createPosition,
    updatePosition,
    deletePosition
};
