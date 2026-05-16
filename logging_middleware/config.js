require('dotenv').config();

module.exports = {
    baseUrl: process.env.BASE_URL,
    email: process.env.EMAIL,
    name: process.env.NAME,
    rollNo: process.env.ROLL_NO,
    accessCode: process.env.ACCESS_CODE,
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    token: process.env.TOKEN
};
