const mongoose = require("mongoose");


const userSchema = mongoose.Schema({
    username: String,
    name: String,
    email: String,
    age: Number,
    password: String,
    posts: [
        {type: mongoose.Schema.Types.ObjectId, ref: "post"}
    ],
    profileImage: {
        type: String,
        default: process.env.DEFAULT_PROFILE_IMAGE
    }
})

module.exports = mongoose.model("user", userSchema);