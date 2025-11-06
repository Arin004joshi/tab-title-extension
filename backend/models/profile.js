// models/profile.js
const { Sequelize, DataTypes } = require('sequelize');
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: 'database.sqlite'
});

const Profile = sequelize.define('Profile', {
    name: { type: DataTypes.STRING },
    url: { type: DataTypes.TEXT },
    about: { type: DataTypes.TEXT }, // about / headline
    bio: { type: DataTypes.TEXT }, // full bio/summary
    location: { type: DataTypes.STRING },
    followerCount: { type: DataTypes.STRING },
    connectionCount: { type: DataTypes.STRING },
    bioLine: { type: DataTypes.STRING } // short bio line
}, {
    timestamps: true
});

module.exports = { sequelize, Profile };
