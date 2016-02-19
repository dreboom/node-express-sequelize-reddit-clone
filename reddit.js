// Dependencies
var express = require('express');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var Sequelize = require('sequelize');
var bcrypt = require('bcrypt');
var secureRandom = require('secure-random');


var db = new Sequelize('reddit_clone', 'dreboom', undefined, {
    dialect: 'mysql'
});

var app = express();


// Middleware
app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(cookieParser());


function createSessionToken() {
    return secureRandom.randomArray(40).map(code => code.toString(16)).join('');
}



function checkLoginToken(request, response, next) {
    if (request.cookies.SESSION) {
        Session.findOne({
            where: {
                token: request.cookies.SESSION
            },
            include: User // so we can add it to the request
        }).then(
            function(session) {
                // session will be null if no token was found
                if (session) {
                    request.loggedInUser = session.user;
                }

                // No matter what, we call `next()` to move on to the next handler
                next();
            }
        );
    }
}

app.use(checkLoginToken);



// Table Creation:


var User = db.define('user', {
    username: {
        type: Sequelize.STRING,
        unique: true
    },
    hashed_password: {
        type: Sequelize.STRING
    },
    password: {
        validate: {
            len: [5, 25]
        },
        type: Sequelize.VIRTUAL,
        set: function(actualPassword) {
            this.setDataValue('hashed_password', bcrypt.hashSync(actualPassword, 10));
            this.setDataValue("password", actualPassword);
        }
    }
});

// Even though the content belongs to users, we will setup the userId relationship later
var Content = db.define('content', {
    url: Sequelize.STRING,
    title: Sequelize.STRING

});

// Even though a vote has a link to user and content, we will setup the relationship later
var Vote = db.define('vote', {
    upVote: Sequelize.INTEGER
});


var Session = db.define('session', {
    token: Sequelize.STRING
});


// Relation Creation:

// User <-> Content relationship
Content.belongsTo(User); // This will add a `setUser` function on content objects
User.hasMany(Content); // This will add an `addContent` function on user objects

// User <-> Vote <-> Content relationship
User.belongsToMany(Content, {
    through: Vote,
    as: 'Upvotes'
}); // This will add an `add`
Content.belongsToMany(User, {
    through: Vote
});

Content.hasMany(Vote);

User.hasMany(Session); // This will let us do user.createSession
Session.belongsTo(User); // This will let us do Session.findOne({include: User})

// Testing Sort Buttons

// app.get('/sortby', function(req, res, next) {
//         res.sendFile(__dirname + '/sortby_buttons.html');
//     });



// To Create Content:

function createNewContent(userId, url, title, callback) {
    Content.create({
        userId: userId,
        url: url,
        title: title,
    }).then(function(NewContent) {
        callback(NewContent);
    });
}


app.get('/createContent', function(req, res, next) {
    if (!req.loggedInUser) {
        res.status(401).send('You must be logged in to create content!');
    }
    else {
        res.sendFile(__dirname + '/create_post_form.html');
    }
});
app.post('/createContent', function(req, res) {
    req.loggedInUser.createContent({
        url: req.body.url,
        title: req.body.title
    }).then(function(NewContent) {
        res.redirect("/contents");
    });
});



app.get('/contents', function(request, response) {


    Content.findAll({
        limit: 2,
        include: User,
        order: [
            ['createdAt', 'DESC']
        ]
    }).then(function(returnedContent) {

        var listLi = "";
        returnedContent.forEach(function(item) {

            listLi = listLi + `<li>Title: ${item.title} <br>Url: ${item.url} <br>User: ${item.user.username}  </li>
            <form action="/voteContent" method="post">
            <input type="hidden" name="upVote" value="true">
            <input type="hidden" name="contentId" value=${item.id}>
            <button type="submit">upvote this</button>
            </form>
            <form action="/voteContent" method="post">
            <input type="hidden" name="upVote" value="false">
            <input type="hidden" name="contentId" value=${item.id}>
            <button type="submit">downvote this</button>
            </form>
            `;

        });
        var htmlCore = "<div><h1>List of Contents</h1><ul>" + "<div><h3>Sort By</h3></div>" + '<button type="submit">Top</button> <button type="submit">Hot</button> <button type="submit">New</button> <button type="submit">Contreversial</button>' + "<br></br>" + listLi + "</ul></div>";
        listLi.length > 0 ? response.send(htmlCore) : response.send("Check your Code!");

    });
});



// To Create User:

function createNewUser(username, password, callback) {
    User.create({
        username: username,
        password: password
            //This is a callback function
    }).then(function(user) {
        callback(user);
    });
}


