const fs = require('fs');
const file = 'backend/src/controllers/tripController.js';
let data = fs.readFileSync(file, 'utf8');

data = data.replace(
  "const { userId } = req.body;",
  "const { userId } = req.body;\n            const User = require('../models/User');\n            const ownerUser = await User.findOne({ firebaseUid: req.user.uid });\n            if (!ownerUser || (!ownerUser.following.includes(userId) && !ownerUser.followers.includes(userId))) {\n                return res.status(403).json({ error: 'Collaborators must be friends (following or follower)' });\n            }"
);

fs.writeFileSync(file, data);
