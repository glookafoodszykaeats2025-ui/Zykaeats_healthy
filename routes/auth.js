const express = require('express');
const fs      = require('fs');
const path    = require('path');

const router  = express.Router();
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

// ── In-memory OTP store (use Redis in production) ──
const otpStore = new Map(); // phone → { otp, expiresAt, attempts }

function readUsers(){
  try{ return JSON.parse(fs.readFileSync(USERS_FILE,'utf8')); }
  catch(e){ return []; }
}
function writeUsers(arr){
  try{ fs.writeFileSync(USERS_FILE, JSON.stringify(arr, null, 2)); }
  catch(e){ console.error('Write users error:', e); }
}

function generateOTP(){
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ── POST /api/auth/send-otp ──
router.post('/send-otp', async (req, res) => {
  const { phone } = req.body;
  if(!phone || !/^\d{10}$/.test(phone)){
    return res.status(400).json({ error: 'Valid 10-digit phone required' });
  }

  const otp = generateOTP();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
  otpStore.set(phone, { otp, expiresAt, attempts: 0 });

  // ── Fast2SMS integration ──
  const apiKey = process.env.FAST2SMS_API_KEY;

  if(!apiKey || apiKey === 'YOUR_FAST2SMS_API_KEY'){
    // DEV MODE: log OTP to console instead of sending SMS
    console.log(`\n🔐 DEV OTP for ${phone}: ${otp}\n`);
    return res.json({ ok: true, dev: true, message: 'OTP logged to server console (add FAST2SMS_API_KEY to send real SMS)' });
  }

  try{
    const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        'authorization': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        route: 'otp',
        variables_values: otp,
        numbers: phone,
      })
    });
    const data = await response.json();
    if(data.return === true){
      res.json({ ok: true });
    } else {
      console.error('Fast2SMS error:', data);
      res.status(500).json({ error: 'Failed to send OTP. Try again.' });
    }
  } catch(err){
    console.error('Fast2SMS fetch error:', err);
    res.status(500).json({ error: 'SMS service unavailable. Try again.' });
  }
});

// ── POST /api/auth/verify-otp ──
router.post('/verify-otp', (req, res) => {
  const { phone, otp } = req.body;
  if(!phone || !otp){
    return res.status(400).json({ error: 'Phone and OTP required' });
  }

  const record = otpStore.get(phone);
  if(!record){
    return res.status(400).json({ error: 'OTP not found. Please request a new one.' });
  }
  if(Date.now() > record.expiresAt){
    otpStore.delete(phone);
    return res.status(400).json({ error: 'OTP expired. Please request a new one.' });
  }
  record.attempts++;
  if(record.attempts > 5){
    otpStore.delete(phone);
    return res.status(429).json({ error: 'Too many attempts. Request a new OTP.' });
  }
  if(record.otp !== otp.toString()){
    return res.status(400).json({ error: `Incorrect OTP. ${5 - record.attempts} attempt(s) left.` });
  }

  // OTP valid — clear it
  otpStore.delete(phone);

  // Find or create user
  const users = readUsers();
  let user = users.find(u => u.phone === phone);
  if(!user){
    user = {
      id: 'USR-' + Date.now().toString(36).toUpperCase(),
      phone,
      name: 'Customer',
      email: '',
      addr: '',
      maps: '',
      lat: null,
      lng: null,
      cuisines: [],
      joinedAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    };
    users.push(user);
  } else {
    user.lastLogin = new Date().toISOString();
  }
  writeUsers(users);

  res.json({
    ok: true,
    user: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      addr: user.addr,
      maps: user.maps,
      lat: user.lat,
      lng: user.lng,
      cuisines: user.cuisines
    }
  });
});

module.exports = router;
