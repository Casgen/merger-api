import express, { Router } from "express";
import 'cookie-parser';
import * as spotifyController from "../controllers/spotifyController";

require('dotenv').config();

export const router: Router = express.Router();

router.get('/auth/login', spotifyController.login)

router.get('/auth/callback', spotifyController.authCallback)

router.get('/refreshToken', spotifyController.refreshToken)

router.get('/auth/token', spotifyController.getAccessToken)

router.get('/me', spotifyController.meInfo)

router.get('/me/playlists', spotifyController.getUsersPlaylists)

router.post('/search', spotifyController.search);

router.get('/playlist/:id', spotifyController.getPlaylist)

router.get('/album/:id', spotifyController.getAlbum)

router.get('/track/:id', spotifyController.getTrack)

router.get('/tracks/:ids', spotifyController.getTracks)

router.put('/player/play', spotifyController.play)

router.put('/player/pause', spotifyController.pause)

router.put('/player/setVolume', spotifyController.setVolume)

router.get("/player/playbackState", spotifyController.getPlaybackState)

router.put("/player/seek", spotifyController.seek);

router.get("/artist/:id", spotifyController.getArtist);

router.get("/artist/:id/topTracks", spotifyController.getArtistsTopTracks);

router.get("/artist/:id/albums", spotifyController.getArtistsAlbums);

router.get("/artist/:id/relatedArtists", spotifyController.getRelatedArtists);


module.exports = router
