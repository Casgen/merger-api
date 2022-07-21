import { auth, youtube, youtube_v3 } from "@googleapis/youtube";
import express, { Router } from "express";

export const router: Router = express.Router();

require('dotenv').config();

const google = require("@googleapis/youtube");
const youTube: youtube_v3.Youtube = google.youtube('v3')
const api: string | undefined = process.env.YOUTUBE_API_KEY;
var typescriptMonads = require("typescript-monads");

router.get("/search", (req: express.Request, res: express.Response, err: express.Errback) => {
    if (req.query.query !== undefined) {
        let searchQuery: string = req.query.query as string;
        youTube.search.list({
            auth: api,
            part: ['snippet'],
            q: searchQuery,
            maxResults: 15
        },(ytErr, ytRes) => {
            if (!ytErr) {
                res.send(ytRes?.data).end();
                return;
            }
            res.status(500).send(ytErr).end();
        })
    }
});

router.get("/video/:id",(req: express.Request, res: express.Response, err: express.Errback) => {
    if (req.params.id !== undefined) {
        let id: string = req.params.id;
        youTube.videos.list({
            auth: api,
            part: ['contentDetails','id','snippet'],
            id: [id]
        }, (ytErr, ytRes) => {
            if (!ytErr) {
                res.send(ytRes?.data).end();
                return;
            }
            res.status(500).send(ytErr).end();
        })
    }
})

router.get("/playlist/:id",(req: express.Request, res: express.Response, err: express.Errback) => {
    if (req.params.id !== undefined) {
        let id: string = req.params.id;
        youTube.playlists.list({
            auth: api,
            part: ['contentDetails','id','snippet'],
            id: [id]
        }, (ytErr, ytRes) => {
            if (!ytErr) {
                res.send(ytRes?.data).end();
                return;
            }
            res.status(500).send(ytErr).end();
        })
    }
})

router.get("/playlistItems/:id",(req: express.Request, res: express.Response, err: express.Errback) => {

    let params: youtube_v3.Params$Resource$Playlistitems$List = {
        auth: api,
        part: ['contentDetails','id','snippet'],
    }

    if (req.params.id) params.playlistId = req.params.id;
    if (req.query.max_results) params.maxResults = parseInt(req.query.max_results as string);

    if (req.params.id !== undefined) {
        let id: string = req.params.id;
        youTube.playlistItems.list(params, (ytErr, ytRes) => {
            if (!ytErr) {
                res.send(ytRes?.data).end();
                return;
            }
            res.status(500).send(ytErr).end();
        })
    }
})

module.exports = router;