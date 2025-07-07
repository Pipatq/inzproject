// Load environment variables first
const dotenv = require('dotenv');
dotenv.config();

// Import the configured Express app
const app = require('./src/app');

// Get the port from environment variables or use a default
const PORT = process.env.PORT || 3000;

// Start listening for requests
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});