const express = require('express');
const fs      = require('fs');
const path    = require('path');

const router  = express.Router();
const DATA    = path.join(__dirname, 'data', 'users.json');

function readUsers(){
  try{ return JSON.parse(fs.readFileSync(DATA,'utf8')); }
  catch(e){ return []; }
}
function writeUsers(arr){
  fs.writeFileSync(DATA, JSON.stringify(arr, null, 2));
}

// POST /api/users/signup
router.post('/signup', (req, res) => {
  try{
    const { name, phone, email, addr, state, cuisines, joinedAt, skipped } = req.body;
    if(!name && !skipped) return res.status(400).json({ error: 'Name required' });

    const users = readUsers();
    // Update existing if same phone, else add new
    const idx = phone ? users.findIndex(u => u.phone === phone) : -1;
    const record = { name, phone, email, addr, state, cuisines, joinedAt, skipped: !!skipped };

    if(idx >= 0){ users[idx] = { ...users[idx], ...record }; }
    else { record.id = 'USR-' + Date.now().toString(36).toUpperCase(); users.push(record); }

    writeUsers(users);
    res.json({ ok: true, id: record.id || users[idx]?.id });
  }catch(err){
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users — admin only (basic)
router.get('/', (req, res) => {
  try{
    const users = readUsers();
    res.json({ users, total: users.length });
  }catch(e){
    res.status(500).json({ error: 'Could not read users' });
  }
});

module.exports = router;
