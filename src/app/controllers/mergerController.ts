import * as queries from "../database_queries";
import * as merger from "../interfaces";
import express from "express";
import bcrypt from 'bcrypt';
import { createMergerError, isUserAuthenticated, testEmail, testPassword, testUsername } from "../utils";
import { Connection, OkPacket, RowDataPacket } from "mysql2";
import { youtube_v3 } from "@googleapis/youtube/build/v3";
import * as spotifyController from "./spotifyController";
import * as youtubeController from "./youtubeController";

require('dotenv').config()

const db: Connection = require("../database");

export const getPlaylist = async (req: express.Request, res: express.Response) => {

	if (!isUserAuthenticated(req.session)) {
		if (process.env.CLIENT_URL)
			return res.redirect(process.env.CLIENT_URL);
		return res.status(403)
			.send(createMergerError("User is not authenticated or user id is invalid!", 403));
	}

	if (!req.params.id) {
		return res.status(500)
			.send(createMergerError("playlistId wasn't provided!", 403));
	}

	try {
		const playlist = (
			(await db.promise()
				.query(queries.selectPlaylistById(parseInt(req.params.id))))[0] as RowDataPacket[]
		)[0];

		if (!playlist?.id) throw new Error("Playlist id is undefined!");

		const trackUris: Array<merger.Song> = (await db.promise().query(
			queries.selectTracksByPlaylistId(playlist.id)))[0] as Array<merger.Song>;

		const tracks = await requestTracks(trackUris);

		const playlistObj: merger.PlaylistFull = {
			title: playlist.title,
			creator: {
				id: playlist.creator,
				username: playlist.username
			},
			id: playlist.id,
			desc: playlist.desc,
			tracks
		}

		return res.status(200).send(playlistObj);

	} catch (e: unknown) {
		console.error(e);
		res.status(500).send(createMergerError("Execution of the query failed!", 500))
	}
}

export const getUsersPlaylists = async (req: express.Request, res: express.Response) => {

	if (!isUserAuthenticated(req.session)) {
		if (process.env.CLIENT_URL)
			return res.redirect(process.env.CLIENT_URL);
		return res.status(403)
			.send(createMergerError("User is not authenticated or user id is invalid!", 403));
	}

	try {
		const playlistsQuery = db.promise().query(queries.selectPlaylistsByUser(parseInt(req.session.userId)));
		const playlistsRes: Array<merger.Playlist> = ((await playlistsQuery)[0] as RowDataPacket[]) as Array<merger.Playlist>;

		return res.status(200).send(playlistsRes)

	} catch (e: unknown) {
		console.error(e);
		res.status(500).send(createMergerError("Execution of the query failed!", 500))
	}

}

export const register = async (req: express.Request, res: express.Response) => {
	const user: merger.User = req.body as merger.User;

	if (!user.password || !testPassword(user.password))
		return res.status(400).send(
			createMergerError("Password wasn't provided or illegal chars have been used!", 400)
		);

	if (!testEmail(user.email) || !testUsername(user.username))
		return res.status(400).send(
			createMergerError("Email or username has not been provided or prohibited chars have been used!", 400)
		);

	const hashedPassword: string = await bcrypt.hash(user.password, 10);

	try {
		if (!user.email) throw new Error("Email is undefined!");

		await db.promise().query(queries.insertUser(user.username, user.email, hashedPassword));

	} catch (e: unknown) {
		console.error(e)
		return res.status(500).send(
			createMergerError("Failed to register a user!", 500)
		);
	}

}

export const login = (req: express.Request, res: express.Response) => {
	if (req.session.authenticated) return res.status(200);

	const { email, password } = req.body;

	if (!email || !password) return res.status(403).send(createMergerError("Bad Credentials", 403));

	db.promise().query(queries.selectUserByEmail(email)).then(async (sqlRes) => {

		const user = (sqlRes[0] as RowDataPacket[])[0] as merger.User;

		if (!user) {
			return res.status(403).send(
				createMergerError("Given email wasn't found! If you don't have an account please sign up.", 403));
		}

		if (!user.password) {
			return res.status(500).send(createMergerError("Password is undefined!", 500));
		}

		bcrypt.compare(password, user.password).then(() => {
			req.session.username = user.username;
			req.session.email = user.email;
			req.session.userId = user.id;
			req.session.img = user.img;
			req.session.authenticated = true;

			return res.json(req.session);
		}).catch(() => {
			return res.status(403).send(
				createMergerError("Bad Credentials", 403)
			);
		});

		return;
	}).catch((sqlErr) => {
		return res.send(sqlErr);
	})
}

export const logout = (req: express.Request, res: express.Response) => {

	if (req.session)
		req.session.destroy()

	return res.redirect(`${process.env.CLIENT_URL}/`)
}