app.get('/signup', function(req, res, next) {

    var form = '<form action="/signup" method="post"><div><input type="text" name="username" placeholder="Enter a username"></div><div><input type="text" name="password" placeholder="Enter your password"></div><button type="submit">Sign Up!</button></form>';
    if (req.query.error) {
        form = form + req.query.error;
    }
    res.send(form);

});


app.post('/signup', function(req, res) {
    User.create({
        username: req.body.username,
        password: req.body.password
            //This is a callback function
    }).then(function(user) {
        res.send("OK!");
    }, function(err) {
        res.redirect('/signup?error=ERROR! Either Username already exists or password is invalid (min 5 characters)');
    });
});


// To Login:

app.get('/login', function(req, res, next) {

    var form = '<form action="/login" method="post"><div><input type="text" name="username" placeholder="Enter a username"></div><div><input type="text" name="password" placeholder="Enter your password"></div><button type="submit">Login!</button></form>';
    if (req.query.error) {
        form = form + req.query.error;
    }
    res.send(form);

});


app.post('/login', function(req, res) {


    User.findOne({
        where: {
            username: req.body.username
        }
    }).then(
        function(user) {
            if (!user) {
                // here we would use response.send instead :)
                res.send('username or password incorrect');
            }
            else {
                // Here we found a user, compare their password!
                var isPasswordOk = bcrypt.compareSync(req.body.password, user.hashed_password);

                // this is good, we can now "log in" the user
                if (isPasswordOk) {
                    var token = createSessionToken();

                    user.createSession({
                        token: token
                    }).then(function(session) {
                        // Here we can set a cookie for the user!
                        res.cookie('SESSION', token);
                        res.redirect("/contents");
                    });
                }


                else {
                    res.redirect('/login?error=ERROR! Username or Password is Invalid!');
                }
            }
        }
    );
});



// To Vote:


app.post('/voteContent', function(req, res) {

    Vote.findOne({
        where: {
            userId: req.loggedInUser.id, // This should be the currently logged in user's ID
            contentId: req.body.contentId // This should be the ID of the content we want to vote on   
        }
    }).then(
        function(vote) {

            if (!vote) {
                // here we didn't find a vote so let's add one. Notice Vote with capital V, the model
                return Vote.create({
                    userId: req.loggedInUser.id, // Received from the loggedIn middleware
                    contentId: req.body.contentId, // Received from the user's form submit
                    upVote: req.body.upVote === 'true' ? 1 : -1, // Received from the user's form submit
                    //downVote: req.body.downVote
                });
            }
            else {
                // user already voted, perhaps we need to change the direction of the vote?
                var newVoteValue;
                if (req.body.upVote === 'true' && vote.get('upVote') === 1) {
                    newVoteValue = 0;
                }
                else if (req.body.upVote === 'true' && vote.get('upVote') === 0) {
                    newVoteValue = 1;
                }
                else if (req.body.upVote === 'false' && vote.get('upVote') === 1) {         //check downvote code....
                    newVoteValue = 0;
                }
                else if (req.body.upVote === 'false' && vote.get('upVote') === 0) {
                    newVoteValue = -1;
                }

                return vote.update({
                    upVote: newVoteValue // Received from the user's form submit
                });
            }
        }
    ).then(
        // Look at the two returns in the previous callbacks. In both cases we are returning
        // a promise, one to create a vote and one to update a vote. Either way we get the result here
        function(vote) {
            // Good to go, the user was able to vote. Let's redirect them to the homepage?
            res.redirect('/contents');

            // Perhaps we could redirect them to where they came from?
            // Try to figure out how to do this using the Referer HTTP header :)
        }
    );
});


//To log out
var logOut = "<form action='/logout' method='post'><input type='hidden' name='logOut' value='true'></input><button type='submit'>Log out!</button></form>";
app.get('/logout', function(req, res) {
    if (req.query.error) {
        logOut = logOut + req.query.error;
    }
    res.send(logOut);
});
app.post('/logout', function(req, res) {
    Session.findOne({
        where: {
            token: req.cookies.SESSION
        },
        include: User // so we can add it to the request
    }).then(
        function(session) {
            // session will be null if no token was found
            if (session) {
                session.destroy()
                    .then(function() {
                        res.redirect('/login');
                    });
            }
        });
});



// Listening:

db.sync().then(function() {
    var server = app.listen(process.env.PORT, process.env.IP, function() {
        var host = server.address().address;
        var port = server.address().port;

        console.log('Example app listening at http://%s:%s', host, port);
    });
});
