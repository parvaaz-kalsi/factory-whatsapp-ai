const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const usersData = fs.readFileSync(path.join(process.cwd(), 'users.json'), 'utf8');
        const users = JSON.parse(usersData);

        const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        console.log(`[Authentication] User "${user.username}" logged in successfully under role "${user.role}"`);
        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                displayName: user.displayName
            }
        });
    } catch (err) {
        console.error('Error during login API handler:', err);
        res.status(500).json({ error: 'Internal server login error' });
    }
};
