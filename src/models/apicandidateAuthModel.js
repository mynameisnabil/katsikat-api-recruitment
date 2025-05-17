const pool = require('../config/db');
const bcrypt = require('bcryptjs');



module.exports = {
  checkLoginCandidate: async (username, password) => {
    try {
        // Get user data from users table
        const [userRows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        if (userRows.length === 0) return null;

        const user = userRows[0];

        // Validate password
        let isValidPassword = false;
        
        // Check if password is stored as plaintext or bcrypt hash
        if (user.password.length === 60) { // Length of bcrypt hash is 60 characters
            isValidPassword = await bcrypt.compare(password, user.password);
        } else {
            isValidPassword = user.password === password;
        }
        
        // If password is invalid, return null
        if (!isValidPassword) return null;
        
        // Get candidate_id from candidates table using user_id
        const [candidateRows] = await pool.query('SELECT id as candidate_id FROM candidates WHERE user_id = ?', [user.id]);
        
        // Add candidate_id to the user object if found
        if (candidateRows.length > 0) {
            user.candidate_id = candidateRows[0].candidate_id;
        } else {
            user.candidate_id = null; // Set to null if no candidate record found
        }
        
        return user;
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