import { youtube_v3 } from "@googleapis/youtube";
import express, { Router } from "express";

export const router: Router = express.Router();

require('dotenv').config();

const google = require("@googleapis/youtube");
const youTube: youtube_v3.Youtube = google.youtube('v3')
const api: string | undefined = process.env.YOUTUBE_API_KEY;

router.get("/search", (req: express.Request, res: express.Response, err: express.Errback) => {
    if (req.query.query !== undefined) {
        let searchQuery: string = req.query.query as string;
        youTube.search.list({
            auth: api,
            part: ['snippet'],
            q: searchQuery,
        },(ytErr, ytRes) => {
            if (!ytErr) {
                res.send(ytRes?.data).end();
                return;
            }
            res.status(500).send(ytErr).end();
        })
    }
});

module.exports = router;