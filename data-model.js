var Sequelize = require('sequelize');

var db = new Sequelize('reddit', 'dreboom', undefined, {
    dialect: 'mysql'
});


var User = db.define('user', {
    username: Sequelize.STRING,
    password: Sequelize.STRING // TODO: make the passwords more secure!
});

// Even though the content belongs to users, we will setup the userId relationship later
var Content = db.define('content', {
    url: Sequelize.STRING,
    title: Sequelize.STRING
});

// Even though a vote has a link to user and content, we will setup the relationship later
var Vote = db.define('vote', {
    upVote: Sequelize.BOOLEAN
});


// function createNewUser(name, pass, callback) {
//     User.create({
//         name: name,
//         password: pass
//             //This is a callback function
//     }).then(function(user) {
//         callback(user);
//     });
// }


function createNewContent(userId, url, title, callback) {
    Content.create({
        userId: userId,
        url: url,
        title: title,
    }).then(function(NewContent) {
        callback(NewContent);
    });
}
// createNewContent(1, 'http://www.google.com', 'google', function(NewContent){console.log(NewContent)});


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

// db.sync();



app.get('/contents', function(request, response) {
        Content.findAll({
        limit: 5,
        include: User,
        order: [['createdAt', 'DESC']]
    }).then(function(returnedContent) {
        console.log(JSON.stringify(returnedContent, 0, 4))
        var listLi = "";
        returnedContent.forEach(function(item){
            listLi = listLi + "<li>Title: "+item.title+"<br>Url: "+item.url+"<br>User: "+item.user.username+"</li>";
        });
        var htmlCore = "<div><h1>List of Contents</h1><ul>"+listLi+"</ul></div>";
        listLi.length > 0 ? response.send(htmlCore) : response.send("Check your Code!");
        
    });
});





// Exercise 5: In this exercise, we're going to use Express to simply send an HTML file to our user containing a <form>
// sing ExpressJS create a GET endpoint called createContent. We will use the Express res.sendFile function to serve the 
// form.html file when someone requests the /createContent resource with a GET.

app.get('/createContent', function (req, res, next) {

  res.sendFile(__dirname + '/form.html', function (err) {
    if (err) {
      console.log(err);
      res.status(err.status).end();
    }
    else {
      console.log('Sent form.html');
    }
  });

});


app.use(bodyParser.urlencoded({ extended: false }));

app.post('/createContent', function (req, res) {
  console.log(req.body);
  
  createNewContent(1, req.body.url, req.body.title, function(content) {
    //   res.send("OK!");
    res.redirect('/contents');
  });
  
});




// ======================================================================================



/* YOU DON'T HAVE TO CHANGE ANYTHING BELOW THIS LINE :) */

// Boilerplate code to start up the web server
var server = app.listen(process.env.PORT, process.env.IP, function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('Example app listening at http://%s:%s', host, port);
});
