const express = require("express");
const userModel = require("./models/user");
const postModel = require("./models/post");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();

app.set("view engine", "ejs")
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/", (req, res) => {
    res.render("index");
});

app.get("/create", (req, res) => {
    res.render("create")
})

app.get("/login", (req, res) => {
    res.render("login");
});

app.get("/profile", isLoggedIn, async (req, res) => {
    let user = await userModel.findOne({email: req.user.email}).populate("posts");
    res.render("profile", {user});
});

app.get("/like/:id", isLoggedIn, async (req, res) => {
    let post = await postModel.findOne({_id: req.params.id}).populate("user");

    if (!post) return res.redirect("/feed"); 

    if(post.likes.indexOf(req.user.userid) === -1){
        post.likes.push(req.user.userid);
    }
    else{
        post.likes.splice(post.likes.indexOf(req.user.userid), 1)
    }
    await post.save();

    if (req.query.from === "feed") {
        return res.redirect("/feed");
    }

    res.redirect("/profile");
});

app.get("/edit/:id", isLoggedIn, async (req, res) => {
    let post = await postModel.findOne({_id: req.params.id}).populate("user");
    
    if (!post.user.equals(req.user.userid)) {
        return res.render("unauthorized");
    }

    res.render("edit", {post});
});

app.post("/update/:id", isLoggedIn, async (req, res) => {
    let post = await postModel.findOneAndUpdate({_id: req.params.id}, {content: req.body.content});
    
    if (!post.user.equals(req.user.userid)) {
        return res.render("unauthorized");
    }
    res.redirect("/profile");
});

app.get("/delete/:id", isLoggedIn, async (req, res) => {
    let post = await postModel.findOne({_id: req.params.id});
    
    if (!post.user.equals(req.user.userid)) {
        return res.render("unauthorized");
    }
    await postModel.findOne({_id: req.params.id});
    res.redirect("/profile");
});

app.post("/post", isLoggedIn, async (req, res) => {
    let user = await userModel.findOne({email: req.user.email});
    let {content} = req.body;
    
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

            let token = jwt.sign({ email: email, userid: user._id, username: username }, "secretkey");
            res.cookie("token", token);
            res.redirect("feed");
        });
    });
});

app.post("/login", async (req, res) => {
    let { username, email, password } = req.body;

    let user = await userModel.findOne({ email });
    if (!user) {
        res.status(500).render("loginerror");
    }
    bcrypt.compare(password, user.password, (err, result) => {
        if (result) {
            let token = jwt.sign({ email: email, userid: user._id, }, "secretkey");
            res.cookie("token", token);
            res.status(200).redirect("/feed");
        }
        else res.render("loginerror");
    })
});

app.get("/logout", (req, res) => {
    res.cookie("token", "");
    res.redirect("/login");
});

function isLoggedIn(req, res, next) {
    if (req.cookies.token === "") return res.render("loginrequired")

    else {
        let data = jwt.verify(req.cookies.token, "secretkey");
        req.user = data
    }

    next();
}


app.get("/feed", isLoggedIn, async (req, res) => {
    let posts = await postModel.find().populate("user").sort({date: -1});
    let user = await userModel.findOne({email: req.user.email})
    res.render("feed", {posts, user, currentUser: req.user})
})

app.get("/unauthorized", (req, res) => {
    res.render("unauthorized");
});


app.listen(3000);