export const createPlaylist = async (req: express.Request, res: express.Response) => {

	if (!isUserAuthenticated(req.session)) {
		if (process.env.CLIENT_URL)
			return res.redirect(process.env.CLIENT_URL);
		return res.status(403)
			.send(createMergerError("User is not authenticated or user id is invalid!", 403));
	}

	try {
		const { title, desc } = req.body!;

		const sqlRes: OkPacket = (await db.promise().query(
			queries.insertPlaylist(title, req.session.userId, desc)))[0] as OkPacket;

		return res.json(sqlRes.insertId);
	} catch (e: unknown) {

		console.error(e);
		return res.status(500).send(createMergerError("Failed to create a new playlist!"));
	}
}

export const likeTrack = async (req: express.Request, res: express.Response) => {

	if (!isUserAuthenticated(req.session)) {
		if (process.env.CLIENT_URL)
			return res.redirect(process.env.CLIENT_URL);
		return res.status(403)
			.send(createMergerError("User is not authenticated or user id is invalid!", 403));
	}

	try {
		if (!req.body.uri) res.status(401).send(createMergerError("URI is not valid!"))

		await db.promise().query(queries.insertTrack(req.body.uri as string));

		db.promise().query(queries.insertSongToUserData(req.session.userId, req.body)).then(() => {
			return res.status(200);
		}).catch((err) => {
			console.error("failed to like a track!", err)
			res.status(500).send(createMergerError("failed to like a track!", 500))
		})

	} catch (e: unknown) {
		console.error(e);
		return res.status(500).send(createMergerError("Failed to execute a query!", 500))
	}
}

export const getLikedSongsByUser = async (req: express.Request, res: express.Response) => {

	if (!isUserAuthenticated(req.session)) {
		if (process.env.CLIENT_URL)
			return res.redirect(process.env.CLIENT_URL);
		return res.status(403)
			.send(createMergerError("User is not authenticated or user id is invalid!", 403));
	}

	try {
		const songUris: Array<merger.Song> = (await db.promise().query(
			queries.getLikedSongsByUser(req.session.userId)))[0] as Array<merger.Song>;
		const tracks: Array<SpotifyApi.TrackObjectFull | youtube_v3.Schema$Video> = (await requestTracks(songUris))
		console.log(tracks);

		return res.status(200).send(tracks);

	} catch (e: unknown) {
		console.error(e);
		return res.status(500).send(createMergerError("Execution of the query failed!"));
	}
}

export const addToPlaylist = async (req: express.Request, res: express.Response) => {

	if (!isUserAuthenticated(req.session)) {
		if (process.env.CLIENT_URL)
			return res.redirect(process.env.CLIENT_URL);
		return res.status(403)
			.send(createMergerError("User is not authenticated or user id is invalid!", 403));
	}

	if (!req.body.playlistId || !req.body.trackId)
		return res.status(400).send(createMergerError("Playlist Id or track object is undefined!", 400));

	try {
		await db.promise()
			.query(queries.insertTrack(req.body.trackId));
		await db.promise()
			.query(queries.insertTrackToPlaylist(req.body.trackId, req.body.playlistId))

		return res.status(200);

	} catch (e: unknown) {
		console.error(e)
		return res.status(500).send(createMergerError("Execution of the query failed!", 500));
	}
}

export const getUser = async (req: express.Request, res: express.Response) => {
	try {
		if (!isUserAuthenticated(req.session))
			return res.status(403).send(createMergerError("User is not authenticated or user id is invalid!", 403));

		const sqlQuery = (await db.promise()
			.query(queries.selectUserById(req.session.userId as number)))[0] as RowDataPacket[];

		return res.send(sqlQuery[0]);

	} catch (e: unknown) {
		console.error(e)
		res.status(500).send(createMergerError("Execution of the query failed!", 500))
	}
}


const requestTracks = async (tracks: Array<merger.Song>): Promise<Array<SpotifyApi.TrackObjectFull | youtube_v3.Schema$Video>> => {

	let results: Array<SpotifyApi.TrackObjectFull | youtube_v3.Schema$Video> = [];

	let isType: merger.PlayerType = tracks[0].type;
	let startIndex = 0;
	let endIndex = 1;

	for (let i = 1; i < tracks.length; i++) {

		if (isType === tracks[i].type) {
			endIndex++;
			if (endIndex !== tracks.length) continue;
		}

		if (isType === merger.PlayerType.Spotify) {
			const uris: string[] = tracks.slice(startIndex, endIndex).map(track => track.uri.split(":")[2]);
			const requestedTracks: Array<SpotifyApi.TrackObjectFull> = await spotifyController.getTracksByUris(uris);

			results = results.concat(requestedTracks);
			startIndex = i;
			endIndex = i + 1;
			isType = merger.PlayerType.Youtube;
			continue;
		}

		const requestedTracks: Array<youtube_v3.Schema$Video> = (await youtubeController
			.getYoutubeVideoList(tracks.slice(startIndex, endIndex)
				.map(val => val.uri)));

		results = results.concat(requestedTracks);
		startIndex = i;
		endIndex = i + 1;
		isType = merger.PlayerType.Spotify;
	}

	if (results.length === tracks.length) return results;

	if (isType === merger.PlayerType.Spotify) {
		const uris: string[] = tracks.slice(startIndex, endIndex).map(track => track.uri.split(":")[2]);

		const requestedTracks: Array<SpotifyApi.TrackObjectFull> = await spotifyController.getTracksByUris(uris);

		results = results.concat(requestedTracks);
	}

	const requestedTracks: Array<youtube_v3.Schema$Video> = (await youtubeController
		.getYoutubeVideoList(tracks.slice(startIndex, endIndex)
			.map(val => val.uri)));

	results = results.concat(requestedTracks);

	return results;
}


