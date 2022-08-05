import { youtube_v3 } from "@googleapis/youtube";
import express from "express";
import { createMergerError } from "../utils";
import typescriptMonads, { Maybe } from "typescript-monads";

require('dotenv').config();

const google = require("@googleapis/youtube");
const youTube: youtube_v3.Youtube = google.youtube('v3')
const api: string | undefined = process.env.YOUTUBE_API_KEY;


export const search = (req: express.Request, res: express.Response) => {
	if (req.query.query !== undefined) {
		
		let types: string[] = ["playlist", "video"]; 

		if (req.body.types) types = req.body.types;

		const searchQuery: string = req.query.query as string;
		youTube.search.list({
			auth: api,
			part: ['snippet'],
			q: searchQuery,
			maxResults: 15,
			type: types
		}, (ytErr, ytRes) => {
			if (!ytErr) {
				res.send(ytRes?.data).end();
				return;
			}
			res.status(500).send(ytErr).end();
		})
	}
}

export const getVideo = async (req: express.Request, res: express.Response) => {
	if (req.params.id !== undefined) {
		try {
			const videoRes: youtube_v3.Schema$VideoListResponse = (await getYoutubeVideo(req.params.id)).data;

			if (videoRes.items)
				return res.status(200).send(videoRes.items[0]);


		} catch (e: unknown) {
			console.error(e);
			return res.status(500).send(createMergerError("Coudln't fetch a video!", 500));
		}
	}
}

export const getPlaylist = async (req: express.Request, res: express.Response) => {
	if (req.params.id !== undefined) {

		const id: string = req.params.id;

		try {
			const playlistRes = await getPlaylistById(id);

			return res.status(200).send(playlistRes);

		} catch (e: unknown) {
			console.error(e);
			return res.status(500).send(createMergerError("Querying for a playlist failed!", 500));
		}
	}

	return res.status(401).send(createMergerError("Playlist id is undefined!", 500));
}

export const getPlaylistItems = (req: express.Request, res: express.Response) => {

	if (req.params.id !== undefined) {
		const params: youtube_v3.Params$Resource$Playlistitems$List = {
			auth: api,
			part: ['contentDetails', 'id', 'snippet'],
			playlistId: req.params.id as string
		}

		if (req.query.max_results) params.maxResults = parseInt(req.query.max_results as string);

		youTube.playlistItems.list(params, (ytErr, ytRes) => {
			if (!ytErr) {
				res.send(ytRes?.data.items).end();
				return;
			}
			res.status(500).send(ytErr).end();
		})
	}
}

export const getAllVideosFromPlaylist = async (req: express.Request, res: express.Response) => {
	if (req.params.id !== undefined) {
		try {
			const videos: Array<youtube_v3.Schema$Video> = await getAllVideosFromPlaylistById(req.params.id as string, parseInt(req.query.max_results as string)); 
			return res.send(videos);

		} catch (e: unknown) {
			console.error(e);
			return res.status(500).send(createMergerError("Request for all videos from playlist failed!", 500));
		}
	}
	return res.status(401).send(createMergerError("Playlist id is undefined!", 500));
}

export const getAllVideosFromPlaylistById = async (id: string, maxResults?: number): Promise<Array<youtube_v3.Schema$Video>> => {

	const params: youtube_v3.Params$Resource$Playlistitems$List = {
		auth: api,
		part: ['contentDetails', 'id', 'snippet'],
		playlistId: id
	}

	if (maxResults) params.maxResults = maxResults;

	const playlistItems: Array<youtube_v3.Schema$PlaylistItem> | undefined = (await youTube.playlistItems.list(params)).data.items;

	if (!playlistItems) throw new Error("Playlistitems are not defined!");

	const videoIds: Array<string> = [];

	for (const item of playlistItems) {
		if (item.contentDetails && item.contentDetails.videoId) videoIds.push(item.contentDetails.videoId);
	}

	const videos: Array<youtube_v3.Schema$Video> = (await getYoutubeVideoList(videoIds));

	return videos;

}

export const getYoutubeVideo = (id: string) => {
	return youTube.videos.list({
		auth: api,
		part: ['contentDetails', 'id', 'snippet'],
		id: [id]
	})
}

export const getYoutubeVideoList = async (id: Array<string>): Promise<Array<youtube_v3.Schema$Video>> => {

	const res: youtube_v3.Schema$VideoListResponse = (await youTube.videos.list({
		auth: api,
		part: ['contentDetails', 'id', 'snippet'],
		id: id
	})).data;

	if (!res.items) throw new Error("Youtube video items are not defined!");

	return res.items;
}

export const getPlaylistById = async (id: string): Promise<youtube_v3.Schema$Playlist> => {

	const res: youtube_v3.Schema$PlaylistListResponse = (await youTube.playlists.list({
		auth: api,
		part: ['contentDetails', 'id', 'snippet'],
		id: [id]
	})).data

	if (!res.items || !res.items[0]) throw new Error("Failed to fetch a playlist");

	return res.items[0];

}
