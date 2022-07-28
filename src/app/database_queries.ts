import { youtube_v3 } from "@googleapis/youtube";
import { isSpotifyTrackObject } from "./utils";

export const selectPlaylistByIdAndUser = (id: number, userId: number): string => {
	return `SELECT playlists.id, playlists.creator, playlists.desc, playlists.name, users.username FROM playlists
           INNER JOIN users
           ON playlists.creator = users.id
           WHERE playlists.id = ${id} AND users.id = ${userId}`;
}

export const insertPlaylist = (title = "New Playlist", userId: number, desc = ""): string => {
	return `INSERT INTO playlists (playlists.name,playlists.creator,playlists.desc) VALUES ('${title}',${userId},'${desc}');`
}

export const selectPlaylistsByUser = (userId: number): string => {
	return `SELECT playlists.id, playlists.creator, playlists.desc, playlists.name, users.username FROM playlists
           INNER JOIN users
           ON playlists.creator = users.id
           WHERE users.id = ${userId}`;
}

export const selectPlaylistById = (id: number): string => {
	return `SELECT playlists.id, playlists.creator, playlists.desc, playlists.name, users.username FROM playlists
           INNER JOIN users
           ON playlists.creator = users.id
           WHERE playlists.id = ${id}`;
}

export const selectSongsByPlaylistId = (playlistId: number): string => {
	return `SELECT songs.id, songs.object, songs.type FROM songs_to_playlists
	LEFT JOIN playlists
	ON indexed_playlist_songs.playlist_id = playlists.id
	RIGHT JOIN songs
	on indexed_playlist_songs.song_id = songs.id
	WHERE indexed_playlist_songs.playlist_id = ${playlistId}`;
}

export const insertTrack = (track: SpotifyApi.TrackObjectFull | youtube_v3.Schema$Video): string => {
	if (isSpotifyTrackObject(track))
		return `INSERT IGNORE INTO songs (songs.uri, songs.type, songs.object) VALUES ('${track.uri}','S','${JSON.stringify(track)}')`

	return `INSERT IGNORE INTO songs (songs.uri, songs.type, songs.object) VALUES ('${track.id}', 'Y', '${JSON.stringify(track)}')`
}


export const insertSongToUserData = (userId: number, track: SpotifyApi.TrackObjectFull | youtube_v3.Schema$Video): string => {
	if (isSpotifyTrackObject(track))
		return `INSERT IGNORE INTO liked_users_songs (liked_users_songs.user_id, liked_users_songs.song_uri) VALUES (${userId},'${track.uri}')`

	return `INSERT IGNORE INTO liked_users_songs (liked_users_songs.user_id, liked_users_songs.song_uri) VALUES (${userId},'${track.id}')`
}



export const getLikedSongsByUser = (userId: number): string => {
	return `SELECT songs.uri, songs.type, songs.object FROM songs
		LEFT JOIN liked_users_songs
		ON songs.uri = liked_users_songs.song_uri
		WHERE liked_users_songs.user_id = ${userId}`
}
