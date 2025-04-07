require('dotenv').config();

const validateGlobalToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token || token !== process.env.GLOBAL_API_KEY) {
        return res.status(401).json({ status: "FAILED", message: "Token global tidak valid" });
    }
    next();
};

module.exports = { validateGlobalToken };