export const merge = async (req: express.Request, res: express.Response) => {
	if (!isUserAuthenticated(req.session))
		return res.status(403).send(createMergerError("User is not authenticated or user id is invalid!", 403));

	if (!req.body.spotifyId && !req.body.youtubeId)
		return res.status(401).send(createMergerError("Youtube or Spotify playlist id is not defined!"));


	try {
		let order: merger.Order = merger.Order.Random;

		if (req.body.order)
			order = req.body.order as merger.Order;


		const spotifyTracks: Array<SpotifyApi.TrackObjectFull> = (await spotifyController.getPlaylistById(
			req.body.spotifyId)).tracks.items.map((val) => {
				return val.track
			});

		const youtubeTracks: Array<youtube_v3.Schema$Video> = await youtubeController.getAllVideosFromPlaylistById(
			req.body.youtubeId);

		const sqlRes = (await db.promise().query(queries.insertPlaylist("Merged playlist", req.session.userId)))[0];
		const insertId: number = (sqlRes as OkPacket).insertId;

		let insertQuery = "";

		for (const track of spotifyTracks) {
			insertQuery = insertQuery.concat(queries.insertTrack(track.uri), "\n");
		}

		for (const video of youtubeTracks) {
			if (!video.id) throw new Error("Video id is not defined!");

			insertQuery = insertQuery.concat(queries.insertTrack(video.id), "\n");
		}

		await db.promise().query(insertQuery);

		let tracksQuery: string;

		switch (order) {
			case merger.Order.Random:
				tracksQuery = orderRandomly(spotifyTracks, youtubeTracks, insertId);
				break;
			case merger.Order.SpotifyFirst:
				tracksQuery = orderSpotifyFirst(spotifyTracks, youtubeTracks, insertId);
				break;
			case merger.Order.YoutubeFirst:
				tracksQuery = orderYoutubeFirst(spotifyTracks, youtubeTracks, insertId);
		}

		await db.promise().query(tracksQuery);

	res.status(200).send({
			playlistId:insertId
		})

	} catch (e: unknown) {
		console.error(e);
		return res.status(500).send(createMergerError("Failed to merge!", 500));
	}
}


/**
 *    Creates a query for randomly arranged array of tracks
 *    @param spTracks - array of Spotify tracks
 *    @param ytVideos - array of youtube videos
 *    @param playlistId - an Id to include in insert query
 */
const orderRandomly = (spTracks: Array<SpotifyApi.TrackObjectFull>, ytVideos: Array<youtube_v3.Schema$Video>,
	playlistId: number): string => {

	const totalLength: number = spTracks.length + ytVideos.length;

	let insertIntoPlaylistQuery = "";

	for (let i = 0; i < totalLength; i++) {
		const rnd: number = Math.random();

		if (rnd < 0.5 && spTracks.length > 0) {
			const track = spTracks.pop();
			if (track) {
				insertIntoPlaylistQuery = insertIntoPlaylistQuery.concat(
					queries.insertTrackToPlaylist(track.uri, playlistId));
				continue;
			}
		}

		if (ytVideos.length > 0) {
			const video = ytVideos.pop();

			if (video?.id)
				insertIntoPlaylistQuery = insertIntoPlaylistQuery.concat(
					queries.insertTrackToPlaylist(video.id, playlistId));
		}

	}

	return insertIntoPlaylistQuery;
}

const orderSpotifyFirst = (spTracks: Array<SpotifyApi.TrackObjectFull>, ytVideos: Array<youtube_v3.Schema$Video>,
	playlistId: number): string => {

	let insertIntoPlaylistQuery = "";

	for (const track of spTracks) {
		insertIntoPlaylistQuery = insertIntoPlaylistQuery.concat(queries.insertTrackToPlaylist(track.uri, playlistId));
	}


	for (const video of ytVideos) {
		if (video?.id)
			insertIntoPlaylistQuery = insertIntoPlaylistQuery.concat(
				queries.insertTrackToPlaylist(video.id, playlistId));
	}

	return insertIntoPlaylistQuery;
}

const orderYoutubeFirst = (spTracks: Array<SpotifyApi.TrackObjectFull>, ytVideos: Array<youtube_v3.Schema$Video>,
	playlistId: number): string => {

	let insertIntoPlaylistQuery = "";

	for (const video of ytVideos) {
		if (video?.id)
			insertIntoPlaylistQuery = insertIntoPlaylistQuery.concat(
				queries.insertTrackToPlaylist(video.id, playlistId));
	}

	for (const track of spTracks) {
		insertIntoPlaylistQuery = insertIntoPlaylistQuery.concat(queries.insertTrackToPlaylist(track.uri, playlistId));
	}

	return insertIntoPlaylistQuery;
}
