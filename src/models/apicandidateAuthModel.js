const pool = require('../config/db');
const bcrypt = require('bcryptjs');



module.exports = {
     checkLoginCandidate: async (username, password) => {
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

// Get candidate details by username
getCandidateByUsername : async (username) => {
    // Get candidate basic information
    const [candidateRows] = await pool.query(`
        SELECT c.id as candidate_id, c.*, u.username, u.email as user_email
        FROM candidates c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE u.username = ?
    `, [username]);
    
    if (candidateRows.length === 0) {
        return null;
    }
    
    const candidate = candidateRows[0];
    
    // Remove unwanted fields and candidate_position_id from the response
    const { 
        candidate_position_id,
        data_user,
        interviews,
        exam_reports, 
        summary_report,
        ...candidateInfo 
    } = candidate;
    
    return candidateInfo;
}


    


};