require("dotenv").config();
const express = require("express");
const userModel = require("./models/user");
const postModel = require("./models/post");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
const mongoose = require("mongoose");
const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB connected"))
    .catch(err => console.log(err));

app.set("view engine", "ejs")
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/", isGuest, (req, res) => {
    res.render("index");
});

app.get("/create", isGuest, (req, res) => {
    res.render("create")
})

app.get("/login", isGuest, (req, res) => {
    res.render("login");
});

app.get("/profile", isLoggedIn, async (req, res) => {
    let user = await userModel.findOne({ email: req.user.email }).populate("posts");
    res.render("profile", { user });
});

app.get("/like/:id", isLoggedIn, async (req, res) => {
    let post = await postModel.findOne({ _id: req.params.id }).populate("user");

    if (!post) return res.redirect("/feed");

    if (post.likes.indexOf(req.user.userid) === -1) {
        post.likes.push(req.user.userid);
    }
    else {
        post.likes.splice(post.likes.indexOf(req.user.userid), 1)
    }
    await post.save();

    if (req.query.from === "feed") {
        return res.redirect("/feed");
    }

    res.redirect("/profile");
});

app.get("/edit/:id", isLoggedIn, async (req, res) => {
    let post = await postModel.findOne({ _id: req.params.id }).populate("user");

    if (!post.user.equals(req.user.userid)) {
        return res.render("unauthorized");
    }

    res.render("edit", { post });
});

app.post("/update/:id", isLoggedIn, async (req, res) => {
    let post = await postModel.findOneAndUpdate({ _id: req.params.id }, { content: req.body.content });

    if (!post.user.equals(req.user.userid)) {
        return res.render("unauthorized");
    }
    res.redirect("/profile");
});

app.get("/delete/:id", isLoggedIn, async (req, res) => {
    let post = await postModel.findOne({ _id: req.params.id });

    if (!post.user.equals(req.user.userid)) {
        return res.render("unauthorized");
    }
    await postModel.findOneAndDelete({ _id: req.params.id });
    res.redirect("/profile");
});

app.post("/post", isLoggedIn, async (req, res) => {
    let user = await userModel.findOne({ email: req.user.email });
    let { content } = req.body;

    let post = await postModel.create({
        user: user._id,
        content
    });

    user.posts.push(post._id);
    await user.save();
    res.redirect("/profile");
});

app.post("/register", async (req, res) => {
    let { username, name, email, age, password } = req.body;

    let user = await userModel.findOne({ email });
    if (user) return res.status(500).render("userexist");

    bcrypt.genSalt(10, (err, salt) => {
        bcrypt.hash(password, salt, async (err, hash) => {
            let user = await userModel.create({
                username,
                name,
                email,
                age,
                password: hash
            });

            let token = jwt.sign({ email: email, userid: user._id, username: username }, process.env.JWT_SECRET);
            res.cookie("token", token, {
                httpOnly: true,
                secure: true,
                sameSite: "none"
            });
            res.redirect("feed");
        });
    });
});

app.post("/login", async (req, res) => {
    let { username, email, password } = req.body;

    let user = await userModel.findOne({ email });
    if (!user) {
        return res.status(401).render("loginerror");
    }
    bcrypt.compare(password, user.password, (err, result) => {
        if (result) {
            let token = jwt.sign({ email: email, userid: user._id, }, process.env.JWT_SECRET);
            res.cookie("token", token, {
                httpOnly: true,
                secure: true,
                sameSite: "none"
            });
            res.redirect("/feed");
        }
        else {
            return res.render("loginerror");
        }
    })
});

app.get("/logout", (req, res) => {
    res.cookie("token", "");
    res.redirect("/login");
});


app.get("/feed", isLoggedIn, async (req, res) => {
    let posts = await postModel.find().populate("user").sort({ date: -1 });
    posts = posts.map(post => ({
        ...post._doc,
        timeAgo: timeAgo(post.date)
    }));
    let user = await userModel.findOne({ email: req.user.email })
    res.render("feed", { posts, user, currentUser: req.user })
});

app.get("/home", isLoggedIn, async (req, res) => {
    let user = await userModel.findOne({ email: req.user.email })
    res.render("home", { user })
})




function isLoggedIn(req, res, next) {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).render("loginrequired");
    }

    try {
        const data = jwt.verify(token, process.env.JWT_SECRET);
        req.user = data;
        next();
    } catch (err) {
        return res.status(401).render("loginrequired");
    }

}

function isGuest(req, res, next) {
    const token = req.cookies.token;

    if (token) {
        return res.redirect("/home");
    }

    next();
}

function timeAgo(date) {
    const seconds = Math.floor((Date.now() - new Date(date)) / 1000);

    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}





app.get("/unauthorized", (req, res) => {
    res.render("unauthorized");
});

app.get("/404", (req, res) => {
    res.render("404");
});

app.get("/500", (req, res) => {
    res.render("500");
});



app.listen(PORT, () => {
    console.log("Server running on port", PORT);
});


app.use((req, res) => {
    res.status(404).render("404");
});

app.use((err, req, res, next) => {
    console.error(err.stack);

    res.status(500).render("500");
});
