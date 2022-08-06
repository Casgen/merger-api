import express, { Router } from "express";
import * as mergerController from "../controllers/mergerController";
import 'cookie-parser';

const router: Router = express.Router();


router.get('/getPlaylistsByUser', mergerController.getUsersPlaylists);

router.get("/playlist/:id", mergerController.getPlaylist)

router.put('/register', mergerController.register)

router.post('/login', mergerController.login)

router.put('/createPlaylist', mergerController.createPlaylist)

router.put("/likeTrack", mergerController.likeTrack)

router.get("/getLikedSongsByUser", mergerController.getLikedSongsByUser);

router.put("/addToPlaylist", mergerController.addToPlaylist);

router.put("/merge", mergerController.merge);

router.get("/users/session", mergerController.getUser)

router.get("/users/logout", mergerController.logout)



module.exports = router;

