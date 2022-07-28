import express, { Router } from "express";
import 'cookie-parser';
import { Connection, OkPacket, RowDataPacket } from "mysql2";
import * as merger from "../interfaces";
import bcrypt from 'bcrypt';
import { createMergerError, isUserAuthenticated, testEmail, testPassword, testUsername } from "../utils";
import { getLikedSongsByUser, insertPlaylist, insertSongToUserData, insertTrack, selectPlaylistById, selectPlaylistByIdAndUser, selectPlaylistsByUser, selectSongsByPlaylistId } from "../database_queries";

const router: Router = express.Router();
const db: Connection = require("../database");

/*router.get('/users/:id', (req: express.Request, res: express.Response, err: express.Errback) => {
	if (!req.params.id) {
		res.status(304).send({
			message: "ID of an user was not provided!",
			stacktrace: err.prototype.stacktrace
		} as merger.Error)
		return;
	}

	db.promise().query(`SELECT * FROM users WHERE users.id = ${req.params.id}`).then((sqlRes) => {
		return res.send(sqlRes[0]);
	}).catch((err) => {
		return res.send(err);
	})
});*/

router.get('/getPlaylistsByUser', async (req: express.Request, res: express.Response) => {

	if (!isUserAuthenticated(req.session))
		return res.status(403).send(createMergerError("User is not authenticated or user id is invalid!", 403));

	try {
		const playlistsQuery = db.promise().query(selectPlaylistsByUser(parseInt(req.session.userId)));
		const playlistsRes: Array<merger.Playlist> = ((await playlistsQuery)[0] as RowDataPacket[]) as Array<merger.Playlist>;

		return res.status(200).send(playlistsRes)

	} catch (e: unknown) {
		console.error(e);
		res.status(500).send(createMergerError("Execution of the query failed!", 500))
	}

});

router.get('/getPlaylistsByUser', async (req: express.Request, res: express.Response) => {

	if (!isUserAuthenticated(req.session))
		return res.status(403).send(createMergerError("User is not authenticated or user id is invalid!", 403));

	try {
		const playlistsQuery = db.promise().query(selectPlaylistsByUser(parseInt(req.session.userId)));
		const playlistsRes: Array<merger.Playlist> = ((await playlistsQuery)[0] as RowDataPacket[]) as Array<merger.Playlist>;

		return res.status(200).send(playlistsRes)

	} catch (e: unknown) {
		console.error(e);
		res.status(500).send(createMergerError("Execution of the query failed!", 500))
	}
});

router.get("/playlist/:id", async (req: express.Request, res: express.Response) => {

	if (!isUserAuthenticated(req.session))
		return res.status(403).send(createMergerError("User is not authenticated or user id is invalid!", 403));

	if (!req.params.id)
		return res.status(500).send(createMergerError("playlistId wasn't provided!", 403));

	try {
		const playlistQuery = db.promise().query(selectPlaylistById(parseInt(req.params.id)));
		const playlistRes = ((await playlistQuery)[0] as RowDataPacket[])[0];

		const songsQuery = db.promise().query(selectSongsByPlaylistId(parseInt(playlistRes.id)));
		const songsRes: Array<merger.Song> = ((await songsQuery)[0] as RowDataPacket[]) as Array<merger.Song>;

		const playlistObj: merger.PlaylistFull = {
			title: playlistRes.name as string,
			creator: {
				id: playlistRes.creator as number,
				username: playlistRes.username as string
			},
			id: 4,
			desc: playlistRes.desc as string,
			songs: songsRes
		}

		return res.status(200).send(playlistObj);


	} catch (e: unknown) {
		console.error(e);
		res.status(500).send(createMergerError("Execution of the query failed!", 500))
	}


})

