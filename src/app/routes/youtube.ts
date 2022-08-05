import express, { Router } from "express";
import * as youtubeController from "../controllers/youtubeController";

export const router: Router = express.Router();


router.post("/search", youtubeController.search);

router.get("/video/:id", youtubeController.getVideo)

router.get("/playlist/:id", youtubeController.getPlaylist)

router.get("/playlist/:id/items", youtubeController.getPlaylistItems)

router.get("/playlist/:id/videos", youtubeController.getAllVideosFromPlaylist)


module.exports = router;


