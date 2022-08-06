import express from "express"
import SpotifyWebApi from "spotify-web-api-node";
import * as merger from "../interfaces";
import { createMergerError } from "../utils";

const generateRandomString = (length: number) => {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

	for (let i = 0; i < length; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
};

let refreshInterval: NodeJS.Timeout;

const request = require('request');
const spotifyApi: SpotifyWebApi = new SpotifyWebApi({
	clientId: process.env.SPOTIFY_CLIENT_ID,
	clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
	redirectUri: `http://localhost:${process.env.PORT}/spotify/auth/callback`
})

export const login = (req: express.Request, res: express.Response) => {
	if (spotifyApi.getCredentials().clientId != undefined) {
		const scope = "streaming \
                        user-read-email \
                        user-read-private \
                        user-read-playback-state \
			playlist-read-private \
			playlist-read-collaborative"

		const state = generateRandomString(32);

		const auth_query_parameters = new URLSearchParams({
			response_type: "code",
			scope: scope,
			redirect_uri: spotifyApi.getCredentials().redirectUri as string,
			state: state,
			client_id: spotifyApi.getCredentials().clientId as string,
		})

		res.redirect('https://accounts.spotify.com/authorize/?' + auth_query_parameters.toString());
		res.end();
		return;
	}
	res.send("Invalid Spotify Client ID!");
	res.end();
}

export const logout = (req: express.Request, res: express.Response) => {
	try {
		spotifyApi.resetAccessToken();
		spotifyApi.resetRefreshToken();

		return res.redirect(`${process.env.CLIENT_URL}/`)

	} catch (e: unknown) {
		console.error(e);
		return res.status(500).send(createMergerError("Failed to log out!", 500));
	}
}

export const authCallback = (req: express.Request, res: express.Response, err: express.Errback) => {

	if (req.query.error === undefined) {
		const code = req.query.code;

		const authOptions = {
			url: 'https://accounts.spotify.com/api/token',
			form: {
				code: code,
				redirect_uri: spotifyApi.getCredentials().redirectUri,
				grant_type: 'authorization_code',
			},
			headers: {
				'Authorization': 'Basic ' + (Buffer.from(spotifyApi.getCredentials().clientId + ':' + spotifyApi.getCredentials().clientSecret).toString('base64')),
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			json: true
		};

		request.post(authOptions, (error: Error, response: express.Response, body: any) => {
			if (!error && response.statusCode === 200) {
				spotifyApi.setCredentials({ ...spotifyApi.getCredentials(), accessToken: body.access_token });
				spotifyApi.setRefreshToken(body.refresh_token);
				refreshInterval = setInterval(refreshSpotifyToken, body.expires_in * 1000);
				res.redirect('http://localhost:3000/');
				res.end();
			} else {
				res.status(500);

				res.send({
					message: "Trying to obtain the access token failed!",
					stacktrace: err.prototype.stacktrace
				} as merger.Error)

				res.redirect('http://localhost:3000/');
				res.end();
			}
		});
	} else {
		res.status(500);

		res.send({
			message: "Authorization request has failed or been denied!",
			stacktrace: err.prototype.stacktrace
		} as merger.Error)

		res.redirect('http://localhost:3000/');
		res.end();
	}

}

export const refreshToken = () => {
	clearInterval(refreshInterval);
	spotifyApi.refreshAccessToken().then((spRes) => {
		if (spRes.body.refresh_token)
			spotifyApi.setRefreshToken(spRes.body.refresh_token);

		spotifyApi.setAccessToken(spRes.body.access_token);

		refreshInterval = setInterval(refreshSpotifyToken, spRes.body.expires_in * 1000);
	}).catch((err) => {
		console.error("failed to refresh the token!", err);
	})
}

export const getAccessToken = (req: express.Request, res: express.Response) => {
	res.json(spotifyApi.getAccessToken())
}

export const meInfo = (req: express.Request, res: express.Response) => {
	spotifyApi.getMe().then((spRes) => {
		res.json(spRes.body);
		res.end();
	}).catch((err) => {
		res.send(err);
		res.end();
	})
}

export const getUsersPlaylists = async (req: express.Request, res: express.Response) => {

	try {
		const playlists: SpotifyApi.ListOfUsersPlaylistsResponse = (await spotifyApi.getUserPlaylists()).body;

		return res.send(playlists.items);

	} catch (e: unknown) {
		console.error(e);
		return res.status(500).send(createMergerError("Retrieving users playlists failed!", 500));
	}

}

export const search = async (req: express.Request, res: express.Response) => {

	if (req.query.q !== undefined) {

		try {
			const searchRes = await spotifyApi.search(req.query.q as string, req.body.types);

			return res.send(searchRes.body);

		} catch (e: unknown) {
			console.error(e)
			return res.status(500).send(createMergerError("Spotify search has failed!", 500))
		}
	}

	return res.status(204).send(createMergerError("Query is undefined!", 204))
}

export const getPlaylist = (req: express.Request, res: express.Response) => {
	spotifyApi.getPlaylist(req.params.id).then((data) => {
		res.json(data.body);
	}).catch((spErr) => {
		res.status(500).send(spErr);
	})
}

export const getAlbum = (req: express.Request, res: express.Response) => {
	spotifyApi.getAlbum(req.params.id).then((data) => {
		res.json(data.body);
	}).catch((spotifyErr: Error) => {
		res.status(500)
		res.send(spotifyErr);
	}
	)
}

export const getAlbumTracks = async (req: express.Request, res: express.Response) => {
	try {
		if (!req.params.id) throw new Error('Album Id is Invalid!');

		const albumTracks: Array<SpotifyApi.TrackObjectSimplified> = (await spotifyApi.getAlbumTracks(req.params.id as string)).body.items;

		const tracks: Array<SpotifyApi.TrackObjectFull> = await getTracksByUris(albumTracks.map((track) => {
			return track.id;
		}));

		return res.send(tracks);

	} catch (e: unknown) {
		console.error(e);
		res.status(500).send(createMergerError("Failed to fetch album tracks!"))
	}
}

export const getTrack = async (req: express.Request, res: express.Response, err: express.Errback) => {
	try {
		const spRes = await spotifyApi.getTrack(req.params.id);

		return res.send(spRes.body);
	} catch (e: unknown) {
		console.error(e);
		res.send(e);
	}
}

export const getTracks = (req: express.Request, res: express.Response, err: express.Errback) => {
	if (req.params.ids !== undefined) {

		const idArray: Array<string> = req.params.ids.split(",");

		spotifyApi.getTracks(idArray, {}).then((data) => {
			res.json(data.body);
			res.end();
		}).catch((spotifyErr: SpotifyApi.ErrorObject) => {
			res.send(spotifyErr);
			res.end();
		})
		return;
	}

	res.status(400).send({
		error: "id's are undefined",
		stacktrace: err.prototype.stacktrace
	})

	res.end();
}

export const play = (req: express.Request, res: express.Response, err: express.Errback) => {
	if (req.query.device_id !== undefined) {
		if (req.body[0] === undefined) {
			spotifyApi.play({
				device_id: req.query.device_id as string
			}).then((spotifyRes) => {
				res.json(spotifyRes.body).end();
			}).catch((spotifyErr) => {
				if (spotifyErr.status)
					res.status(spotifyErr.status);
				res.send(spotifyErr);
			})
		} else {
			spotifyApi.play({
				uris: req.body as string[],
				device_id: req.query.device_id as string
			}).then((spotifyRes) => {
				res.json(spotifyRes.body).end();
			}).catch((spotifyErr) => {
				if (spotifyErr.statusCode)
					res.status(spotifyErr.statusCode);
				res.send(spotifyErr);
			})
		}
		return;
	}
	res.status(400).send({
		errorMessage: "Device_id wasn't provided!"
	})
}

export const pause = (req: express.Request, res: express.Response, err: express.Errback) => {
	if (req.query.device_id !== undefined) {
		spotifyApi.pause({
			device_id: req.query.device_id as string
		}).then((spotifyRes) => {
			res.json(spotifyRes.body).end();
		}).catch((spotifyErr) => {
			if (spotifyErr)
				res.status(spotifyErr.status)
			res.send(spotifyErr);
		})
		return;

	}
	const error: merger.Error = {
		message: "Device_id wasn't provided!"
	};
	res.status(400).send(error);
}

export const setVolume = (req: express.Request, res: express.Response, err: express.Errback) => {
	if (req.body.value !== undefined && req.body.device_id !== undefined) {
		const deviceId: string = req.body.device_id as string;
		const volumePercent: number = req.body.value as unknown as number;
		spotifyApi.setVolume(volumePercent, { device_id: deviceId }).then((spotifyRes) => {
			res.json(spotifyRes)
		}).catch((spErr: SpotifyApi.ErrorObject) => {
			res.status(500).send(spErr);
		})
		return;
	}

	const error: merger.Error = {
		message: "Device_id or value was not provided!",
		stacktrace: err.prototype.stacktrace
	};
	res.status(400).send(error);
}

export const getPlaybackState = (req: express.Request, res: express.Response, err: express.Errback) => {
	spotifyApi.getMyCurrentPlaybackState({ market: "ES" }).then((spotifyRes) => {
		res.json(spotifyRes.body);
	}).catch((spErr) => {
		res.status(500).send(spErr);
	})
}

export const seek = (req: express.Request, res: express.Response, err: express.Errback) => {
	if (req.query.device_id && req.query.position_ms) {
		spotifyApi.seek(req.query.position_ms as unknown as number,
			{ device_id: req.query.device_id as unknown as string }
		)
			.then((spotifyRes) => {
				res.status(200).send(spotifyRes.body);
			}).catch((spErr) => {
				res.status(500).send(spErr);
			})
	} else {
		const error: merger.Error = {
			message: "Device_id or value was not provided!",
			stacktrace: err.prototype.stacktrace
		};

		res.status(400).send(error);
	}
}

export const getArtist = (req: express.Request, res: express.Response, err: express.Errback) => {
	if (req.params.id !== undefined) {
		spotifyApi.getArtist(req.params.id).then((spRes) => {
			res.status(200).send(spRes.body);
		}).catch((err) => {
			if (err.statusCode) {
				res.status(err.statusCode)
			} else {
				res.status(500)
			}
			res.send(err);
		})
		return;
	}

	res.status(400).send({
		message: "id is undefined!",
		stacktrace: err.prototype.stacktrace
	} as merger.Error);

	return;
}

export const getArtistsTopTracks = (req: express.Request, res: express.Response, err: express.Errback) => {
	if (req.params.id !== undefined) {
		//TODO: Watch out for the available markets. they could be interfering with the result
		spotifyApi.getArtistTopTracks(req.params.id, "ES").then((spRes) => {
			res.status(200).send(spRes.body);
		}).catch((err) => {
			res.status(500).send(err);
		})
		return;
	}


	res.status(400).send({
		message: "id is undefined!",
		stacktrace: err.prototype.stacktrace
	} as merger.Error);

}

export const getArtistsAlbums = (req: express.Request, res: express.Response, err: express.Errback) => {
	if (req.params.id !== undefined) {
		spotifyApi.getArtistAlbums(req.params.id, {}).then((spRes) => {
			res.status(200).send(spRes.body);
		}).catch((err) => {
			res.status(500).send(err);
		})
		return;
	}

	res.status(400).send({
		message: "id is undefined!",
		stacktrace: err.prototype.stacktrace
	} as merger.Error);
}

export const getRelatedArtists = (req: express.Request, res: express.Response, err: express.Errback) => {
	if (req.params.id !== undefined) {
		//TODO: Watch out for the available markets. they could be interfering with the result
		spotifyApi.getArtistRelatedArtists(req.params.id).then((spRes) => {
			res.status(200).send(spRes.body);
		}).catch((err) => {
			res.status(500).send(err);
		})
		return;
	}

	res.status(400).send({
		message: "id is undefined!",
		stacktrace: err.prototype.stacktrace
	} as merger.Error);

}


export const getTracksByUris = async (uris: Array<string>): Promise<Array<SpotifyApi.TrackObjectFull>> => {

	//if the array is longer than 50 uris, it has to cut to several count of requests.
	
	const countOfRequests: number = Math.ceil(uris.length / 50);

	let results: Array<SpotifyApi.TrackObjectFull> = [];

	for (let i = 0; i < countOfRequests; i++) {	
		results = results.concat((await spotifyApi.getTracks(uris.slice(i*50,(i+1)*50), {})).body.tracks);
	}

	return results;


}


export const getTrackByUri = async (uri: string): Promise<SpotifyApi.TrackObjectFull> => {
	const res: SpotifyApi.SingleTrackResponse = (await spotifyApi.getTrack(uri, {})).body;

	return res as SpotifyApi.TrackObjectFull;
}

export const getPlaylistById = async (id: string): Promise<SpotifyApi.PlaylistObjectFull> => {
	const res: SpotifyApi.PlaylistObjectFull = (await spotifyApi.getPlaylist(id)).body;

	if (!res) throw new Error("Playlist is not defined!");

	return res;
}



const refreshSpotifyToken = async () => {
	return spotifyApi.refreshAccessToken().then((spRes) => {
		if (spRes.body.refresh_token)
			spotifyApi.setRefreshToken(spRes.body.refresh_token);

		spotifyApi.setAccessToken(spRes.body.access_token);
	});
}

