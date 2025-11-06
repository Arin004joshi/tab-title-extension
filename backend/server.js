const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { sequelize, Profile } = require('./models/profile');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(bodyParser.json());

app.post('/profiles', async (req, res) => {
    try {
        const payload = req.body;
        if (Array.isArray(payload)) {
            const created = await Profile.bulkCreate(payload, { validate: true });
            return res.status(201).json({ created: created.length });
        } else {
            const created = await Profile.create(payload);
            return res.status(201).json(created);
        }
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error', details: err.message });
    }
});

app.get('/', (req, res) => res.send('TabPeek backend up'));

(async () => {
    await sequelize.sync();
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
})();