router.put('/register', async (req: express.Request, res: express.Response) => {
	const user: merger.User = req.body as merger.User;

	if (!user.password || !testPassword(user.password)) return res.status(400).send(createMergerError("Password wasn't provided or illegal chars have been used!", 400));

	if (!testEmail(user.email) || !testUsername(user.username)) return res.status(400).send(createMergerError("Email or username has not been provided or prohibited chars have been used!", 400));

	const hashedPassword: string = await bcrypt.hash(user.password, 10);

	db.promise().query(`INSERT INTO users (username,email,password) VALUES ('${user.username}','${user.email}','${hashedPassword}')`).then((sqlRes) => {
		return res.redirect("http://localhost:3000/login");
	}).catch((sqlErr) => {
		if (sqlErr.errno === 1062) return res.status(400).send(createMergerError("This email already exists!", 400));
		console.error(sqlErr)
		return res.status(500).send(sqlErr);
	})
})

router.post('/login', (req: express.Request, res: express.Response) => {
	if (req.session.authenticated) return res.status(200);

	const { email, password } = req.body;

	if (!email || !password) return res.status(403).send(createMergerError("Bad Credentials", 403));

	db.promise().query(`SELECT * FROM users WHERE users.email = '${email}'`).then(async (sqlRes) => {

		const user = (sqlRes[0] as RowDataPacket[])[0] as merger.User;

		if (!user) {
			return res.status(403).send(createMergerError("Given email wasn't found! If you don't have an account please sign up.", 403));
		}

		if (!user.password) {
			return res.status(500).send({
				message: "Password is undefined!",
				status: 500
			} as merger.Error)
		}

		bcrypt.compare(password, user.password).then((bcryptRes: boolean) => {
			req.session.username = user.username;
			req.session.email = user.email;
			req.session.userId = user.id;
			req.session.img = user.img;
			req.session.authenticated = true;

			return res.json(req.session);
		}).catch((err) => {
			return res.status(403).send({
				message: "Bad Credentials",
				stacktrace: Error.prototype.stack
			} as merger.Error);
		});

		return;
	}).catch((sqlErr) => {

		return res.send(sqlErr);
	})
})

router.put('/createPlaylist', (req: express.Request, res: express.Response, err: express.Errback) => {

	if (!isUserAuthenticated(req.session))
		return res.status(403).send(createMergerError("User is not authenticated or user id is invalid!", 403));

	const { title, desc } = req.body!;


	//TODO Maybe chain this better with async/await if possible
	db.promise()
		.query(insertPlaylist(title, req.session.userId, desc))
		.then((sqlRes) => {
			const lastId: number = (sqlRes[0] as OkPacket).insertId;

			db.promise().query(selectPlaylistByIdAndUser(lastId, req.session.userId))
				.then((sqlSelRes) => {
					const createdPlaylist: merger.Playlist = (sqlSelRes[0] as RowDataPacket[])[0] as merger.Playlist;
					res.status(200).json(createdPlaylist);
				}).catch((sqlSelErr) => {
					console.error(sqlSelErr);
					return res.status(500).send(createMergerError("Selection of the created playlist failed!"));
				});
		}).catch((sqlErr) => {
			console.error(sqlErr);
			return res.status(500).send(createMergerError("Creation of the playlist failed!"));
		})
})

router.put("/likeTrack", async (req: express.Request, res: express.Response) => {

	if (!isUserAuthenticated(req.session))
		return res.status(403).send(createMergerError("User is not authenticated or user id is invalid!", 403));

	try {
		await db.promise().query(insertTrack(req.body));

		db.promise().query(insertSongToUserData(req.session.userId, req.body)).then(() => {
			return res.status(200);
		}).catch((err) => {
			console.error("failed to like a track!", err)
			res.status(500).send(createMergerError("failed to like a track!", 500))
		})

	} catch (e: unknown) {
		console.error(e);
		return res.status(500).send(createMergerError("Failed to execute a query!", 500))
	}
})

router.get("/getLikedSongsByUser", async (req: express.Request, res: express.Response) => {

	if (!isUserAuthenticated(req.session))
		return res.status(403).send(createMergerError("User is not authenticated or user id is invalid!", 403));

	try {
		const likedSongs= (await db.promise().query(getLikedSongsByUser(req.session.userId)))[0];
		
		return res.status(200).send(likedSongs);

	} catch (e: unknown) {
		console.error(e);
		return res.status(500).send(createMergerError("Execution of the query failed!"));
	}
});


module.exports = router;
