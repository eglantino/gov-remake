var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var mysql = require('mysql');
var cors = require("cors");

var app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());

module.exports = app;

// Database connection
const con = mysql.createConnection({
	host: 'localhost',
	user: 'root',
	password: 'admin',
	database: 'eam_db'
});

con.connect((err) => {
	if (err) {
		console.log(err.stack);
	}
	else {
		console.log("Connected!");
	}
});

app.get("/search", (request, response) => {
	con.query("select * from users", (err, res) => {
		if (err) {
			console.log(err);
		}
		else {
			res.forEach(r => {
				r.additionalInfo = JSON.parse(r.additionalInfo)
				r.availability = JSON.parse(r.availability)
				r.previousTransaction = JSON.parse(r.previousTransaction);
			});
			response.send(res);
		}
	})
});

app.get("/paramsSearch?:filters", (request, response) => {
	const filters = JSON.parse(request.query.filters);

	let locationQueries = filters?.locations.map(location => {
		return new Promise((resolve, reject) => {
			con.query("SELECT * FROM users WHERE location_id = ?", [location], (err, res) => {
				if (err) {
					reject(err);
				}
				else {
					console.log(res);
					resolve(res);
				}
			});
		});
	});

	Promise.all(locationQueries)
		   .then(results => {
			   // Flatten the results array if needed
			   let flattenedResults = results.flat();
			   flattenedResults.forEach(r => {
				   r.additionalInfo = JSON.parse(r.additionalInfo);
				   r.availability = JSON.parse(r.availability);
				   r.previousTransaction = JSON.parse(r.previousTransaction);
			   });
			   response.send(flattenedResults);
		   })
		   .catch(err => {
			   console.error(err);
			   response.status(500).send("An error occurred while fetching data.");
		   });
});

app.get("/locations", (request, response) => {
	con.query("select * from locations", (error, result) => {
		if (error) {
			console.log(error);
		}
		else {
			response.send(result);
		}
	})
})

app.get("/profile?:id", (request, response) => {
	const id = request.query.id;

	con.query('select * from users where id=?', id, (error, result) => {
		if (error) {
			console.log(error);
		}
		else {
			result = result[0];
			result.additionalInfo = JSON.parse(result.additionalInfo);
			result.availability = JSON.parse(result.availability);
			result.previousTransaction = JSON.parse(result.previousTransaction);
			response.send(result);
		}
	});
});

app.get("/user/:id/extended", (request, response) => {
	const id = parseInt(request.params.id);

	con.query('select * from users_extended where user_id=?', id, (error, result) => {
		if (error) {
			console.log(error);
		}
		else {
			response.send(result[0]);
		}
	});
});

app.patch("/user", (request, response) => {
	const { user } = request.body.params;

	const userQuery = `
        UPDATE users
        SET email=?, 
			name=?,
			surname=?,
			location_id=?
        WHERE id=?
	`

	con.query(
		userQuery,
		[user.email, user.name, user.surname, user.location_id, user.id],
		(error, result) => {
			if (error) {
				console.log(error);
			}
			else {
				response.send(user);
			}
		}
	);
});

app.patch("/user/extended", (request, response) => {
	const { userExtended } = request.body.params;

	const userExtendedQuery = `
        UPDATE users_extended
        SET adt=?,
            amka=?,
            afm=?,
            phone=?,
            date_of_birth=?
        WHERE id = ?
	`

	con.query(
		userExtendedQuery,
		[
			userExtended.adt, userExtended.amka, userExtended.afm, userExtended.phone, userExtended.date_of_birth,
			userExtended.id
		],
		(error, result) => {
			if (error) {
				console.log(error);
			}
			else {
				response.send(userExtended);
			}
		}
	);
});

app.post("/login", (request, response) => {
	const {email, password} = request.body.params.credentials;

	con.query('select * from users where email=? and password=?', [email, password], (error, result) => {
		if (error) {
			console.log(error);
		}
		else {
			result = result[0];
			result.additionalInfo = JSON.parse(result.additionalInfo);
			result.availability = JSON.parse(result.availability);
			result.previousTransaction = JSON.parse(result.previousTransaction);
			response.send(result);
		}
	})
});

app.post("/contact/draft", (request, response) => {
	const {userID, draft} = request.body.params;

	con.query(`
        insert into user_contact_draft (user_id, draft)
        values (?, ?) on duplicate key
        update draft=
        values (draft)
	`, [userID, JSON.stringify(draft)], (err, res) => {
		if (err) {
			console.log(err);
		}
		else {
			response.send(draft);
		}
	})
});

app.get("/contact/draft?:userID", (request, response) => {
	const userID = request.query.userID;

	con.query('select draft from user_contact_draft where user_id=?', userID, (err, res) => {
		if (err) {
			console.log(err);
		}
		else {
			let draft = res[0]?.draft;

			if (draft) {
				response.send(JSON.parse(draft));
			}
			else {
				response.status(404).send("No draft file available!");
			}
		}
	})
});

app.delete("/contact/draft?:userID", (request, response) => {
	const userID = request.query.userID;

	con.query('delete from user_contact_draft where user_id=?', userID, (err, res) => {
		if (err) {
			console.log(err);
		}
		else {
			response.send(res);
		}
	})
});

app.post("/contact/final", (request, response) => {
	const {userID, document} = request.body.params;

	con.query(`
        insert into user_contact_finalized (user_id, document)
        values (?, ?) on duplicate key
        update document=
        values (document)
	`, [userID, JSON.stringify(document)], (err, res) => {
		if (err) {
			console.log(err);
		}
		else {
			response.send(document);
		}
	})
});

app.get("/contact/document?:userID", (request, response) => {
	const userID = request.query.userID;

	con.query('select document from user_contact_finalized where user_id=?', userID, (err, res) => {
		if (err) {
			console.log(err);
		}
		else {
			let document = res[0]?.document;

			if (document) {
				response.send(JSON.parse(document));
			}
			else {
				response.status(404).send("No file available!");
			}
		}
	})
});