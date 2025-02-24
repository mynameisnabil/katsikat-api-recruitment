const express = require('express');
const app = express();
const authRoutes = require('./src/routes/authRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const appStatusRoutes = require('./src/routes/appStatusRoutes');


app.use(express.json());
app.use('/api/admin', authRoutes);
app.use('/api/data_admin', adminRoutes);
app.use('/app-status', appStatusRoutes);


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
