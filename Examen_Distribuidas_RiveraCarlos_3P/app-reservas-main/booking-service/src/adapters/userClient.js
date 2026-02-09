const axios = require('axios');

const BASE = process.env.USER_SERVICE_URL || 'http://user-service:5001';

const getMe = async (token) => {
  const res = await axios.get(`${BASE}/me`, { headers: { Authorization: `Bearer ${token}` }, timeout: 3000 });
  return res.data;
};

module.exports = { getMe };
